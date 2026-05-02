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

function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmt(ts){ if(!ts)return '—'; return new Date(ts).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}); }
function show(id){ const el=document.getElementById(id); if(el)el.style.display=''; }
function hide(id){ const el=document.getElementById(id); if(el)el.style.display='none'; }

const ADMIN_KEY = 'cidadeonline2026';
const TYPE = {
  commercial_point:'🏪',health_unit:'🏥',school:'🏫',public_service:'🏛️',
  church:'⛪',neighborhood_place:'🌳',landmark:'📌',property:'🏗️',residential_address:'🏠'
};

let allClaims = [];
let allPlaces = [];
let activeTab  = 'claims';
let rejectTarget = null;

// ── ADMIN GATE ────────────────────────────────────────────────────────────────
window.setAdminKey = function(){
  if((document.getElementById('admin-key-input')?.value||'').trim()===ADMIN_KEY){
    localStorage.setItem('pc_admin',ADMIN_KEY); unlockPanel();
  } else { alert('Chave incorreta.'); }
};
function unlockPanel(){
  hide('locked-msg'); show('main-panel');
  document.getElementById('admin-gate').style.display='none';
  document.getElementById('admin-label').style.display='';
  init();
}
if(localStorage.getItem('pc_admin')===ADMIN_KEY) unlockPanel();

// ── INIT ─────────────────────────────────────────────────────────────────────
function init(){
  onValue(ref(db,'placeClaims'), snap=>{
    allClaims=Object.values(snap.val()||{}).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    if(activeTab==='claims') renderClaims();
  });
  onValue(ref(db,'places'), snap=>{
    allPlaces=Object.values(snap.val()||{}).filter(p=>p.active!==false).sort((a,b)=>a.name?.localeCompare(b.name));
    if(activeTab==='places') renderPlacesList();
  });
  let d; document.getElementById('f-search')?.addEventListener('input',()=>{clearTimeout(d);d=setTimeout(renderActive,200);});
}

// ── TABS ──────────────────────────────────────────────────────────────────────
window.setTab = function(tab){
  activeTab=tab;
  ['claims','places'].forEach(t=>{
    document.getElementById('tab-'+t)?.classList.toggle('active',t===tab);
    const pane=document.getElementById('pane-'+t);
    if(pane) pane.style.display=t===tab?'':'none';
  });
  renderActive();
};
function renderActive(){ activeTab==='claims'?renderClaims():renderPlacesList(); }

// ── RENDER CLAIMS ──────────────────────────────────────────────────────────────
function renderClaims(){
  const status=(document.getElementById('f-status')?.value||'pending');
  const search=(document.getElementById('f-search')?.value||'').toLowerCase();
  const filtered=allClaims.filter(c=>{
    if(status && c.status!==status) return false;
    const hay=`${c.placeName} ${c.claimantName} ${c.claimantPhone} ${c.claimantNote}`.toLowerCase();
    return !search||hay.includes(search);
  });
  const el=document.getElementById('claims-list');
  if(!filtered.length){el.innerHTML='<div class="empty-state"><span>📋</span>Nenhuma reivindicação.</div>';return;}
  el.innerHTML=filtered.map(c=>{
    const isPending=c.status==='pending';
    const badgeCls={pending:'badge-pending',approved:'badge-approved',rejected:'badge-rejected'}[c.status]||'badge-pending';
    const badgeLbl={pending:'⏳ Pendente',approved:'✅ Aprovado',rejected:'❌ Rejeitado'}[c.status]||c.status;
    return `<div class="claim-row">
      <div class="claim-row-top">
        <div>
          <div class="claim-place-name">📍 ${esc(c.placeName)}</div>
        </div>
        <span class="badge ${badgeCls}">${badgeLbl}</span>
      </div>
      <div class="claim-meta">
        <strong>Solicitante:</strong> ${esc(c.claimantName)} · ${esc(c.claimantPhone)}<br>
        <strong>Papel:</strong> ${esc(c.claimantRole||'—')}${c.claimantNote?` · <em>${esc(c.claimantNote)}</em>`:''}<br>
        <strong>Data:</strong> ${fmt(c.createdAt)}
        ${c.rejectionReason?`<br><strong>Motivo rejeição:</strong> <em>${esc(c.rejectionReason)}</em>`:''}
      </div>
      <div class="claim-actions">
        <a class="btn-view-place" href="place.html?id=${esc(c.placeId)}" target="_blank">👁️ Ver lugar</a>
        ${isPending?`
          <button class="btn-approve" onclick="approveClaim('${esc(c.claimId)}','${esc(c.placeId)}','${esc(c.claimantName)}')">✅ Aprovar</button>
          <button class="btn-reject-action" onclick="openRejectModal('${esc(c.claimId)}','${esc(c.placeId)}')">❌ Rejeitar</button>
        `:''}
      </div>
    </div>`;
  }).join('');
}

