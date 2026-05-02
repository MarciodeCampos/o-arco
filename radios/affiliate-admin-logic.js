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
function fmt(ts){ if(!ts) return '—'; return new Date(ts).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}); }
function show(id){ const el=document.getElementById(id); if(el)el.style.display=''; }
function hide(id){ const el=document.getElementById(id); if(el)el.style.display='none'; }

const ADMIN_KEY = 'cidadeonline2026';
const STATUS_BADGE = {
  pending:'badge-pending',approved:'badge-approved',
  rejected:'badge-rejected',paid_manual:'badge-paid_manual'
};
const STATUS_LABEL = {pending:'⏳ Pendente',approved:'✅ Aprovado',rejected:'❌ Rejeitado',paid_manual:'💸 Pago'};

let allLeads   = [];
let allComms   = [];
let allOffers  = {};
let allLinks   = {};
let activeTab  = 'leads';
let rejectTarget = null;

// ── ADMIN GATE ────────────────────────────────────────────────────────────────
window.setAdminKey = function(){
  if(document.getElementById('admin-key-input')?.value.trim()===ADMIN_KEY){
    localStorage.setItem('aff_admin',ADMIN_KEY); unlockPanel();
  } else { alert('Chave incorreta.'); }
};
function unlockPanel(){
  hide('locked-msg'); show('main-panel');
  document.getElementById('admin-gate-inline').style.display='none';
  document.getElementById('admin-label').style.display='';
  init();
}
if(localStorage.getItem('aff_admin')===ADMIN_KEY) unlockPanel();

// ── INIT ──────────────────────────────────────────────────────────────────────
function init(){
  setupFilters();
  // Load lookups
  get(ref(db,'affiliateOffers')).then(s=>{ const d=s.val()||{}; Object.values(d).forEach(o=>allOffers[o.offerId]=o); });
  get(ref(db,'affiliateLinks')).then(s=>{ const d=s.val()||{}; Object.values(d).forEach(l=>allLinks[l.linkId]=l); });
  // Listen leads
  onValue(ref(db,'affiliateLeads'), snap=>{
    allLeads = Object.values(snap.val()||{}).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    updateSummary(); if(activeTab==='leads') renderLeads();
  });
  // Listen commissions
  onValue(ref(db,'affiliateCommissions'), snap=>{
    allComms = Object.values(snap.val()||{}).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    updateSummary(); if(activeTab==='comms') renderComms();
  });
}

function setupFilters(){
  document.getElementById('f-status')?.addEventListener('change', renderActive);
  let d; document.getElementById('f-search-admin')?.addEventListener('input',()=>{clearTimeout(d);d=setTimeout(renderActive,200);});
}

function updateSummary(){
  document.getElementById('sk-leads-p').textContent  = allLeads.filter(l=>l.status==='pending').length;
  document.getElementById('sk-leads-a').textContent  = allLeads.filter(l=>l.status==='approved').length;
  document.getElementById('sk-leads-r').textContent  = allLeads.filter(l=>l.status==='rejected').length;
  document.getElementById('sk-comm-p').textContent   = allComms.filter(c=>c.status==='pending'||c.status==='approved').length;
  document.getElementById('sk-comm-paid').textContent= allComms.filter(c=>c.status==='paid_manual').length;
}

// ── TABS ──────────────────────────────────────────────────────────────────────
window.setTab = function(tab){
  activeTab=tab;
  ['leads','comms'].forEach(t=>{
    document.getElementById('tab-'+t)?.classList.toggle('active',t===tab);
    const pane=document.getElementById('pane-'+t);
    if(pane) pane.style.display=t===tab?'':'none';
  });
  // Reset status filter options for tab context
  const sel=document.getElementById('f-status');
  if(sel){
    if(tab==='comms'){
      sel.innerHTML='<option value="">Todos</option><option value="pending">Pendente</option><option value="approved">Aprovado</option><option value="paid_manual">Pago</option><option value="rejected">Rejeitado</option>';
    } else {
      sel.innerHTML='<option value="">Todos</option><option value="pending">Pendente</option><option value="approved">Aprovado</option><option value="rejected">Rejeitado</option>';
    }
  }
  renderActive();
};

function renderActive(){ activeTab==='leads' ? renderLeads() : renderComms(); }

