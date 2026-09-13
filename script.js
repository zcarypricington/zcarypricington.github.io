(() => {
  "use strict";

  const GAMES_URL = "./games.json";
  const REQUEST_ENDPOINT = "https://script.google.com/macros/s/AKfycbwzRQYzsauP60uto83r5heFbxmJNffu_6LL7I0DEouDTYZJv-K5yX45kKaXMd89nl_kyA/exec";
  const SETTINGS_KEY = "thearchive.settings";
  const DEFAULTS = {
    theme:"default", fx:"off", fxDensity:1, gridSize:180,
    fullscreenOnPlay:false, confirmBeforeClose:false, reduceMotion:false,
    cloakEnabled:false, cloakTitle:"Classes",
    cloakFavicon:"https://www.gstatic.com/classroom/logo_square_rounded.svg"
  };

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const loadState = () => { try { return {...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}")}; } catch { return {...DEFAULTS}; } };
  let state = loadState();
  const save = () => localStorage.setItem(SETTINGS_KEY, JSON.stringify(state));

  const school = $("#school-screen"), transition = $("#transition"), archive = $("#archive");
  let activated = false, games = [], category = "All", query = "";

  function activate() {
    if (activated) return;
    activated = true;
    transition.classList.remove("hidden");
    setTimeout(() => {
      school.classList.add("hidden");
      archive.classList.remove("hidden");
      transition.classList.add("hidden");
      document.body.classList.add("archive-active");
      render();
      syncSettingsUI();
      setTimeout(() => setFX(state.fx), 50);
    }, 700);
  }
  addEventListener("keydown", e => { if (e.key.toLowerCase()==="e" && !["INPUT","TEXTAREA"].includes(document.activeElement.tagName)) activate(); });
  $("#school-request").addEventListener("click", e => { e.preventDefault(); activate(); setTimeout(openRequest, 800); });

  async function loadGames() {
    try {
      const r = await fetch(GAMES_URL, {cache:"no-store"});
      games = await r.json();
    } catch {
      games = [];
    }
    $("#game-count").textContent = `· ${games.length} TITLES`;
    buildFilters();
    render();
  }

  function buildFilters() {
    const categories = ["All", ...new Set(games.map(g=>g.tag).filter(Boolean))];
    $("#filters").innerHTML = categories.map(c => `<button class="filter ${c===category?"active":""}" data-category="${esc(c)}">${esc(c)}</button>`).join("");
    $$(".filter").forEach(b => b.onclick = () => { category=b.dataset.category; buildFilters(); render(); });
  }

  function render() {
    const filtered = games.filter(g => {
      const matchesCategory = category==="All" || g.tag===category;
      const hay = `${g.name} ${g.tag}`.toLowerCase();
      return matchesCategory && hay.includes(query.toLowerCase());
    });
    $("#result-count").textContent = `${filtered.length} RESULT${filtered.length===1?"":"S"}`;
    $("#empty").classList.toggle("hidden", filtered.length !== 0);
    $("#game-grid").innerHTML = filtered.map((g,i) => `
      <article class="game-card" data-index="${games.indexOf(g)}">
        <img loading="lazy" src="${escAttr(g.icon||"")}" alt="" onerror="this.style.opacity=.12">
        <div class="shade"></div>
        <div class="game-info"><small>${esc(g.tag||"Game")}</small><h4>${esc(g.name||"Untitled")}</h4></div>
      </article>`).join("");
    $$(".game-card").forEach(card => card.onclick = () => play(games[Number(card.dataset.index)]));
    document.documentElement.style.setProperty("--card", `${state.gridSize}px`);
  }

  $("#search").addEventListener("input", e => { query=e.target.value.trim(); render(); });
  $("#clear-search").onclick = () => { $("#search").value=""; query=""; render(); };
  addEventListener("keydown", e => {
    if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="k") { e.preventDefault(); activate(); $("#search").focus(); }
    if (e.key==="Escape") { $("#search").value=""; query=""; render(); closeRequest(); }
  });

  function play(game) {
    if (!game) return;
    $("#play-title").textContent = game.name;
    $("#play-tag").textContent = game.tag || "Game";
    $("#game-frame").src = game.file;
    $("#game-modal").classList.remove("hidden");
    document.body.style.overflow = "hidden";
    if (state.fullscreenOnPlay) setTimeout(() => $("#game-frame").requestFullscreen?.().catch(()=>{}), 250);
  }
  function closeGame() {
    if (state.confirmBeforeClose && $("#game-frame").src && !confirm("Close this game?")) return;
    $("#game-frame").src = "about:blank";
    $("#game-modal").classList.add("hidden");
    document.body.style.overflow = "";
  }
  $("#play-close").onclick = closeGame;
  $("#play-fullscreen").onclick = () => $("#game-frame").requestFullscreen?.().catch(()=>{});
  $("#game-modal").addEventListener("click", e => { if (e.target.id==="game-modal") closeGame(); });

  function showView(view) {
    $("#browse-view").classList.toggle("hidden", view!=="browse");
    $("#settings-view").classList.toggle("hidden", view!=="settings");
    $$(".nav-btn[data-view]").forEach(b=>b.classList.toggle("active", b.dataset.view===view));
    if (view==="settings") syncSettingsUI();
    scrollTo({top:0,behavior:"smooth"});
  }
  $$("[data-view]").forEach(b => b.addEventListener("click", e => { e.preventDefault(); showView(b.dataset.view); }));
  $("[data-home]").onclick = e => { e.preventDefault(); showView("browse"); };

  const themes = [
    ["default","#8b5cf6"],["mono","#111111"],["blue","#3d7bff"],["teal","#2fcf9e"],
    ["red","#ef4444"],["amber","#f5a623"],["purple","#6a5cff"],["magenta","#d94fd9"]
  ];
  function applyTheme() {
    if (state.theme==="default") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.dataset.theme=state.theme;
  }
  function syncSettingsUI() {
    applyTheme();
    $("#theme-row").innerHTML = themes.map(([name,color]) => `<button class="swatch ${state.theme===name?"active":""}" title="${name}" data-theme="${name}" style="background:${color}"></button>`).join("");
    $$(".swatch").forEach(b => b.onclick=()=>{state.theme=b.dataset.theme;save();syncSettingsUI();});
    $("#grid-size").value=String(state.gridSize);
    $("#fx-mode").value=state.fx;
    $("#fx-density").value=String(state.fxDensity);
    [["reduce-motion","reduceMotion"],["fullscreen-play","fullscreenOnPlay"],["confirm-close","confirmBeforeClose"],["cloak-enabled","cloakEnabled"]].forEach(([id,key])=>$( "#"+id).classList.toggle("on",!!state[key]));
    $("#cloak-title").value=state.cloakTitle;
    $("#cloak-favicon").value=state.cloakFavicon;
  }
  $("#grid-size").onchange=e=>{state.gridSize=+e.target.value;save();render();};
  $("#fx-mode").onchange=e=>{state.fx=e.target.value;save();setFX(state.fx);};
  $("#fx-density").onchange=e=>{state.fxDensity=+e.target.value;save();setFX(state.fx);};
  [["reduce-motion","reduceMotion"],["fullscreen-play","fullscreenOnPlay"],["confirm-close","confirmBeforeClose"],["cloak-enabled","cloakEnabled"]].forEach(([id,key])=>{
    $("#"+id).onclick=()=>{state[key]=!state[key];save();syncSettingsUI();if(key==="reduceMotion")document.documentElement.classList.toggle("reduce-motion",state[key]);if(key==="cloakEnabled")syncCloak();};
  });
  $("#cloak-title").oninput=e=>{state.cloakTitle=e.target.value;save();syncCloak();};
  $("#cloak-favicon").oninput=e=>{state.cloakFavicon=e.target.value;save();syncCloak();};
  $("#reset-settings").onclick=()=>{if(confirm("Reset all local settings?")){state={...DEFAULTS};save();syncSettingsUI();setFX("off");}};

  function setIcon(href) {
    $$('link[rel*="icon"]').forEach(x=>x.remove());
    const l=document.createElement("link"); l.rel="icon"; l.href=href; document.head.appendChild(l);
  }
  function syncCloak() {
    if (!state.cloakEnabled) {
      document.title="Doomsday — Digital Archive";
      setIcon("./g/assets/favicon-96x96.png");
      return;
    }
    document.title=state.cloakTitle||"Classes";
    setIcon(state.cloakFavicon||DEFAULTS.cloakFavicon);
  }
  $("#cloak-open").onclick=()=>{
    const w=window.open("about:blank","_blank");
    if(!w){alert("Popup blocked — allow pop-ups for this site and try again.");return;}
    w.document.open();
    w.document.write(`<title>${esc(state.cloakTitle||"Classes")}</title><link rel="icon" href="${escAttr(state.cloakFavicon||DEFAULTS.cloakFavicon)}"><style>html,body,iframe{margin:0;width:100%;height:100%;border:0;overflow:hidden}</style><iframe src="${location.href}"></iframe>`);
    w.document.close();
  };
  syncCloak();

  const modal=$("#request-modal");
  function openRequest(){modal.classList.remove("hidden");setTimeout(()=>$("#request-name").focus(),30);}
  function closeRequest(){modal.classList.add("hidden");$("#request-status").textContent="";}
  ["request-cta","school-request"].forEach(id=>{const el=$("#"+id);if(el)el.onclick=e=>{e.preventDefault();if(!activated)activate();setTimeout(openRequest,activated?0:750);};});
  $("#request-close").onclick=closeRequest;
  modal.addEventListener("click",e=>{if(e.target===modal)closeRequest();});
  $("#request-form").onsubmit=async e=>{
    e.preventDefault();
    const name=$("#request-name").value.trim(), note=$("#request-note").value.trim(), status=$("#request-status");
    if(!name)return;
    status.textContent="Sending…";
    try {
      const body=new URLSearchParams({name,note});
      await fetch(REQUEST_ENDPOINT,{method:"POST",mode:"no-cors",headers:{"Content-Type":"application/x-www-form-urlencoded"},body});
      status.textContent="Request sent.";
      e.target.reset();
      setTimeout(closeRequest,1000);
    } catch {
      status.textContent="Saved locally — endpoint unavailable.";
      const saved=JSON.parse(localStorage.getItem("thearchive.requests")||"[]");
      saved.push({name,note,createdAt:new Date().toISOString()});
      localStorage.setItem("thearchive.requests",JSON.stringify(saved));
    }
  };

  const music=$("#bg-music"), musicBtn=$("#music-btn");
  let musicOn=false;
  function toggleMusic(){musicOn=!musicOn;if(musicOn)music.play().catch(()=>{});else music.pause();musicBtn.style.color=musicOn?"var(--accent2)":"";}
  musicBtn.onclick=toggleMusic;
  addEventListener("pointerdown",()=>{if(!musicOn)music.play().then(()=>{musicOn=true;musicBtn.style.color="var(--accent2)"}).catch(()=>{});},{once:true});

  // Ambient FX
  const canvas=$("#fx"), ctx=canvas.getContext("2d");
  let W=0,H=0,dpr=1,fxMode="off",fxDensity=1,items=[],raf=0,last=0;
  function resizeFX(){dpr=Math.min(devicePixelRatio||1,1.5);W=innerWidth;H=innerHeight;canvas.width=W*dpr;canvas.height=H*dpr;canvas.style.width=W+"px";canvas.style.height=H+"px";ctx.setTransform(dpr,0,0,dpr,0,0);buildFX();}
  function buildFX(){
    items=[]; const n=Math.max(12,Math.round((W*H/1200000)*fxDensity*260));
    if(fxMode==="matrix"){for(let i=0;i<Math.floor(W/14*.7*fxDensity);i++)items.push({x:Math.random()*W,y:-Math.random()*H,s:10+Math.random()*20});}
    else for(let i=0;i<n;i++)items.push({x:Math.random()*W,y:Math.random()*H,r:.5+Math.random()*2,vx:(Math.random()-.5)*.5,vy:.3+Math.random()*1.1,p:Math.random()*6.28});
  }
  function drawFX(now){
    if(fxMode==="off"||state.reduceMotion){ctx.clearRect(0,0,W,H);raf=requestAnimationFrame(drawFX);return}
    const dt=Math.min(50,now-last||16);last=now;ctx.clearRect(0,0,W,H);
    const accent=getComputedStyle(document.documentElement).getPropertyValue("--phosphor").trim()||"#b8f4e0";
    ctx.fillStyle=accent;ctx.strokeStyle=accent;
    if(fxMode==="matrix"){
      ctx.font='14px "Courier New"';ctx.globalAlpha=.45;
      for(const x of items){x.y+=x.s*dt/16.7;ctx.fillText("01ABCDEF"[Math.floor(Math.random()*8)],x.x,x.y);if(x.y>H+40){x.y=-20;x.x=Math.random()*W}}
      ctx.globalAlpha=1;
    } else if(fxMode==="rain"){
      ctx.globalAlpha=.35;ctx.lineWidth=1;for(const p of items){p.y+=p.vy*7*dt/16.7;p.x-=1;if(p.y>H+20){p.y=-20;p.x=Math.random()*W}ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+3,p.y-14);ctx.stroke()}ctx.globalAlpha=1;
    } else if(fxMode==="snow"){
      ctx.globalAlpha=.7;for(const p of items){p.p+=.02*dt;p.x+=Math.sin(p.p)*.35;p.y+=p.vy*dt/16.7;if(p.y>H+5)p.y=-5;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,7);ctx.fill()}ctx.globalAlpha=1;
    } else {
      for(const p of items){p.x+=p.vx*dt/16.7;p.y+=p.vy*dt/16.7;if(p.x<0)p.x=W;if(p.x>W)p.x=0;if(p.y<0)p.y=H;if(p.y>H)p.y=0;ctx.globalAlpha=.45;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,7);ctx.fill()}
      if(fxMode==="constellations"){ctx.globalAlpha=.1;for(let i=0;i<items.length;i++)for(let j=i+1;j<Math.min(items.length,i+5);j++){const a=items[i],b=items[j],dx=a.x-b.x,dy=a.y-b.y;if(dx*dx+dy*dy<7000){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}}ctx.globalAlpha=1}
    }
    raf=requestAnimationFrame(drawFX);
  }
  function setFX(mode){fxMode=mode;fxDensity=state.fxDensity;buildFX();cancelAnimationFrame(raf);last=performance.now();raf=requestAnimationFrame(drawFX);}
  addEventListener("resize",resizeFX);resizeFX();

  function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
  const escAttr=esc;

  loadGames();
})();
