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

const TYPE = {
  commercial_point:    {icon:'🏪', label:'Ponto comercial',   privacy:'public'},
  health_unit:         {icon:'🏥', label:'Saúde',             privacy:'public'},
  school:              {icon:'🏫', label:'Escola / Educação',  privacy:'public'},
  public_service:      {icon:'🏛️', label:'Serviço público',   privacy:'public'},
  church:              {icon:'⛪', label:'Igreja / Templo',    privacy:'public'},
  neighborhood_place:  {icon:'🌳', label:'Praça / Parque',    privacy:'public'},
  landmark:            {icon:'📌', label:'Ponto de referência',privacy:'public'},
  property:            {icon:'🏗️', label:'Propriedade',       privacy:'neighborhood'},
  residential_address: {icon:'🏠', label:'Endereço residencial',privacy:'neighborhood'}
};

const placeId = new URLSearchParams(location.search).get('id')||'';
let _place    = null;

// ── INIT ─────────────────────────────────────────────────────────────────────
async function init(){
  if(!placeId){ hide('loading-state'); show('not-found'); return; }
  const snap = await get(ref(db,'places/'+placeId));
  if(!snap.exists()){ hide('loading-state'); show('not-found'); return; }
  _place = snap.val();
  renderPlace(_place);
}

// ── RENDER ────────────────────────────────────────────────────────────────────
function renderPlace(p){
  hide('loading-state');
  show('place-content');

  const t = TYPE[p.type]||{icon:'📍',label:p.type,privacy:'public'};

  // Meta
  document.getElementById('pg-title').textContent   = esc(p.name)+' | CIDADEONLINE';
  document.getElementById('pg-desc').content         = esc(p.description||p.name);

  // Header
  document.getElementById('place-icon').textContent    = t.icon;
  document.getElementById('place-name').textContent    = p.name||'';
  document.getElementById('place-type-line').textContent = t.label+' · '+fmtCity(p);
  document.getElementById('place-address-line').textContent = fmtAddress(p);

  // Status badge
  const badge = document.getElementById('place-status-badge');
  const statusMap = {unclaimed:['status-unclaimed','🏷️ Não reivindicado'],pending:['status-pending','⏳ Em análise'],claimed:['status-claimed','✅ Reivindicado']};
  const [cls,lbl] = statusMap[p.status]||statusMap.unclaimed;
  badge.className='place-status-badge '+cls; badge.textContent=lbl;

  // Linked business
  if(p.linkedBusinessId){
    get(ref(db,'businessProfiles/'+p.linkedBusinessId)).then(bs=>{
      const biz=bs.val();
      if(biz){
        const bizCard=document.getElementById('linked-biz-card');
        bizCard.innerHTML=`<span style="font-size:1.3rem">🏪</span><span style="font-size:.82rem"><strong>${esc(biz.name||'')}</strong><br><span style="color:#64748b">Comércio vinculado a este lugar</span></span><a href="profile.html?pid=${esc(p.linkedBusinessId)}">Ver perfil →</a>`;
        show('linked-biz-card');
      }
    });
  }

  // Description
  if(p.description){
    document.getElementById('place-desc-text').textContent = p.description;
    show('place-description');
  }

  // Mural
  const mural = p.mural||[];
  if(mural.length){
    const list=document.getElementById('mural-list');
    list.innerHTML=mural.map(m=>`<div class="mural-item">${esc(m.text||'')}${m.link?` <a href="${esc(m.link)}" target="_blank">→ Link</a>`:''}</div>`).join('');
    show('place-mural');
  }

  // Links / contact
  const links=p.links||[];
  if(links.length||p.whatsapp||p.phone){
    const list=document.getElementById('place-links-list');
    let html='';
    if(p.whatsapp) html+=`<a class="place-link-item" href="https://wa.me/${esc(p.whatsapp.replace(/\D/g,''))}" target="_blank">💬 WhatsApp</a>`;
    if(p.phone)    html+=`<a class="place-link-item" href="tel:${esc(p.phone)}" target="_blank">📞 ${esc(p.phone)}</a>`;
    links.forEach(l=>{ html+=`<a class="place-link-item" href="${esc(l.url)}" target="_blank">🔗 ${esc(l.label||l.url)}</a>`; });
    list.innerHTML=html;
    show('place-links-section');
  }

  // Claim section
  renderClaimArea(p);
}