// ── RENDER LEADS ──────────────────────────────────────────────────────────────
function renderLeads(){
  const status = document.getElementById('f-status')?.value||'';
  const search = (document.getElementById('f-search-admin')?.value||'').toLowerCase();
  const filtered = allLeads.filter(l=>{
    if(status && l.status!==status) return false;
    const offer = allOffers[l.offerId]||{};
    const link  = allLinks[l.linkId]||{};
    const haystack = `${l.leadName} ${l.leadPhone} ${l.leadMessage} ${offer.title} ${link.affiliateName}`.toLowerCase();
    if(search && !haystack.includes(search)) return false;
    return true;
  });

  const el=document.getElementById('leads-list');
  if(!filtered.length){ el.innerHTML='<div class="empty-state"><span>📋</span>Nenhum lead encontrado.</div>'; return; }

  el.innerHTML=filtered.map(l=>{
    const offer = allOffers[l.offerId]||{};
    const link  = allLinks[l.linkId]||{};
    const isPending = l.status==='pending';
    return `<div class="lead-row">
      <div class="lead-row-top">
        <div class="lead-title">${esc(offer.title||l.offerId)}</div>
        <span class="badge ${STATUS_BADGE[l.status]||'badge-pending'}">${STATUS_LABEL[l.status]||l.status}</span>
      </div>
      <div class="lead-meta">
        <strong>Cliente:</strong> ${esc(l.leadName)} · ${esc(l.leadPhone)}<br>
        ${l.leadMessage?`<strong>Msg:</strong> ${esc(l.leadMessage)}<br>`:''}
        <strong>Afiliado:</strong> ${esc(link.affiliateName||l.affiliateUid||'direto')} · ref: ${esc(l.refCode||'—')}<br>
        <strong>Comércio:</strong> ${esc(offer.city||'')}/${esc(offer.uf||'')} · ${esc(offer.category||'')}<br>
        <strong>Data:</strong> ${fmt(l.createdAt)}
        ${l.confirmedAt?` · <strong>Aprovado em:</strong> ${fmt(l.confirmedAt)}`:''}
        ${l.rejectedAt?` · <strong>Rejeitado em:</strong> ${fmt(l.rejectedAt)}`:''}
        ${l.rejectionReason?` · <em>${esc(l.rejectionReason)}</em>`:''}
      </div>
      ${isPending?`<div class="lead-actions">
        <button class="btn-approve" onclick="approveLead('${esc(l.leadId)}')">✅ Aprovar lead</button>
        <button class="btn-reject-action" onclick="openRejectModal('${esc(l.leadId)}')">❌ Rejeitar</button>
      </div>`:''}
    </div>`;
  }).join('');
}

// ── APPROVE LEAD ──────────────────────────────────────────────────────────────
window.approveLead = async function(leadId){
  const lead = allLeads.find(l=>l.leadId===leadId);
  if(!lead) return;
  const now = Date.now();
  await update(ref(db,'affiliateLeads/'+leadId),{status:'approved', confirmedAt:now});

  // Increment affiliateLinks.leads
  if(lead.linkId && allLinks[lead.linkId]!==undefined){
    const curLeads = (allLinks[lead.linkId]?.leads||0);
    // Only count if not already approved (avoid double-count from submitLead increment)
    // We track commissionGenerated flag
  }

  // Generate commission if offer has commission
  if(!lead.commissionGenerated){
    const offer = allOffers[lead.offerId]||{};
    if(offer.commissionType && offer.commissionType!=='none' && offer.commissionValue && lead.affiliateUid){
      const commRef = push(ref(db,'affiliateCommissions'));
      const commDoc = {
        commissionId: commRef.key,
        leadId:       leadId,
        offerId:      lead.offerId,
        businessId:   lead.businessId||'',
        affiliateUid: lead.affiliateUid,
        affiliateName: allLinks[lead.linkId]?.affiliateName||'',
        linkId:       lead.linkId||'',
        value:        offer.commissionValue,
        type:         offer.commissionType,
        status:       'pending',
        approvedBy:'', approvedAt:null, paidAt:null,
        paymentMethod:'', paymentNote:'',
        createdAt:now, updatedAt:now
      };
      await set(commRef, commDoc);
      // Mark lead commission generated
      await update(ref(db,'affiliateLeads/'+leadId),{commissionGenerated:true});
      // Update affiliate link comms counter
      if(lead.linkId){
        const curPend = allLinks[lead.linkId]?.commissionsPending||0;
        update(ref(db,'affiliateLinks/'+lead.linkId),{commissionsPending:curPend+offer.commissionValue}).catch(()=>{});
      }
    }
  }
};

