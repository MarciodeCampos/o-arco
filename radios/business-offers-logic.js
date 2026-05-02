import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, get, set, push, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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

function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function slugify(s){ return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
function randId(){ return Math.random().toString(36).slice(2,10); }
function show(id){ const el=document.getElementById(id); if(el)el.style.display=''; }
function hide(id){ const el=document.getElementById(id); if(el)el.style.display='none'; }

const ADMIN_KEY = 'cidadeonline2026';
const BASE_URL  = window.location.origin+window.location.pathname.replace('business-offers.html','');

// ── STATE ─────────────────────────────────────────────────────────────────────
let currentUser  = null;
let isAdmin      = false;
let myBizList    = [];
let activeBizId  = null;
let allOffers    = [];
let editingId    = null;
let offersUnsub  = null;

// ── ADMIN GATE ────────────────────────────────────────────────────────────────
window.setAdminKey = function(){
  const val = document.getElementById('admin-key-input')?.value.trim();
  if(val===ADMIN_KEY){ localStorage.setItem('bo_admin',val); isAdmin=true; bootPanel(); }
  else { alert('Chave incorreta.'); }
};

// ── AUTH ──────────────────────────────────────────────────────────────────────
window.doLogin = async function(){
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider).catch(e=>alert('Erro: '+e.message));
};

onAuthStateChanged(auth, async user=>{
  currentUser=user;
  if(localStorage.getItem('bo_admin')===ADMIN_KEY){ isAdmin=true; }
  if(user){
    document.getElementById('user-name-label').textContent = user.displayName||'';
    document.getElementById('btn-login').style.display='none';
  } else {
    document.getElementById('btn-login').style.display='';
  }
  if(user || isAdmin) bootPanel();
  else { show('auth-gate'); hide('main-panel'); hide('no-biz-gate'); }
});

// ── BOOT ──────────────────────────────────────────────────────────────────────
async function bootPanel(){
  hide('auth-gate');
  const snap = await get(ref(db,'businessProfiles'));
  const data = snap.val()||{};
  if(isAdmin){
    myBizList = Object.values(data).filter(b=>b.active!==false);
  } else if(currentUser){
    myBizList = Object.values(data).filter(b=>b.ownerUid===currentUser.uid && b.active!==false);
  }
  if(!myBizList.length){ show('no-biz-gate'); return; }
  show('main-panel');
  populateBizSelector();
}

function populateBizSelector(){
  const sel = document.getElementById('biz-selector');
  sel.innerHTML = myBizList
    .sort((a,b)=>(a.name||'').localeCompare(b.name||''))
    .map(b=>`<option value="${esc(b.businessId||b.profileId)}">${esc(b.name)} — ${esc(b.city||'')}/${esc(b.uf||'')}</option>`)
    .join('');
  activeBizId = myBizList[0].businessId||myBizList[0].profileId;
  sel.onchange = ()=>{ activeBizId=sel.value; listenOffers(); };
  listenOffers();
}

// ── LISTEN OFFERS ─────────────────────────────────────────────────────────────
function listenOffers(){
  if(offersUnsub) offersUnsub();
  offersUnsub = onValue(ref(db,'affiliateOffers'), snap=>{
    const data = snap.val()||{};
    allOffers = Object.values(data)
      .filter(o=>o.businessId===activeBizId)
      .sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    updateCounters();
    renderOffers();
  });
}

function updateCounters(){
  const active   = allOffers.filter(o=>o.active).length;
  const inactive = allOffers.length - active;
  const clicks   = allOffers.reduce((s,o)=>s+(o.totalClicks||0),0);
  document.getElementById('cnt-total').textContent   = allOffers.length;
  document.getElementById('cnt-active').textContent  = active;
  document.getElementById('cnt-inactive').textContent= inactive;
  document.getElementById('cnt-clicks').textContent  = clicks;
}

// ── RENDER ────────────────────────────────────────────────────────────────────
const TYPE_LABEL = {
  coupon:'🏷️ Cupom', lead:'📋 Agendamento',
  external_cart:'🛒 Online', reservation:'🏨 Reserva', custom:'⭐ Especial'
};

