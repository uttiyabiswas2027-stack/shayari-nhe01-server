(function () {
  const $ = (id) => document.getElementById(id);
  const store = {
    get() { try { return JSON.parse(localStorage.getItem("shayari-demo") || "{}"); } catch (e) { return {}; } },
    set(v) { localStorage.setItem("shayari-demo", JSON.stringify(v)); },
    clear() { localStorage.removeItem("shayari-demo"); }
  };

  let state = store.get();
  let currentMood = null;
  let currentPoem = null;

  function hourCheckin() {
    const h = new Date().getHours();
    if (h >= 23 || h < 5) return CHECKINS.lateNight;
    if (h >= 5 && h < 12) return CHECKINS.morning;
    if (h >= 12 && h < 17) return CHECKINS.afternoon;
    return CHECKINS.evening;
  }

  function show(id) {
    ["onboarding", "home", "poem", "favs", "chat"].forEach((s) => $(s).classList.toggle("hidden", s !== id));
  }

  function greet() {
    const visits = state.visits || 0;
    const name = state.name;
    let g = "Hello, " + name + ".";
    if (visits > 1) g = "Welcome back, " + name + ". I remembered you.";
    $("greeting").textContent = g;
    let c = hourCheckin();
    if (state.lastMood && visits > 1) {
      c += " Last time you were feeling " + SHAYARI[state.lastMood].label + ".";
    }
    $("checkin").textContent = c;
    $("favLinkWrap").classList.toggle("hidden", !(state.favs && state.favs.length));
  }

  function buildMoods() {
    const wrap = $("moods");
    wrap.innerHTML = "";
    Object.keys(SHAYARI).forEach((k) => {
      const b = document.createElement("button");
      b.innerHTML = SHAYARI[k].label + '<span class="en">' + SHAYARI[k].hint + "</span>";
      b.onclick = () => pickMood(k);
      wrap.appendChild(b);
    });
  }

  function pickMood(k) {
    currentMood = k;
    state.lastMood = k;
    store.set(state);
    show("poem");
    renderPoem();
  }

  function localPoem() {
    const arr = SHAYARI[currentMood].lines;
    return { ...arr[Math.floor(Math.random() * arr.length)], source: "notebook" };
  }

  async function fetchPoem() {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 15000); // cold-start tolerant
    try {
      const r = await fetch("/api/poem?mood=" + encodeURIComponent(currentMood) +
        "&name=" + encodeURIComponent(state.name || "friend"), { signal: ctl.signal });
      if (!r.ok) throw new Error("api " + r.status);
      const p = await r.json();
      if (!p.l1 || !p.l2) throw new Error("bad");
      return p;
    } finally { clearTimeout(t); }
  }

  async function renderPoem() {
    const block = $("poemBlock"), think = $("thinking");
    block.classList.add("fading");
    think.classList.remove("hidden");
    let p;
    try { p = await fetchPoem(); }
    catch (e) { p = localPoem(); }
    if (!p.note) p.note = "";
    currentPoem = p;
    $("poemMood").textContent = SHAYARI[currentMood].label + " - for " + state.name;
    $("line1").textContent = p.l1;
    $("line2").textContent = p.l2;
    $("note").textContent = p.note;
    $("srcBadge").textContent = p.source === "gemini" ? "written for you, just now" : "from her notebook";
    state.poemCount = (state.poemCount || 0) + 1;
    store.set(state);
    $("memoryNote").textContent =
      "She remembers (only in this browser): " + state.name + " - visit " + state.visits +
      " - " + state.poemCount + " poems shared - last mood: " + SHAYARI[state.lastMood].label + ".";
    think.classList.add("hidden");
    block.classList.remove("fading");
  }

  function renderFavs() {
    const list = $("favList");
    list.innerHTML = "";
    (state.favs || []).slice().reverse().forEach((f) => {
      const d = document.createElement("div");
      d.className = "fav";
      d.innerHTML = '<p class="poemline">' + f.l1 + "</p><p class='poemline'>" + f.l2 + "</p>" +
        (f.note ? '<p class="note">' + f.note + "</p>" : "") +
        '<p class="when">' + f.mood + " - kept on " + f.when + "</p>";
      list.appendChild(d);
    });
  }

  /* ---- chat ---- */
  function chatHistory() { return (state.chat || []).slice(-10); }

  function addChatBubble(who, text) {
    const log = $("chatLog");
    const d = document.createElement("div");
    d.className = "bubble " + who;
    d.textContent = text;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  }

  function renderChat() {
    const log = $("chatLog");
    log.innerHTML = "";
    (state.chat || []).forEach((m) => addChatBubble(m.role === "user" ? "me" : "her", m.text));
    if (!(state.chat || []).length) {
      addChatBubble("her", "Hi " + state.name + ". I'm here - how is your heart tonight?");
    }
  }

  async function sendChat() {
    const inp = $("chatInput");
    const msg = inp.value.trim();
    if (!msg) return;
    inp.value = "";
    state.chat = state.chat || [];
    state.chat.push({ role: "user", text: msg });
    store.set(state);
    addChatBubble("me", msg);
    const thinking = document.createElement("div");
    thinking.className = "bubble her faint";
    thinking.textContent = "...";
    $("chatLog").appendChild(thinking);
    $("chatLog").scrollTop = $("chatLog").scrollHeight;
    let reply = "I'm here with you. Tell me more?", src = "notebook";
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 20000);
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: msg, name: state.name || "friend", mood: state.lastMood || "", history: chatHistory() }),
        signal: ctl.signal
      });
      clearTimeout(t);
      if (r.ok) {
        const j = await r.json();
        if (j.reply) { reply = j.reply; src = j.source === "gemini" ? "gemini" : "notebook"; }
      }
    } catch (e) {}
    thinking.remove();
    addChatBubble("her", reply);
    state.chat.push({ role: "model", text: reply });
    if (state.chat.length > 40) state.chat = state.chat.slice(-40);
    store.set(state);
  }

  $("chatLink").onclick = () => { renderChat(); show("chat"); };
  $("chatSend").onclick = () => sendChat();
  $("chatInput").addEventListener("keydown", (e) => { if (e.key === "Enter") sendChat(); });
  $("chatBack").onclick = () => { greet(); show("home"); };

  $("startBtn").onclick = () => {
    const name = $("nameInput").value.trim();
    if (!name) { $("nameInput").focus(); return; }
    state.name = name;
    state.visits = 1;
    store.set(state);
    greet(); show("home");
  };
  $("nameInput").addEventListener("keydown", (e) => { if (e.key === "Enter") $("startBtn").click(); });
  $("moreBtn").onclick = () => renderPoem();
  $("keepBtn").onclick = () => {
    if (!currentPoem) return;
    state.favs = state.favs || [];
    state.favs.push({ ...currentPoem, mood: currentMood, when: new Date().toLocaleDateString() });
    store.set(state);
    $("keepBtn").textContent = "kept";
    setTimeout(() => { $("keepBtn").textContent = "keep this one"; }, 1200);
  };
  $("moodBtn").onclick = () => { greet(); show("home"); };
  $("favLink").onclick = () => { renderFavs(); show("favs"); };
  $("favBack").onclick = () => { greet(); show("home"); };
  $("wipeBtn").onclick = () => { store.clear(); state = {}; location.reload(); };

  buildMoods();
  if (state.name) {
    state.visits = (state.visits || 0) + 1;
    store.set(state);
    greet(); show("home");
  } else {
    show("onboarding");
  }
})();
