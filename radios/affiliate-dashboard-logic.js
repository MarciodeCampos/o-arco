import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, get, set, push, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
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
function randCode(){ return Math.random().toString(36).slice(2,9); }
function show(id){ const el=document.getElementById(id); if(el)el.style.display=''; }
function hide(id){ const el=document.getElementById(id); if(el)el.style.display='none'; }

const BASE = window.location.origin+window.location.pathname.replace('affiliate-dashboard.html','');

// ── STATE ─────────────────────────────────────────────────────────────────────
let currentUser  = null;
let allOffers    = [];   // active offers available to affiliate
let myLinks      = {};   // { offerId: linkDoc }
let activeTab    = 'offers';

// ── AUTH ──────────────────────────────────────────────────────────────────────
window.doLogin = async function(){
  const p = new GoogleAuthProvider();
  await signInWithPopup(auth, p).catch(e=>alert('Erro: '+e.message));
};

onAuthStateChanged(auth, user=>{
  currentUser = user;
  if(user){
    document.getElementById('user-label').textContent = user.displayName||user.email||'';
    document.getElementById('btn-login').style.display='none';
    hide('auth-gate');
    show('main-panel');
    boot();
  } else {
    show('auth-gate');
    hide('main-panel');
    document.getElementById('btn-login').style.display='';
  }
});

// ── BOOT ──────────────────────────────────────────────────────────────────────
function boot(){
  // Listen my links
  onValue(ref(db,'affiliateLinks'), snap=>{
    const data = snap.val()||{};
    myLinks = {};
    for(const lnk of Object.values(data)){
      if(lnk.affiliateUid===currentUser.uid) myLinks[lnk.offerId]=lnk;
    }
    updateSummary();
    if(activeTab==='links') renderMyLinks();
    if(activeTab==='offers') renderOffers();
  });

  // Listen offers
  const now = Date.now();
  onValue(ref(db,'affiliateOffers'), snap=>{
    const data = snap.val()||{};
    allOffers = Object.values(data)
      .filter(o=>o.active && (!o.validUntil||o.validUntil>now))
      .sort((a,b)=>(b.featured?1:0)-(a.featured?1:0)||(b.totalClicks||0)-(a.totalClicks||0));
    renderOffers();
  });

  // Search filter
  let d; document.getElementById('f-search')?.addEventListener('input',()=>{clearTimeout(d);d=setTimeout(renderOffers,200);});
}

// ── SUMMARY ───────────────────────────────────────────────────────────────────
function updateSummary(){
  const links   = Object.values(myLinks);
  const clicks  = links.reduce((s,l)=>s+(l.clicks||0),0);
  const leads   = links.reduce((s,l)=>s+(l.leads||0),0);
  const comms   = links.reduce((s,l)=>s+(l.commissionsApproved||0),0);
  document.getElementById('s-links').textContent  = links.length;
  document.getElementById('s-clicks').textContent = clicks;
  document.getElementById('s-leads').textContent  = leads;
  document.getElementById('s-comms').textContent  = comms>0?`R$ ${comms.toFixed(2)}`:'R$ 0';
}

// ── TABS ──────────────────────────────────────────────────────────────────────
window.setTab = function(tab){
  activeTab=tab;
  ['offers','links'].forEach(t=>{
    document.getElementById('tab-'+t)?.classList.toggle('active',t===tab);
    const pane=document.getElementById('pane-'+t);
    if(pane) pane.style.display=t===tab?'':'none';
  });
  if(tab==='links') renderMyLinks();
};

// ── RENDER OFFERS ─────────────────────────────────────────────────────────────
const TYPE_LABEL={coupon:'🏷️ Cupom',lead:'📋 Agendamento',external_cart:'🛒 Online',reservation:'🏨 Reserva',custom:'⭐ Especial'};

function renderOffers(){
  const search=(document.getElementById('f-search')?.value||'').toLowerCase();
  const filtered=allOffers.filter(o=>!search||(o.title||'').toLowerCase().includes(search)||(o.city||'').toLowerCase().includes(search));
  const el=document.getElementById('available-offers');
  if(!filtered.length){
    el.innerHTML='<div class="empty-state"><span>🏷️</span>Nenhuma oferta disponível no momento.</div>'; return;
  }
  el.innerHTML=filtered.map(o=>{
    const myLink = myLinks[o.offerId];
    const pubUrl = myLink ? `${BASE}offer.html?id=${esc(o.offerId)}&ref=${esc(myLink.refCode)}` : '';
    const disc   = fmtDiscount(o);
    const hasComm = o.showCommission && o.commissionValue && o.commissionType!=='none';
    return `<div class="avail-card">
      <div>
        <div class="avail-title">${esc(o.title)}</div>
        <div class="avail-meta">🏪 ${esc(o.city||'')}/${esc(o.uf||'')} · ${TYPE_LABEL[o.type||o.offerType]||'Oferta'}</div>
      </div>
      ${disc?`<div class="avail-discount">${disc}</div>`:''}
      ${o.couponCode?`<div class="avail-coupon">🏷️ ${esc(o.couponCode)}</div>`:''}
      ${hasComm?`<div class="avail-comm">💸 Comissão: ${o.commissionType==='percent'?o.commissionValue+'%':'R$'+o.commissionValue} por lead confirmado</div>`:''}
      <div class="avail-actions">
        <button class="btn-generate${myLink?' has-link':''}" onclick="generateLink('${esc(o.offerId)}')">
          ${myLink?'✓ Link gerado':'🔗 Gerar meu link'}
        </button>
        ${myLink?`<button class="btn-copy-avail" onclick="copyUrl('${esc(pubUrl)}',this)">📋 Copiar</button>`:''}
        <a class="btn-view-avail" href="offer.html?id=${esc(o.offerId)}" target="_blank">👁️</a>
      </div>
      ${myLink?`<div style="font-size:.7rem;color:#475569">👁️ ${myLink.clicks||0} cliques · 📋 ${myLink.leads||0} leads</div>`:''}
    </div>`;
  }).join('');
}