// ── REJECT LEAD ───────────────────────────────────────────────────────────────
window.openRejectModal = function(leadId){
  rejectTarget=leadId;
  document.getElementById('reject-reason').value='';
  document.getElementById('reject-modal').style.display='flex';
};
window.closeRejectModal = function(e){
  if(!e || e.target.id==='reject-modal') document.getElementById('reject-modal').style.display='none';
};
window.confirmReject = async function(){
  if(!rejectTarget) return;
  const reason = document.getElementById('reject-reason').value.trim();
  await update(ref(db,'affiliateLeads/'+rejectTarget),{
    status:'rejected', rejectedAt:Date.now(), rejectionReason:reason||''
  });
  document.getElementById('reject-modal').style.display='none';
  rejectTarget=null;
};

// ── RENDER COMMISSIONS ────────────────────────────────────────────────────────
function renderComms(){
  const status = document.getElementById('f-status')?.value||'';
  const search = (document.getElementById('f-search-admin')?.value||'').toLowerCase();
  const filtered = allComms.filter(c=>{
    if(status && c.status!==status) return false;
    const offer = allOffers[c.offerId]||{};
    const hay = `${c.affiliateName} ${offer.title}`.toLowerCase();
    if(search && !hay.includes(search)) return false;
    return true;
  });

  const el=document.getElementById('comms-list');
  if(!filtered.length){ el.innerHTML='<div class="empty-state"><span>💸</span>Nenhuma comissão encontrada.</div>'; return; }

  el.innerHTML=filtered.map(c=>{
    const offer = allOffers[c.offerId]||{};
    const valFmt = c.type==='percent'?`${c.value}%`:`R$ ${(c.value||0).toFixed(2)}`;
    return `<div class="lead-row">
      <div class="lead-row-top">
        <div>
          <div class="lead-title">💸 ${valFmt} — ${esc(offer.title||c.offerId)}</div>
          <div style="font-size:.73rem;color:#64748b;margin-top:2px">
            Afiliado: <strong>${esc(c.affiliateName||c.affiliateUid)}</strong> · Lead: ${esc(c.leadId?.slice(-6)||'')}<br>
            Criado: ${fmt(c.createdAt)}${c.paidAt?` · Pago: ${fmt(c.paidAt)}`:''}
            ${c.paymentNote?` · <em>${esc(c.paymentNote)}</em>`:''}
          </div>
        </div>
        <span class="badge ${STATUS_BADGE[c.status]||'badge-pending'}">${STATUS_LABEL[c.status]||c.status}</span>
      </div>
      <div class="lead-actions">
        <label style="font-size:.75rem;color:#64748b;font-weight:700">Status:</label>
        <select class="comm-status-select" onchange="updateCommStatus('${esc(c.commissionId)}',this.value,'${esc(c.affiliateUid)}','${c.value||0}','${c.type||''}')">
          <option value="pending"     ${c.status==='pending'?'selected':''}>⏳ Pendente</option>
          <option value="approved"    ${c.status==='approved'?'selected':''}>✅ Aprovado</option>
          <option value="paid_manual" ${c.status==='paid_manual'?'selected':''}>💸 Pago (manual)</option>
          <option value="rejected"    ${c.status==='rejected'?'selected':''}>❌ Rejeitado</option>
        </select>
      </div>
    </div>`;
  }).join('');
}

// ── UPDATE COMMISSION STATUS ──────────────────────────────────────────────────
window.updateCommStatus = async function(commId, newStatus, affiliateUid, value, type){
  const now=Date.now();
  const patch = { status:newStatus, updatedAt:now };
  if(newStatus==='approved')    patch.approvedAt=now;
  if(newStatus==='paid_manual'){ patch.paidAt=now; patch.paymentMethod='pix_manual'; }

  await update(ref(db,'affiliateCommissions/'+commId), patch);

  // Update affiliateLink counters when paid
  const comm = allComms.find(c=>c.commissionId===commId);
  if(comm?.linkId && newStatus==='paid_manual'){
    const lnk = allLinks[comm.linkId]||{};
    const paid = (lnk.commissionsApproved||0)+parseFloat(value||0);
    const pend = Math.max(0,(lnk.commissionsPending||0)-parseFloat(value||0));
    update(ref(db,'affiliateLinks/'+comm.linkId),{commissionsApproved:paid, commissionsPending:pend}).catch(()=>{});
  }
};
