import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, get, set, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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
function fmt(ts){ if(!ts) return '—'; return new Date(ts).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }

const ADMIN_KEY = 'cidadeonline2026';
let allClaims = [];

window.setAdminKey = function(){
  if(document.getElementById('admin-key-input')?.value.trim()===ADMIN_KEY){
    localStorage.setItem('claims_admin',ADMIN_KEY);
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
if(localStorage.getItem('claims_admin')===ADMIN_KEY) unlockPanel();

function init(){
  setupFilters();
  listenClaims();
}

function setupFilters(){
  document.getElementById('f-status')?.addEventListener('change', renderList);
  let d; document.getElementById('f-search')?.addEventListener('input',()=>{clearTimeout(d);d=setTimeout(renderList,200);});
}

function listenClaims(){
  onValue(ref(db,'businessClaims'), snap=>{
    const data = snap.val()||{};
    allClaims = Object.values(data).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    updateCounters();
    renderList();
  });
}

function updateCounters(){
  const c=s=>allClaims.filter(x=>x.status===s).length;
  document.getElementById('cnt-pending').querySelector('span').textContent = c('pending');
  document.getElementById('cnt-approved').querySelector('span').textContent = c('approved');
  document.getElementById('cnt-rejected').querySelector('span').textContent = c('rejected');
  document.getElementById('cnt-total').querySelector('span').textContent = allClaims.length;
}

const STATUS_LABELS = {pending:'⏳ Pendente',approved:'✅ Aprovado',rejected:'❌ Rejeitado',cancelled:'🚫 Cancelado'};

function renderList(){
  const status = document.getElementById('f-status')?.value||'';
  const search = (document.getElementById('f-search')?.value||'').toLowerCase();
  const filtered = allClaims.filter(c=>{
    if(status && c.status!==status) return false;
    if(search && !(c.bizName||'').toLowerCase().includes(search) && !(c.requesterName||'').toLowerCase().includes(search)) return false;
    return true;
  });
  const el = document.getElementById('claims-list');
  document.getElementById('results-meta').textContent = filtered.length+' solicitaç'+(filtered.length===1?'ão':'ões');
  if(!filtered.length){
    el.innerHTML='<div class="empty-state"><span>🏪</span>Nenhuma solicitação encontrada.</div>'; return;
  }
  el.innerHTML = filtered.map(c=>{
    const isPending = c.status==='pending';
    return `<div class="claim-card status-${c.status}" id="claim-${esc(c.claimId)}">
      <div class="claim-header">
        <div>
          <div class="claim-biz">🏪 ${esc(c.bizName||c.profileId)}</div>
          <div class="claim-meta">Solicitado em ${fmt(c.createdAt)}</div>
        </div>
        <span class="badge badge-${c.status}">${STATUS_LABELS[c.status]||c.status}</span>
      </div>
      <div class="claim-details">
        ${field('Solicitante',c.requesterName)}
        ${field('WhatsApp/Tel',c.requesterPhone)}
        ${field('E-mail',c.requesterEmail)}
        ${field('profileId',c.profileId)}
        ${field('UID',c.requestedBy)}
        ${c.reviewedAt?field('Revisado em',fmt(c.reviewedAt)):''}
      </div>
      ${c.message?`<div class="claim-msg">"${esc(c.message)}"</div>`:''}
      <div class="claim-actions">
        ${isPending?`<button class="btn-approve" onclick="approveClaim('${esc(c.claimId)}','${esc(c.profileId)}','${esc(c.requestedBy)}','${esc(c.requesterName)}')">✅ Aprovar</button>`:''}
        ${isPending?`<button class="btn-reject-action" onclick="rejectClaim('${esc(c.claimId)}')">❌ Rejeitar</button>`:''}
        <a class="btn-view" href="profile.html?pid=${esc(c.profileId)}" target="_blank">👤 Ver perfil</a>
      </div>
    </div>`;
  }).join('');
}

function field(label,val){
  if(!val) return '';
  return `<div class="claim-field"><strong>${label}</strong>${esc(val)}</div>`;
}

// ── APPROVE ───────────────────────────────────────────────────────────────────
window.approveClaim = async function(claimId, profileId, ownerUid, ownerName){
  if(!confirm(`Aprovar reivindicação de "${ownerName}" para o perfil ${profileId}?`)) return;
  const now = Date.now();

  // Atualiza profiles/
  const profileSnap = await get(ref(db,'profiles/'+profileId));
  if(profileSnap.exists()){
    await update(ref(db,'profiles/'+profileId),{
      ownerUid, claimStatus:'claimed', verificationStatus:'verified', verified:true, updatedAt:now
    });
  }

  // Atualiza businessProfiles/ (pode ter businessId igual ao profileId)
  const bizSnap = await get(ref(db,'businessProfiles/'+profileId));
  if(bizSnap.exists()){
    await update(ref(db,'businessProfiles/'+profileId),{
      ownerUid, claimed:true, updatedAt:now
    });
  }

  // Rejeita outras claims pendentes para o mesmo perfil
  const others = allClaims.filter(c=>c.profileId===profileId && c.status==='pending' && c.claimId!==claimId);
  for(const o of others){
    await update(ref(db,'businessClaims/'+o.claimId),{status:'rejected',reviewedAt:now,reviewedBy:'admin'});
  }

  // Atualiza a claim aprovada
  await update(ref(db,'businessClaims/'+claimId),{
    status:'approved', reviewedAt:now, reviewedBy:'admin'
  });

  alert('✅ Aprovado! ownerUid definido para o perfil.');
};

// ── REJECT ────────────────────────────────────────────────────────────────────
window.rejectClaim = async function(claimId){
  if(!confirm('Rejeitar esta solicitação?')) return;
  await update(ref(db,'businessClaims/'+claimId),{
    status:'rejected', reviewedAt:Date.now(), reviewedBy:'admin'
  });
};