function fmtCity(p){ const a=p.address||{}; return [a.city,a.uf].filter(Boolean).join('/'); }

function fmtAddress(p){
  const a=p.address||{};
  const t=TYPE[p.type]||{};
  // Privacy: residential & property → only neighborhood + city
  if(t.privacy==='neighborhood'||p.privacy==='neighborhood'){
    return [a.neighborhood,a.city,a.uf].filter(Boolean).join(' · ');
  }
  const parts=[];
  if(a.street){ parts.push(a.street+(a.number?' '+a.number:'')); }
  if(a.neighborhood) parts.push(a.neighborhood);
  parts.push([a.city,a.uf].filter(Boolean).join('/'));
  return parts.join(' · ');
}

// ── CLAIM AREA ────────────────────────────────────────────────────────────────
function renderClaimArea(p){
  hide('claim-trigger'); hide('claim-form'); hide('claim-pending'); hide('claim-claimed');
  if(p.status==='claimed')        show('claim-claimed');
  else if(p.status==='pending')   show('claim-pending');
  else                            show('claim-trigger');
}

window.openClaimForm = function(){
  hide('claim-trigger'); show('claim-form');
};
window.closeClaimForm = function(){
  hide('claim-form'); if(_place?.status==='unclaimed') show('claim-trigger');
};

window.submitClaim = async function(){
  const name  = document.getElementById('cf-name')?.value.trim();
  const phone = document.getElementById('cf-phone')?.value.trim().replace(/\D/g,'');
  const role  = document.getElementById('cf-role')?.value;
  const note  = document.getElementById('cf-note')?.value.trim();
  const fb    = document.getElementById('cf-feedback');
  const btn   = document.getElementById('btn-claim-submit');

  if(!name)  { showFb(fb,'err','⚠️ Informe seu nome.'); return; }
  if(!phone) { showFb(fb,'err','⚠️ Informe seu WhatsApp.'); return; }
  if(!role)  { showFb(fb,'err','⚠️ Selecione sua relação com este lugar.'); return; }

  // Dedup: one claim per phone per place per 24h
  const dedupKey=`claim_${placeId}_${phone}`;
  const last=parseInt(localStorage.getItem(dedupKey)||'0');
  if(Date.now()-last<86400000){ showFb(fb,'ok','✅ Solicitação já enviada. Aguarde análise.'); return; }

  btn.disabled=true; btn.textContent='Enviando...';
  try{
    const now=Date.now();
    const claimRef=push(ref(db,'placeClaims'));
    const claimDoc={
      claimId:claimRef.key, placeId,
      placeName: _place.name||'',
      claimantName:name, claimantPhone:phone,
      claimantEmail:'', claimantRole:role, claimantNote:note,
      status:'pending', reviewedBy:'', reviewedAt:null, rejectionReason:'',
      linkedBusinessId:'', createdAt:now
    };
    await set(claimRef, claimDoc);
    await update(ref(db,'places/'+placeId),{status:'pending', updatedAt:now});
    _place.status='pending';
    localStorage.setItem(dedupKey,now);
    showFb(fb,'ok','✅ Solicitação enviada! A equipe CIDADEONLINE entrará em contato.');
    btn.textContent='✅ Enviado';
    hide('claim-form'); show('claim-pending');
  } catch(e){
    btn.disabled=false; btn.textContent='📨 Enviar solicitação';
    showFb(fb,'err','❌ Erro ao enviar. Tente novamente.');
  }
};

function showFb(el,type,msg){
  if(!el) return;
  el.textContent=msg; el.className='cf-feedback '+type; el.style.display='';
  if(type==='err') setTimeout(()=>el.style.display='none',4000);
}

init();
