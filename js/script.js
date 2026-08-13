/* ============================================================
   Practice Plan · Cinematic Three-Level Journey — script
   - i18n: detect system language, fetch lang/strings.<lang>.json
   - Scene manager: synchronized bottom→top pan transition
   - Scene 1/2/3 narrative animations (each plays once)
   - Feedback: open mail client preserving formatting
   ============================================================ */

/* ------------------------------------------------------------
   i18n
   ------------------------------------------------------------ */
const SUPPORTED = ['en','zh','fr','ru','ar'];
const DEFAULT_LANG = 'en';
const LANG_STORAGE_KEY = 'practice-plan-lang';
let currentStrings = null;

function detectLang(){
  const list = (navigator.languages && navigator.languages.length)
    ? navigator.languages
    : [navigator.language || DEFAULT_LANG];
  for(const l of list){
    const code = String(l||'').toLowerCase().split('-')[0];
    if(SUPPORTED.includes(code)) return code;
  }
  return DEFAULT_LANG;
}

function getPreferredLang(){
  try{
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if(saved && SUPPORTED.includes(String(saved).toLowerCase())){
      return String(saved).toLowerCase();
    }
  }catch(err){
    // localStorage may be unavailable in some restricted contexts.
  }
  return detectLang();
}

function rememberLang(lang){
  const normalized = SUPPORTED.includes(String(lang).toLowerCase())
    ? String(lang).toLowerCase()
    : DEFAULT_LANG;
  try{
    localStorage.setItem(LANG_STORAGE_KEY, normalized);
  }catch(err){
    // ignore storage errors; UI still works without persistence
  }
  return normalized;
}

function getPath(obj, path){
  return path.split('.').reduce((o,k)=> (o==null?undefined:o[k]), obj);
}

/* Dismiss the boot blur overlay. Called the instant text replacement
   finishes — or immediately when no translation is available (fetch
   failure). The overlay blocks every pointer event while visible. */
function dismissBootBlur(){
  const ov = document.getElementById('bootOverlay');
  if(!ov || ov.classList.contains('gone')) return;
  ov.classList.add('gone');
  // remove from DOM after the fade-out transition finishes
  setTimeout(()=>{ if(ov.parentNode) ov.parentNode.removeChild(ov); }, 700);
}

async function initI18n(lang = getPreferredLang()){
  const resolvedLang = rememberLang(lang);
  try{
    const res = await fetch(`lang/strings.${resolvedLang}.json`, {cache:'no-cache'});
    if(!res.ok) throw new Error('HTTP '+res.status);
    currentStrings = await res.json();
    applyStrings(currentStrings);
    document.documentElement.lang = currentStrings.lang || resolvedLang;
    document.documentElement.dir = currentStrings.dir || 'ltr';
    dismissBootBlur();
  }catch(err){
    console.warn('[i18n] Could not load lang/strings.'+resolvedLang+'.json — using built-in English.', err);
    document.documentElement.lang = DEFAULT_LANG;
    document.documentElement.dir = 'ltr';
    dismissBootBlur();
  }
}

