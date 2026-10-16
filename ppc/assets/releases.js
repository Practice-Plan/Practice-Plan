/* PPC home — GitHub releases live download section
   Source: api.github.com/repos/Practice-Plan/Practice-Plan/releases/latest (public, no auth)
   - 1h localStorage cache (unauth rate limit = 60 req/h)
   - Offline / fail → keep static facts values (v0.1.0) baked in the HTML
   - Only touches NON-i18n elements, so language switching never fights live data */
(function(){
'use strict';

var API = 'https://api.github.com/repos/Practice-Plan/Practice-Plan/releases/latest';
var KEY = 'ppc-release', TTL = 3600e3;

function kb(bytes){
  var mb = bytes / 1048576;
  return (mb >= 10 ? Math.round(mb) : mb.toFixed(2)) + ' MB';
}
function verFromTag(tag){ return (tag || '').replace(/^ppc[-_]?v?/i, 'v') || 'v0.1.0'; }

function apply(rel){
  var ver = verFromTag(rel.tag_name);
  var assets = rel.assets || [];
  function find(re){ for(var i=0;i<assets.length;i++){ if(re.test(assets[i].name)) return assets[i]; } return null; }
  var win64p = find(/win64[_-]?portable\.zip$/i), win64m = find(/win64[_-]?setup\.msi$/i);
  var win32p = find(/win32[_-]?portable\.zip$/i), win32m = find(/win32[_-]?setup\.msi$/i);

  /* version badges + CTA + release line */
  document.querySelectorAll('.relv').forEach(function(el){ el.textContent = ver; });
  var cta = document.querySelector('#cta-ver'); if(cta) cta.textContent = ver;
  var info = document.querySelector('#rel-info');
  if(info && rel.published_at){
    var d = new Date(rel.published_at);
    info.textContent = ver + ' · ' + d.toISOString().slice(0,10);
  }

  /* download cards: href + per-arch sizes */
  var map = [
    { card: 0, a: win64p, b: win32p }, /* Portable */
    { card: 1, a: win64m, b: win32m }  /* Setup.msi */
  ];
  var cards = document.querySelectorAll('#download .dcard');
  map.forEach(function(m){
    var card = cards[m.card]; if(!card) return;
    var link = card.querySelector('a');
    var size = card.querySelector('.size');
    if(m.a && m.b){
      if(link){ link.href = m.a.browser_download_url; }
      if(size){
        size.setAttribute('data-arch64', kb(m.a.size));
        size.setAttribute('data-arch32', kb(m.b.size));
        size.textContent = kb(m.a.size); /* x64 is the active arch by default */
      }
    } else if(link && rel.html_url){
      link.href = rel.html_url; /* partial assets → release page */
    }
  });

  /* timeline current node sync (b element of first tnode) */
  var now = document.querySelector('.tnode.now b');
  if(now && rel.published_at){
    var v = ver.replace(/^v/, 'v');
    now.textContent = v + ' — ' + new Date(rel.published_at).toISOString().slice(0,10);
  }
}

function load(){
  if(!window.fetch) return; /* keep static */
  var cached = null;
  try{ cached = JSON.parse(localStorage.getItem(KEY) || 'null'); }catch(e){}
  if(cached && (Date.now() - cached.t) < TTL && cached.rel){
    apply(cached.rel);
    refreshInBackground(cached.rel);
    return;
  }
  refreshInBackground(null);
}

function refreshInBackground(have){
  fetch(API, { headers: { 'Accept': 'application/vnd.github+json' } })
    .then(function(r){ return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function(rel){
      if(!rel || !rel.tag_name) return;
      try{ localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), rel: rel })); }catch(e){}
      if(!have || verFromTag(rel.tag_name) !== verFromTag(have.tag_name)) apply(rel);
    })
    .catch(function(){ /* offline / rate-limited → static values stay */ });
}

load();
})();
