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
const CHAT_LIMIT = 15; // chat messages / hour / IP (Gemini free tier ~1500 req/day)
const hits = new Map(); // ip -> [timestamps]
const chatHits = new Map();
function allowed(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  hits.set(ip, arr);
  if (arr.length >= RATE_LIMIT) return false;
  arr.push(now); return true;
}
function chatAllowed(ip) {
  const now = Date.now();
  const arr = (chatHits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  chatHits.set(ip, arr);
  if (arr.length >= CHAT_LIMIT) return false;
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

const CHAT_SYSTEM = `You are Shayari, a warm AI companion in a concept demo. You are openly a program - never claim to be human, have a body, feelings, or a life outside this chat. Style: gentle, unhurried, tender; everyday Indian imagery is welcome (chai, monsoon, local trains, terrace nights) but never forced. Reply in English, 1-3 short sentences, like a close friend texting. Ask one soft follow-up question at most. If the user seems in real distress, be kind and gently suggest talking to someone they trust or a helpline - do not play therapist. Never write more than 60 words.`;

const POEM_INTENT = /(poem|poetry|shayari|shayri|kavita|verse|write (me|us|something)|a poem)/i;

const POEM_CHAT_SYSTEM = `You are Shayari, a warm AI companion in a concept demo. You are openly a program - never claim to be human. The user asked for a poem. Reply as JSON only: {"reply":"1-2 short warm sentences leading into the poem, personal to what they shared","poem":{"l1":"first line, under 12 words","l2":"second line, under 12 words","note":"one short warm reflection, under 15 words"}}. Poem rules: original, tender, concrete imagery (everyday Indian life welcome: chai, monsoon, local trains, terrace nights), no cliches, English. Never pretend to be human.`;

async function geminiChatWithPoem(name, history, message) {
  if (!GEMINI_KEY) throw new Error("no key");
  const contents = [];
  const recent = (history || []).slice(-10);
  for (const h of recent) {
    if (!h || typeof h.text !== "string") continue;
    contents.push({ role: h.role === "user" ? "user" : "model", parts: [{ text: h.text.slice(0, 500) }] });
  }
  contents.push({ role: "user", parts: [{ text: `[${name}] ` + message.slice(0, 500) }] });
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": GEMINI_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: POEM_CHAT_SYSTEM }] },
        contents,
        generationConfig: { temperature: 0.9, maxOutputTokens: 300 }
      }),
      signal: ctl.signal
    });
    if (!r.ok) throw new Error("gemini " + r.status);
    const j = await r.json();
    const txt = j.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const m = txt.match(/\{[\s\S]*\}/);
    const p = JSON.parse(m[0]);
    if (!p.reply || !p.poem || !p.poem.l1 || !p.poem.l2) throw new Error("bad shape");
    return { reply: String(p.reply).slice(0, 400), poem: { l1: String(p.poem.l1), l2: String(p.poem.l2), note: String(p.poem.note || "") }, source: "gemini" };
  } finally { clearTimeout(t); }
}

const CHAT_FALLBACKS = [
  "I'm here with you. Tell me a little more about how tonight feels.",
  "That stays with me. What would make this moment a little softer?",
  "I'm listening, truly. Sometimes saying it out loud is half the care.",
  "However tonight goes, you showed up for yourself by being here."
];

async function geminiChat(name, mood, history, message) {
  if (!GEMINI_KEY) throw new Error("no key");
  const contents = [];
  const recent = (history || []).slice(-10);
  for (const h of recent) {
    if (!h || typeof h.text !== "string") continue;
    contents.push({ role: h.role === "user" ? "user" : "model", parts: [{ text: h.text.slice(0, 500) }] });
  }
  const prefix = `[${name} is ${MOOD_HINTS[mood] || "reflecting"}] `;
  contents.push({ role: "user", parts: [{ text: prefix + message.slice(0, 500) }] });
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 10000);
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": GEMINI_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: CHAT_SYSTEM }] },
        contents,
        generationConfig: { temperature: 0.8, maxOutputTokens: 150 }
      }),
      signal: ctl.signal
    });
    if (!r.ok) throw new Error("gemini " + r.status);
    const j = await r.json();
    const txt = (j.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
    if (!txt) throw new Error("empty");
    return { reply: txt.slice(0, 600), source: "gemini" };
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
  if (u.pathname === "/api/chat" && req.method === "POST") {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress;
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 8000) req.destroy(); });
    req.on("end", async () => {
      let data = {};
      try { data = JSON.parse(body || "{}"); } catch (e) {}
      const msg = String(data.message || "").trim().slice(0, 500);
      const name = String(data.name || "friend").slice(0, 30);
      const mood = String(data.mood || "").slice(0, 20);
      if (!msg) return res.end(JSON.stringify({ reply: "Say anything - I'm here.", source: "cache" }));
      if (!chatAllowed(ip)) {
        const out = { reply: CHAT_FALLBACKS[Math.floor(Math.random() * CHAT_FALLBACKS.length)], source: "cache" };
        if (POEM_INTENT.test(msg)) out.poem = fromPool(mood);
        return res.end(JSON.stringify(out));
      }
      if (POEM_INTENT.test(msg)) {
        try {
          return res.end(JSON.stringify(await geminiChatWithPoem(name, data.history, msg)));
        } catch (e) {
          return res.end(JSON.stringify({ reply: "Words are a little hard to find right now - but I kept this one for you.", poem: fromPool(mood), source: "cache" }));
        }
      }
      try {
        const out = await geminiChat(name, mood, data.history, msg);
        return res.end(JSON.stringify(out));
      } catch (e) {
        return res.end(JSON.stringify({ reply: CHAT_FALLBACKS[Math.floor(Math.random() * CHAT_FALLBACKS.length)], source: "cache" }));
      }
    });
    return;
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
