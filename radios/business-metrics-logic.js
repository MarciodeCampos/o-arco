import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDa0XWSvNISi47olox7U2HHawf3pf1rOjI",
  authDomain: "triadic-radios.firebaseapp.com",
  databaseURL: "https://triadic-radios-default-rtdb.firebaseio.com",
  projectId: "triadic-radios",
  storageBucket: "triadic-radios.firebasestorage.app",
  messagingSenderId: "574115949337",
  appId: "1:574115949337:web:527670aa35d9bb939f3388"
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

const ADMIN_KEY = 'cidadeonline2026';
let allMetrics = {}; // {date: {eventType: count}}

// ── ADMIN GATE ────────────────────────────────────────────────────────────────
window.setAdminKey = function(){
  if(document.getElementById('admin-key-input')?.value.trim()===ADMIN_KEY){
    localStorage.setItem('metrics_admin',ADMIN_KEY);
    unlockPanel();
  } else { alert('Chave incorreta.'); }
};
function unlockPanel(){
  document.getElementById('locked-msg').style.display='none';
  document.getElementById('main-panel').style.display='block';
  document.getElementById('admin-gate').style.display='none';
  document.getElementById('admin-label').style.display='';
  init();
}
if(localStorage.getItem('metrics_admin')===ADMIN_KEY) unlockPanel();

// ── INIT ──────────────────────────────────────────────────────────────────────
async function init(){
  await loadBusinessList();
  document.getElementById('biz-select').onchange = ()=>{
    const bizId = document.getElementById('biz-select').value;
    if(!bizId){ document.getElementById('no-biz-msg').style.display=''; hide('kpi-grid'); hide('daily-section'); return; }
    hide('no-biz-msg');
    listenMetrics(bizId);
  };
  show('no-biz-msg');
}

async function loadBusinessList(){
  const snap = await get(ref(db,'businessProfiles'));
  const data = snap.val()||{};
  const sorted = Object.values(data).filter(b=>b.active!==false)
    .sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  const sel = document.getElementById('biz-select');
  sel.innerHTML='<option value="">Selecionar comércio...</option>'
    +sorted.map(b=>`<option value="${esc(b.businessId||b.profileId)}">${esc(b.name)} — ${esc(b.city||'')}/${esc(b.uf||'')}</option>`).join('');
}

// ── LISTEN METRICS ────────────────────────────────────────────────────────────
let unsubscribe = null;
function listenMetrics(bizId){
  if(unsubscribe) unsubscribe();
  unsubscribe = onValue(ref(db,'businessMetrics/'+bizId), snap=>{
    allMetrics = snap.val()||{};
    renderMetrics();
  });
}

// ── RENDER ────────────────────────────────────────────────────────────────────
window.renderMetrics = function(){
  const days = document.getElementById('period-select')?.value;
  const dates = getDateRange(days);

  // Filter metrics to selected period
  const filtered = {};
  for(const [date,events] of Object.entries(allMetrics)){
    if(days==='all' || dates.includes(date)) filtered[date]=events;
  }

  // Aggregate totals
  const totals = {profile_view:0,whatsapp_click:0,link_click:0,message_start:0,business_card_click:0,post_click:0};
  for(const events of Object.values(filtered)){
    for(const [k,v] of Object.entries(events||{})){
      if(totals[k]!==undefined) totals[k]+=(v||0);
    }
  }

  // KPIs
  document.getElementById('kpi-views').textContent  = totals.profile_view;
  document.getElementById('kpi-wa').textContent      = totals.whatsapp_click;
  document.getElementById('kpi-links').textContent   = totals.link_click;
  document.getElementById('kpi-msgs').textContent    = totals.message_start;
  document.getElementById('kpi-cards').textContent   = totals.business_card_click;
  document.getElementById('kpi-posts').textContent   = totals.post_click;
  show('kpi-grid');

  // Daily table
  const sortedDates = Object.keys(filtered).sort((a,b)=>b.localeCompare(a));
  if(sortedDates.length){
    const tbody = document.getElementById('daily-tbody');
    tbody.innerHTML = sortedDates.map(d=>{
      const e = filtered[d]||{};
      return `<tr>
        <td>${d}</td>
        <td>${e.profile_view||0}</td>
        <td>${e.whatsapp_click||0}</td>
        <td>${e.link_click||0}</td>
        <td>${e.message_start||0}</td>
        <td>${e.business_card_click||0}</td>
      </tr>`;
    }).join('');
    show('daily-section');
  } else {
    hide('daily-section');
  }
};

// ── UTILS ─────────────────────────────────────────────────────────────────────
function getDateRange(days){
  if(days==='all') return [];
  const n = parseInt(days)||7;
  const arr=[];
  for(let i=0;i<n;i++){
    const d=new Date(); d.setDate(d.getDate()-i);
    arr.push(d.toISOString().slice(0,10));
  }
  return arr;
}
function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function show(id){ const el=document.getElementById(id); if(el) el.style.display=''; }
function hide(id){ const el=document.getElementById(id); if(el) el.style.display='none'; }
