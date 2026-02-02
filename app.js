/* ============================
   CUT TOO SOON — script.js
   DOM-only, no canvas, no BS.
   Works with a big library (200+ movies, 150+ shows) once you drop images + data.
   ============================ */

/*
  IMPORTANT:
  Your index.html currently loads `app.js`.
  If you want to use this file name, either:
   - rename this file to app.js
   OR
   - change the script tag to: <script src="script.js"></script>
*/

(() => {
  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);

  const livesEl = $("lives");
  const streakEl = $("streak");
  const bestEl = $("best");

  const roundEl = $("round");
  const flashMsEl = $("flashMs");
  const spikeTagEl = $("spikeTag");

  const frameEl = $("frame");
  const frameOverlayEl = $("frameOverlay");
  const btnStart = $("btnStart");

  const inputZoneEl = $("inputZone");
  const answerEl = $("answer");
  const btnSubmit = $("btnSubmit");
  const btnSkip = $("btnSkip");

  const feedbackEl = $("feedback");
  const feedbackMsgEl = $("feedbackMsg");
  const feedbackMetaEl = $("feedbackMeta");

  const btnNext = $("btnNext");
  const btnReveal = $("btnReveal");
  const btnPause = $("btnPause");

  const filterAll = $("filterAll");
  const filterMovies = $("filterMovies");
  const filterShows = $("filterShows");
  const regionChips = $("regionChips");

  const difficultyEl = $("difficulty");
  const difficultyLabelEl = $("difficultyLabel");
  const spikeRoundsEl = $("spikeRounds");
  const poolCountEl = $("poolCount");

  const statCorrectEl = $("statCorrect");
  const statCloseEl = $("statClose");
  const statWrongEl = $("statWrong");
  const statSkippedEl = $("statSkipped");

  const lastTitleEl = $("lastTitle");
  const lastSubEl = $("lastSub");

  const btnResetRun = $("btnResetRun");
  const btnWipeSave = $("btnWipeSave");

  // Modals
  const howModal = $("howModal");
  const settingsModal = $("settingsModal");

  const btnHow = $("btnHow");
  const btnSettings = $("btnSettings");
  const howClose = $("howClose");
  const howOk = $("howOk");
  const settingsClose = $("settingsClose");
  const settingsCancel = $("settingsCancel");
  const settingsSave = $("settingsSave");

  const lenientBtn = $("lenient");
  const strictBtn = $("strict");
  const soundEl = $("sound");
  const flashCutBtn = $("flashCut");
  const flashFlickerBtn = $("flashFlicker");

  // ---------- SAVE KEYS ----------
  const SAVE_KEY = "cut-too-soon:v1";

  // ---------- GAME STATE ----------
  const state = {
    // run
    lives: 3,
    streak: 0,
    best: 0,
    round: 1,
    paused: false,
    revealed: false,

    // stats
    correct: 0,
    close: 0,
    wrong: 0,
    skipped: 0,

    // config
    filterType: "ALL",       // ALL | MOVIE | SHOW
    region: "ALL",           // "ALL" or country code like "DE"
    difficulty: 3,           // 1..5
    spikeRounds: true,       // boolean
    leniency: "LENIENT",     // LENIENT | STRICT
    flashStyle: "CUT",       // CUT | FLICKER
    sound: true,             // boolean (stub)

    // library
    library: [],             // all items
    pool: [],                // filtered items
    used: new Set(),         // IDs used this run
    current: null,           // current item
    currentFlashMs: 0,
    currentIsSpike: false,

    // phase
    phase: "IDLE",           // IDLE | FLASHING | ANSWER | FEEDBACK
  };

  // ---------- LIBRARY FORMAT ----------
  /*
    Each item should look like:

    {
      id: "tt1375666",              // unique (make your own)
      type: "MOVIE" | "SHOW",
      region: "US" | "DE" | "FR" | ...,
      title: "Inception",
      aliases: ["Inception (2010)"], // optional
      img: "stills/movies/inception_01.jpg" // local path
    }

    Drop your images in /stills/... and make a library.json.
    If library.json exists, this script will load it automatically.
  */

  // A tiny default library so the game runs immediately.
  // Replace this with a big library.json (200+ movies, 150+ shows) later.
  const DEFAULT_LIBRARY = [
    {
      id: "m_inception",
      type: "MOVIE",
      region: "US",
      title: "Inception",
      aliases: ["inception (2010)"],
      img: "stills/movies/inception_01.jpg",
    },
    {
      id: "m_interstellar",
      type: "MOVIE",
      region: "US",
      title: "Interstellar",
      aliases: ["interstellar (2014)"],
      img: "stills/movies/interstellar_01.jpg",
    },
    {
      id: "s_dark",
      type: "SHOW",
      region: "DE",
      title: "Dark",
      aliases: ["dark (tv)"],
      img: "stills/shows/dark_01.jpg",
    },
    {
      id: "s_osmosis",
      type: "SHOW",
      region: "FR",
      title: "Osmosis",
      aliases: ["osmosis (2019)"],
      img: "stills/shows/osmosis_01.jpg",
    },
  ];

  // ---------- INIT ----------
  boot().catch(console.error);

  async function boot() {
    loadSave();
    wireUI();
    setDifficultyLabel();
    await loadLibrary();
    rebuildRegionChips();
    rebuildPool();
    renderHUD();
    showIdleOverlay();
  }

  async function loadLibrary() {
    // Try to load library.json; if it fails, use defaults.
    // Put library.json in the same folder as index.html.
    try {
      const res = await fetch("library.json", { cache: "no-store" });
      if (!res.ok) throw new Error("no library.json");
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) throw new Error("library.json empty");
      state.library = data;
    } catch {
      state.library = DEFAULT_LIBRARY;
    }
    poolCountEl.textContent = String(state.library.length);
  }

  function wireUI() {
    // Filter type buttons
    filterAll.addEventListener("click", () => setTypeFilter("ALL"));
    filterMovies.addEventListener("click", () => setTypeFilter("MOVIE"));
    filterShows.addEventListener("click", () => setTypeFilter("SHOW"));

    // Region chips (delegated)
    regionChips.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-region]");
      if (!btn) return;
      setRegion(btn.dataset.region);
    });

    // Difficulty
    difficultyEl.addEventListener("input", () => {
      state.difficulty = Number(difficultyEl.value);
      setDifficultyLabel();
      save();
      if (state.phase === "IDLE") updateFlashMsPreview();
    });

    // Spike rounds
    spikeRoundsEl.addEventListener("change", () => {
      state.spikeRounds = !!spikeRoundsEl.checked;
      save();
    });

    // Start / submit / skip / next / reveal / pause
    btnStart.addEventListener("click", startOrNext);
    btnSubmit.addEventListener("click", submitAnswer);
    btnSkip.addEventListener("click", skipRound);
    btnNext.addEventListener("click", nextRound);
    btnReveal.addEventListener("click", revealAnswer);
    btnPause.addEventListener("click", togglePause);

    // Enter submits
    answerEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submitAnswer();
    });

    // Keyboard shortcuts
    window.addEventListener("keydown", (e) => {
      if (state.paused) {
        if (e.key === "Escape") togglePause();
        return;
      }

      if (e.key === "Escape") togglePause();

      if (e.key === " " || e.code === "Space") {
        // prevent scrolling
        e.preventDefault();
        startOrNext();
      }
    });

    // Reset run + wipe save
    btnResetRun.addEventListener("click", () => resetRun(false));
    btnWipeSave.addEventListener("click", () => resetRun(true));

    // How modal
    btnHow.addEventListener("click", () => howModal.showModal());
    howClose.addEventListener("click", () => howModal.close());
    howOk.addEventListener("click", () => howModal.close());

    // Settings modal
    btnSettings.addEventListener("click", () => settingsModal.showModal());
    settingsClose.addEventListener("click", () => settingsModal.close());
    settingsCancel.addEventListener("click", () => settingsModal.close());
    settingsSave.addEventListener("click", () => {
      // everything saves live, but this feels good
      save();
      settingsModal.close();
    });

    // Settings toggles
    lenientBtn.addEventListener("click", () => setLeniency("LENIENT"));
    strictBtn.addEventListener("click", () => setLeniency("STRICT"));
    soundEl.addEventListener("change", () => { state.sound = !!soundEl.checked; save(); });

    flashCutBtn.addEventListener("click", () => setFlashStyle("CUT"));
    flashFlickerBtn.addEventListener("click", () => setFlashStyle("FLICKER"));

    // Sync UI from loaded save
    difficultyEl.value = String(state.difficulty);
    spikeRoundsEl.checked = !!state.spikeRounds;
    soundEl.checked = !!state.sound;
    setTypeFilter(state.filterType, true);
    setLeniency(state.leniency, true);
    setFlashStyle(state.flashStyle, true);
  }

  // ---------- FILTERS ----------
  function setTypeFilter(type, silent = false) {
    state.filterType = type;
    // UI
    filterAll.classList.toggle("is-on", type === "ALL");
    filterMovies.classList.toggle("is-on", type === "MOVIE");
    filterShows.classList.toggle("is-on", type === "SHOW");

    if (!silent) {
      rebuildPool();
      save();
    }
  }

  function setRegion(code) {
    state.region = code;

    [...regionChips.querySelectorAll("button[data-region]")].forEach((b) => {
      b.classList.toggle("is-on", b.dataset.region === code);
    });

    rebuildPool();
    save();
  }

  function rebuildRegionChips() {
    // Build chips from library regions + always ALL
    const regions = new Set(state.library.map((x) => x.region).filter(Boolean));
    const ordered = ["ALL", ...Array.from(regions).sort()];

    regionChips.innerHTML = ordered
      .map((r) => {
        const on = (r === state.region) || (r === "ALL" && state.region === "ALL");
        return `<button class="chip ${on ? "is-on" : ""}" type="button" data-region="${escapeHtml(r)}">${escapeHtml(r)}</button>`;
      })
      .join("");

    // If current region no longer exists, force ALL
    if (state.region !== "ALL" && !regions.has(state.region)) {
      state.region = "ALL";
      [...regionChips.querySelectorAll("button[data-region]")].forEach((b) => {
        b.classList.toggle("is-on", b.dataset.region === "ALL");
      });
    }
  }

  function rebuildPool() {
    const type = state.filterType;
    const region = state.region;

    state.pool = state.library.filter((item) => {
      if (type !== "ALL" && item.type !== type) return false;
      if (region !== "ALL" && item.region !== region) return false;
      return true;
    });

    poolCountEl.textContent = String(state.pool.length);

    // If pool is empty, block gameplay
    if (state.pool.length === 0) {
      showIdleOverlay("No items match your filters.");
      disableAnswerControls(true);
    } else {
      showIdleOverlay(); // default "Ready?"
      disableAnswerControls(true);
    }

    updateFlashMsPreview();
  }

  // ---------- RUN CONTROL ----------
  function startOrNext() {
    if (state.pool.length === 0) return;
    if (state.phase === "IDLE") return startRound();
    if (state.phase === "FEEDBACK") return nextRound();
    // If you're mid-round, ignore space spam
  }

  function startRound() {
    if (state.lives <= 0) return gameOver();

    state.revealed = false;
    state.phase = "FLASHING";
    feedbackEl.hidden = true;
    btnNext.disabled = true;
    btnReveal.disabled = true;

    const item = pickNextItem();
    state.current = item;

    // Decide timing + spike
    const baseMs = baseFlashMsFromDifficulty(state.difficulty);
    const isSpike = state.spikeRounds && Math.random() < spikeChanceFromDifficulty(state.difficulty);
    const ms = isSpike ? Math.max(120, Math.floor(baseMs * randomBetween(0.50, 0.72))) : baseMs;

    state.currentFlashMs = ms;
    state.currentIsSpike = isSpike;

    // UI updates
    spikeTagEl.hidden = !isSpike;
    roundEl.textContent = String(state.round);
    flashMsEl.textContent = `${ms} ms`;

    // Show frame
    showFrame(item.img);

    // Flash style
    frameEl.classList.toggle("is-flicker", state.flashStyle === "FLICKER");

    // Animate little pop
    frameEl.classList.add("is-flashing");
    setTimeout(() => frameEl.classList.remove("is-flashing"), 180);

    // Hide overlay + start button while flashing
    frameOverlayEl.style.display = "none";
    btnStart.style.display = "none";

    // Disable input during flash
    disableAnswerControls(true);

    // Cut away after time
    setTimeout(() => {
      if (state.paused) return; // if paused mid-flash, do nothing (pause logic will handle)
      cutFrameToBlack();
      startAnswerPhase();
    }, ms);
  }

  function startAnswerPhase() {
    state.phase = "ANSWER";
    answerEl.value = "";
    disableAnswerControls(false);
    answerEl.focus();
    // keep reveal button disabled until after submit/skip
  }

  function submitAnswer() {
    if (state.phase !== "ANSWER") return;
    if (!state.current) return;

    const guessRaw = answerEl.value.trim();
    if (!guessRaw) return;

    const result = judgeGuess(guessRaw, state.current);

    if (result.kind === "CORRECT") {
      state.correct++;
      state.streak++;
      state.best = Math.max(state.best, state.streak);
      showFeedback("Correct.", result.meta, "correct");
      nextButtonsAfterFeedback();
    } else if (result.kind === "CLOSE") {
      state.close++;
      state.streak++; // close keeps streak alive (your rule)
      state.best = Math.max(state.best, state.streak);
      showFeedback("Close. Streak lives.", result.meta, "close");
      nextButtonsAfterFeedback();
    } else {
      state.wrong++;
      state.lives--;
      state.streak = 0;
      showFeedback("Wrong.", result.meta, "wrong");
      nextButtonsAfterFeedback();
      if (state.lives <= 0) {
        // Let them see the feedback first, then game over on Next
      }
    }

    lastTitleEl.textContent = state.current.title;
    lastSubEl.textContent = `${state.current.type} • ${state.current.region}`;

    renderHUD();
    save();

    // Lock input until next
    disableAnswerControls(true);
    state.phase = "FEEDBACK";
  }

  function skipRound() {
    if (state.phase !== "ANSWER") return;
    state.skipped++;
    state.streak = 0; // skip breaks streak
    showFeedback("Skipped.", `It was: ${state.current?.title ?? "—"}`, "wrong");

    lastTitleEl.textContent = state.current?.title ?? "—";
    lastSubEl.textContent = `${state.current?.type ?? "—"} • ${state.current?.region ?? "—"}`;

    renderHUD();
    save();

    disableAnswerControls(true);
    nextButtonsAfterFeedback();
    state.phase = "FEEDBACK";
  }

  function nextRound() {
    if (state.phase !== "FEEDBACK") return;

    if (state.lives <= 0) return gameOver();

    state.round++;
    state.current = null;
    state.currentIsSpike = false;
    state.currentFlashMs = 0;

    // Reset visuals
    feedbackEl.hidden = true;
    btnNext.disabled = true;
    btnReveal.disabled = true;
    spikeTagEl.hidden = true;

    showIdleOverlay("Ready?");
    state.phase = "IDLE";
  }

  function revealAnswer() {
    // Reveal is allowed after feedback OR if you want to allow during answer.
    // Right now: only after you already got feedback (or skipped).
    if (state.phase !== "FEEDBACK") return;
    if (!state.current) return;

    state.revealed = true;
    showFeedback(feedbackMsgEl.textContent, `Answer: ${state.current.title}`, currentFeedbackKind());
    btnReveal.disabled = true;
  }

  function togglePause() {
    state.paused = !state.paused;

    if (state.paused) {
      // Freeze UI
      btnPause.textContent = "Unpause";
      disableAnswerControls(true);

      // Put overlay back so it feels dramatic
      frameOverlayEl.style.display = "grid";
      frameOverlayEl.querySelector(".frame__title")?.replaceChildren(document.createTextNode("Paused"));
      const sub = frameOverlayEl.querySelector(".frame__sub");
      if (sub) sub.textContent = "Press Esc to resume.";
      btnStart.style.display = "none";
    } else {
      btnPause.textContent = "Pause";
      // If we paused during flashing, we won't re-run the timer; simplest: restart round
      if (state.phase === "FLASHING") {
        // mean but fair: you paused mid-flash → you restart that round
        showIdleOverlay("Paused mid-flash. Restarting round.");
        state.phase = "IDLE";
      } else if (state.phase === "ANSWER") {
        // back to answer
        frameOverlayEl.style.display = "none";
        disableAnswerControls(false);
        answerEl.focus();
      } else if (state.phase === "FEEDBACK") {
        frameOverlayEl.style.display = "none";
      } else {
        showIdleOverlay();
      }
    }
  }

  function gameOver() {
    // Big end screen (still inside your current layout)
    state.phase = "IDLE";
    showIdleOverlay(`Game over. Best: ${state.best}. Hit Start to run it back.`);
    btnStart.style.display = "block";
    disableAnswerControls(true);
    spikeTagEl.hidden = true;

    // Reset run but keep best + save
    // (If you want “continue”, remove this)
    state.lives = 3;
    state.streak = 0;
    state.round = 1;
    state.used.clear();
    state.correct = 0;
    state.close = 0;
    state.wrong = 0;
    state.skipped = 0;

    renderHUD();
    save();
  }

  function resetRun(wipeSave) {
    state.lives = 3;
    state.streak = 0;
    state.round = 1;
    state.used.clear();
    state.current = null;
    state.phase = "IDLE";
    state.correct = 0;
    state.close = 0;
    state.wrong = 0;
    state.skipped = 0;
    state.paused = false;

    // keep best unless wiping
    if (wipeSave) {
      state.best = 0;
      localStorage.removeItem(SAVE_KEY);
    } else {
      save();
    }

    renderHUD();
    showIdleOverlay("Reset. Start when ready.");
    disableAnswerControls(true);
    feedbackEl.hidden = true;
    spikeTagEl.hidden = true;
    btnNext.disabled = true;
    btnReveal.disabled = true;
  }

  // ---------- PICKING ----------
  function pickNextItem() {
    // Basic anti-repeat: avoid items used this run until pool exhausted.
    // If pool is huge, this is good enough.
    const pool = state.pool;

    if (state.used.size >= pool.length) {
      // exhausted → reset used for this filter set
      state.used.clear();
    }

    let tries = 0;
    while (tries < 1000) {
      const idx = Math.floor(Math.random() * pool.length);
      const item = pool[idx];
      if (!state.used.has(item.id)) {
        state.used.add(item.id);
        return item;
      }
      tries++;
    }

    // fallback
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ---------- JUDGING (partial credit is your vibe) ----------
  function judgeGuess(guessRaw, item) {
    const guess = normalizeTitle(guessRaw);
    const title = normalizeTitle(item.title);

    // Exact match (or alias exact)
    if (guess === title) return { kind: "CORRECT", meta: "Exact." };

    if (Array.isArray(item.aliases)) {
      for (const a of item.aliases) {
        if (guess === normalizeTitle(a)) return { kind: "CORRECT", meta: "Alias accepted." };
      }
    }

    // Similarity checks
    const simTitle = similarity(guess, title);
    let bestAliasSim = 0;

    if (Array.isArray(item.aliases)) {
      for (const a of item.aliases) {
        bestAliasSim = Math.max(bestAliasSim, similarity(guess, normalizeTitle(a)));
      }
    }

    const sim = Math.max(simTitle, bestAliasSim);

    // Thresholds
    const strict = state.leniency === "STRICT";
    const closeThreshold = strict ? 0.82 : 0.74;
    const correctThreshold = strict ? 0.92 : 0.88;

    // If it’s REALLY close, call it correct (this feels good)
    if (sim >= correctThreshold) {
      return { kind: "CORRECT", meta: "Close enough." };
    }

    // Partial credit
    if (sim >= closeThreshold) {
      return { kind: "CLOSE", meta: `Almost. (${Math.round(sim * 100)}%)` };
    }

    // Extra partial credit: franchise-ish match (one contains the other)
    // Example: guess "dark" vs "dark season 1" etc.
    if (containsLoose(guess, title) || containsLoose(title, guess)) {
      return { kind: "CLOSE", meta: "Right idea. Incomplete title." };
    }

    return { kind: "WRONG", meta: `It was: ${item.title}` };
  }

  // ---------- VISUALS ----------
  function showFrame(imgPath) {
    // Use background image for “poster-like” fill
    frameEl.style.backgroundImage = `url("${imgPath}")`;
    frameEl.style.backgroundSize = "cover";
    frameEl.style.backgroundPosition = "center";
  }

  function cutFrameToBlack() {
    // Hard cut: remove image immediately
    frameEl.style.backgroundImage = "none";
    frameOverlayEl.style.display = "none";
  }

  function showIdleOverlay(message = "Ready?") {
    // Show overlay with a message + start hint.
    frameOverlayEl.style.display = "grid";

    const titleEl = frameOverlayEl.querySelector(".frame__title");
    const subEl = frameOverlayEl.querySelector(".frame__sub");

    if (titleEl) titleEl.textContent = message;
    if (subEl) subEl.textContent = "Hit Space or click Start.";

    btnStart.style.display = "block";
    btnStart.disabled = false;

    // preview flash time
    updateFlashMsPreview();

    // clear frame
    frameEl.style.backgroundImage = "none";
    frameEl.classList.remove("is-flicker");
  }

  function showFeedback(msg, meta, kind) {
    feedbackEl.hidden = false;
    feedbackMsgEl.textContent = msg;
    feedbackMetaEl.textContent = meta;

    feedbackEl.classList.remove("is-correct", "is-close", "is-wrong");
    if (kind === "correct") feedbackEl.classList.add("is-correct");
    if (kind === "close") feedbackEl.classList.add("is-close");
    if (kind === "wrong") feedbackEl.classList.add("is-wrong");

    // Enable reveal after feedback (so they can peek)
    btnReveal.disabled = false;
  }

  function currentFeedbackKind() {
    if (feedbackEl.classList.contains("is-correct")) return "correct";
    if (feedbackEl.classList.contains("is-close")) return "close";
    return "wrong";
  }

  function nextButtonsAfterFeedback() {
    btnNext.disabled = false;
    btnReveal.disabled = false;
  }

  function disableAnswerControls(disabled) {
    answerEl.disabled = disabled;
    btnSubmit.disabled = disabled;
    btnSkip.disabled = disabled;
  }

  function renderHUD() {
    // lives display
    livesEl.textContent = "●".repeat(state.lives) + "○".repeat(Math.max(0, 3 - state.lives));
    streakEl.textContent = String(state.streak);
    bestEl.textContent = String(state.best);

    statCorrectEl.textContent = String(state.correct);
    statCloseEl.textContent = String(state.close);
    statWrongEl.textContent = String(state.wrong);
    statSkippedEl.textContent = String(state.skipped);

    roundEl.textContent = String(state.round);
  }

  function setDifficultyLabel() {
    const v = Number(difficultyEl.value);
    state.difficulty = v;

    const label = (v === 1) ? "Chill"
      : (v === 2) ? "Spicy"
      : (v === 3) ? "Savage"
      : (v === 4) ? "Brutal"
      : "Illegal";

    difficultyLabelEl.textContent = label;
    save();
  }

  function updateFlashMsPreview() {
    const ms = baseFlashMsFromDifficulty(state.difficulty);
    flashMsEl.textContent = `${ms} ms`;
  }

  function setLeniency(mode, silent = false) {
    state.leniency = mode;
    lenientBtn.classList.toggle("is-on", mode === "LENIENT");
    strictBtn.classList.toggle("is-on", mode === "STRICT");
    if (!silent) save();
  }

  function setFlashStyle(style, silent = false) {
    state.flashStyle = style;
    flashCutBtn.classList.toggle("is-on", style === "CUT");
    flashFlickerBtn.classList.toggle("is-on", style === "FLICKER");
    if (!silent) save();
  }

  // ---------- TIMING CURVE ----------
  function baseFlashMsFromDifficulty(diff) {
    // diff: 1..5
    // This is where the personality lives.
    // You can tune these to taste.
    switch (diff) {
      case 1: return 1700;
      case 2: return 1250;
      case 3: return 900;
      case 4: return 650;
      case 5: return 420;
      default: return 900;
    }
  }

  function spikeChanceFromDifficulty(diff) {
    // More spike rounds on higher difficulty
    switch (diff) {
      case 1: return 0.10;
      case 2: return 0.14;
      case 3: return 0.18;
      case 4: return 0.22;
      case 5: return 0.28;
      default: return 0.18;
    }
  }

  // ---------- STRING HELPERS ----------
  function normalizeTitle(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/['’"]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\b(the|a|an)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function containsLoose(a, b) {
    // loose contains, for partial credit “right idea”
    if (!a || !b) return false;
    if (a.length < 4 || b.length < 4) return false;
    return a.includes(b) || b.includes(a);
  }

  function similarity(a, b) {
    // 0..1 based on normalized Levenshtein distance
    if (!a && !b) return 1;
    if (!a || !b) return 0;
    const d = levenshtein(a, b);
    const maxLen = Math.max(a.length, b.length);
    return 1 - (d / maxLen);
  }

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    return dp[m][n];
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ---------- SAVE / LOAD ----------
  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);

      // only load safe fields
      state.best = Number(saved.best ?? state.best);
      state.filterType = saved.filterType ?? state.filterType;
      state.region = saved.region ?? state.region;
      state.difficulty = Number(saved.difficulty ?? state.difficulty);
      state.spikeRounds = !!(saved.spikeRounds ?? state.spikeRounds);
      state.leniency = saved.leniency ?? state.leniency;
      state.flashStyle = saved.flashStyle ?? state.flashStyle;
      state.sound = !!(saved.sound ?? state.sound);

      // reflect best immediately
      bestEl.textContent = String(state.best);
    } catch {
      // ignore broken saves
    }
  }

  function save() {
    const payload = {
      best: state.best,
      filterType: state.filterType,
      region: state.region,
      difficulty: state.difficulty,
      spikeRounds: state.spikeRounds,
      leniency: state.leniency,
      flashStyle: state.flashStyle,
      sound: state.sound,
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    } catch {
      // ignore (private mode etc.)
    }
  }
})();
