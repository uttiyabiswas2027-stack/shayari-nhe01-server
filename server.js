/* Shayari NHE 01 - free-tier server: static app + /api/poem (Gemini, key server-side only).
   Traffic design: per-IP rate limit, per-mood poem pool, graceful fallback. */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const PUB = path.join(__dirname, "public");

/* ---- static fallback pool, mirrors public/data.js ---- */
const POEMS = require("./poems.json");
const pool = {}; // mood -> [ {l1,l2,note} ] starts with static, Gemini tops up
for (const m of Object.keys(POEMS)) pool[m] = POEMS[m].map(p => ({ ...p }));

/* ---- per-IP rate limit: 20 poem requests / hour ---- */
const RATE_LIMIT = 20, WINDOW_MS = 3600 * 1000;
const hits = new Map(); // ip -> [timestamps]
function allowed(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  hits.set(ip, arr);
  if (arr.length >= RATE_LIMIT) return false;
  arr.push(now); return true;
}

const MOOD_HINTS = {
  lonely: "feeling lonely in a new city, far from home",
  hopeful: "feeling hopeful and wanting gentle encouragement",
  missing: "missing someone dear who is far away",
  calm: "feeling calm and wanting to savour the quiet",
  celebrating: "feeling joyful and wanting to celebrate"
};

async function geminiPoem(mood, name, timeOfDay) {
  if (!GEMINI_KEY) throw new Error("no key");
  const prompt = `You are Shayari, a warm AI companion. Write an original two-line English poem for ${name}, who is ${MOOD_HINTS[mood] || "reflecting"} this ${timeOfDay}. Rules: exactly two lines, each under 12 words; tender, concrete imagery (Indian everyday life welcome: chai, monsoon, local trains, terrace nights); no cliches like "light at the end of the tunnel"; never pretend to be human. Then one short line (under 15 words) of warm reflection addressed to ${name}. Reply ONLY as JSON: {"l1":"...","l2":"...","note":"..."}`;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": GEMINI_KEY },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 200 } }),
      signal: ctl.signal
    });
    if (!r.ok) throw new Error("gemini " + r.status);
    const j = await r.json();
    const txt = j.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const m = txt.match(/\{[\s\S]*\}/);
    const p = JSON.parse(m[0]);
    if (!p.l1 || !p.l2 || !p.note) throw new Error("bad shape");
    return { l1: String(p.l1), l2: String(p.l2), note: String(p.note) };
  } finally { clearTimeout(t); }
}

function fromPool(mood) {
  const arr = pool[mood] || pool.calm;
  return arr[Math.floor(Math.random() * arr.length)];
}

function timeOfDay() {
  const h = new Date().getHours();
  if (h >= 23 || h < 5) return "late night";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };

http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/api/health") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ ok: true, gemini: !!GEMINI_KEY }));
  }
  if (u.pathname === "/api/poem") {
    const mood = u.searchParams.get("mood") || "calm";
    const name = (u.searchParams.get("name") || "friend").slice(0, 30);
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress;
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    if (!allowed(ip)) {
      return res.end(JSON.stringify({ ...fromPool(mood), source: "cache" }));
    }
    try {
      const p = await geminiPoem(mood, name, timeOfDay());
      pool[mood] = pool[mood] || [];
      if (pool[mood].length < 50) pool[mood].push(p);
      return res.end(JSON.stringify({ ...p, source: "gemini" }));
    } catch (e) {
      return res.end(JSON.stringify({ ...fromPool(mood), source: "cache" }));
    }
  }
  // static
  let fp = path.normalize(path.join(PUB, u.pathname === "/" ? "index.html" : u.pathname));
  if (!fp.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "content-type": MIME[path.extname(fp)] || "application/octet-stream" });
    res.end(data);
  });
}).listen(PORT, () => console.log("listening", PORT));