// ── GENERATE LINK ─────────────────────────────────────────────────────────────
window.generateLink = async function(offerId){
  if(!currentUser){ alert('Faça login primeiro.'); return; }
  // Reuse se já existe
  if(myLinks[offerId]){
    const l=myLinks[offerId];
    const url=`${BASE}offer.html?id=${offerId}&ref=${l.refCode}`;
    copyUrlSilent(url);
    alert('✅ Link copiado!\n'+url);
    return;
  }

  // Antifraude: não pode ser o próprio dono do negócio
  const offerSnap=await get(ref(db,'affiliateOffers/'+offerId));
  const offer=offerSnap.val()||{};
  if(offer.businessId){
    const bizSnap=await get(ref(db,'businessProfiles/'+offer.businessId));
    const biz=bizSnap.val()||{};
    if(biz.ownerUid===currentUser.uid){
      alert('⚠️ Você não pode gerar link de afiliado para o seu próprio comércio.');
      return;
    }
  }

  const refCode = randCode();
  const linkRef = push(ref(db,'affiliateLinks'));
  const linkId  = linkRef.key;
  const linkDoc = {
    linkId, offerId,
    businessId:  offer.businessId||'',
    affiliateUid: currentUser.uid,
    affiliateName: currentUser.displayName||currentUser.email||'',
    refCode,
    url: `${BASE}offer.html?id=${offerId}&ref=${refCode}`,
    clicks: 0, leads: 0,
    commissionsApproved: 0, commissionsPending: 0,
    createdAt: Date.now(), active: true
  };
  await set(linkRef, linkDoc);
  // Cache local imediato (o onValue vai confirmar)
  myLinks[offerId]=linkDoc;
  renderOffers();
  // Copiar e notificar
  const url=linkDoc.url;
  copyUrlSilent(url);
  alert('✅ Link gerado e copiado!\n'+url);
};

// ── RENDER MY LINKS ───────────────────────────────────────────────────────────
function renderMyLinks(){
  const el=document.getElementById('my-links-list');
  const links=Object.values(myLinks).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  if(!links.length){
    el.innerHTML='<div class="empty-state"><span>🔗</span>Você ainda não gerou nenhum link.<br><small>Vá em "Ofertas disponíveis" e clique em <strong>Gerar meu link</strong>.</small></div>';
    return;
  }
  // Map offerId → offer data
  const offerMap={};
  allOffers.forEach(o=>{ offerMap[o.offerId]=o; });

  el.innerHTML=links.map(l=>{
    const o=offerMap[l.offerId]||{};
    const url=l.url||`${BASE}offer.html?id=${l.offerId}&ref=${l.refCode}`;
    const comm=l.commissionsApproved>0
      ?`<span style="color:#22c55e;font-size:.73rem;font-weight:700">R$ ${l.commissionsApproved.toFixed(2)} aprovado</span>`
      :(l.commissionsPending>0?`<span style="color:#f59e0b;font-size:.73rem;font-weight:700">R$ ${l.commissionsPending.toFixed(2)} pendente</span>`:'');
    return `<div class="link-row">
      <div class="link-row-top">
        <div>
          <div class="link-offer-title">${esc(o.title||l.offerId)}</div>
          <div class="link-offer-meta">🏪 ${esc(o.city||'')}/${esc(o.uf||'')} · Ref: <strong>${esc(l.refCode)}</strong></div>
        </div>
        <a href="offer.html?id=${esc(l.offerId)}&ref=${esc(l.refCode)}" target="_blank"
           style="font-size:.75rem;color:#a78bfa;font-weight:700;text-decoration:none">👁️ Ver</a>
      </div>
      <div class="link-url-bar">
        <span class="link-url-text">${url}</span>
        <button class="btn-copy-link" onclick="copyUrl('${esc(url)}',this)">📋 Copiar</button>
      </div>
      <div class="link-stats">
        <div class="link-stat"><div class="link-stat-val c">${l.clicks||0}</div><div class="link-stat-lbl">Cliques</div></div>
        <div class="link-stat"><div class="link-stat-val l">${l.leads||0}</div><div class="link-stat-lbl">Leads</div></div>
        <div class="link-stat" style="flex:1">${comm}</div>
      </div>
    </div>`;
  }).join('');
}

// ── COPY ──────────────────────────────────────────────────────────────────────
window.copyUrl = function(url,btn){
  navigator.clipboard.writeText(url).then(()=>{
    if(!btn) return;
    const orig=btn.textContent; btn.textContent='✅ Copiado!'; setTimeout(()=>btn.textContent=orig,1500);
  }).catch(()=>{ if(btn) prompt('Copie o link:',url); });
};
function copyUrlSilent(url){ navigator.clipboard.writeText(url).catch(()=>{}); }

function fmtDiscount(o){
  if(o.discountType==='percent' && o.discountValue) return `-${o.discountValue}%`;
  if(o.discountType==='fixed' && o.discountValue)   return `-R$${o.discountValue}`;
  if(o.discountType==='frete_gratis') return '🚚 Frete grátis';
  return '';
}
