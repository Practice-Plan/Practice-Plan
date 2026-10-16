/* PPC home — cinematic Three.js world + GSAP/Lenis motion system
   World bible (drafts/01-mainpage-3d.md):
   - One persistent world, scroll = deterministic conductor (scroll-worlds pattern)
   - Central amber octahedron core (heartbeat 1.2s) + cyan satellites on orbit rings
   - Data packets stream along curved paths satellite → core, arrival = core flash
   - Camera chapters: hero(front-right) → pullback(overview) → overhead → side → low drift
   - Quality gates: DPR≤1.75 / mobile stars+packets halved / reduced-motion static frame /
     context-loss → CSS fallback / pause when hidden / dispose on unload
   Depends: vendor/three.min.js, vendor/gsap.min.js, vendor/ScrollTrigger.min.js, vendor/lenis.min.js */
(function(){
'use strict';

var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var isMobile = window.matchMedia('(max-width: 900px)').matches;
var reduce = prefersReduced || isMobile; /* mobile: lighter world, still animated */
var html = document.documentElement;

/* ============ MOTION-READY FLAG (no-JS / reduced-motion keep content visible) ============ */
if(!prefersReduced) html.classList.add('motion');

/* ============ Lenis smooth scroll + ScrollTrigger wiring ============ */
var lenis = null;
if(!prefersReduced && window.Lenis){
  lenis = new Lenis({ duration: 1.15, smoothWheel: true, touchMultiplier: 1.4 });
  lenis.on('scroll', function(){ if(window.ScrollTrigger) ScrollTrigger.update(); });
  gsap.ticker.add(function(t){ lenis.raf(t * 1000); });
  gsap.ticker.lagSmoothing(0);
}

/* ============ THREE world ============ */
var canvas = document.getElementById('bg3d');
var three3D = null; /* success flag */

function initWorld(){
  if(!canvas || !window.THREE) return false;
  var renderer;
  try{
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !reduce, alpha: true, powerPreference: 'high-performance' });
  }catch(e){ return false; }

  var DPR_CAP = reduce ? 1.25 : 1.75;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_CAP));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);

  var scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0e14, 0.028);
  var camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 120);

  var AMBER = 0xffb454, CYAN = 0x4dd0e1, WHITE = 0xe8eef6;

  /* --- glow sprite texture (canvas-generated, no downloads) --- */
  function glowTexture(){
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(64,64,0,64,64,64);
    grad.addColorStop(0,'rgba(255,190,110,0.9)');
    grad.addColorStop(0.35,'rgba(255,180,84,0.28)');
    grad.addColorStop(1,'rgba(255,180,84,0)');
    g.fillStyle = grad; g.fillRect(0,0,128,128);
    var t = new THREE.CanvasTexture(c); return t;
  }
  var glowTex = glowTexture();

  /* --- CORE: outer wireframe octahedron + inner glowing solid --- */
  var coreGroup = new THREE.Group(); scene.add(coreGroup);
  var coreOuter = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.35, 0),
    new THREE.MeshBasicMaterial({ color: AMBER, wireframe: true, transparent: true, opacity: 0.85 })
  );
  var coreInner = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.62, 0),
    new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0.9 })
  );
  var coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.6, depthWrite: false }));
  coreGlow.scale.set(5.2, 5.2, 1);
  coreGroup.add(coreOuter, coreInner, coreGlow);

  /* --- ORBIT RINGS + SATELLITES --- */
  var SAT_N = reduce ? 4 : 7;
  var sats = [];
  var rings = [];
  var satGeo = new THREE.IcosahedronGeometry(0.16, 0);
  for(var i=0; i<SAT_N; i++){
    var radius = 2.6 + (i % 3) * 0.9;
    var incl  = [0.15, 0.55, -0.35, 0.95, -0.7, 0.35, -0.15][i % 7];
    var speed = 0.12 + (i % 4) * 0.05;
    var phase = (i / SAT_N) * Math.PI * 2;
    var mat = new THREE.MeshBasicMaterial({ color: i === 0 ? AMBER : CYAN, transparent: true, opacity: 0.95 });
    var mesh = new THREE.Mesh(satGeo, mat);
    var sglow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.35, color: i===0?AMBER:CYAN, depthWrite: false }));
    sglow.scale.set(1.1, 1.1, 1);
    scene.add(mesh, sglow);
    sats.push({ mesh: mesh, glow: sglow, r: radius, incl: incl, speed: speed, phase: phase, y: Math.sin(incl)*radius*0.3 });
    /* orbit ring line (only for first 3 to keep draw calls low) */
    if(i < 3){
      var pts = [];
      for(var a=0; a<=64; a++){
        var th = (a/64)*Math.PI*2;
        pts.push(new THREE.Vector3(Math.cos(th)*radius, Math.sin(incl*2)*radius*0.12, Math.sin(th)*radius));
      }
      var ring = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.14 })
      );
      scene.add(ring); rings.push(ring);
    }
  }

  /* --- DATA PACKETS: satellite → core curved streams --- */
  var PACKET_N = reduce ? 24 : 56;
  var packets = [];
  var pGeo = new THREE.SphereGeometry(0.045, 6, 6);
  for(var p=0; p<PACKET_N; p++){
    var pm = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.9 }));
    pm.scale.setScalar(0.7 + Math.random()*0.7);
    scene.add(pm);
    packets.push({ mesh: pm, t: Math.random(), speed: 0.25 + Math.random()*0.35, sat: sats[(p*3) % SAT_N], lift: 0.8 + Math.random()*1.4 });
  }

  /* --- STARFIELD --- */
  var STAR_N = reduce ? 220 : 460;
  var starPos = new Float32Array(STAR_N * 3);
  for(var s=0; s<STAR_N; s++){
    var r = 26 + Math.random()*34, th = Math.random()*Math.PI*2, ph = Math.acos(2*Math.random()-1);
    starPos[s*3]   = r*Math.sin(ph)*Math.cos(th);
    starPos[s*3+1] = r*Math.cos(ph)*0.6;
    starPos[s*3+2] = r*Math.sin(ph)*Math.sin(th);
  }
  var starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  var stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0x8fa8bf, size: 0.09, transparent: true, opacity: 0.55, sizeAttenuation: true }));
  scene.add(stars);

  /* ============ CAMERA CHAPTERS (scroll = conductor) ============ */
  /* keyframes: [px,py,pz, lx,ly,lz] — lerp piecewise on normalized progress */
  var KEYS = [
    [ 0.0,  0.5,  7.6,  -1.15, 0.10, 0.0 ],  /* 0.00 hero — core sits right of copy */
    [ 2.6,  2.8,  6.0,   0.00, 0.00, 0.0 ],  /* 0.28 pullback overview */
    [ 0.0,  7.6,  3.2,   0.00, 0.00, 0.0 ],  /* 0.55 overhead (architecture) */
    [-6.8,  1.4,  2.4,   0.00, 0.00, 0.0 ],  /* 0.80 side (timeline) */
    [-3.4, -2.8,  7.0,   0.00, 0.00, 0.0 ]   /* 1.00 low drift (download) */
  ];
  var KEY_AT = [0.0, 0.28, 0.55, 0.80, 1.0];
  var camPos = new THREE.Vector3(KEYS[0][0], KEYS[0][1], KEYS[0][2]);
  var camLook = new THREE.Vector3(KEYS[0][3], KEYS[0][4], KEYS[0][5]);
  var tgtPos = camPos.clone(), tgtLook = camLook.clone();
  var progress = 0;

  function sampleKeys(p){
    var i = 0;
    while(i < KEY_AT.length-2 && p > KEY_AT[i+1]) i++;
    var a = KEYS[i], b = KEYS[i+1];
    var span = KEY_AT[i+1]-KEY_AT[i];
    var f = span > 0 ? Math.min(1, Math.max(0, (p-KEY_AT[i])/span)) : 0;
    f = f*f*(3-2*f); /* smoothstep */
    tgtPos.set(a[0]+(b[0]-a[0])*f, a[1]+(b[1]-a[1])*f, a[2]+(b[2]-a[2])*f);
    tgtLook.set(a[3]+(b[3]-a[3])*f, a[4]+(b[4]-a[4])*f, a[5]+(b[5]-a[5])*f);
  }

  /* hero on mobile: center the core instead of right-offset */
  function applyLayout(){
    if(window.innerWidth < 900){ tgtLook.x = 0; } /* sampled keys set x; override after sample below */
  }

  /* --- mouse parallax (desktop, damped) --- */
  var mx = 0, my = 0, mtx = 0, mty = 0;
  if(window.matchMedia('(pointer: fine)').matches && !prefersReduced){
    window.addEventListener('pointermove', function(e){
      mtx = (e.clientX / window.innerWidth - 0.5);
      mty = (e.clientY / window.innerHeight - 0.5);
    }, { passive: true });
  }

  /* --- heartbeat + packet arrival flash --- */
  var beat = 0, flash = 0;

  /* --- render loop --- */
  var running = true, lastT = performance.now();
  var tmpV = new THREE.Vector3(), tmpC = new THREE.Vector3();

  function frame(now){
    if(!running) return;
    var dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    var t = now / 1000;

    sampleKeys(progress);
    if(window.innerWidth < 900) tgtLook.x = 0;

    /* damped camera */
    mx += (mtx - mx) * 0.04; my += (mty - my) * 0.04;
    camPos.lerp(tgtPos, 0.06);
    camLook.lerp(tgtLook, 0.06);
    camera.position.set(camPos.x + mx*0.9, camPos.y - my*0.5, camPos.z);
    camera.lookAt(camLook);

    /* core: rotation + heartbeat (1.2s) + arrival flash */
    beat = (Math.sin(t * (Math.PI*2/1.2)) * 0.5 + 0.5);
    flash = Math.max(0, flash - dt * 2.2);
    var k = 1 + beat * 0.05 + flash * 0.16;
    coreInner.scale.setScalar(k);
    coreInner.rotation.y = t * 0.4; coreInner.rotation.x = Math.sin(t*0.3)*0.2;
    coreOuter.rotation.y = -t * 0.15; coreOuter.rotation.z = Math.sin(t*0.2)*0.1;
    coreGlow.material.opacity = 0.42 + beat * 0.2 + flash * 0.5;
    coreGlow.scale.setScalar(5.2 * (1 + flash * 0.25));

    /* satellites */
    for(var i=0; i<sats.length; i++){
      var st = sats[i];
      var th = st.phase + t * st.speed;
      var x = Math.cos(th) * st.r, z = Math.sin(th) * st.r, y = st.y * Math.cos(th * 1.7);
      st.mesh.position.set(x, y, z);
      st.mesh.rotation.y = t * 0.6;
      st.glow.position.set(x, y, z);
    }

    /* packets: quadratic bezier sat → lift control → core; arrival bumps flash */
    for(var q=0; q<packets.length; q++){
      var pk = packets[q];
      var sp = pk.sat.mesh.position;
      var tt = pk.t;
      /* bezier control point between sat and core, lifted */
      tmpC.set((sp.x*0.5), (sp.y*0.5 + pk.lift), (sp.z*0.5));
      var u = 1 - tt;
      tmpV.set(
        u*u*sp.x + 2*u*tt*tmpC.x + tt*tt*0,
        u*u*sp.y + 2*u*tt*tmpC.y + tt*tt*0,
        u*u*sp.z + 2*u*tt*tmpC.z + tt*tt*0
      );
      pk.mesh.position.copy(tmpV);
      pk.mesh.material.opacity = 0.25 + 0.65 * Math.sin(Math.PI * tt);
      pk.mesh.lookAt(0,0,0);
      pk.t += dt * pk.speed;
      if(pk.t >= 1){ pk.t = 0; flash = Math.min(1, flash + 0.35); if(Math.random()<0.3) pk.sat = sats[(Math.random()*sats.length)|0]; }
    }

    stars.rotation.y = t * 0.008;
    for(var r=0; r<rings.length; r++) rings[r].rotation.y = t * 0.02;

    /* canvas dims with depth as user scrolls past hero */
    canvas.style.opacity = String(Math.max(0.34, 1 - progress * 0.5));

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  /* --- reduced motion: single static frame, no loop --- */
  if(prefersReduced){
    sampleKeys(0.12);
    camPos.copy(tgtPos); camLook.copy(tgtLook);
    camera.position.copy(camPos); camera.lookAt(camLook);
    for(var i2=0; i2<sats.length; i2++){ sats[i2].mesh.position.set(Math.cos(sats[i2].phase)*sats[i2].r, sats[i2].y, Math.sin(sats[i2].phase)*sats[i2].r); sats[i2].glow.position.copy(sats[i2].mesh.position); }
    renderer.render(scene, camera);
  } else {
    requestAnimationFrame(frame);
  }

  /* --- scroll progress source: ScrollTrigger scrub over whole page --- */
  if(window.ScrollTrigger && !prefersReduced){
    ScrollTrigger.create({
      trigger: document.body, start: 0, end: 'max', scrub: true,
      onUpdate: function(self){ progress = self.progress; }
    });
  } else if(!prefersReduced){
    var onScroll = function(){ progress = window.scrollY / Math.max(1, document.body.scrollHeight - window.innerHeight); };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }

  /* --- resize (debounced) --- */
  var rzT;
  window.addEventListener('resize', function(){
    clearTimeout(rzT);
    rzT = setTimeout(function(){
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      if(prefersReduced) renderer.render(scene, camera);
    }, 150);
  });

  /* --- pause when tab hidden --- */
  document.addEventListener('visibilitychange', function(){
    if(document.hidden){ running = false; }
    else if(!running && !prefersReduced){ running = true; lastT = performance.now(); requestAnimationFrame(frame); }
  });

  /* --- context loss → graceful fallback to CSS scene --- */
  canvas.addEventListener('webglcontextlost', function(e){
    e.preventDefault(); running = false;
    html.classList.remove('has-3d');
  }, false);

  return true;
}

