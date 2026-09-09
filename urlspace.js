/**
 * urlspace.js — 62^8 URL namespace router for Doomsday
 *
 * Every game gets a unique shareable short-URL like:
 *   https://yoursite.com/#/g/aB3xK9mZ
 *
 * The 8-char base62 slug encodes a deterministic hash of the game's
 * file path — no server, no database, no new pages. The entire 218-trillion
 * slot namespace is virtual. Only slugs that map to a real game in
 * allGames[] actually resolve. Everything else 404s gracefully.
 *
 * Integrates with the existing script.js surface:
 *   - Reads window.allGames (set by script.js after games.json loads)
 *   - Calls window.openGame(game) to launch the modal
 *   - Writes shareable links into the tile DOM via data-slug attributes
 *   - Exposes window.URLSpace for external use
 */

(function () {
  'use strict';

  // ---- Base62 alphabet -------------------------------------------------------
  // 0-9, A-Z, a-z  →  62 chars  →  62^8 ≈ 218 trillion combinations
  const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const BASE = ALPHABET.length; // 62
  const SLUG_LEN = 8;

  // ---- Deterministic hash ----------------------------------------------------
  // djb2 variant — fast, no crypto dependency, collision rate negligible
  // for a game catalog that will never exceed tens of thousands of entries.
  function djb2(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) + h + str.charCodeAt(i)) >>> 0; // keep unsigned 32-bit
    }
    return h;
  }

  // Mix seed with a second pass to widen the distribution across 8 chars.
  // djb2 alone on short strings clusters in the high bits.
  function hashStr(str) {
    const a = djb2(str);
    const b = djb2(str.split('').reverse().join('') + '\x01');
    // Combine into a 53-bit safe integer (JS number)
    return (a * 0x100000000 + b) % Number.MAX_SAFE_INTEGER;
  }

  // ---- Base62 encode/decode --------------------------------------------------
  function toBase62(num, len) {
    let out = '';
    let n = num;
    for (let i = 0; i < len; i++) {
      out = ALPHABET[n % BASE] + out;
      n = Math.floor(n / BASE);
    }
    return out;
  }

  function fromBase62(slug) {
    let num = 0;
    for (let i = 0; i < slug.length; i++) {
      const idx = ALPHABET.indexOf(slug[i]);
      if (idx === -1) return -1; // invalid char
      num = num * BASE + idx;
    }
    return num;
  }

  // ---- Slug generation -------------------------------------------------------
  // Slug is derived from the game's file path (the stable identifier).
  // Two games with identical file paths get the same slug — intentional,
  // since they're the same game.
  function slugFor(game) {
    const key = (game.file || game.name || '').trim().toLowerCase();
    const num = hashStr(key);
    return toBase62(num % Math.pow(BASE, SLUG_LEN), SLUG_LEN);
  }

  // ---- Slug → game lookup ----------------------------------------------------
  // Build a Map<slug, game> from whatever is currently in allGames.
  // Called lazily and on each games-list update.
  let _slugMap = null;

  function buildSlugMap(games) {
    const map = new Map();
    for (const g of games) {
      const slug = slugFor(g);
      if (!map.has(slug)) map.set(slug, g); // first entry wins on collision
    }
    return map;
  }

  function getSlugMap() {
    if (_slugMap) return _slugMap;
    const games = window.allGames || [];
    _slugMap = buildSlugMap(games);
    return _slugMap;
  }

  // Invalidate the cache when the games list changes (called by script.js
  // after sheets / gamepix inject new entries).
  function invalidateSlugMap() {
    _slugMap = null;
  }

  // ---- Resolve a slug --------------------------------------------------------
  function resolve(slug) {
    if (!slug || slug.length !== SLUG_LEN) return null;
    // Validate every char is in alphabet
    for (const c of slug) {
      if (!ALPHABET.includes(c)) return null;
    }
    return getSlugMap().get(slug) || null;
  }

  // ---- URL helpers -----------------------------------------------------------
  // Route format:  /#/g/<slug>
  // e.g.          /#/g/aB3xK9mZ
  const ROUTE_PREFIX = '/g/';

  function makeHash(slug) {
    return '#' + ROUTE_PREFIX + slug;
  }

  function parseHash(hash) {
    // Accepts  #/g/aB3xK9mZ  or  /g/aB3xK9mZ
    const clean = (hash || '').replace(/^#/, '');
    if (!clean.startsWith(ROUTE_PREFIX)) return null;
    const slug = clean.slice(ROUTE_PREFIX.length).split('?')[0].split('/')[0];
    return slug.length === SLUG_LEN ? slug : null;
  }

  // Full shareable URL for a game
  function shareableUrl(game) {
    const slug = slugFor(game);
    const base = location.origin + location.pathname;
    return base + makeHash(slug);
  }

  // ---- Clipboard copy --------------------------------------------------------
  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      // Fallback: execCommand
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (_) {
      return false;
    }
  }

  // ---- Toast notification ----------------------------------------------------
  let _toastTimer = null;

  function toast(msg, duration) {
    duration = duration || 1800;
    let el = document.getElementById('urlspace-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'urlspace-toast';
      el.style.cssText = [
        'position:fixed',
        'bottom:28px',
        'left:50%',
        'transform:translateX(-50%) translateY(12px)',
        'background:var(--void-2,#111)',
        'border:1px solid var(--line-dim,#333)',
        'color:var(--phosphor,#b8f4e0)',
        'font-family:"Courier New",monospace',
        'font-size:12px',
        'letter-spacing:0.05em',
        'padding:10px 20px',
        'border-radius:6px',
        'box-shadow:0 4px 24px rgba(0,0,0,0.6)',
        'opacity:0',
        'transition:opacity 0.18s ease,transform 0.18s ease',
        'pointer-events:none',
        'z-index:99999',
        'white-space:nowrap',
      ].join(';');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    clearTimeout(_toastTimer);
    // Force reflow so transition fires even if already visible
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(12px)';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateX(-50%) translateY(0)';
      });
    });
    _toastTimer = setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50%) translateY(12px)';
    }, duration);
  }

  // ---- Share button injection -------------------------------------------------
  // Adds a small "share" icon button to each .arc-tile after the grid renders.
  // Uses MutationObserver to catch tiles injected by gamepix.js too.

  const SHARE_BTN_ATTR = 'data-urlspace-share';

  function injectShareBtn(tile, game) {
    if (tile.hasAttribute(SHARE_BTN_ATTR)) return;
    tile.setAttribute(SHARE_BTN_ATTR, '1');

    const slug = slugFor(game);
    tile.setAttribute('data-slug', slug);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'urlspace-share-btn';
    btn.title = 'Copy link · ' + slug;
    btn.setAttribute('aria-label', 'Copy shareable link for ' + game.name);
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13">' +
      '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>' +
      '<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>' +
      '</svg>';

    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      const url = shareableUrl(game);
      const ok = await copyToClipboard(url);
      toast(ok ? '✓ link copied — ' + slug : url);
    });

    // Insert into .tile-thumb so it floats over the thumbnail
    const thumb = tile.querySelector('.tile-thumb');
    if (thumb) thumb.appendChild(btn);
    else tile.appendChild(btn);
  }

  function injectShareButtons() {
    const grid = document.getElementById('game-grid');
    const gpGrid = document.getElementById('gamepix-grid');

    function processGrid(gridEl, games) {
      if (!gridEl || !games || !games.length) return;
      const tiles = gridEl.querySelectorAll('.arc-tile');
      tiles.forEach((tile) => {
        const idx = parseInt(tile.dataset.index, 10);
        if (isNaN(idx) || !games[idx]) return;
        injectShareBtn(tile, games[idx]);
      });
    }

    processGrid(grid, window.allGames || window.games || []);
    // gamepix tiles store their own game objects differently — read from dataset
    if (gpGrid) {
      gpGrid.querySelectorAll('.arc-tile').forEach((tile) => {
        if (tile.hasAttribute(SHARE_BTN_ATTR)) return;
        const name = tile.querySelector('.tile-name');
        const icon = tile.querySelector('.tile-icon');
        if (!name) return;
        const fakeGame = {
          name: name.textContent.trim(),
          file: icon ? (icon.src || '') : '',
          tag: '',
        };
        injectShareBtn(tile, fakeGame);
      });
    }
  }

  function observeGridMutations() {
    const grids = [
      document.getElementById('game-grid'),
      document.getElementById('gamepix-grid'),
    ].filter(Boolean);

    const mo = new MutationObserver(() => {
      invalidateSlugMap();
      injectShareButtons();
    });
    grids.forEach((g) =>
      mo.observe(g, { childList: true, subtree: false })
    );
  }

  // ---- Hash-based routing on page load ---------------------------------------
  // Fires after the archive is activated (script.js sets activated=true and
  // shows #archive-site). We poll briefly since allGames may not be populated
  // until games.json resolves.

  function tryRoute() {
    const slug = parseHash(location.hash);
    if (!slug) return false;

    const game = resolve(slug);
    if (!game) {
      // Slug exists in URL but maps to nothing in the catalog
      console.warn('[URLSpace] No game found for slug:', slug);
      showNotFound(slug);
      return true; // still "handled"
    }

    // Ensure the archive is visible before opening the modal
    const archiveSite = document.getElementById('archive-site');
    if (archiveSite) {
      archiveSite.removeAttribute('aria-hidden');
      archiveSite.style.display = '';
    }
    const eduSite = document.getElementById('edu-site');
    if (eduSite) eduSite.style.display = 'none';

    // Give the DOM one frame to settle before opening
    requestAnimationFrame(() => {
      if (typeof window.openGame === 'function') {
        window.openGame(game);
        // Clean up the hash so closing the modal doesn't re-trigger
        history.replaceState(null, '', location.pathname + location.search);
      }
    });
    return true;
  }

  function showNotFound(slug) {
    toast('No game found for slug: ' + slug, 3200);
  }

  // Poll until allGames is populated (max 6 seconds)
  function routeOnLoad() {
    const slug = parseHash(location.hash);
    if (!slug) return;

    let attempts = 0;
    const MAX = 60; // 60 × 100ms = 6s
    const poll = setInterval(() => {
      attempts++;
      const games = window.allGames || [];
      if (games.length > 0 || attempts >= MAX) {
        clearInterval(poll);
        invalidateSlugMap();
        tryRoute();
      }
    }, 100);
  }

  // React to hash changes during the session (back/forward, manual edits)
  window.addEventListener('hashchange', () => {
    invalidateSlugMap();
    tryRoute();
  });

  // ---- Share button styles ----------------------------------------------------
  function injectStyles() {
    if (document.getElementById('urlspace-styles')) return;
    const style = document.createElement('style');
    style.id = 'urlspace-styles';
    style.textContent = `
      .urlspace-share-btn {
        position: absolute;
        top: 6px;
        right: 6px;
        width: 26px;
        height: 26px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,0.55);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 5px;
        color: var(--phosphor, #b8f4e0);
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.15s ease, background 0.15s ease;
        z-index: 10;
        padding: 0;
        line-height: 1;
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
      }
      .arc-tile:hover .urlspace-share-btn,
      .gamepix-tile:hover .urlspace-share-btn {
        opacity: 1;
      }
      .urlspace-share-btn:hover {
        background: rgba(0,0,0,0.8);
        border-color: var(--phosphor-dim, #4a9c85);
      }
      .urlspace-share-btn svg {
        display: block;
        flex-shrink: 0;
      }
      /* Ensure .tile-thumb is positioned so the share btn can be absolute */
      .tile-thumb {
        position: relative;
      }
    `;
    document.head.appendChild(style);
  }

  // ---- Public API ------------------------------------------------------------
  window.URLSpace = {
    // Generate a slug for any game object { file, name }
    slugFor,

    // Resolve a slug string → game object (or null)
    resolve,

    // Full shareable URL for a game
    shareableUrl,

    // Copy a game's link to clipboard + show toast
    shareGame: async function (game) {
      const url = shareableUrl(game);
      const ok = await copyToClipboard(url);
      toast(ok ? '✓ link copied — ' + slugFor(game) : url);
      return url;
    },

    // Force slug map rebuild (call after mutating window.allGames externally)
    rebuild: invalidateSlugMap,

    // Decode a slug to its numeric value (debugging / curiosity)
    decode: fromBase62,

    // Encode a number to base62
    encode: (n) => toBase62(n, SLUG_LEN),

    // Show namespace stats in the console
    stats: function () {
      const total = Math.pow(BASE, SLUG_LEN);
      const games = (window.allGames || []).length;
      console.log(
        '[URLSpace]\n' +
        '  Alphabet:     ' + ALPHABET + '\n' +
        '  Slug length:  ' + SLUG_LEN + ' chars\n' +
        '  Namespace:    ' + total.toExponential(3) + ' (' + BASE + '^' + SLUG_LEN + ')\n' +
        '  Games loaded: ' + games + '\n' +
        '  Utilization:  ' + ((games / total) * 100).toExponential(3) + '%'
      );
    },
  };

  // ---- Boot ------------------------------------------------------------------
  injectStyles();

  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  function boot() {
    // Inject share buttons on first render
    injectShareButtons();
    // Watch for grid mutations (gamepix lazy-load, sheet injection, etc.)
    observeGridMutations();
    // Route from URL hash if present
    routeOnLoad();
  }
})();