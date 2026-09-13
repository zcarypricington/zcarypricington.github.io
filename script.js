(() => {
  "use strict";

  const SETTINGS_KEY = "thearchive.settings";
  const REQUESTS_KEY = "thearchive.requests";
  const GAMES_URL = "./games.json";
  const REQUEST_ENDPOINT = "https://script.google.com/macros/s/AKfycbwzRQYzsauP60uto83r5heFbxmJNffu_6LL7I0DEouDTYZJv-K5yX45kKaXMd89nl_kyA/exec";

  const DEFAULTS = {
    theme: "default",
    fx: "off",
    fxDensity: 1,
    gridSize: 180,
    fullscreenOnPlay: false,
    confirmBeforeClose: false,
    reduceMotion: false,
    cloakEnabled: false,
    cloakTitle: "Classes",
    cloakFavicon: "https://www.gstatic.com/classroom/logo_square_rounded.svg"
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const state = (() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      return { ...DEFAULTS, ...(saved && typeof saved === "object" ? saved : {}) };
    } catch {
      return { ...DEFAULTS };
    }
  })();

  const save = () => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(state)); } catch {}
  };

  const school = $("#school-screen");
  const transition = $("#transition");
  const archive = $("#archive");
  const bootError = $("#boot-error");

  let activated = false;
  let games = [];
  let category = "All";
  let query = "";

  const themes = [
    ["default", "#8b5cf6"],
    ["mono", "#111111"],
    ["blue", "#3d7bff"],
    ["teal", "#2fcf9e"],
    ["red", "#ef4444"],
    ["amber", "#f5a623"],
    ["purple", "#6a5cff"],
    ["magenta", "#d94fd9"]
  ];

  function safeText(value) {
    return String(value ?? "");
  }

  function escapeHTML(value) {
    return safeText(value).replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  function escapeAttr(value) {
    return escapeHTML(value);
  }

  function showBootError(message) {
    if (!bootError) return;
    $("#boot-error-text").textContent = message;
    bootError.hidden = false;
  }

  function applyTheme() {
    if (state.theme === "default") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.dataset.theme = state.theme;
    }
  }

  function setFavicon(url) {
    try {
      $$('link[rel*="icon"]').forEach(node => node.remove());
      const link = document.createElement("link");
      link.rel = "icon";
      link.href = url;
      document.head.appendChild(link);
    } catch {}
  }

  function syncCloak() {
    applyTheme();

    if (!state.cloakEnabled) {
      document.title = "Doomsday — Digital Archive";
      setFavicon("./g/assets/favicon-96x96.png");
      return;
    }

    document.title = state.cloakTitle || "Classes";
    setFavicon(state.cloakFavicon || DEFAULTS.cloakFavicon);
  }

  function syncSettingsUI() {
    applyTheme();

    $("#theme-row").innerHTML = themes.map(([name, color]) =>
      `<button class="swatch ${state.theme === name ? "active" : ""}" title="${escapeAttr(name)}" data-theme="${escapeAttr(name)}" style="background:${color}" type="button"></button>`
    ).join("");

    $$(".swatch").forEach(button => {
      button.addEventListener("click", () => {
        state.theme = button.dataset.theme || "default";
        save();
        syncSettingsUI();
      });
    });

    $("#grid-size").value = String(state.gridSize);
    $("#fx-mode").value = state.fx;
    $("#fx-density").value = String(state.fxDensity);

    [
      ["reduce-motion", "reduceMotion"],
      ["fullscreen-play", "fullscreenOnPlay"],
      ["confirm-close", "confirmBeforeClose"],
      ["cloak-enabled", "cloakEnabled"]
    ].forEach(([id, key]) => {
      $("#" + id).classList.toggle("on", !!state[key]);
    });

    $("#cloak-title").value = state.cloakTitle || "";
    $("#cloak-favicon").value = state.cloakFavicon || "";

    document.documentElement.classList.toggle("reduce-motion", !!state.reduceMotion);
  }

  function activate(openRequestAfter = false) {
    if (activated) {
      if (openRequestAfter) openRequest();
      return;
    }

    activated = true;
    transition.classList.remove("hidden");
    transition.setAttribute("aria-hidden", "false");

    const finish = () => {
      school.classList.add("hidden");
      archive.classList.remove("hidden");
      transition.classList.add("hidden");
      transition.setAttribute("aria-hidden", "true");
      document.body.classList.add("archive-active");

      applyTheme();
      syncSettingsUI();
      render();
      setFX(state.fx);

      if (openRequestAfter) setTimeout(openRequest, 80);
    };

    if (state.reduceMotion) finish();
    else setTimeout(finish, 500);
  }

  function openRequest() {
    const modal = $("#request-modal");
    modal.classList.remove("hidden");
    setTimeout(() => $("#request-name")?.focus(), 30);
  }

  function closeRequest() {
    $("#request-modal").classList.add("hidden");
    $("#request-status").textContent = "";
  }

  async function loadGames() {
    try {
      const response = await fetch(GAMES_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`games.json returned ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("games.json is not an array");
      games = data.filter(game => game && typeof game === "object" && game.name && game.file);
    } catch (error) {
      console.error("Could not load games.json:", error);
      games = [];
      showBootError("The archive interface is available, but games.json could not be read. Check that games.json is in the repository root.");
    }

    $("#game-count").textContent = `· ${games.length} TITLES`;
    buildFilters();
    render();
  }

  function buildFilters() {
    const categories = ["All", ...new Set(games.map(game => game.tag).filter(Boolean))];

    if (!categories.includes(category)) category = "All";

    $("#filters").innerHTML = categories.map(cat =>
      `<button class="filter ${cat === category ? "active" : ""}" data-category="${escapeAttr(cat)}" type="button">${escapeHTML(cat)}</button>`
    ).join("");

    $$(".filter").forEach(button => {
      button.addEventListener("click", () => {
        category = button.dataset.category || "All";
        buildFilters();
        render();
      });
    });
  }

  function render() {
    const lowerQuery = query.toLowerCase();

    const filtered = games.filter(game => {
      const categoryMatch = category === "All" || game.tag === category;
      const text = `${game.name || ""} ${game.tag || ""}`.toLowerCase();
      return categoryMatch && text.includes(lowerQuery);
    });

    $("#result-count").textContent = `${filtered.length} RESULT${filtered.length === 1 ? "" : "S"}`;
    $("#empty").classList.toggle("hidden", filtered.length !== 0);

    $("#game-grid").innerHTML = filtered.map(game => {
      const index = games.indexOf(game);
      const image = game.icon || "./g/assets/favicon-96x96.png";

      return `
        <article class="game-card" data-index="${index}" tabindex="0" role="button" aria-label="Play ${escapeAttr(game.name)}">
          <img loading="lazy" src="${escapeAttr(image)}" alt="" onerror="this.onerror=null;this.src='./g/assets/favicon-96x96.png';this.style.objectFit='contain';this.style.padding='30px';">
          <div class="shade"></div>
          <div class="game-info">
            <small>${escapeHTML(game.tag || "Game")}</small>
            <h4>${escapeHTML(game.name || "Untitled")}</h4>
          </div>
        </article>
      `;
    }).join("");

    $$(".game-card").forEach(card => {
      const open = () => play(games[Number(card.dataset.index)]);
      card.addEventListener("click", open);
      card.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      });
    });

    document.documentElement.style.setProperty("--card", `${state.gridSize}px`);
  }

  function play(game) {
    if (!game || !game.file) return;

    $("#play-title").textContent = game.name || "Game";
    $("#play-tag").textContent = game.tag || "Game";
    $("#game-frame").src = game.file;
    $("#game-modal").classList.remove("hidden");
    document.body.style.overflow = "hidden";

    if (state.fullscreenOnPlay) {
      setTimeout(() => {
        const frame = $("#game-frame");
        if (frame?.requestFullscreen) frame.requestFullscreen().catch(() => {});
      }, 300);
    }
  }

  function closeGame() {
    if (state.confirmBeforeClose && $("#game-frame").src && !confirm("Close this game?")) return;

    try {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    } catch {}

    $("#game-frame").src = "about:blank";
    $("#game-modal").classList.add("hidden");
    document.body.style.overflow = "";
  }

  function showView(view) {
    const browse = $("#browse-view");
    const settings = $("#settings-view");

    browse.classList.toggle("hidden", view !== "browse");
    settings.classList.toggle("hidden", view !== "settings");

    $$(".nav-btn[data-view]").forEach(button => {
      button.classList.toggle("active", button.dataset.view === view);
    });

    if (view === "settings") syncSettingsUI();
    window.scrollTo({ top: 0, behavior: state.reduceMotion ? "auto" : "smooth" });
  }

  // Search
  $("#search").addEventListener("input", event => {
    query = event.target.value.trim();
    render();
  });

  $("#clear-search").addEventListener("click", () => {
    $("#search").value = "";
    query = "";
    render();
    $("#search").focus();
  });

  // Navigation
  $$("[data-view]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      showView(button.dataset.view);
    });
  });

  $("#home-btn").addEventListener("click", () => showView("browse"));

  // Activation
  $("#enter-archive").addEventListener("click", () => activate(false));
  $("#school-request").addEventListener("click", event => {
    event.preventDefault();
    activate(true);
  });

  window.addEventListener("keydown", event => {
    const tag = document.activeElement?.tagName || "";

    if (
      event.key.toLowerCase() === "e" &&
      !["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(tag)
    ) {
      activate(false);
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      activate(false);
      setTimeout(() => $("#search").focus(), 40);
    }

    if (event.key === "Escape") {
      closeRequest();
      if (!$("#game-modal").classList.contains("hidden")) closeGame();
    }
  });

  // Settings
  $("#grid-size").addEventListener("change", event => {
    state.gridSize = Number(event.target.value) || 180;
    save();
    render();
  });

  $("#fx-mode").addEventListener("change", event => {
    state.fx = event.target.value;
    save();
    setFX(state.fx);
  });

  $("#fx-density").addEventListener("change", event => {
    state.fxDensity = Number(event.target.value) || 1;
    save();
    setFX(state.fx);
  });

  [
    ["reduce-motion", "reduceMotion"],
    ["fullscreen-play", "fullscreenOnPlay"],
    ["confirm-close", "confirmBeforeClose"],
    ["cloak-enabled", "cloakEnabled"]
  ].forEach(([id, key]) => {
    $("#" + id).addEventListener("click", () => {
      state[key] = !state[key];
      save();
      syncSettingsUI();

      if (key === "reduceMotion") {
        document.documentElement.classList.toggle("reduce-motion", state.reduceMotion);
        setFX(state.fx);
      }

      if (key === "cloakEnabled") syncCloak();
    });
  });

  $("#cloak-title").addEventListener("input", event => {
    state.cloakTitle = event.target.value;
    save();
    syncCloak();
  });

  $("#cloak-favicon").addEventListener("input", event => {
    state.cloakFavicon = event.target.value;
    save();
    syncCloak();
  });

  $("#reset-settings").addEventListener("click", () => {
    if (!confirm("Reset all local settings?")) return;

    Object.keys(state).forEach(key => delete state[key]);
    Object.assign(state, DEFAULTS);
    save();
    syncSettingsUI();
    setFX("off");
    syncCloak();
  });

  // Cloaked tab
  $("#cloak-open").addEventListener("click", () => {
    const child = window.open("about:blank", "_blank");

    if (!child) {
      alert("Popup blocked. Allow pop-ups for this site and try again.");
      return;
    }

    const title = escapeHTML(state.cloakTitle || "Classes");
    const favicon = escapeAttr(state.cloakFavicon || DEFAULTS.cloakFavicon);
    const source = escapeAttr(location.href);

    child.document.open();
    child.document.write(`
      <!doctype html>
      <html>
      <head>
        <title>${title}</title>
        <link rel="icon" href="${favicon}">
        <style>html,body,iframe{margin:0;width:100%;height:100%;border:0;overflow:hidden}</style>
      </head>
      <body><iframe src="${source}"></iframe></body>
      </html>
    `);
    child.document.close();
  });

  // Request system
  $("#request-cta").addEventListener("click", openRequest);
  $("#request-close").addEventListener("click", closeRequest);

  $("#request-modal").addEventListener("click", event => {
    if (event.target === $("#request-modal")) closeRequest();
  });

  $("#request-form").addEventListener("submit", async event => {
    event.preventDefault();

    const name = $("#request-name").value.trim();
    const note = $("#request-note").value.trim();
    const status = $("#request-status");

    if (!name) return;

    status.textContent = "Sending…";

    try {
      const body = new URLSearchParams({ name, note });

      await fetch(REQUEST_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body
      });

      status.textContent = "Request sent.";
      event.target.reset();
      setTimeout(closeRequest, 900);
    } catch {
      try {
        const existing = JSON.parse(localStorage.getItem(REQUESTS_KEY) || "[]");
        existing.push({
          name,
          note,
          createdAt: new Date().toISOString()
        });
        localStorage.setItem(REQUESTS_KEY, JSON.stringify(existing));
      } catch {}

      status.textContent = "Saved locally.";
    }
  });

  // Game player
  $("#play-close").addEventListener("click", closeGame);
  $("#play-fullscreen").addEventListener("click", () => {
    const frame = $("#game-frame");
    if (frame?.requestFullscreen) frame.requestFullscreen().catch(() => {});
  });

  $("#game-modal").addEventListener("click", event => {
    if (event.target === $("#game-modal")) closeGame();
  });

  // Music
  const music = $("#bg-music");
  const musicButton = $("#music-btn");
  let musicOn = false;

  function updateMusicButton() {
    musicButton.style.color = musicOn ? "var(--accent2)" : "";
  }

  musicButton.addEventListener("click", () => {
    if (!musicOn) {
      music.play().then(() => {
        musicOn = true;
        updateMusicButton();
      }).catch(() => {});
    } else {
      music.pause();
      musicOn = false;
      updateMusicButton();
    }
  });

  // FX
  const canvas = $("#fx");
  const ctx = canvas.getContext("2d", { alpha: true });

  let W = 0;
  let H = 0;
  let dpr = 1;
  let fxMode = "off";
  let fxDensity = 1;
  let particles = [];
  let animation = 0;
  let lastTime = 0;

  function resizeFX() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth;
    H = window.innerHeight;

    canvas.width = Math.max(1, Math.floor(W * dpr));
    canvas.height = Math.max(1, Math.floor(H * dpr));
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildFX();
  }

  function buildFX() {
    particles = [];

    if (fxMode === "off" || state.reduceMotion) return;

    const count = Math.max(20, Math.round((W * H / 1200000) * fxDensity * 180));

    if (fxMode === "matrix") {
      const columns = Math.max(12, Math.floor((W / 15) * 0.65 * fxDensity));
      for (let i = 0; i < columns; i++) {
        particles.push({
          x: Math.random() * W,
          y: -Math.random() * H,
          speed: 9 + Math.random() * 16
        });
      }
      return;
    }

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 0.5 + Math.random() * 2,
        vx: (Math.random() - 0.5) * 0.5,
        vy: 0.3 + Math.random() * 1.1,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  function drawFX(time) {
    const dt = Math.min(50, time - lastTime || 16);
    lastTime = time;

    ctx.clearRect(0, 0, W, H);

    if (fxMode === "off" || state.reduceMotion) {
      animation = requestAnimationFrame(drawFX);
      return;
    }

    const accent = getComputedStyle(document.documentElement)
      .getPropertyValue("--phosphor")
      .trim() || "#b8f4e0";

    ctx.fillStyle = accent;
    ctx.strokeStyle = accent;

    if (fxMode === "matrix") {
      ctx.font = '14px "Courier New", monospace';
      ctx.globalAlpha = 0.4;

      for (const item of particles) {
        item.y += item.speed * dt / 16.7;
        ctx.fillText("01ABCDEF"[Math.floor(Math.random() * 8)], item.x, item.y);

        if (item.y > H + 40) {
          item.y = -20;
          item.x = Math.random() * W;
        }
      }

      ctx.globalAlpha = 1;
    } else if (fxMode === "rain") {
      ctx.globalAlpha = 0.32;
      ctx.lineWidth = 1;

      for (const p of particles) {
        p.y += p.vy * 7 * dt / 16.7;
        p.x -= dt * 0.06;

        if (p.y > H + 20) {
          p.y = -20;
          p.x = Math.random() * W;
        }

        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + 3, p.y - 14);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
    } else if (fxMode === "snow") {
      ctx.globalAlpha = 0.65;

      for (const p of particles) {
        p.phase += 0.02 * dt;
        p.x += Math.sin(p.phase) * 0.35;
        p.y += p.vy * dt / 16.7;

        if (p.y > H + 5) p.y = -5;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    } else {
      for (const p of particles) {
        p.x += p.vx * dt / 16.7;
        p.y += p.vy * dt / 16.7;

        if (p.x < 0) p.x = W;
        if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H;
        if (p.y > H) p.y = 0;

        ctx.globalAlpha = 0.42;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (fxMode === "constellations") {
        ctx.globalAlpha = 0.1;

        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < Math.min(particles.length, i + 5); j++) {
            const a = particles[i];
            const b = particles[j];
            const dx = a.x - b.x;
            const dy = a.y - b.y;

            if (dx * dx + dy * dy < 7000) {
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
            }
          }
        }

        ctx.globalAlpha = 1;
      }
    }

    animation = requestAnimationFrame(drawFX);
  }

  function setFX(mode) {
    fxMode = mode || "off";
    fxDensity = Number(state.fxDensity) || 1;
    buildFX();
    cancelAnimationFrame(animation);
    lastTime = performance.now();
    animation = requestAnimationFrame(drawFX);
  }

  window.addEventListener("resize", resizeFX);

  // Game player controls
  window.addEventListener("beforeunload", event => {
    if (!state.confirmBeforeClose || $("#game-modal").classList.contains("hidden")) return;
    event.preventDefault();
    event.returnValue = "";
  });

  // Initial boot
  try {
    syncCloak();
    syncSettingsUI();
    resizeFX();
    loadGames();
  } catch (error) {
    console.error("Doomsday startup error:", error);
    showBootError(`Startup error: ${error.message || error}`);
  }
})();
