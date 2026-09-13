(() => {
  "use strict";

  /*
   * ============================================================
   * DOOMSDAY
   * Digital Game Archive
   *
   * Robust frontend controller
   * ============================================================
   */

  const SETTINGS_KEY = "thearchive.settings";
  const REQUESTS_KEY = "thearchive.requests";
  const GAMES_URL = "./games.json";

  const REQUEST_ENDPOINT =
    "https://script.google.com/macros/s/AKfycbwzRQYzsauP60uto83r5heFbxmJNffu_6LL7I0DEouDTYZJv-K5yX45kKaXMd89nl_kyA/exec";

  /*
   * ------------------------------------------------------------
   * DEFAULT SETTINGS
   * ------------------------------------------------------------
   */

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
    cloakFavicon:
      "https://www.gstatic.com/classroom/logo_square_rounded.svg"
  };

  /*
   * IMPORTANT:
   * themes is intentionally declared BEFORE any functions that
   * may use it.
   */

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

  /*
   * ------------------------------------------------------------
   * HELPERS
   * ------------------------------------------------------------
   */

  const $ = (selector, root = document) => {
    try {
      return root.querySelector(selector);
    } catch {
      return null;
    }
  };

  const $$ = (selector, root = document) => {
    try {
      return Array.from(root.querySelectorAll(selector));
    } catch {
      return [];
    }
  };

  function on(selector, event, handler, root = document) {
    const element =
      typeof selector === "string"
        ? $(selector, root)
        : selector;

    if (!element) {
      return false;
    }

    element.addEventListener(event, handler);
    return true;
  }

  function setText(selector, value) {
    const element = $(selector);

    if (element) {
      element.textContent = value;
    }
  }

  function safeText(value) {
    return String(value ?? "");
  }

  function escapeHTML(value) {
    return safeText(value).replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[character]));
  }

  function escapeAttr(value) {
    return escapeHTML(value);
  }

  /*
   * ------------------------------------------------------------
   * STATE
   * ------------------------------------------------------------
   */

  const state = (() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);

      if (!stored) {
        return { ...DEFAULTS };
      }

      const parsed = JSON.parse(stored);

      if (!parsed || typeof parsed !== "object") {
        return { ...DEFAULTS };
      }

      return {
        ...DEFAULTS,
        ...parsed
      };
    } catch {
      return {
        ...DEFAULTS
      };
    }
  })();

  function save() {
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify(state)
      );
    } catch {
      // Storage can be blocked in some browser modes.
    }
  }

  /*
   * ------------------------------------------------------------
   * DOM REFERENCES
   * ------------------------------------------------------------
   */

  let school = null;
  let transition = null;
  let archive = null;
  let bootError = null;

  let activated = false;
  let games = [];
  let category = "All";
  let query = "";

  /*
   * ------------------------------------------------------------
   * BOOT ERROR
   * ------------------------------------------------------------
   */

  function showBootError(message) {
    const errorBox = bootError || $("#boot-error");
    const errorText = $("#boot-error-text");

    if (!errorBox) {
      console.error(message);
      return;
    }

    if (errorText) {
      errorText.textContent = message;
    }

    errorBox.hidden = false;
  }

  /*
   * ------------------------------------------------------------
   * THEME
   * ------------------------------------------------------------
   */

  function applyTheme() {
    const root = document.documentElement;

    if (!root) {
      return;
    }

    if (!state.theme || state.theme === "default") {
      root.removeAttribute("data-theme");
    } else {
      root.dataset.theme = state.theme;
    }
  }

  /*
   * ------------------------------------------------------------
   * FAVICON / CLOAK
   * ------------------------------------------------------------
   */

  function setFavicon(url) {
    if (!url) {
      return;
    }

    try {
      $$('link[rel*="icon"]').forEach(node => {
        node.remove();
      });

      const link = document.createElement("link");

      link.rel = "icon";
      link.href = url;

      document.head.appendChild(link);
    } catch {
      // Ignore favicon errors.
    }
  }

  function syncCloak() {
    applyTheme();

    if (!state.cloakEnabled) {
      document.title = "Doomsday — Digital Archive";

      setFavicon(
        "./g/assets/favicon-96x96.png"
      );

      return;
    }

    document.title =
      state.cloakTitle || "Classes";

    setFavicon(
      state.cloakFavicon ||
      DEFAULTS.cloakFavicon
    );
  }

  /*
   * ------------------------------------------------------------
   * SETTINGS UI
   * ------------------------------------------------------------
   */

  function syncSettingsUI() {
    /*
     * themes is already initialized before this function can
     * ever run.
     */

    applyTheme();

    const themeRow = $("#theme-row");

    if (themeRow) {
      themeRow.innerHTML = themes
        .map(([name, color]) => {
          const active =
            state.theme === name
              ? "active"
              : "";

          return `
            <button
              class="swatch ${active}"
              title="${escapeAttr(name)}"
              data-theme="${escapeAttr(name)}"
              style="background:${color}"
              type="button"
              aria-label="${escapeAttr(name)} theme"
            ></button>
          `;
        })
        .join("");

      $$(".swatch", themeRow).forEach(button => {
        button.addEventListener("click", () => {
          state.theme =
            button.dataset.theme ||
            "default";

          save();
          syncSettingsUI();
        });
      });
    }

    const gridSize = $("#grid-size");

    if (gridSize) {
      gridSize.value =
        String(state.gridSize);
    }

    const fxMode = $("#fx-mode");

    if (fxMode) {
      fxMode.value =
        state.fx;
    }

    const fxDensity = $("#fx-density");

    if (fxDensity) {
      fxDensity.value =
        String(state.fxDensity);
    }

    const toggles = [
      ["reduce-motion", "reduceMotion"],
      ["fullscreen-play", "fullscreenOnPlay"],
      ["confirm-close", "confirmBeforeClose"],
      ["cloak-enabled", "cloakEnabled"]
    ];

    toggles.forEach(([id, key]) => {
      const element = $("#" + id);

      if (!element) {
        return;
      }

      element.classList.toggle(
        "on",
        !!state[key]
      );
    });

    const cloakTitle = $("#cloak-title");

    if (cloakTitle) {
      cloakTitle.value =
        state.cloakTitle || "";
    }

    const cloakFavicon = $("#cloak-favicon");

    if (cloakFavicon) {
      cloakFavicon.value =
        state.cloakFavicon || "";
    }

    document.documentElement.classList.toggle(
      "reduce-motion",
      !!state.reduceMotion
    );
  }

  /*
   * ------------------------------------------------------------
   * ACTIVATION
   * ------------------------------------------------------------
   */

  function activate(openRequestAfter = false) {
    if (!school || !archive) {
      showBootError(
        "The archive could not find the required page containers."
      );

      return;
    }

    if (activated) {
      if (openRequestAfter) {
        openRequest();
      }

      return;
    }

    activated = true;

    if (transition) {
      transition.classList.remove("hidden");
      transition.setAttribute(
        "aria-hidden",
        "false"
      );
    }

    const finish = () => {
      if (school) {
        school.classList.add("hidden");
      }

      if (archive) {
        archive.classList.remove("hidden");
      }

      if (transition) {
        transition.classList.add("hidden");

        transition.setAttribute(
          "aria-hidden",
          "true"
        );
      }

      document.body.classList.add(
        "archive-active"
      );

      applyTheme();
      syncSettingsUI();
      render();
      setFX(state.fx);

      if (openRequestAfter) {
        setTimeout(
          openRequest,
          80
        );
      }
    };

    if (state.reduceMotion) {
      finish();
    } else {
      setTimeout(
        finish,
        500
      );
    }
  }

  /*
   * ------------------------------------------------------------
   * REQUEST MODAL
   * ------------------------------------------------------------
   */

  function openRequest() {
    const modal = $("#request-modal");

    if (!modal) {
      return;
    }

    modal.classList.remove("hidden");

    setTimeout(() => {
      const name = $("#request-name");

      if (name) {
        name.focus();
      }
    }, 30);
  }

  function closeRequest() {
    const modal = $("#request-modal");

    if (modal) {
      modal.classList.add("hidden");
    }

    setText(
      "#request-status",
      ""
    );
  }

  /*
   * ------------------------------------------------------------
   * GAMES
   * ------------------------------------------------------------
   */

  async function loadGames() {
    try {
      const response = await fetch(
        GAMES_URL,
        {
          cache: "no-store"
        }
      );

      if (!response.ok) {
        throw new Error(
          `games.json returned ${response.status}`
        );
      }

      const data =
        await response.json();

      if (!Array.isArray(data)) {
        throw new Error(
          "games.json is not an array"
        );
      }

      games = data.filter(game => {
        return (
          game &&
          typeof game === "object" &&
          game.name &&
          game.file
        );
      });

      console.log(
        `Doomsday: loaded ${games.length} games.`
      );
    } catch (error) {
      console.error(
        "Could not load games.json:",
        error
      );

      games = [];

      showBootError(
        "The archive interface loaded, but games.json could not be read. Make sure games.json is in the repository root."
      );
    }

    setText(
      "#game-count",
      `· ${games.length} TITLES`
    );

    buildFilters();
    render();
  }

  function buildFilters() {
    const filters = $("#filters");

    if (!filters) {
      return;
    }

    const categories = [
      "All",
      ...new Set(
        games
          .map(game => game.tag)
          .filter(Boolean)
      )
    ];

    if (!categories.includes(category)) {
      category = "All";
    }

    filters.innerHTML =
      categories
        .map(cat => `
          <button
            class="filter ${cat === category ? "active" : ""}"
            data-category="${escapeAttr(cat)}"
            type="button"
          >
            ${escapeHTML(cat)}
          </button>
        `)
        .join("");

    $$(".filter", filters).forEach(button => {
      button.addEventListener(
        "click",
        () => {
          category =
            button.dataset.category ||
            "All";

          buildFilters();
          render();
        }
      );
    });
  }

  function render() {
    const grid = $("#game-grid");

    if (!grid) {
      return;
    }

    const lowerQuery =
      query.toLowerCase();

    const filtered =
      games.filter(game => {
        const categoryMatch =
          category === "All" ||
          game.tag === category;

        const text =
          `${game.name || ""} ${game.tag || ""}`
            .toLowerCase();

        return (
          categoryMatch &&
          text.includes(lowerQuery)
        );
      });

    setText(
      "#result-count",
      `${filtered.length} RESULT${filtered.length === 1 ? "" : "S"}`
    );

    const empty = $("#empty");

    if (empty) {
      empty.classList.toggle(
        "hidden",
        filtered.length !== 0
      );
    }

    grid.innerHTML =
      filtered
        .map(game => {
          const index =
            games.indexOf(game);

          const image =
            game.icon ||
            "./g/assets/favicon-96x96.png";

          return `
            <article
              class="game-card"
              data-index="${index}"
              tabindex="0"
              role="button"
              aria-label="Play ${escapeAttr(game.name)}"
            >
              <img
                loading="lazy"
                src="${escapeAttr(image)}"
                alt=""
                onerror="
                  this.onerror=null;
                  this.src='./g/assets/favicon-96x96.png';
                  this.style.objectFit='contain';
                  this.style.padding='30px';
                "
              >

              <div class="shade"></div>

              <div class="game-info">
                <small>
                  ${escapeHTML(game.tag || "Game")}
                </small>

                <h4>
                  ${escapeHTML(game.name || "Untitled")}
                </h4>
              </div>
            </article>
          `;
        })
        .join("");

    $$(".game-card", grid).forEach(card => {
      const open = () => {
        const index =
          Number(card.dataset.index);

        play(games[index]);
      };

      card.addEventListener(
        "click",
        open
      );

      card.addEventListener(
        "keydown",
        event => {
          if (
            event.key === "Enter" ||
            event.key === " "
          ) {
            event.preventDefault();
            open();
          }
        }
      );
    });

    document.documentElement.style.setProperty(
      "--card",
      `${state.gridSize}px`
    );
  }

  /*
   * ------------------------------------------------------------
   * GAME PLAYER
   * ------------------------------------------------------------
   */

  function play(game) {
    if (!game || !game.file) {
      return;
    }

    const title =
      $("#play-title");

    const tag =
      $("#play-tag");

    const frame =
      $("#game-frame");

    const modal =
      $("#game-modal");

    if (!frame || !modal) {
      return;
    }

    if (title) {
      title.textContent =
        game.name || "Game";
    }

    if (tag) {
      tag.textContent =
        game.tag || "Game";
    }

    frame.src =
      game.file;

    modal.classList.remove(
      "hidden"
    );

    document.body.style.overflow =
      "hidden";

    if (state.fullscreenOnPlay) {
      setTimeout(() => {
        if (
          frame.requestFullscreen
        ) {
          frame
            .requestFullscreen()
            .catch(() => {});
        }
      }, 300);
    }
  }

  function closeGame() {
    const frame =
      $("#game-frame");

    const modal =
      $("#game-modal");

    if (!frame || !modal) {
      return;
    }

    if (
      state.confirmBeforeClose &&
      frame.src &&
      frame.src !== "about:blank"
    ) {
      if (
        !confirm(
          "Close this game?"
        )
      ) {
        return;
      }
    }

    try {
      if (
        document.fullscreenElement &&
        document.exitFullscreen
      ) {
        document
          .exitFullscreen()
          .catch(() => {});
      }
    } catch {}

    frame.src =
      "about:blank";

    modal.classList.add(
      "hidden"
    );

    document.body.style.overflow =
      "";
  }

  /*
   * ------------------------------------------------------------
   * VIEW NAVIGATION
   * ------------------------------------------------------------
   */

  function showView(view) {
    const browse =
      $("#browse-view");

    const settings =
      $("#settings-view");

    if (!browse || !settings) {
      return;
    }

    browse.classList.toggle(
      "hidden",
      view !== "browse"
    );

    settings.classList.toggle(
      "hidden",
      view !== "settings"
    );

    $$(
      ".nav-btn[data-view]"
    ).forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.view === view
      );
    });

    if (view === "settings") {
      syncSettingsUI();
    }

    window.scrollTo({
      top: 0,
      behavior:
        state.reduceMotion
          ? "auto"
          : "smooth"
    });
  }

  /*
   * ------------------------------------------------------------
   * BACKGROUND FX
   * ------------------------------------------------------------
   */

  let fxAnimation = null;

  function setFX(mode) {
    const canvas =
      $("#fx");

    if (!canvas) {
      return;
    }

    if (fxAnimation) {
      cancelAnimationFrame(
        fxAnimation
      );

      fxAnimation = null;
    }

    const ctx =
      canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    resizeFX();

    ctx.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    if (
      !mode ||
      mode === "off" ||
      state.reduceMotion
    ) {
      return;
    }

    const dpr =
      window.devicePixelRatio || 1;

    const width =
      window.innerWidth;

    const height =
      window.innerHeight;

    const count =
      Math.max(
        20,
        Math.floor(
          50 * state.fxDensity
        )
      );

    const particles =
      Array.from(
        { length: count },
        () => ({
          x: Math.random() * width,
          y: Math.random() * height,
          size:
            Math.random() * 2 + 0.5,
          speed:
            Math.random() * 1.5 + 0.3,
          alpha:
            Math.random() * 0.5 + 0.15
        })
      );

    function animate() {
      ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      ctx.save();
      ctx.scale(dpr, dpr);

      particles.forEach(particle => {
        if (mode === "rain") {
          particle.y +=
            particle.speed * 5;

          if (
            particle.y >
            height
          ) {
            particle.y = -10;
            particle.x =
              Math.random() * width;
          }

          ctx.globalAlpha =
            particle.alpha;

          ctx.fillRect(
            particle.x,
            particle.y,
            1,
            8
          );
        }

        else if (
          mode === "snow"
        ) {
          particle.y +=
            particle.speed;

          particle.x +=
            Math.sin(
              particle.y / 40
            ) * 0.25;

          if (
            particle.y >
            height
          ) {
            particle.y = -10;
          }

          ctx.globalAlpha =
            particle.alpha;

          ctx.beginPath();

          ctx.arc(
            particle.x,
            particle.y,
            particle.size,
            0,
            Math.PI * 2
          );

          ctx.fill();
        }

        else if (
          mode === "matrix"
        ) {
          particle.y +=
            particle.speed * 3;

          if (
            particle.y >
            height
          ) {
            particle.y = -10;
          }

          ctx.globalAlpha =
            particle.alpha;

          ctx.font =
            "12px monospace";

          ctx.fillText(
            Math.random() > 0.5
              ? "1"
              : "0",
            particle.x,
            particle.y
          );
        }

        else if (
          mode === "stars"
        ) {
          ctx.globalAlpha =
            particle.alpha;

          ctx.beginPath();

          ctx.arc(
            particle.x,
            particle.y,
            particle.size,
            0,
            Math.PI * 2
          );

          ctx.fill();
        }

        else {
          particle.y -=
            particle.speed;

          particle.x +=
            Math.sin(
              particle.y / 30
            ) * 0.15;

          if (
            particle.y < 0
          ) {
            particle.y = height;
          }

          ctx.globalAlpha =
            particle.alpha;

          ctx.beginPath();

          ctx.arc(
            particle.x,
            particle.y,
            particle.size,
            0,
            Math.PI * 2
          );

          ctx.fill();
        }
      });

      ctx.restore();

      fxAnimation =
        requestAnimationFrame(
          animate
        );
    }

    animate();
  }

  function resizeFX() {
    const canvas =
      $("#fx");

    if (!canvas) {
      return;
    }

    const dpr =
      window.devicePixelRatio || 1;

    canvas.width =
      window.innerWidth * dpr;

    canvas.height =
      window.innerHeight * dpr;

    canvas.style.width =
      `${window.innerWidth}px`;

    canvas.style.height =
      `${window.innerHeight}px`;
  }

  /*
   * ------------------------------------------------------------
   * INITIALIZATION
   * ------------------------------------------------------------
   */

  function initialize() {
    try {
      school =
        $("#school-screen");

      transition =
        $("#transition");

      archive =
        $("#archive");

      bootError =
        $("#boot-error");

      /*
       * Search
       */

      on(
        "#search",
        "input",
        event => {
          query =
            event.target.value
              .trim();

          render();
        }
      );

      on(
        "#clear-search",
        "click",
        () => {
          const search =
            $("#search");

          if (search) {
            search.value = "";
          }

          query = "";

          render();

          if (search) {
            search.focus();
          }
        }
      );

      /*
       * Navigation
       */

      $$(
        "[data-view]"
      ).forEach(button => {
        button.addEventListener(
          "click",
          event => {
            event.preventDefault();

            showView(
              button.dataset.view
            );
          }
        );
      });

      on(
        "#home-btn",
        "click",
        () => {
          showView("browse");
        }
      );

      /*
       * Activation
       */

      on(
        "#enter-archive",
        "click",
        () => {
          activate(false);
        }
      );

      on(
        "#school-request",
        "click",
        event => {
          event.preventDefault();

          activate(true);
        }
      );

      /*
       * Keyboard shortcuts
       */

      window.addEventListener(
        "keydown",
        event => {
          const tag =
            document.activeElement?.tagName ||
            "";

          if (
            event.key.toLowerCase() ===
              "e" &&
            ![
              "INPUT",
              "TEXTAREA",
              "SELECT",
              "BUTTON"
            ].includes(tag)
          ) {
            activate(false);
          }

          if (
            (event.ctrlKey ||
              event.metaKey) &&
            event.key.toLowerCase() ===
              "k"
          ) {
            event.preventDefault();

            activate(false);

            setTimeout(() => {
              const search =
                $("#search");

              if (search) {
                search.focus();
              }
            }, 40);
          }

          if (
            event.key ===
            "Escape"
          ) {
            closeRequest();

            const gameModal =
              $("#game-modal");

            if (
              gameModal &&
              !gameModal.classList.contains(
                "hidden"
              )
            ) {
              closeGame();
            }
          }
        }
      );

      /*
       * Settings
       */

      on(
        "#grid-size",
        "change",
        event => {
          state.gridSize =
            Number(
              event.target.value
            ) || 180;

          save();
          render();
        }
      );

      on(
        "#fx-mode",
        "change",
        event => {
          state.fx =
            event.target.value;

          save();
          setFX(state.fx);
        }
      );

      on(
        "#fx-density",
        "change",
        event => {
          state.fxDensity =
            Number(
              event.target.value
            ) || 1;

          save();
          setFX(state.fx);
        }
      );

      const settingToggles = [
        ["reduce-motion", "reduceMotion"],
        ["fullscreen-play", "fullscreenOnPlay"],
        ["confirm-close", "confirmBeforeClose"],
        ["cloak-enabled", "cloakEnabled"]
      ];

      settingToggles.forEach(
        ([id, key]) => {
          on(
            "#" + id,
            "click",
            () => {
              state[key] =
                !state[key];

              save();
              syncSettingsUI();

              if (
                key ===
                "reduceMotion"
              ) {
                document.documentElement.classList.toggle(
                  "reduce-motion",
                  state.reduceMotion
                );

                setFX(
                  state.fx
                );
              }

              if (
                key ===
                "cloakEnabled"
              ) {
                syncCloak();
              }
            }
          );
        }
      );

      /*
       * Cloak settings
       */

      on(
        "#cloak-title",
        "input",
        event => {
          state.cloakTitle =
            event.target.value;

          save();
          syncCloak();
        }
      );

      on(
        "#cloak-favicon",
        "input",
        event => {
          state.cloakFavicon =
            event.target.value;

          save();
          syncCloak();
        }
      );

      /*
       * Reset
       */

      on(
        "#reset-settings",
        "click",
        () => {
          if (
            !confirm(
              "Reset all local settings?"
            )
          ) {
            return;
          }

          Object.keys(
            state
          ).forEach(key => {
            delete state[key];
          });

          Object.assign(
            state,
            DEFAULTS
          );

          save();

          syncSettingsUI();
          setFX("off");
          syncCloak();
        }
      );

      /*
       * Cloaked tab
       */

      on(
        "#cloak-open",
        "click",
        () => {
          const child =
            window.open(
              "about:blank",
              "_blank"
            );

          if (!child) {
            alert(
              "Popup blocked. Allow pop-ups for this site and try again."
            );

            return;
          }

          const title =
            escapeHTML(
              state.cloakTitle ||
              "Classes"
            );

          const favicon =
            escapeAttr(
              state.cloakFavicon ||
              DEFAULTS.cloakFavicon
            );

          const source =
            escapeAttr(
              location.href
            );

          child.document.open();

          child.document.write(`
            <!doctype html>
            <html>
              <head>
                <title>${title}</title>

                <link
                  rel="icon"
                  href="${favicon}"
                >

                <style>
                  html,
                  body,
                  iframe {
                    margin: 0;
                    width: 100%;
                    height: 100%;
                    border: 0;
                    overflow: hidden;
                  }
                </style>
              </head>

              <body>
                <iframe src="${source}"></iframe>
              </body>
            </html>
          `);

          child.document.close();
        }
      );

      /*
       * Request system
       */

      on(
        "#request-cta",
        "click",
        openRequest
      );

      on(
        "#request-close",
        "click",
        closeRequest
      );

      on(
        "#request-modal",
        "click",
        event => {
          if (
            event.target ===
            $("#request-modal")
          ) {
            closeRequest();
          }
        }
      );

      on(
        "#request-form",
        "submit",
        async event => {
          event.preventDefault();

          const nameInput =
            $("#request-name");

          const noteInput =
            $("#request-note");

          const status =
            $("#request-status");

          if (
            !nameInput ||
            !status
          ) {
            return;
          }

          const name =
            nameInput.value.trim();

          const note =
            noteInput
              ? noteInput.value.trim()
              : "";

          if (!name) {
            return;
          }

          status.textContent =
            "Sending…";

          try {
            const body =
              new URLSearchParams({
                name,
                note
              });

            await fetch(
              REQUEST_ENDPOINT,
              {
                method: "POST",
                mode: "no-cors",
                headers: {
                  "Content-Type":
                    "application/x-www-form-urlencoded;charset=UTF-8"
                },
                body
              }
            );

            status.textContent =
              "Request sent.";

            event.target.reset();

            setTimeout(
              closeRequest,
              900
            );
          } catch {
            try {
              const existing =
                JSON.parse(
                  localStorage.getItem(
                    REQUESTS_KEY
                  ) || "[]"
                );

              existing.push({
                name,
                note,
                createdAt:
                  new Date().toISOString()
              });

              localStorage.setItem(
                REQUESTS_KEY,
                JSON.stringify(
                  existing
                )
              );
            } catch {}

            status.textContent =
              "Saved locally.";
          }
        }
      );

      /*
       * Game player
       */

      on(
        "#play-close",
        "click",
        closeGame
      );

      on(
        "#play-fullscreen",
        "click",
        () => {
          const frame =
            $("#game-frame");

          if (
            frame &&
            frame.requestFullscreen
          ) {
            frame
              .requestFullscreen()
              .catch(() => {});
          }
        }
      );

      on(
        "#game-modal",
        "click",
        event => {
          if (
            event.target ===
            $("#game-modal")
          ) {
            closeGame();
          }
        }
      );

      /*
       * Music
       */

      const music =
        $("#bg-music");

      const musicButton =
        $("#music-btn");

      let musicOn = false;

      function updateMusicButton() {
        if (!musicButton) {
          return;
        }

        musicButton.style.color =
          musicOn
            ? "var(--accent2)"
            : "";
      }

      if (
        musicButton &&
        music
      ) {
        musicButton.addEventListener(
          "click",
          () => {
            if (!musicOn) {
              music
                .play()
                .then(() => {
                  musicOn = true;
                  updateMusicButton();
                })
                .catch(() => {});
            } else {
              music.pause();

              musicOn = false;

              updateMusicButton();
            }
          }
        );
      }

      /*
       * Window resize
       */

      window.addEventListener(
        "resize",
        () => {
          resizeFX();

          if (
            state.fx !==
            "off"
          ) {
            setFX(
              state.fx
            );
          }
        }
      );

      /*
       * Initial UI state
       */

      syncCloak();

      /*
       * Load games.
       */

      loadGames();

      console.log(
        "Doomsday initialized successfully."
      );
    } catch (error) {
      console.error(
        "Doomsday initialization error:",
        error
      );

      showBootError(
        "Doomsday encountered an initialization error. Open the browser console for details."
      );
    }
  }

  /*
   * ------------------------------------------------------------
   * DOM READY
   * ------------------------------------------------------------
   *
   * This prevents JavaScript from trying to access elements
   * before index.html has finished parsing.
   */

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      {
        once: true
      }
    );
  } else {
    initialize();
  }
})();