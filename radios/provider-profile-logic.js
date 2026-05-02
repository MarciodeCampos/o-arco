import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get, push, set, update, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const FB={apiKey:"AIzaSyDa0XWSvNISi47olox7U2HHawf3pf1rOjI",authDomain:"triadic-radios.firebaseapp.com",databaseURL:"https://triadic-radios-default-rtdb.firebaseio.com",projectId:"triadic-radios",storageBucket:"triadic-radios.firebasestorage.app",messagingSenderId:"574115949337",appId:"1:574115949337:web:527670aa35d9bb939f3388"};
const app=initializeApp(FB); const db=getDatabase(app);
const params=new URLSearchParams(location.search);
const pid=params.get('id')||'';
const preRef=params.get('ref')||'';
const preCat=params.get('cat')||'';

let currentProvider=null;
let currentRefCode=preRef;
let currentReferralId='';

function fmt(ts){ return ts?new Date(ts).toLocaleDateString('pt-BR'):'—'; }
function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function stars(n){ const s=Math.round(n||0); return '★'.repeat(s)+'☆'.repeat(5-s); }
function showFb(type,msg){ const el=document.getElementById('ref-fb'); el.className='form-feedback '+type; el.textContent=msg; el.style.display=''; if(type==='err')setTimeout(()=>el.style.display='none',4000); }

// ── MAIN LOAD ─────────────────────────────────────────────────
async function init(){
  if(!pid){ showNotFound(); return; }
  const snap=await get(ref(db,'serviceProviders/'+pid));
  currentProvider=snap.val();
  if(!currentProvider){ showNotFound(); return; }

  document.getElementById('pp-loading').style.display='none';
  document.getElementById('pp-main').style.display='';
  document.title=(currentProvider.name||'Prestador')+' | CIDADEONLINE';
  document.getElementById('page-title').textContent=(currentProvider.name||'Prestador')+' | CIDADEONLINE';

  const p=currentProvider;
  // Avatar
  document.getElementById('pp-avatar').textContent=(p.name||'?')[0].toUpperCase();
  // Name / cats / location
  document.getElementById('pp-name').textContent=p.name||'—';
  document.getElementById('pp-cats').innerHTML=(p.categories||[]).map(c=>`<span class="pp-cat-tag">${esc(c.replace('_',' '))}</span>`).join('');
  document.getElementById('pp-cats-detail').textContent=(p.categories||[]).join(', ')||'—';
  const loc=[p.city,p.uf].filter(Boolean).join(' / ');
  document.getElementById('pp-location').textContent=loc?'📍 '+loc:'';
  document.getElementById('pp-area').textContent=[p.city,p.uf,p.area].filter(Boolean).join(' — ')||'—';
  // Availability
  const isAvail=p.available!==false;
  const avEl=document.getElementById('pp-avail');
  avEl.textContent=isAvail?'🟢 Disponível':'🔴 Indisponível'; avEl.className='pp-avail '+(isAvail?'yes':'no');
  // Rating
  const rEl=document.getElementById('pp-rating-row');
  if(p.ratingCount) rEl.textContent=stars(p.rating)+' — '+p.ratingCount+' avaliação'+(p.ratingCount!==1?'ões':'');
  document.getElementById('pp-rating-detail').textContent=p.ratingCount?stars(p.rating)+' ('+p.ratingCount+')':'Sem avaliações ainda';
  // Bio
  if(p.bio){ document.getElementById('pp-bio').textContent=p.bio; document.getElementById('pp-bio-card').style.display=''; }
  // Since
  document.getElementById('pp-since').textContent=fmt(p.createdAt);
  // WhatsApp (only if public)
  if(p.whatsappPublic&&p.phone){
    const wa=document.getElementById('btn-whatsapp');
    if(wa){ wa.href='https://wa.me/55'+p.phone+'?text='+encodeURIComponent('Olá '+p.name+'. Vi seu perfil no CIDADEONLINE e gostaria de um orçamento.'); wa.style.display=''; }
  }
  // Request links (carry ref if present)
  const catParam=preCat||(p.categories||[])[0]||'';
  const refParam=currentRefCode?'&ref='+currentRefCode:'';
  const ridParam=currentReferralId?'&rid='+currentReferralId:'';
  ['btn-request','btn-request2'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.href=`service-request.html?cat=${catParam}&pid=${pid}${refParam}${ridParam}`;
  });
  // Load reputation data
  await Promise.all([loadPortfolio(), loadReviews()]);
  // Handle referral click tracking
  if(preRef) await trackReferralClick(preRef);
}

// ── PORTFOLIO ─────────────────────────────────────────────────
async function loadPortfolio(){
  const snap=await get(ref(db,'servicePortfolios'));
  const all=Object.values(snap.val()||{}).filter(p=>p.providerId===pid&&p.verified);
  const sec=document.getElementById('portfolio-section');
  if(!all.length){ if(sec)sec.style.display='none'; return; }
  if(sec)sec.style.display='';
  document.getElementById('portfolio-list').innerHTML=all.map(item=>`
    <div class="portfolio-card">
      ${item.imageUrl?`<img src="${esc(item.imageUrl)}" class="portfolio-img" alt="${esc(item.title)}" loading="lazy">`:`<div class="portfolio-img-placeholder">🔨</div>`}
      <div class="portfolio-body">
        <div class="portfolio-title">${esc(item.title)}</div>
        <div class="portfolio-desc">${esc(item.description||'')}</div>
        <div class="portfolio-client">👤 ${esc(item.clientName||'Cliente verificado')}</div>
      </div>
    </div>`).join('');
}