/* ============ BOOT ============ */
three3D = initWorld();
if(three3D){
  html.classList.add('has-3d');      /* hides CSS fallback scene, translucent .alt */
} else {
  html.classList.add('no-3d');       /* keeps CSS orbit scene */
}

/* ============ GSAP entrance + scroll reveals (language-switch safe: whole-element, no word split) ============ */
if(!prefersReduced && window.gsap){
  gsap.registerPlugin(ScrollTrigger);

  /* hero entrance: badge → h1 → sub → CTAs */
  gsap.timeline({ defaults: { ease: 'power3.out' } })
    .from('#hero .badge', { opacity: 0, y: 14, duration: 0.45 }, 0.05)
    .from('#hero h1', { opacity: 0, y: 26, duration: 0.6 }, 0.18)
    .from('#hero .hero-sub', { opacity: 0, y: 18, duration: 0.55 }, 0.42)
    .from('#hero .cta-row .btn-p, #hero .cta-row .btn-s', { opacity: 0, y: 14, duration: 0.5, stagger: 0.1 }, 0.58)
    .from('#hero .scene', { opacity: 0, duration: 0.8, ease: 'power2.out' }, 0.3);

  /* section blocks reveal in view */
  var sel = 'section .h2, section .lead, #features .fcard, #protocol .step, #protocol .term, #download .dcard, #versions .tnode, #architecture .dg-shell, #architecture .arch, #architecture .arch-notes, #download .archsel, #download .dnote, #download .arch-notes';
  gsap.utils.toArray(sel).forEach(function(el){
    gsap.from(el, {
      opacity: 0, y: 30, duration: 0.7, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true }
    });
  });

  /* feature cards stagger within grid */
  gsap.from('#features .fcard', {
    opacity: 0, y: 34, duration: 0.65, ease: 'power3.out', stagger: 0.06,
    scrollTrigger: { trigger: '#features .fgrid', start: 'top 82%', once: true }
  });

  /* timeline axis growth (scrub) */
  gsap.fromTo('#versions .tlaxis', { scaleY: 0 }, {
    scaleY: 1, ease: 'none',
    transformOrigin: 'top center',
    scrollTrigger: { trigger: '#versions', start: 'top 70%', end: 'bottom 60%', scrub: 0.6 }
  });

  /* terminal typewriter in protocol section */
  var term = document.querySelector('#protocol .term');
  if(term){
    var lines = term.querySelectorAll('.l, div:not(.dots)');
    if(lines.length){
      gsap.set(lines, { opacity: 0 });
      gsap.to(lines, {
        opacity: 1, duration: 0.05, stagger: 0.28, ease: 'none',
        scrollTrigger: { trigger: term, start: 'top 75%', once: true }
      });
    }
  }

  /* nav condense on scroll */
  ScrollTrigger.create({
    start: 80, end: 'max',
    onUpdate: function(self){ html.classList.toggle('scrolled', self.scroll() > 80); }
  });

  gsap.delayedCall(0.3, function(){ ScrollTrigger.refresh(); });
}

})();