function renderOffers(){
  const el = document.getElementById('offers-list');
  if(!allOffers.length){
    el.innerHTML='<div class="empty-state"><span>🏷️</span>Nenhuma oferta criada ainda.<br><small>Clique em "+ Nova oferta" para começar.</small></div>';
    return;
  }
  el.innerHTML = allOffers.map(o=>{
    const typeK   = o.type||o.offerType||'custom';
    const isActive = o.active!==false;
    const pubUrl  = `${BASE_URL}offer.html?id=${esc(o.offerId)}`;
    const disc    = fmtDiscount(o);
    return `<div class="offer-row${isActive?'':' inactive'}" id="row-${esc(o.offerId)}">
      <div class="offer-row-top">
        <div>
          <div class="offer-row-title">${esc(o.title)}</div>
          <div class="offer-row-meta">${esc(o.category||'')} · ${esc(o.city||'')}/${esc(o.uf||'')}</div>
        </div>
      </div>
      <div class="offer-row-badges">
        <span class="badge ${isActive?'badge-active':'badge-inactive'}">${isActive?'✓ Ativa':'⏸ Pausada'}</span>
        <span class="badge badge-${typeK}">${TYPE_LABEL[typeK]||typeK}</span>
        ${o.featured?'<span class="badge badge-featured">⭐ Destaque</span>':''}
        ${o.couponCode?`<span class="badge badge-coupon">🏷️ ${esc(o.couponCode)}</span>`:''}
        ${disc?`<span style="font-size:.7rem;color:#fbbf24;font-weight:700">${disc}</span>`:''}
      </div>
      <div class="offer-link-bar">
        <span class="offer-link-url">${pubUrl}</span>
        <button class="btn-copy-link" onclick="copyLink('${esc(pubUrl)}',this)">📋 Copiar</button>
      </div>
      <div class="offer-stats-mini">
        <span>👁️ <strong>${o.totalClicks||0}</strong> cliques</span>
        <span>📋 <strong>${o.totalLeads||0}</strong> leads</span>
        ${o.validUntil?`<span>⏱ Expira ${new Date(o.validUntil).toLocaleDateString('pt-BR')}</span>`:''}
      </div>
      <div class="offer-row-actions">
        <button class="btn-edit" onclick="openOfferForm('${esc(o.offerId)}')">✏️ Editar</button>
        <button class="${isActive?'btn-toggle-on':'btn-toggle-off'} btn-toggle-active"
          onclick="toggleActive('${esc(o.offerId)}',${isActive})">
          ${isActive?'⏸ Pausar':'▶ Ativar'}
        </button>
        <a class="btn-view-offer" href="offer.html?id=${esc(o.offerId)}" target="_blank">🔗 Ver oferta</a>
      </div>
    </div>`;
  }).join('');
}

function fmtDiscount(o){
  if(o.discountType==='percent' && o.discountValue) return `-${o.discountValue}%`;
  if(o.discountType==='fixed' && o.discountValue)   return `-R$${o.discountValue}`;
  if(o.discountType==='frete_gratis') return 'Frete grátis';
  return '';
}

// ── TOGGLE ACTIVE ─────────────────────────────────────────────────────────────
window.toggleActive = async function(offerId, isActive){
  await update(ref(db,'affiliateOffers/'+offerId),{active:!isActive, updatedAt:Date.now()});
  await update(ref(db,'businessOffers/'+activeBizId+'/'+offerId),{active:!isActive}).catch(()=>{});
};

// ── COPY LINK ─────────────────────────────────────────────────────────────────
window.copyLink = function(url, btn){
  navigator.clipboard.writeText(url).then(()=>{
    const orig=btn.textContent; btn.textContent='✅ Copiado!'; setTimeout(()=>btn.textContent=orig,1500);
  }).catch(()=>{ prompt('Copie o link:',url); });
};

// ── FORM MODAL ────────────────────────────────────────────────────────────────
window.openOfferForm = function(offerId=null){
  editingId = offerId;
  document.getElementById('modal-title').textContent = offerId ? '✏️ Editar oferta' : '+ Nova oferta';
  if(offerId){
    const o = allOffers.find(x=>x.offerId===offerId);
    if(o) fillForm(o);
  } else {
    resetForm();
  }
  document.getElementById('offer-modal').style.display='flex';
};

window.closeModal = function(){
  document.getElementById('offer-modal').style.display='none';
  editingId=null;
};

window.closeModalOnOverlay = function(e){
  if(e.target.id==='offer-modal') closeModal();
};

