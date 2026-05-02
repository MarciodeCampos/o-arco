import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get, set, push, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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
function show(id){ const el=document.getElementById(id); if(el)el.style.display=''; }
function hide(id){ const el=document.getElementById(id); if(el)el.style.display='none'; }

const params  = new URLSearchParams(location.search);
const offerId = params.get('id')||'';
const refCode = params.get('ref')||'';

const TYPE_LABEL = {
  coupon:'🏷️ Cupom', lead:'📋 Agendamento',
  external_cart:'🛒 Compra online', reservation:'🏨 Reserva', custom:'⭐ Especial'
};

// ── BOOT ──────────────────────────────────────────────────────────────────────
async function init(){
  if(!offerId){ hide('loading-state'); show('not-found'); return; }

  // Resolve refCode → linkId/affiliateUid
  let linkDoc = null;
  if(refCode){
    const linksSnap = await get(ref(db,'affiliateLinks'));
    const linksData = linksSnap.val()||{};
    linkDoc = Object.values(linksData).find(l=>l.refCode===refCode && l.offerId===offerId);
  }

  // Load offer
  const snap = await get(ref(db,'affiliateOffers/'+offerId));
  if(!snap.exists()){ hide('loading-state'); show('not-found'); return; }
  const o = snap.val();

  const now = Date.now();
  if(!o.active || (o.validUntil && o.validUntil<now)){
    hide('loading-state'); show('not-found'); return;
  }

  // Track click (antifraude: dedup por offerId+UA dentro de 1h via localStorage)
  trackClick(o, linkDoc);

  // Load biz profile
  let biz = null;
  if(o.businessId){
    const bSnap = await get(ref(db,'profiles/'+o.businessId));
    biz = bSnap.val()||null;
    if(!biz){
      const bSnap2 = await get(ref(db,'businessProfiles/'+o.businessId));
      biz = bSnap2.val()||null;
    }
  }

  renderOffer(o, biz, linkDoc);
}

// ── TRACK CLICK ───────────────────────────────────────────────────────────────
async function trackClick(o, linkDoc){
  const dedupKey = `click_${o.offerId}_${navigator.userAgent.slice(0,30)}`;
  const lastClick = parseInt(localStorage.getItem(dedupKey)||'0');
  const now = Date.now();
  if(now - lastClick < 3600000) return; // dedup 1h
  localStorage.setItem(dedupKey, now);

  const clickRef = push(ref(db,'affiliateClicks'));
  const clickData = {
    clickId: clickRef.key,
    offerId: o.offerId,
    businessId: o.businessId||'',
    linkId: linkDoc?.linkId||'',
    affiliateUid: linkDoc?.affiliateUid||'',
    refCode: refCode||'',
    source: document.referrer
      ? (document.referrer.includes('wa.me')||document.referrer.includes('whatsapp')?'whatsapp'
        :document.referrer.includes('instagram')?'instagram'
        :document.referrer.includes('triadic')||document.referrer.includes('localhost')?'radio':'external')
      : 'direct',
    userAgent: navigator.userAgent.slice(0,120),
    ts: now, date: new Date().toISOString().slice(0,10)
  };
  await set(clickRef, clickData);

  // Increment counters
  update(ref(db,'affiliateOffers/'+o.offerId),{
    totalClicks: (o.totalClicks||0)+1, updatedAt:now
  }).catch(()=>{});
  if(linkDoc?.linkId){
    update(ref(db,'affiliateLinks/'+linkDoc.linkId),{
      clicks: (linkDoc.clicks||0)+1
    }).catch(()=>{});
  }
}

