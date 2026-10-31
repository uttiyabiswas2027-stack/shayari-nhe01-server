(function () {
  const $ = (id) => document.getElementById(id);
  const store = {
    get() { try { return JSON.parse(localStorage.getItem("shayari-demo") || "{}"); } catch (e) { return {}; } },
    set(v) { localStorage.setItem("shayari-demo", JSON.stringify(v)); },
    clear() { localStorage.removeItem("shayari-demo"); }
  };

  let state = store.get();
  let awaitingName = !state.name;

  function show(id) {
    ["chat", "favs"].forEach((s) => $(s).classList.toggle("hidden", s !== id));
    $("about").classList.toggle("hidden", id === "favs" ? false : false);
  }

  function saveChat() {
    if (state.chat.length > 60) state.chat = state.chat.slice(-60);
    store.set(state);
  }

  function addBubble(who, text) {
    const log = $("chatLog");
    const d = document.createElement("div");
    d.className = "bubble " + who;
    d.textContent = text;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }

  function addPoemCard(poem, idx) {
    const log = $("chatLog");
    const d = document.createElement("div");
    d.className = "bubble her poemcard";
    const l1 = document.createElement("p"); l1.className = "poemline"; l1.textContent = poem.l1;
    const l2 = document.createElement("p"); l2.className = "poemline"; l2.textContent = poem.l2;
    d.appendChild(l1); d.appendChild(l2);
    if (poem.note) { const n = document.createElement("p"); n.className = "note"; n.textContent = poem.note; d.appendChild(n); }
    const meta = document.createElement("p"); meta.className = "badge";
    meta.textContent = poem.source === "gemini" ? "written for you, just now" : "from her notebook";
    d.appendChild(meta);
    const keep = document.createElement("button");
    keep.className = "ghost small"; keep.textContent = "keep this one";
    keep.onclick = () => {
      state.favs = state.favs || [];
      state.favs.push({ ...poem, when: new Date().toLocaleDateString() });
      store.set(state);
      keep.textContent = "kept"; keep.disabled = true;
      $("favLink").classList.remove("hidden");
    };
    d.appendChild(keep);
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  }

  function renderAll() {
    const log = $("chatLog");
    log.innerHTML = "";
    (state.chat || []).forEach((m) => {
      if (m.poem) addPoemCard(m.poem);
      else addBubble(m.role === "user" ? "me" : "her", m.text);
    });
    log.scrollTop = log.scrollHeight;
  }

  function herGreeting() {
    const visits = state.visits || 0;
    if (visits > 1) {
      return "Welcome back, " + state.name + ". I remembered you. How is tonight treating you?";
    }
    return "Hi " + state.name + ". I'm here - how is your heart tonight?";
  }

  function boot() {
    state.chat = state.chat || [];
    if (!state.chat.length) {
      if (awaitingName) {
        state.chat.push({ role: "model", text: "Hi. I'm Shayari - a companion who remembers. I'm a program, and I'll never pretend otherwise. What should I call you?" });
      } else {
        state.chat.push({ role: "model", text: herGreeting() });
      }
      store.set(state);
    }
    renderAll();
    $("chatTitle").textContent = state.name ? "Shayari - with " + state.name : "Shayari";
    $("favLink").classList.toggle("hidden", !(state.favs && state.favs.length));
  }

  function localFallbackReply(msg) {
    const pool = [
      "I'm here with you. Tell me a little more about how tonight feels.",
      "That stays with me. What would make this moment a little softer?",
      "I'm listening, truly. Sometimes saying it out loud is half the care."
    ];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function localPoem() {
    const moods = Object.keys(SHAYARI);
    const arr = SHAYARI[moods[Math.floor(Math.random() * moods.length)]].lines;
    return { ...arr[Math.floor(Math.random() * arr.length)], source: "notebook" };
  }

  async function sendChat(text) {
    const msg = (text !== undefined ? text : $("chatInput").value).trim();
    if (!msg) return;
    $("chatInput").value = "";

    if (awaitingName) {
      const name = msg.split(/\s+/)[0].slice(0, 30);
      state.name = name;
      state.visits = 1;
      awaitingName = false;
      state.chat.push({ role: "user", text: msg });
      addBubble("me", msg);
      const hello = "Good to meet you, " + name + ". I'll remember that. So - how is tonight treating you?";
      state.chat.push({ role: "model", text: hello });
      saveChat();
      addBubble("her", hello);
      $("chatTitle").textContent = "Shayari - with " + name;
      return;
    }

    state.chat.push({ role: "user", text: msg });
    saveChat();
    addBubble("me", msg);

    const thinking = addBubble("her faint", "...");
    const wakeTimer = setTimeout(() => { thinking.textContent = "she is waking up, one moment..."; }, 8000);

    let out = null;
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 45000); // cold-start tolerant
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: msg,
          name: state.name || "friend",
          mood: state.lastMood || "",
          history: (state.chat || []).filter(m => !m.poem).slice(-10)
        }),
        signal: ctl.signal
      });
      clearTimeout(t);
      if (r.ok) {
        const j = await r.json();
        if (j.reply) out = j;
      }
    } catch (e) {}
    clearTimeout(wakeTimer);
    thinking.remove();

    if (!out) {
      out = { reply: localFallbackReply(msg), source: "notebook" };
      if (/(poem|shayari|shayri|kavita|verse|write)/i.test(msg)) out.poem = localPoem();
    }

    if (out.poem) { out.poem.source = out.source === "gemini" ? "gemini" : "notebook"; }
    state.chat.push({ role: "model", text: out.reply });
    addBubble("her", out.reply);
    if (out.poem) {
      state.chat.push({ role: "model", poem: out.poem, text: "" });
      state.poemCount = (state.poemCount || 0) + 1;
      addPoemCard(out.poem);
    }
    saveChat();
  }

  function renderFavs() {
    const list = $("favList");
    list.innerHTML = "";
    (state.favs || []).slice().reverse().forEach((f) => {
      const d = document.createElement("div");
      d.className = "fav";
      d.innerHTML = '<p class="poemline">' + f.l1 + "</p><p class='poemline'>" + f.l2 + "</p>" +
        (f.note ? '<p class="note">' + f.note + "</p>" : "") +
        '<p class="when">kept on ' + f.when + "</p>";
      list.appendChild(d);
    });
  }

  $("chatSend").onclick = () => sendChat();
  $("chatInput").addEventListener("keydown", (e) => { if (e.key === "Enter") sendChat(); });
  $("poemChip").onclick = () => sendChat("Will you write me a poem for tonight?");
  $("favLink").onclick = () => { renderFavs(); show("favs"); };
  $("favBack").onclick = () => { show("chat"); renderAll(); };
  $("wipeBtn").onclick = () => { store.clear(); state = {}; awaitingName = true; location.reload(); };

  if (state.name) {
    state.visits = (state.visits || 0) + 1;
    store.set(state);
  }
  show("chat");
  boot();
})();
