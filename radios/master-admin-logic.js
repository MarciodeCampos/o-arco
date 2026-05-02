import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, get, set, push, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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
function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function slug(s){ return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,''); }
function showFb(el,type,msg){ el.className='form-feedback '+type; el.textContent=msg; el.style.display=''; if(type==='err')setTimeout(()=>el.style.display='none',4000); }
function fmt(ts){ if(!ts)return '—'; return new Date(ts).toLocaleDateString('pt-BR'); }

// ── ADMIN GATE ─────────────────────────────────────────────────
window.checkGate = function(){
  const val=(document.getElementById('gate-input')?.value||'').trim();
  if(val===ADMIN_KEY){
    localStorage.setItem('ma_admin',ADMIN_KEY);
    document.getElementById('admin-gate').style.display='none';
    document.getElementById('main-panel').style.display='';
    init();
  } else {
    document.getElementById('gate-err').style.display='';
    document.getElementById('gate-input').value='';
  }
};
if(localStorage.getItem('ma_admin')===ADMIN_KEY){
  document.getElementById('admin-gate').style.display='none';
  document.getElementById('main-panel').style.display='';
  document.addEventListener('DOMContentLoaded',()=>init());
}
document.getElementById('gate-input')?.addEventListener('keydown',e=>{if(e.key==='Enter')window.checkGate();});

// ── STATE ─────────────────────────────────────────────────────
let allMasters = [];
let allCities  = [];
let editingMasterId = null;

// ── INIT ──────────────────────────────────────────────────────
function init(){
  onValue(ref(db,'masterProfiles'), snap=>{
    allMasters = Object.values(snap.val()||{}).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    renderMasters();
    populateMasterSelect();
  });
  onValue(ref(db,'cityOperations'), snap=>{
    allCities = Object.values(snap.val()||{}).sort((a,b)=>(a.cityName||'').localeCompare(b.cityName||''));
    renderCities();
  });
}

// ── MASTERS ──────────────────────────────────────────────────
function renderMasters(){
  const el=document.getElementById('masters-list');
  if(!allMasters.length){ el.innerHTML='<div class="empty-state">Nenhum Master cadastrado ainda.</div>'; return; }
  el.innerHTML=allMasters.map(m=>{
    const statusCls={active:'badge-active',pending:'badge-pending',suspended:'badge-suspended'}[m.status]||'badge-pending';
    const statusLbl={active:'Ativo',pending:'Pendente',suspended:'Suspenso'}[m.status]||m.status;
    return `<div class="master-row">
      <div class="master-avatar">${(m.name||'?')[0].toUpperCase()}</div>
      <div class="master-info">
        <div class="master-name">${esc(m.name)}</div>
        <div class="master-meta">${esc(m.email||'')} · ${esc(m.region?.city||'—')}/${esc(m.region?.uf||'')}</div>
      </div>
      <div class="master-badges">
        <span class="badge ${statusCls}">${statusLbl}</span>
        <span class="badge badge-tier">${esc(m.tier||'starter')}</span>
        <button class="btn-edit-sm" onclick="editMaster('${esc(m.masterId)}')">✏️ Editar</button>
      </div>
    </div>`;
  }).join('');
}

function populateMasterSelect(){
  const sel=document.getElementById('cm-master');
  const cur=sel?.value||'';
  sel.innerHTML='<option value="">Sem master ainda</option>';
  allMasters.forEach(m=>{
    const o=document.createElement('option');
    o.value=m.masterId; o.textContent=m.name+(m.status!=='active'?` (${m.status})`:'');
    if(m.masterId===cur)o.selected=true;
    sel.appendChild(o);
  });
}

// ── MODAL MASTER ──────────────────────────────────────────────
window.openMasterForm = function(){ editingMasterId=null; clearMasterForm(); document.getElementById('master-modal-title').textContent='Novo Master Local'; document.getElementById('master-modal').style.display='flex'; };
window.closeMasterModal = function(e){ if(!e||e.target.id==='master-modal') document.getElementById('master-modal').style.display='none'; };
window.editMaster = function(id){
  const m=allMasters.find(x=>x.masterId===id); if(!m)return;
  editingMasterId=id;
  document.getElementById('master-modal-title').textContent='Editar Master';
  document.getElementById('mm-name').value=m.name||'';
  document.getElementById('mm-email').value=m.email||'';
  document.getElementById('mm-phone').value=m.phone||'';
  document.getElementById('mm-uid').value=m.linkedUid||'';
  document.getElementById('mm-uf').value=m.region?.uf||'';
  document.getElementById('mm-city').value=m.region?.city||'';
  document.getElementById('mm-tier').value=m.tier||'starter';
  document.getElementById('mm-status').value=m.status||'pending';
  document.getElementById('master-modal').style.display='flex';
};
function clearMasterForm(){
  ['mm-name','mm-email','mm-phone','mm-uid','mm-uf','mm-city'].forEach(id=>{ if(document.getElementById(id))document.getElementById(id).value=''; });
  document.getElementById('mm-tier').value='starter';
  document.getElementById('mm-status').value='pending';
}