// ── RENDER ────────────────────────────────────────────────────────────────────
function renderOffer(o, biz, linkDoc){
  hide('loading-state');
  show('offer-content');

  // Page meta
  document.getElementById('pg-title').textContent = esc(o.title)+' | CIDADEONLINE';
  document.getElementById('pg-desc').content = esc(o.description||'');

  // BIZ BAR
  const bizBar = document.getElementById('biz-bar');
  if(biz){
    const av = biz.photoURL
      ? `<img src="${esc(biz.photoURL)}" alt="${esc(biz.name)}">`
      : (biz.name||'?')[0].toUpperCase();
    bizBar.innerHTML=`
      <div class="biz-avatar-sm">${av}</div>
      <div class="biz-bar-info">
        <div class="biz-bar-name">${esc(biz.name||'')}</div>
        <div class="biz-bar-meta">${esc(o.category||'')} · ${esc(o.city||'')}/${esc(o.uf||'')}</div>
      </div>
      <a class="biz-bar-link" href="profile.html?pid=${esc(o.businessId)}" target="_blank">Ver perfil →</a>`;
  } else {
    bizBar.innerHTML=`<div class="biz-bar-name">🏪 ${esc(o.city||'')}/${esc(o.uf||'')}</div>`;
  }

  // Type badge
  const typeK = o.type||o.offerType||'custom';
  const typeBadge = document.getElementById('offer-type-badge');
  typeBadge.textContent = TYPE_LABEL[typeK]||typeK;
  typeBadge.className = 'offer-type-badge type-'+typeK;

  // Title + desc
  document.getElementById('offer-title').textContent = o.title||'';
  document.getElementById('offer-desc').textContent = o.description||'';

  // Coupon
  if(o.couponCode){
    document.getElementById('coupon-code').textContent = o.couponCode;
    show('coupon-box');
    document.getElementById('btn-copy').dataset.coupon = o.couponCode;
  }

  // Discount tag
  const disc = fmtDiscount(o);
  if(disc){
    document.getElementById('discount-tag').textContent = disc;
    show('discount-tag');
  }

  // Validity
  const validEl = document.getElementById('validity-bar');
  if(o.validUntil){
    const diff = o.validUntil - Date.now();
    const days = Math.ceil(diff/86400000);
    const str = new Date(o.validUntil).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
    if(days<=3){ validEl.textContent=`⚠️ Expira em ${days}d (${str})`; validEl.className='validity-bar expiring'; }
    else        { validEl.textContent=`✅ Válido até ${str}`;            validEl.className='validity-bar ok'; }
  } else {
    validEl.textContent='✅ Sem prazo definido'; validEl.className='validity-bar ok';
  }

  // CTA
  renderCTA(o, linkDoc);

  // Stats (public)
  const statsEl = document.getElementById('offer-stats');
  statsEl.innerHTML=`
    <div class="stat"><div class="stat-val">${o.totalClicks||0}</div><div class="stat-lbl">Visualizações</div></div>
    ${o.showCommission && o.commissionValue ? `<div class="stat"><div class="stat-val">${o.commissionType==='percent'?o.commissionValue+'%':'R$'+o.commissionValue}</div><div class="stat-lbl">Comissão por indicação</div></div>` : ''}
  `;
}

function renderCTA(o, linkDoc){
  const area = document.getElementById('cta-area');
  const wa = (o.whatsapp||'').replace(/\D/g,'');
  const msg = encodeURIComponent(o.whatsappMessage||(o.couponCode?`Cupom: ${o.couponCode}`:'Olá, vi a oferta no CIDADEONLINE!'));
  const waUrl = wa ? `https://wa.me/${wa}?text=${msg}` : '';

  let html='';

  if(waUrl){
    html+=`<a class="btn-cta-primary" href="${esc(waUrl)}" target="_blank" rel="noopener">
      💬 Falar no WhatsApp${o.couponCode?' · '+esc(o.couponCode):''}
    </a>`;
  }
  if(o.externalUrl){
    const urlLabel = (o.offerType||o.type)==='reservation'?'🏨 Fazer reserva'
                   :(o.offerType||o.type)==='external_cart'?'🛒 Ir para a loja'
                   :'🔗 Acessar';
    html+=`<a class="btn-cta-secondary" href="${esc(o.externalUrl)}" target="_blank" rel="noopener">${urlLabel}</a>`;
  }
  if(!waUrl && !o.externalUrl){
    html+=`<a class="btn-cta-secondary" href="profile.html?pid=${esc(o.businessId)}" target="_blank">👤 Ver perfil do comércio</a>`;
  }
  area.innerHTML=html;
}

// ── COPY COUPON ───────────────────────────────────────────────────────────────
window.copyCoupon = function(){
  const btn = document.getElementById('btn-copy');
  const code = document.getElementById('coupon-code')?.textContent||btn?.dataset?.coupon||'';
  navigator.clipboard.writeText(code).then(()=>{
    const orig=btn.textContent; btn.textContent='✅ Copiado!'; setTimeout(()=>btn.textContent=orig,1500);
  }).catch(()=>{ btn.textContent='Copie: '+code; });
};

// ── HELPERS ───────────────────────────────────────────────────────────────────
function fmtDiscount(o){
  if(o.discountType==='percent' && o.discountValue) return `-${o.discountValue}% de desconto`;
  if(o.discountType==='fixed' && o.discountValue)   return `-R$${o.discountValue} de desconto`;
  if(o.discountType==='frete_gratis') return '🚚 Frete grátis';
  return '';
}

init();
