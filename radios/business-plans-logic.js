import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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

function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmt(ts){ if(!ts) return '—'; return new Date(ts).toLocaleDateString('pt-BR'); }

const ADMIN_KEY = 'cidadeonline2026';
let allBiz = [];
let editTarget = null;

// ── ADMIN GATE ────────────────────────────────────────────────────────────────
window.setAdminKey = function(){
  if(document.getElementById('admin-key-input')?.value.trim()===ADMIN_KEY){
    localStorage.setItem('plans_admin',ADMIN_KEY);
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
if(localStorage.getItem('plans_admin')===ADMIN_KEY) unlockPanel();

// ── INIT ──────────────────────────────────────────────────────────────────────
function init(){
  loadStates();
  setupFilters();
  onValue(ref(db,'businessProfiles'), snap=>{
    const data = snap.val()||{};
    allBiz = Object.values(data).filter(b=>b.active!==false);
    updateCounters();
    renderGrid();
  });
}

function loadStates(){
  const BR=[{uf:'PR',n:'Paraná'},{uf:'SC',n:'Santa Catarina'},{uf:'SP',n:'São Paulo'},{uf:'RS',n:'RS'},{uf:'MG',n:'MG'},{uf:'RJ',n:'RJ'}];
  document.getElementById('f-uf').innerHTML='<option value="">Todos os estados</option>'
    +BR.map(s=>`<option value="${s.uf}">${s.n} (${s.uf})</option>`).join('');
}

function setupFilters(){
  ['f-plan','f-uf'].forEach(id=>document.getElementById(id)?.addEventListener('change',renderGrid));
  let d; document.getElementById('f-search')?.addEventListener('input',()=>{clearTimeout(d);d=setTimeout(renderGrid,200);});
}

function updateCounters(){
  const now=Date.now();
  document.getElementById('cnt-total').querySelector('span').textContent    = allBiz.length;
  document.getElementById('cnt-featured').querySelector('span').textContent = allBiz.filter(b=>b.featured&&(!b.featuredUntil||b.featuredUntil>now)).length;
  document.getElementById('cnt-premium').querySelector('span').textContent  = allBiz.filter(b=>b.plan==='premium').length;
  document.getElementById('cnt-partner').querySelector('span').textContent  = allBiz.filter(b=>b.plan==='partner').length;
  document.getElementById('cnt-claimed').querySelector('span').textContent  = allBiz.filter(b=>b.claimed).length;
}

// ── RENDER ────────────────────────────────────────────────────────────────────
const PLAN_LABELS = {free:'Grátis',featured:'⭐ Destaque',premium:'💎 Premium',partner:'🤝 Parceiro'};

function renderGrid(){
  const search = (document.getElementById('f-search')?.value||'').toLowerCase();
  const plan   = document.getElementById('f-plan')?.value||'';
  const uf     = document.getElementById('f-uf')?.value||'';
  const now    = Date.now();

  const filtered = allBiz.filter(b=>{
    if(plan && (b.plan||'free')!==plan) return false;
    if(uf   && b.uf!==uf) return false;
    if(search && !(b.name||'').toLowerCase().includes(search)) return false;
    return true;
  }).sort((a,b)=>{
    const planScore={partner:4,premium:3,featured:2,claimed:1,free:0};
    return (planScore[b.plan||'free']||0)-(planScore[a.plan||'free']||0)||(b.priority||0)-(a.priority||0);
  });

  document.getElementById('results-meta').textContent = filtered.length+' comércio'+(filtered.length!==1?'s':'');
  const el = document.getElementById('plans-grid');
  if(!filtered.length){ el.innerHTML='<div class="empty-state"><span>🏪</span>Nenhum comércio encontrado.</div>'; return; }

  el.innerHTML = filtered.map(b=>{
    const p     = b.plan||'free';
    const isFeat = b.featured && (!b.featuredUntil||b.featuredUntil>now);
    const planBdg = isFeat
      ? `<span class="badge badge-featured">⭐ Destaque</span>`
      : p==='partner' ? `<span class="badge badge-partner">🤝 Parceiro</span>`
      : p==='premium' ? `<span class="badge badge-premium">💎 Premium</span>`
      : `<span class="badge badge-free">Grátis</span>`;
    const claimedBdg = b.claimed?`<span class="badge badge-claimed">✓ Reivindicado</span>`:'';
    return `<div class="plan-card plan-${p}">
      <div class="plan-card-top">
        <div>
          <div class="plan-biz-name">${esc(b.name)}</div>
          <div class="plan-biz-meta">${esc(b.category||'')} · ${esc(b.city||'')}/${esc(b.uf||'')}</div>
        </div>
        <button class="btn-edit" onclick="openEdit('${esc(b.businessId||b.profileId)}')">✏️ Editar</button>
      </div>
      <div class="plan-badges">${planBdg}${claimedBdg}</div>
      <div class="plan-info">
        <span>Plano:</span> ${PLAN_LABELS[p]||p} ·
        <span>Destaque:</span> ${isFeat?'Ativo até '+fmt(b.featuredUntil):'Não'} ·
        <span>Priority:</span> ${b.priority||0}
      </div>
    </div>`;
  }).join('');
}

// ── EDIT MODAL ────────────────────────────────────────────────────────────────
window.openEdit = function(bizId){
  editTarget = allBiz.find(b=>(b.businessId||b.profileId)===bizId);
  if(!editTarget) return;
  document.getElementById('modal-biz-name').textContent = '✏️ '+editTarget.name;
  document.getElementById('m-plan').value     = editTarget.plan||'free';
  document.getElementById('m-featured').value = editTarget.featured?'true':'false';
  document.getElementById('m-priority').value = editTarget.priority||0;
  // date input
  const fu = editTarget.featuredUntil;
  document.getElementById('m-featured-until').value = fu ? new Date(fu).toISOString().slice(0,10) : '';
  document.getElementById('edit-modal').style.display='flex';
};

window.closeModal = function(){
  document.getElementById('edit-modal').style.display='none';
  editTarget=null;
};

window.saveBusinessPlan = async function(){
  if(!editTarget) return;
  const bizId = editTarget.businessId||editTarget.profileId;
  const plan  = document.getElementById('m-plan').value;
  const feat  = document.getElementById('m-featured').value==='true';
  const prio  = parseInt(document.getElementById('m-priority').value)||0;
  const fuStr = document.getElementById('m-featured-until').value;
  const featUntil = fuStr ? new Date(fuStr).getTime() : null;
  const now   = Date.now();

  const patch = { plan, featured:feat, priority:prio, updatedAt:now };
  if(featUntil) patch.featuredUntil=featUntil;
  else patch.featuredUntil=null;

  await update(ref(db,'businessProfiles/'+bizId), patch);
  // Sync em profiles/ também
  await update(ref(db,'profiles/'+bizId), { plan, featured:feat, priority:prio, updatedAt:now }).catch(()=>{});

  closeModal();
  alert('✅ Plano atualizado!');
};