// ── APPROVE ───────────────────────────────────────────────────────────────────
window.approveClaim = async function(claimId, placeId, claimantName){
  const now=Date.now();
  await update(ref(db,'placeClaims/'+claimId),{status:'approved',reviewedAt:now,reviewedBy:'admin'});
  await update(ref(db,'places/'+placeId),{
    status:'claimed', claimId, claimedBy:claimantName,
    claimedAt:now, updatedAt:now
  });
};

// ── REJECT ────────────────────────────────────────────────────────────────────
window.openRejectModal = function(claimId, placeId){
  rejectTarget={claimId, placeId};
  document.getElementById('reject-reason').value='';
  document.getElementById('reject-modal').style.display='flex';
};
window.closeRejectModal = function(e){
  if(!e||e.target.id==='reject-modal') document.getElementById('reject-modal').style.display='none';
};
window.confirmReject = async function(){
  if(!rejectTarget) return;
  const reason=document.getElementById('reject-reason')?.value.trim()||'';
  const now=Date.now();
  await update(ref(db,'placeClaims/'+rejectTarget.claimId),{status:'rejected',reviewedAt:now,reviewedBy:'admin',rejectionReason:reason});
  await update(ref(db,'places/'+rejectTarget.placeId),{status:'unclaimed',updatedAt:now});
  document.getElementById('reject-modal').style.display='none';
  rejectTarget=null;
};

// ── RENDER PLACES ─────────────────────────────────────────────────────────────
function renderPlacesList(){
  const search=(document.getElementById('f-search')?.value||'').toLowerCase();
  const filtered=allPlaces.filter(p=>!search||`${p.name} ${p.address?.city||''} ${p.address?.neighborhood||''}`.toLowerCase().includes(search));
  const el=document.getElementById('places-list');
  if(!filtered.length){el.innerHTML='<div class="empty-state"><span>📍</span>Nenhum lugar encontrado.</div>';return;}
  const statBdg={unclaimed:'badge-pending',pending:'badge-pending',claimed:'badge-approved'};
  const statLbl={unclaimed:'Não reivindicado',pending:'Em análise',claimed:'Reivindicado'};
  el.innerHTML=filtered.map(p=>`
    <div class="place-row">
      <div class="place-row-icon">${TYPE[p.type]||'📍'}</div>
      <div class="place-row-info">
        <div class="place-row-name">${esc(p.name)}</div>
        <div class="place-row-meta">${esc(p.address?.neighborhood||'')} · ${esc(p.address?.city||'')}/${esc(p.address?.uf||'')} · <span class="badge ${statBdg[p.status]||''}">${statLbl[p.status]||p.status}</span></div>
      </div>
      <a class="btn-view-place" href="place.html?id=${esc(p.placeId)}" target="_blank">Ver →</a>
    </div>`).join('');
}

// ── NEW PLACE ─────────────────────────────────────────────────────────────────
window.openPlaceForm  = function(){ document.getElementById('place-modal').style.display='flex'; };
window.closePlaceModal= function(e){ if(!e||e.target.id==='place-modal') document.getElementById('place-modal').style.display='none'; };
window.savePlace = async function(){
  const name=document.getElementById('pm-name')?.value.trim();
  if(!name){alert('Nome obrigatório.');return;}
  const now=Date.now();
  const placeRef=push(ref(db,'places'));
  const city=(document.getElementById('pm-city')?.value.trim()||'');
  const uf=(document.getElementById('pm-uf')?.value.trim()||'');
  const doc={
    placeId:placeRef.key,
    name,
    type:document.getElementById('pm-type')?.value||'landmark',
    status:'unclaimed',
    description:document.getElementById('pm-desc')?.value.trim()||'',
    address:{
      street:document.getElementById('pm-street')?.value.trim()||'',
      number:document.getElementById('pm-number')?.value.trim()||'',
      neighborhood:document.getElementById('pm-neighborhood')?.value.trim()||'',
      city, citySlug:city.toLowerCase().replace(/\s+/g,'-').normalize('NFD').replace(/[\u0300-\u036f]/g,''), uf
    },
    links:[],whatsapp:'',phone:'',mural:[],publicNote:'',
    active:true,featured:false,priority:0,
    claimedBy:'',claimedAt:null,claimId:'',linkedBusinessId:'',
    createdAt:now,updatedAt:now,createdBy:'admin'
  };
  await set(placeRef,doc);
  document.getElementById('place-modal').style.display='none';
};