// ── REVIEWS ───────────────────────────────────────────────────
async function loadReviews(){
  const snap=await get(ref(db,'serviceReviews'));
  const all=Object.values(snap.val()||{}).filter(r=>r.providerId===pid&&r.verified).sort((a,b)=>b.createdAt-a.createdAt);
  const sec=document.getElementById('reviews-section');
  if(!all.length){ if(sec)sec.style.display='none'; return; }
  if(sec)sec.style.display='';
  document.getElementById('reviews-list').innerHTML=all.map(r=>`
    <div class="review-card">
      <div class="review-top">
        <span class="review-stars">${stars(r.rating)}</span>
        <span class="review-client">${esc(r.clientName||'Anônimo')}</span>
        <span class="review-verified">✓ Verificado</span>
        <span class="review-date">${fmt(r.createdAt)}</span>
      </div>
      <div class="review-comment">${esc(r.comment||'')}</div>
    </div>`).join('');
}

// ── REFERRAL CLICK TRACKING ───────────────────────────────────
async function trackReferralClick(refCode){
  const dedupKey='ref_click_'+pid+'_'+refCode;
  const last=parseInt(localStorage.getItem(dedupKey)||'0');
  if(Date.now()-last < 3600000) return; // 1h dedup
  // Find referral by refCode
  const snap=await get(ref(db,'serviceReferrals'));
  const all=Object.values(snap.val()||{});
  const referral=all.find(r=>r.refCode===refCode&&r.providerId===pid);
  if(referral){
    await update(ref(db,'serviceReferrals/'+referral.referralId),{clicks:increment(1),updatedAt:Date.now()});
    currentReferralId=referral.referralId;
    localStorage.setItem(dedupKey,String(Date.now()));
    // Update request links with rid
    const refParam='&ref='+refCode+'&rid='+referral.referralId;
    const catParam=preCat||((currentProvider?.categories||[])[0]||'');
    ['btn-request','btn-request2'].forEach(id=>{
      const el=document.getElementById(id);
      if(el) el.href=`service-request.html?cat=${catParam}&pid=${pid}${refParam}`;
    });
  }
}

// ── REFERRAL GENERATION ───────────────────────────────────────
window.openReferralModal=function(){ document.getElementById('referral-modal').style.display='flex'; };
window.closeReferralModal=function(e){ if(!e||e.target.id==='referral-modal') document.getElementById('referral-modal').style.display='none'; };

window.generateReferral=async function(){
  if(!pid){ showFb('err','Perfil não encontrado.'); return; }
  const name=(document.getElementById('ref-name')?.value||'').trim()||'Anônimo';
  const btn=document.getElementById('btn-gen-ref');
  btn.disabled=true; btn.textContent='Gerando...';
  try{
    const r=push(ref(db,'serviceReferrals'));
    const refCode=r.key;
    await set(r,{
      referralId:r.key, refCode,
      referrerUid:'', referrerName:name,
      providerId:pid, providerName:currentProvider?.name||'',
      clicks:0, leads:0, conversions:0, commission:0,
      status:'active', createdAt:Date.now(), updatedAt:Date.now()
    });
    currentRefCode=refCode; currentReferralId=r.key;
    const link=`${location.origin}${location.pathname}?id=${pid}&ref=${refCode}`;
    const el=document.getElementById('ref-link-val'); if(el) el.textContent=link;
    document.getElementById('ref-link-box').style.display='';
    document.getElementById('ref-stats').textContent='Cliques: 0 · Leads: 0 · Conversões: 0';
    // WhatsApp share
    const wa=document.getElementById('btn-wa-share');
    if(wa) wa.onclick=()=>window.open('https://wa.me/?text='+encodeURIComponent('Oi! Conheci esse profissional no CIDADEONLINE: '+currentProvider?.name+'. Confira o perfil e chame para um orçamento! 👉 '+link));
    btn.textContent='✅ Gerado!';
    document.getElementById('btn-gen-ref').style.display='none';
  }catch(err){ showFb('err','❌ Erro: '+err.message); btn.disabled=false; btn.textContent='🔗 Gerar meu link'; }
};

window.copyRefLink=function(){
  const val=document.getElementById('ref-link-val')?.textContent||'';
  navigator.clipboard?.writeText(val).then(()=>{
    const btn=document.querySelector('.btn-copy'); if(btn){ btn.textContent='✅ Copiado!'; setTimeout(()=>btn.textContent='📋 Copiar link',2000); }
  });
};

function showNotFound(){ document.getElementById('pp-loading').style.display='none'; document.getElementById('pp-not-found').style.display=''; }
init();
