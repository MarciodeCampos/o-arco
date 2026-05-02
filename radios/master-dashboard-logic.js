import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDa0XWSvNISi47olox7U2HHawf3pf1rOjI",
  authDomain: "triadic-radios.firebaseapp.com",
  databaseURL: "https://triadic-radios-default-rtdb.firebaseio.com",
  projectId: "triadic-radios",
  storageBucket: "triadic-radios.firebasestorage.app",
  messagingSenderId: "574115949337",
  appId: "1:574115949337:web:527670aa35d9bb939f3388"
};
const app  = initializeApp(firebaseConfig);
const db   = getDatabase(app);
const auth = getAuth(app);

function show(id){ const el=document.getElementById(id); if(el)el.style.display=''; }
function hide(id){ const el=document.getElementById(id); if(el)el.style.display='none'; }
function txt(id,v){ const el=document.getElementById(id); if(el)el.textContent=v; }

// ── AUTH ──────────────────────────────────────────────────────
window.doLogin = function(){
  signInWithPopup(auth, new GoogleAuthProvider()).catch(e=>console.warn('login err',e));
};
window.doLogout = function(){
  signOut(auth).then(()=>{ hide('main-dash'); show('login-prompt'); });
};

onAuthStateChanged(auth, async user=>{
  if(!user){
    hide('main-dash'); hide('not-linked'); show('login-prompt');
    hide('btn-logout'); show('btn-login');
    hide('user-chip');
    return;
  }
  // Show user chip
  const chip=document.getElementById('user-chip');
  if(chip){ chip.textContent=user.displayName||user.email; chip.style.display=''; }
  show('btn-logout'); hide('btn-login');

  // Find master profile linked to this uid
  const snap=await get(ref(db,'masterProfiles'));
  const all=Object.values(snap.val()||{});
  const master=all.find(m=>m.linkedUid===user.uid);

  if(!master){
    hide('login-prompt'); hide('main-dash'); show('not-linked'); return;
  }
  hide('login-prompt'); hide('not-linked'); show('main-dash');
  loadDashboard(master);
});

// ── DASHBOARD ─────────────────────────────────────────────────
async function loadDashboard(master){
  // Set master info
  txt('dash-master-name','Operador: '+master.name);
  const tierBadge=document.getElementById('tier-badge');
  if(tierBadge) tierBadge.textContent=master.tier||'starter';

  // Load city operations
  const citySlug=(master.citiesOperated||[])[0]||'';
  if(!citySlug){ txt('dash-city-name','Cidade não vinculada'); setScore(0); return; }

  const citySnap=await get(ref(db,'cityOperations/'+citySlug));
  const city=citySnap.val();
  if(!city){ txt('dash-city-name','Cidade não encontrada'); setScore(0); return; }

  txt('dash-city-name',city.cityName+' / '+city.uf);

  // Live stats from real collections
  await computeStats(city);

  // Listen for pending claims/leads for badges
  listenPendingStats(city);
}

async function computeStats(city){
  const [bSnap, pSnap, offSnap, affSnap, clSnap] = await Promise.all([
    get(ref(db,'businessProfiles')),
    get(ref(db,'places')),
    get(ref(db,'affiliateOffers')),
    get(ref(db,'affiliateClicks')),
    get(ref(db,'businessClaims'))
  ]);

  const citySlug = city.citySlug;
  const bs   = Object.values(bSnap.val()||{});
  const ps   = Object.values(pSnap.val()||{});
  const offs = Object.values(offSnap.val()||{});
  const aff  = Object.values(affSnap.val()||{});

  // Filter by city (best-effort: use city name/slug match)
  const commerces  = bs.filter(b=>matchCity(b.city||b.citySlug, city)).length;
  const places     = ps.filter(p=>matchCity(p.address?.city||p.address?.citySlug, city)).length;
  const offers     = offs.filter(o=>matchCity(o.citySlug||'', city)).length||offs.length;
  const affiliates = [...new Set(aff.map(a=>a.userId||a.uid))].length;

  txt('s-commerces', commerces||bs.length);
  txt('s-places',    places||ps.length);
  txt('s-providers', '—');
  txt('s-offers',    offers);
  txt('s-affiliates',affiliates);

  // Activation score
  const score = calcScore({
    commercesClaimed: bs.filter(b=>b.claimed||b.status==='claimed').length,
    commercesTotal:   Math.max(bs.length,1),
    placesClaimed:    ps.filter(p=>p.status==='claimed').length,
    placesTotal:      Math.max(ps.length,1),
    offersActive:     offs.filter(o=>o.active).length,
    affiliatesActive: affiliates,
    providersActive:  0
  });
  setScore(score);

  // ROI simulation
  const destaque = bs.filter(b=>b.plan==='destaque'||b.featured).length;
  const premium  = bs.filter(b=>b.plan==='premium').length;
  document.getElementById('roi-destaque').textContent = destaque||0;
  document.getElementById('roi-premium').textContent  = premium||0;
  const total = destaque*150 + premium*300;
  document.getElementById('roi-total').textContent = total>0?'R$ '+total.toLocaleString('pt-BR'):'R$ —';
}

function matchCity(val, city){
  if(!val) return false;
  const v=val.toLowerCase();
  return v.includes(city.citySlug||'') || v.includes((city.cityName||'').toLowerCase());
}

function calcScore(d){
  return Math.round(
    (d.commercesClaimed/d.commercesTotal)*30 +
    (d.placesClaimed/d.placesTotal)*20 +
    (Math.min(d.offersActive,d.commercesTotal)/d.commercesTotal)*20 +
    Math.min(d.affiliatesActive/10,1)*15 +
    Math.min(d.providersActive/20,1)*15
  );
}

function setScore(score){
  const fill=document.getElementById('score-bar-fill');
  const val =document.getElementById('score-value');
  const lvl =document.getElementById('score-level');
  if(fill) fill.style.width=Math.min(score,100)+'%';
  if(val)  val.textContent=score;
  const levels=[
    [0,'Cidade inexplorada'],[21,'Início de ativação'],
    [41,'Cidade em crescimento'],[61,'Cidade ativa'],[81,'Cidade consolidada']
  ];
  const [,label]=([...levels].reverse().find(([min])=>score>=min)||levels[0]);
  if(lvl) lvl.textContent=label;
}

function listenPendingStats(city){
  // Business claims pending
  onValue(ref(db,'businessClaims'), snap=>{
    const all=Object.values(snap.val()||{});
    const pending=all.filter(c=>c.status==='pending').length;
    const el=document.getElementById('stat-claims');
    if(el){ el.textContent=pending>0?pending+' pendente'+(pending>1?'s':''):''; el.style.display=pending>0?'':'none'; }
  });
  // Place claims pending
  onValue(ref(db,'placeClaims'), snap=>{
    const all=Object.values(snap.val()||{});
    const pending=all.filter(c=>c.status==='pending').length;
    const el=document.getElementById('stat-place-claims');
    if(el){ el.textContent=pending>0?pending+' pendente'+(pending>1?'s':''):''; el.style.display=pending>0?'':'none'; }
  });
  // Affiliate leads pending
  onValue(ref(db,'affiliateLeads'), snap=>{
    const all=Object.values(snap.val()||{});
    const pending=all.filter(l=>l.status==='pending').length;
    const el=document.getElementById('stat-leads');
    if(el){ el.textContent=pending>0?pending+' lead'+(pending>1?'s':''):''; el.style.display=pending>0?'':'none'; }
  });
}