function applyStrings(s){
  if(!s) return;
  document.documentElement.lang = s.lang || 'en';
  document.documentElement.dir = s.dir || 'ltr';
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const v = getPath(s, el.getAttribute('data-i18n'));
    if(v != null) el.textContent = v;
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el=>{
    const v = getPath(s, el.getAttribute('data-i18n-ph'));
    if(v != null) el.placeholder = v;
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(el=>{
    const v = getPath(s, el.getAttribute('data-i18n-aria'));
    if(v != null) el.setAttribute('aria-label', v);
  });
  document.querySelectorAll('[data-i18n-label]').forEach(el=>{
    const v = getPath(s, el.getAttribute('data-i18n-label'));
    if(v != null) el.setAttribute('data-label', v);
  });
}

/* ------------------------------------------------------------
   STATE + SCENE MANAGER
   ------------------------------------------------------------ */
const state = { current:1, played:{1:false,2:false,3:false}, transitioning:false };
const sceneEls = {
  1:document.querySelector('.scene[data-scene="1"]'),
  2:document.querySelector('.scene[data-scene="2"]'),
  3:document.querySelector('.scene[data-scene="3"]')
};

function updateNav(n){
  document.querySelectorAll('.scene-nav button').forEach(b=>{
    b.classList.toggle('on', +b.dataset.go===n);
  });
  document.querySelectorAll('.level-dots button').forEach(b=>{
    const g=+b.dataset.go;
    b.classList.toggle('on', g===n);
    b.classList.toggle('played', state.played[g]);
  });
}

/* Switch scenes: the outgoing scene pans UP (out the top) while the
   incoming scene pans UP from the bottom — both move bottom→top,
   synchronized. A seamless vertical scroll. */
function goToScene(n){
  if(state.transitioning || n===state.current) return;
  if(n<1||n>3) return;
  state.transitioning=true;
  const cur = sceneEls[state.current];
  const nxt = sceneEls[n];

  // place incoming at the bottom (translateY 100%), visible, no transition
  nxt.classList.add('notrans');
  nxt.style.visibility='visible';
  nxt.style.opacity='1';
  nxt.style.transform='translateY(100%)';
  nxt.style.pointerEvents='none';
  nxt.getBoundingClientRect(); // force reflow
  nxt.classList.remove('notrans');

  requestAnimationFrame(()=>{
    // synchronized upward pan
    cur.style.opacity='1';
    cur.style.transform='translateY(-100%)';   // exits out the top
    cur.style.pointerEvents='none';
    nxt.style.transform='translateY(0)';        // rises into place from the bottom
    nxt.style.pointerEvents='auto';
  });

  updateNav(n);
  state.current=n;

  setTimeout(()=>{
    // hide outgoing & reset it to the bottom for its next entry
    cur.style.visibility='hidden';
    cur.style.opacity='0';
    cur.style.transform='translateY(100%)';
    cur.style.pointerEvents='none';
    state.transitioning=false;
    if(!state.played[n]) playScene(n);
  }, 1180);
}

/* ------------------------------------------------------------
   SCENE 1 — starfield, satellite, wordmark, stars, intro
   ------------------------------------------------------------ */
const STAR_WORD = 'Practice Plan'; // brand wordmark, stays in English
let satAnim=null;

function initStarfield(){
  const c=document.getElementById('starfield1');
  const ctx=c.getContext('2d');
  let stars=[], w=0, h=0;
  function resize(){
    w=c.width=c.clientWidth; h=c.height=c.clientHeight;
    const count=Math.floor(w*h/9000);
    stars=[];
    for(let i=0;i<count;i++){
      stars.push({
        x:Math.random()*w, y:Math.random()*h*0.8,
        r:Math.random()*1.3+0.2,
        a:Math.random()*0.6+0.2,
        s:Math.random()*0.02+0.004,
        d:Math.random()<0.5?1:-1
      });
    }
  }
  resize();
  window.addEventListener('resize',resize);
  function draw(){
    ctx.clearRect(0,0,w,h);
    for(const st of stars){
      st.a+=st.s*st.d;
      if(st.a>=0.85||st.a<=0.15) st.d*=-1;
      ctx.beginPath();
      ctx.arc(st.x,st.y,st.r,0,Math.PI*2);
      ctx.fillStyle=`rgba(255,255,255,${st.a})`;
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  draw();
}

// bezier helpers (percent -> px)
function bez(p0,p1,p2,t){
  const mt=1-t;
  return { x: mt*mt*p0.x+2*mt*t*p1.x+t*t*p2.x,
           y: mt*mt*p0.y+2*mt*t*p1.y+t*t*p2.y };
}
function tan(p0,p1,p2,t){
  const mt=1-t;
  const dx=2*mt*(p1.x-p0.x)+2*t*(p2.x-p1.x);
  const dy=2*mt*(p1.y-p0.y)+2*t*(p2.y-p1.y);
  return Math.atan2(dy,dx)*180/Math.PI;
}
const easeInOutSine=t=>-(Math.cos(Math.PI*t)-1)/2;

function setupSatLayer(){
  const svg=document.getElementById('satSvg');
  const layer=svg.parentElement;
  const w=layer.clientWidth, h=layer.clientHeight;
  svg.setAttribute('viewBox',`0 0 ${w} ${h}`);

  const p0={x:0.84*w, y:0.74*h};
  const p1={x:0.72*w, y:0.26*h};
  const p2={x:0.15*w, y:0.23*h};
  const d=`M ${p0.x} ${p0.y} Q ${p1.x} ${p1.y} ${p2.x} ${p2.y}`;
  document.getElementById('trailGlowPath').setAttribute('d',d);
  document.getElementById('trailCorePath').setAttribute('d',d);

  // build letters
  const lg=document.getElementById('lettersG');
  lg.innerHTML='';
  const fs=Math.max(20, Math.min(w,h)*0.062);
  const chars=[...STAR_WORD];
  const n=chars.length;
  const tStart=0.12, tEnd=0.86;
  const items=[];
  chars.forEach((ch,i)=>{
    const ti=tStart+(tEnd-tStart)*(i/(n-1));
    const pos=bez(p0,p1,p2,ti);
    let ang=tan(p0,p1,p2,ti);
    // keep letters upright & in reading order: if the path tangent would
    // render a letter upside-down (>±90°), rotate by 180° so it stays readable
    if(ang>90) ang-=180; else if(ang<-90) ang+=180;
    const t=document.createElementNS('http://www.w3.org/2000/svg','text');
    t.setAttribute('x',pos.x);
    t.setAttribute('y',pos.y);
    t.setAttribute('text-anchor','middle');
    t.setAttribute('dominant-baseline','middle');
    t.setAttribute('transform',`rotate(${ang} ${pos.x} ${pos.y})`);
    t.setAttribute('font-family','Cormorant Garamond, serif');
    t.setAttribute('font-weight','600');
    t.setAttribute('font-size',fs);
    t.setAttribute('fill','#fff1c4');
    t.setAttribute('opacity','0');
    t.style.transition='opacity .5s ease';
    t.textContent= ch===' ' ? '\u00A0' : ch;
    lg.appendChild(t);
    items.push({t,ti});
  });
  return {p0,p1,p2,items};
}

function playScene1(){
  if(state.played[1]) return;
  state.played[1]=true;
  const cfg=setupSatLayer();
  const sat=document.getElementById('satellite');
  const glowPath=document.getElementById('trailGlowPath');
  const corePath=document.getElementById('trailCorePath');
  sat.style.opacity='1';
  sat.style.transition='opacity .4s ease';

  const dur=4600, t0=performance.now();
  function frame(now){
    let p=Math.min(1,(now-t0)/dur);
    const te=easeInOutSine(p);
    const pos=bez(cfg.p0,cfg.p1,cfg.p2,te);
    const ang=tan(cfg.p0,cfg.p1,cfg.p2,te);
    sat.setAttribute('transform',`translate(${pos.x} ${pos.y}) rotate(${ang})`);
    glowPath.setAttribute('stroke-dashoffset', 1-te);
    corePath.setAttribute('stroke-dashoffset', 1-te);
    for(const it of cfg.items){
      if(te>=it.ti && it.t.getAttribute('opacity')==='0'){
        it.t.setAttribute('opacity','1');
      }
    }
    if(p<1){ satAnim=requestAnimationFrame(frame); }
    else { finishScene1(); }
  }
  satAnim=requestAnimationFrame(frame);
}

function finishScene1(){
  const sat=document.getElementById('satellite');
  sat.style.opacity='0';
  document.getElementById('homeIntro').classList.add('show');
  spawnIntStars();
  setTimeout(()=>showCTA(1), 700);
}

function spawnIntStars(){
  const host=document.getElementById('intStars');
  host.innerHTML='';
  const positions=[
    {x:'12%',y:'18%',s:26}, {x:'34%',y:'8%',s:18},
    {x:'58%',y:'22%',s:22}, {x:'74%',y:'10%',s:16},
    {x:'86%',y:'34%',s:24}, {x:'22%',y:'42%',s:17},
    {x:'50%',y:'46%',s:19}
  ];
  positions.forEach((p,i)=>{
    const el=document.createElement('div');
    el.className='istar';
    el.style.left=p.x; el.style.top=p.y;
    el.style.width=p.s+'px'; el.style.height=p.s+'px';
    el.innerHTML=`<span class="glow-ring"></span>
      <svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M12 1.5l2.9 6.9 7.4.6-5.6 4.8 1.7 7.2L12 17.8 5.6 22l1.7-7.2L1.7 9.6l7.4-.6z" fill="#fff1c4"/></svg>`;
    el.addEventListener('click',()=>burstStar(el));
    host.appendChild(el);
    setTimeout(()=>el.classList.add('appear'), 250+i*180);
  });
}

function burstStar(el){
  if(el.classList.contains('gone')) return;
  el.classList.add('burst');
  setTimeout(()=>el.classList.add('gone'), 500);
}

function showCTA(scene){
  const cta=sceneEls[scene].querySelector('.scene-cta');
  if(cta) cta.classList.add('show');
}

/* ------------------------------------------------------------
   SCENE 2 — sun, clouds, windmill, cards
   ------------------------------------------------------------ */
function cloudSVG(scale){
  return `<svg width="${130*scale}" height="${70*scale}" viewBox="0 0 130 70">
    <g fill="#ffffff">
      <ellipse cx="35" cy="45" rx="28" ry="22"/>
      <ellipse cx="62" cy="38" rx="32" ry="26"/>
      <ellipse cx="92" cy="46" rx="26" ry="21"/>
      <ellipse cx="75" cy="52" rx="30" ry="18"/>
      <ellipse cx="45" cy="54" rx="26" ry="16"/>
    </g>
  </svg>`;
}

function playScene2(){
  if(state.played[2]) return;
  state.played[2]=true;
  setTimeout(()=>document.getElementById('sun').classList.add('show'), 200);

  const layer=document.getElementById('cloudsLayer');
  layer.innerHTML='';
  const specs=[
    {x:'8%',  y:'14%', s:1.0},
    {x:'28%', y:'30%', s:0.7},
    {x:'52%', y:'10%', s:1.15},
    {x:'70%', y:'26%', s:0.85},
    {x:'86%', y:'12%', s:0.65}
  ];
  specs.forEach((c,i)=>{
    const el=document.createElement('div');
    el.className='cloud';
    el.style.left=c.x; el.style.top=c.y;
    el.innerHTML=cloudSVG(c.s);
    el.addEventListener('click',()=>el.classList.add('fall'));
    layer.appendChild(el);
    setTimeout(()=>el.classList.add('in'), 700+i*900);
  });

  const cards=[...document.querySelectorAll('#cards .card')];
  cards.forEach((c,i)=>{
    setTimeout(()=>c.classList.add('in'), 700+specs.length*900+500+i*260);
  });
  setTimeout(()=>showCTA(2), 700+specs.length*900+500+cards.length*260+400);
}

/* ------------------------------------------------------------
   SCENE 3 — reveal form + one-time magma flow
   ------------------------------------------------------------ */
let magmaAnim=null;
function playScene3(){
  if(state.played[3]) return;
  state.played[3]=true;
  const reveals=[...document.querySelectorAll('.scene-contact .reveal')];
  reveals.forEach((r,i)=>setTimeout(()=>r.classList.add('in'), 200+i*260));
  setTimeout(playMagmaFlow, 200+reveals.length*260+200);
  setTimeout(()=>showCTA(3), 200+reveals.length*260+200+2600+300);
}

function playMagmaFlow(){
  const glow=document.getElementById('magmaGlowPath');
  const core=document.getElementById('magmaCorePath');
  const hot=document.getElementById('magmaHot');
  const dur=2400, t0=performance.now();
  const channel=document.getElementById('magmaChannel').getAttribute('d');
  function frame(now){
    let p=Math.min(1,(now-t0)/dur);
    const e=easeInOutSine(p);
    glow.setAttribute('stroke-dashoffset', 1-e);
    core.setAttribute('stroke-dashoffset', 1-e);
    hot.setAttribute('opacity', p>0.05 && p<0.95 ? 0.9 : 0);
    if(!frame.pathLen){
      const tmp=document.createElementNS('http://www.w3.org/2000/svg','path');
      tmp.setAttribute('d',channel);
      frame.pathLen=tmp.getTotalLength();
    }
    const pt=getPointOnPath(channel, frame.pathLen, e);
    hot.setAttribute('cx', pt.x);
    hot.setAttribute('cy', pt.y);
    if(p<1){ magmaAnim=requestAnimationFrame(frame); }
    else { hot.setAttribute('opacity','0'); }
  }
  magmaAnim=requestAnimationFrame(frame);
}

const _measurePath=document.createElementNS('http://www.w3.org/2000/svg','path');
function getPointOnPath(d,len,t){
  _measurePath.setAttribute('d',d);
  const L=len||_measurePath.getTotalLength();
  return _measurePath.getPointAtLength(L*t);
}

/* ------------------------------------------------------------
   SCENE DISPATCH + FEEDBACK
   ------------------------------------------------------------ */
function playScene(n){
  if(n===1) playScene1();
  else if(n===2) playScene2();
  else if(n===3) playScene3();
}

const FEEDBACK_EMAIL = 'wang.station@hotmail.com';

/* Open the user's mail client with the message body preserved exactly
   (line breaks kept). The textarea content is passed verbatim into the
   mailto body, so formatting is unchanged. */
function sendFeedback(e){
  e.preventDefault();
  const name = document.getElementById('fb-name').value.trim();
  const email = document.getElementById('fb-mail').value.trim();
  const msg = document.getElementById('fb-msg').value; // keep as typed (formatting preserved)
  const prefix = (currentStrings && getPath(currentStrings,'contact.form.subjectPrefix')) || '[Practice Plan Feedback]';
  const subject = `${prefix} ${name || '—'}`;
  // Body preserves the user's formatting (newlines). Signature appended.
  const body = `${msg}\n\n— ${name || '—'}${email ? ` (${email})` : ''}`;
  window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return false;
}

/* ------------------------------------------------------------
   AUTO FULLSCREEN
   Browsers only allow requestFullscreen() from a user gesture, so we
   attempt it on the first click/keydown after load (the very first
   interaction). A best-effort attempt is also made on load — it will
   silently reject without a gesture, which we swallow.
   Listeners are attached to `document` in the CAPTURE phase so they
   fire even when the boot overlay later swallows the same event.
   ------------------------------------------------------------ */
function setupAutoFullscreen(){
  const el = document.documentElement;
  const rfs = el.requestFullscreen || el.webkitRequestFullscreen
           || el.mozRequestFullScreen || el.msRequestFullscreen;
  if(!rfs) return;
  let activated = false;
  const tryFs = ()=>{
    if(activated) return;
    try{
      const p = rfs.call(el);
      if(p && typeof p.catch === 'function') p.catch(()=>{}); // swallow rejection
      activated = true;
    }catch(e){ /* ignore */ }
  };
  // Best-effort on load (usually rejected without gesture; harmless).
  tryFs();
  // Guaranteed on the first user gesture. Capture phase on `document`
  // runs BEFORE the boot overlay's own capture handler, so a click on
  // the overlay still activates fullscreen (then the overlay swallows
  // that same click so it never reaches the UI beneath).
  const opts = {capture:true, once:false};
  document.addEventListener('click', tryFs, opts);
  document.addEventListener('keydown', tryFs, opts);
}

/* ------------------------------------------------------------
   WIRING + BOOT
   ------------------------------------------------------------ */
document.querySelectorAll('[data-go]').forEach(b=>{
  b.addEventListener('click',()=>goToScene(+b.dataset.go));
});
document.querySelectorAll('.scene-cta').forEach(b=>{
  b.addEventListener('click',()=>goToScene(+b.dataset.next));
});

document.getElementById('resetBtn').addEventListener('click',()=>{
  const currentLang = getPreferredLang();
  state.current = 1;
  state.transitioning = false;
  state.played = {1:false,2:false,3:false};

  if (satAnim) cancelAnimationFrame(satAnim);
  if (magmaAnim) cancelAnimationFrame(magmaAnim);

  document.querySelectorAll('.scene').forEach(scene => {
    scene.style.visibility = 'hidden';
    scene.style.opacity = '0';
    scene.style.transform = 'translateY(100%)';
    scene.style.pointerEvents = 'none';
  });

  const s1 = sceneEls[1];
  s1.style.visibility = 'visible';
  s1.style.opacity = '1';
  s1.style.transform = 'translateY(0)';
  s1.style.pointerEvents = 'auto';

  document.querySelectorAll('.scene-cta').forEach(btn => btn.classList.remove('show'));
  const intro = document.getElementById('homeIntro');
  if (intro) intro.classList.remove('show');
  const sun = document.getElementById('sun');
  if (sun) sun.classList.remove('show');
  document.querySelectorAll('#cards .card').forEach(c => c.classList.remove('in'));
  document.querySelectorAll('.scene-contact .reveal').forEach(r => r.classList.remove('in'));
  const letters = document.querySelectorAll('#lettersG text');
  letters.forEach(t => t.setAttribute('opacity', '0'));
  const host = document.getElementById('intStars');
  if (host) host.innerHTML = '';

  updateNav(1);
  initI18n(currentLang);
  initStarfield();
  setTimeout(playScene1, 400);
});
document.getElementById('contactForm').addEventListener('submit', sendFeedback);

// While the boot blur overlay is visible it must swallow EVERY pointer
// event so no underlying control can be activated. Capture-phase listeners
// intercept the event before it can reach any button beneath.
(function lockBootOverlay(){
  const ov = document.getElementById('bootOverlay');
  if(!ov) return;
  ['click','mousedown','mouseup','touchstart','touchend','pointerdown','pointerup','dblclick','contextmenu','wheel'].forEach(type=>{
    ov.addEventListener(type, e=>{ e.preventDefault(); e.stopPropagation(); }, {capture:true});
  });
})();

window.addEventListener('keydown',e=>{
  // ignore navigation keys while the boot overlay is still up
  const ov = document.getElementById('bootOverlay');
  if(ov && !ov.classList.contains('gone')){
    e.preventDefault(); e.stopPropagation();
    return;
  }
  if(e.key==='ArrowDown'||e.key==='ArrowRight') goToScene(Math.min(3,state.current+1));
  else if(e.key==='ArrowUp'||e.key==='ArrowLeft') goToScene(Math.max(1,state.current-1));
});

window.addEventListener('resize',()=>{
  if(state.current===1 && state.played[1]){
    setupSatLayer();
    document.querySelectorAll('#lettersG text').forEach(t=>t.setAttribute('opacity','1'));
    document.getElementById('trailGlowPath').setAttribute('stroke-dashoffset','0');
    document.getElementById('trailCorePath').setAttribute('stroke-dashoffset','0');
    document.getElementById('satellite').style.opacity='0';
  }
});

async function boot(){
  // scene 1 visible immediately (also set inline in HTML for first paint)
  const s1 = sceneEls[1];
  s1.style.visibility='visible';
  s1.style.opacity='1';
  s1.style.transform='translateY(0)';
  s1.style.pointerEvents='auto';
  updateNav(1);
  setupAutoFullscreen();
  // i18n runs FIRST: the boot blur is dismissed the moment text
  // replacement completes (or immediately if no translation loads).
  // No narrative animation starts until the blur is gone.
  await initI18n();
  initStarfield();
  setTimeout(playScene1, 400);
}
window.addEventListener('load', boot);
