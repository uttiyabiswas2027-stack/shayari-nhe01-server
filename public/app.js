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
    ["onboarding", "home", "poem", "favs"].forEach((s) => $(s).classList.toggle("hidden", s !== id));
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