function resetForm(){
  ['m-title','m-description','m-coupon','m-discount-value','m-whatsapp','m-wa-message','m-external-url','m-comm-value'].forEach(id=>{
    const el=document.getElementById(id); if(el)el.value='';
  });
  document.getElementById('m-type').value='coupon';
  document.getElementById('m-discount-type').value='';
  document.getElementById('m-comm-type').value='none';
  document.getElementById('m-max-leads').value='500';
  document.getElementById('m-valid-until').value='';
  document.getElementById('m-featured').checked=false;
  document.getElementById('m-show-commission').checked=false;
  // Prefill category from selected biz
  const biz = myBizList.find(b=>(b.businessId||b.profileId)===activeBizId);
  if(biz){
    document.getElementById('m-category').value=biz.category||'';
    document.getElementById('m-whatsapp').value=(biz.whatsapp||'').replace(/\D/g,'');
  }
}

function fillForm(o){
  document.getElementById('m-title').value           = o.title||'';
  document.getElementById('m-description').value     = o.description||'';
  document.getElementById('m-type').value            = o.type||o.offerType||'coupon';
  document.getElementById('m-category').value        = o.category||'';
  document.getElementById('m-coupon').value          = o.couponCode||'';
  document.getElementById('m-discount-type').value   = o.discountType||'';
  document.getElementById('m-discount-value').value  = o.discountValue||0;
  document.getElementById('m-whatsapp').value        = (o.whatsapp||'').replace(/\D/g,'');
  document.getElementById('m-wa-message').value      = o.whatsappMessage||'';
  document.getElementById('m-external-url').value    = o.externalUrl||'';
  document.getElementById('m-comm-type').value       = o.commissionType||'none';
  document.getElementById('m-comm-value').value      = o.commissionValue||0;
  document.getElementById('m-max-leads').value       = o.maxLeads||500;
  document.getElementById('m-featured').checked      = !!o.featured;
  document.getElementById('m-show-commission').checked = !!o.showCommission;
  if(o.validUntil){
    document.getElementById('m-valid-until').value = new Date(o.validUntil).toISOString().slice(0,10);
  } else {
    document.getElementById('m-valid-until').value='';
  }
}

// ── SAVE OFFER ────────────────────────────────────────────────────────────────
window.saveOffer = async function(){
  const title = document.getElementById('m-title').value.trim();
  if(!title){ alert('Título obrigatório.'); return; }

  const biz = myBizList.find(b=>(b.businessId||b.profileId)===activeBizId);
  const now = Date.now();
  const validStr = document.getElementById('m-valid-until').value;
  const offerId  = editingId || ('offer_'+slugify(activeBizId).slice(0,16)+'_'+randId());

  const existing = editingId ? (allOffers.find(o=>o.offerId===editingId)||{}) : {};

  const payload = {
    offerId,
    businessId: activeBizId,
    profileId:  activeBizId,
    createdBy: currentUser?.uid||'admin',

    title,
    description: document.getElementById('m-description').value.trim(),
    type: document.getElementById('m-type').value,
    offerType: document.getElementById('m-type').value,
    category: document.getElementById('m-category').value.trim()||biz?.category||'',

    couponCode:    document.getElementById('m-coupon').value.trim().toUpperCase(),
    discountType:  document.getElementById('m-discount-type').value,
    discountValue: parseFloat(document.getElementById('m-discount-value').value)||0,

    whatsapp:        (document.getElementById('m-whatsapp').value||'').replace(/\D/g,''),
    whatsappMessage: document.getElementById('m-wa-message').value.trim(),
    externalUrl:     document.getElementById('m-external-url').value.trim(),

    commissionType:  document.getElementById('m-comm-type').value,
    commissionValue: parseFloat(document.getElementById('m-comm-value').value)||0,
    showCommission:  document.getElementById('m-show-commission').checked,

    featured: document.getElementById('m-featured').checked,
    active:   existing.active!==false,  // mantém estado atual; novo = true
    validFrom:  existing.validFrom||null,
    validUntil: validStr ? new Date(validStr).getTime() : null,
    maxLeads:   parseInt(document.getElementById('m-max-leads').value)||500,

    city:      biz?.city||existing.city||'',
    citySlug:  biz?.citySlug||existing.citySlug||'',
    uf:        biz?.uf||existing.uf||'',
    stateName: biz?.stateName||existing.stateName||'',

    totalClicks: existing.totalClicks||0,
    totalLeads:  existing.totalLeads||0,
    createdAt:   existing.createdAt||now,
    updatedAt:   now
  };

  if(!editingId) payload.active = true;

  await set(ref(db,'affiliateOffers/'+offerId), payload);
  await set(ref(db,'businessOffers/'+activeBizId+'/'+offerId),{
    offerId, title, active:payload.active, createdAt:payload.createdAt, updatedAt:now
  });

  closeModal();
};