window.saveMaster = async function(){
  const name  = (document.getElementById('mm-name')?.value||'').trim();
  const email = (document.getElementById('mm-email')?.value||'').trim();
  const phone = (document.getElementById('mm-phone')?.value||'').trim().replace(/\D/g,'');
  const uid   = (document.getElementById('mm-uid')?.value||'').trim();
  const uf    = (document.getElementById('mm-uf')?.value||'').trim().toUpperCase();
  const city  = (document.getElementById('mm-city')?.value||'').trim();
  const tier  = document.getElementById('mm-tier')?.value||'starter';
  const status= document.getElementById('mm-status')?.value||'pending';
  const fb    = document.getElementById('master-fb');
  const btn   = document.getElementById('btn-save-master');
  if(!name){ showFb(fb,'err','⚠️ Nome obrigatório.'); return; }
  if(!email){ showFb(fb,'err','⚠️ E-mail obrigatório.'); return; }
  btn.disabled=true; btn.textContent='Salvando...';
  try{
    const now=Date.now();
    if(editingMasterId){
      await update(ref(db,'masterProfiles/'+editingMasterId),{
        name,email,phone,linkedUid:uid,
        region:{uf,city,citySlug:slug(city)},
        tier,status,updatedAt:now
      });
    } else {
      const r=push(ref(db,'masterProfiles'));
      await set(r,{
        masterId:r.key,name,email,phone,linkedUid:uid,
        region:{uf,city,citySlug:slug(city)},
        tier,status,revenueShare:{destaque:.4,premium:.5,service:.3},
        citiesOperated:[],activatedAt:status==='active'?now:null,
        contractedAt:null,createdAt:now,updatedAt:now
      });
    }
    showFb(fb,'ok','✅ Master salvo!');
    btn.textContent='💾 Salvar Master';
    setTimeout(()=>window.closeMasterModal(),1200);
  }catch(e){
    showFb(fb,'err','❌ Erro ao salvar: '+e.message);
  } finally{ btn.disabled=false; }
};

// ── CITIES ────────────────────────────────────────────────────
function renderCities(){
  const el=document.getElementById('cities-list');
  if(!allCities.length){ el.innerHTML='<div class="empty-state">Nenhuma cidade operada ainda.</div>'; return; }
  const statusLbl={inactive:'Inativo',onboarding:'Em onboarding',active:'Ativo'};
  const statusCls={inactive:'badge-pending',onboarding:'badge-pending',active:'badge-active'};
  el.innerHTML=allCities.map(c=>{
    const master=allMasters.find(m=>m.masterId===c.masterId);
    return `<div class="city-row">
      <div class="city-flag">🏙️</div>
      <div class="city-info">
        <div class="city-name">${esc(c.cityName)} / ${esc(c.uf)}</div>
        <div class="city-meta">${master?'Master: '+esc(master.name):'Sem master'} · Criada ${fmt(c.createdAt)}</div>
      </div>
      <span class="score-chip">Score ${c.activationScore||0}</span>
      <span class="badge ${statusCls[c.status]||'badge-pending'}">${statusLbl[c.status]||c.status}</span>
    </div>`;
  }).join('');
}

// ── MODAL CIDADE ──────────────────────────────────────────────
window.openCityForm   = function(){ document.getElementById('city-modal').style.display='flex'; };
window.closeCityModal = function(e){ if(!e||e.target.id==='city-modal') document.getElementById('city-modal').style.display='none'; };

window.saveCity = async function(){
  const city   = (document.getElementById('cm-city')?.value||'').trim();
  const uf     = (document.getElementById('cm-uf')?.value||'').trim().toUpperCase();
  const master = document.getElementById('cm-master')?.value||'';
  const status = document.getElementById('cm-status')?.value||'inactive';
  const fb     = document.getElementById('city-fb');
  const btn    = document.getElementById('btn-save-city');
  if(!city){ showFb(fb,'err','⚠️ Nome da cidade obrigatório.'); return; }
  if(!uf)  { showFb(fb,'err','⚠️ UF obrigatória.'); return; }
  btn.disabled=true; btn.textContent='Salvando...';
  try{
    const now=Date.now();
    const citySlug=slug(city)+'-'+uf.toLowerCase();
    await set(ref(db,'cityOperations/'+citySlug),{
      citySlug,cityName:city,uf,masterId:master,status,
      activationScore:0,
      stats:{commerces:0,places:0,providers:0,offers:0,affiliates:0},
      createdAt:now,updatedAt:now
    });
    // Vincular masterId às cidades se fornecido
    if(master){
      const mData=(await get(ref(db,'masterProfiles/'+master))).val();
      const cities=[...new Set([...(mData?.citiesOperated||[]),citySlug])];
      await update(ref(db,'masterProfiles/'+master),{citiesOperated:cities});
    }
    showFb(fb,'ok','✅ Cidade salva!');
    btn.textContent='💾 Salvar Cidade';
    setTimeout(()=>window.closeCityModal(),1200);
  }catch(e){
    showFb(fb,'err','❌ Erro ao salvar: '+e.message);
  } finally{ btn.disabled=false; }
};
