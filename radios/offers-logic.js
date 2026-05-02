import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, get, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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
function slugify(s){ return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }

const TYPE_LABEL = {
  coupon:'🏷️ Cupom', lead:'📋 Agendamento',
  external_cart:'🛒 Compra online', reservation:'🏨 Reserva', custom:'⭐ Especial'
};

// ── SEED ──────────────────────────────────────────────────────────────────────
const SEED_OFFERS = [
  {
    offerId: 'offer_fbeltrao_pizza_001',
    businessId: 'biz_fbeltrao_pizzaria',
    profileId: 'biz_fbeltrao_pizzaria',
    title: '10% OFF na pizza grande',
    description: 'Válido de segunda a quinta. Peça pelo WhatsApp informando o cupom e ganhe 10% de desconto em qualquer pizza grande.',
    type: 'coupon', offerType: 'coupon',
    couponCode: 'CIDADE10',
    discountType: 'percent', discountValue: 10,
    externalUrl: '',
    whatsappMessage: 'Olá! Vi a oferta no CIDADEONLINE. Cupom: CIDADE10 — 10% OFF na pizza grande!',
    whatsapp: '5546991110005',
    commissionType: 'none', commissionValue: 0,
    showCommission: false,
    city: 'Francisco Beltrão', citySlug: 'francisco-beltrao', uf: 'PR', stateName: 'Paraná',
    category: 'Restaurante',
    active: true, featured: true,
    validFrom: null, validUntil: 1780000000000,
    maxLeads: 500, totalLeads: 0, totalClicks: 0,
    createdAt: Date.now(), updatedAt: Date.now()
  },
  {
    offerId: 'offer_fbeltrao_pousada_001',
    businessId: 'biz_fbeltrao_pousada',
    profileId: 'biz_fbeltrao_pousada',
    title: 'Hospedagem com café da manhã grátis',
    description: 'Reserve pelo CIDADEONLINE e ganhe café da manhã incluso para dois. Disponibilidade sujeita a confirmação.',
    type: 'reservation', offerType: 'reservation',
    couponCode: 'CAFECIDADE',
    discountType: 'custom', discountValue: 0,
    externalUrl: '',
    whatsappMessage: 'Olá! Vi a oferta de hospedagem com café da manhã no CIDADEONLINE. Código: CAFECIDADE. Gostaria de verificar disponibilidade.',
    whatsapp: '5546991110016',
    commissionType: 'percent', commissionValue: 5,
    showCommission: true,
    city: 'Francisco Beltrão', citySlug: 'francisco-beltrao', uf: 'PR', stateName: 'Paraná',
    category: 'Pousada/Hotel',
    active: true, featured: false,
    validFrom: null, validUntil: 1780000000000,
    maxLeads: 100, totalLeads: 0, totalClicks: 0,
    createdAt: Date.now(), updatedAt: Date.now()
  },
  {
    offerId: 'offer_fbeltrao_solar_001',
    businessId: 'biz_fbeltrao_solar',
    profileId: 'biz_fbeltrao_solar',
    title: 'Consultoria gratuita de energia solar',
    description: 'Solicite uma visita técnica gratuita sem compromisso. Economia de até 95% na conta de luz. Financiamento disponível.',
    type: 'lead', offerType: 'lead',
    couponCode: '',
    discountType: 'none', discountValue: 0,
    externalUrl: '',
    whatsappMessage: 'Olá! Vi a oferta de consultoria gratuita de energia solar no CIDADEONLINE. Gostaria de agendar uma visita técnica.',
    whatsapp: '5546991110017',
    commissionType: 'fixed', commissionValue: 80,
    showCommission: true,
    city: 'Francisco Beltrão', citySlug: 'francisco-beltrao', uf: 'PR', stateName: 'Paraná',
    category: 'Energia Solar',
    active: true, featured: false,
    validFrom: null, validUntil: null,
    maxLeads: 50, totalLeads: 0, totalClicks: 0,
    createdAt: Date.now(), updatedAt: Date.now()
  }
];

// ── STATES ────────────────────────────────────────────────────────────────────
const BR_STATES=[{uf:'PR',name:'Paraná'},{uf:'SC',name:'Santa Catarina'},{uf:'SP',name:'São Paulo'},{uf:'RS',name:'Rio Grande do Sul'},{uf:'MG',name:'Minas Gerais'},{uf:'RJ',name:'Rio de Janeiro'}];
let allOffers = [];

// ── BOOT ──────────────────────────────────────────────────────────────────────
async function init(){
  await seedIfNeeded();
  loadStateFilter();
  setupFilters();
  listenOffers();
}

async function seedIfNeeded(){
  const snap = await get(ref(db,'affiliateOffers/offer_fbeltrao_pizza_001'));
  if(snap.exists()) return;
  for(const o of SEED_OFFERS){
    await set(ref(db,'affiliateOffers/'+o.offerId), o);
    // businessOffers index
    await set(ref(db,'businessOffers/'+o.businessId+'/'+o.offerId),{
      offerId:o.offerId, title:o.title, active:o.active, createdAt:o.createdAt
    });
  }
}

// ── GEO ───────────────────────────────────────────────────────────────────────
function loadStateFilter(){
  const sel = document.getElementById('f-uf');
  sel.innerHTML='<option value="">Todos os estados</option>'
    +BR_STATES.map(s=>`<option value="${s.uf}">${s.name} (${s.uf})</option>`).join('');
  sel.onchange = async ()=>{
    const uf = sel.value;
    const cs = document.getElementById('f-city');
    cs.innerHTML='<option value="">Todas as cidades</option>';
    cs.disabled=!uf;
    if(!uf){ applyFilters(); return; }
    const snap = await get(ref(db,'geoCities/'+uf));
    const data = snap.val()||{};
    const sorted = Object.values(data).sort((a,b)=>(a.city||'').localeCompare(b.city||''));
    cs.innerHTML='<option value="">Todas as cidades</option>'
      +sorted.map(c=>`<option value="${esc(c.citySlug)}">${esc(c.city)}</option>`).join('');
    cs.disabled=false;
    applyFilters();
  };
}

function setupFilters(){
  ['f-city','f-type'].forEach(id=>document.getElementById(id)?.addEventListener('change',applyFilters));
  let d; document.getElementById('f-text')?.addEventListener('input',()=>{clearTimeout(d);d=setTimeout(applyFilters,200);});
}

// ── LISTEN ────────────────────────────────────────────────────────────────────
function listenOffers(){
  onValue(ref(db,'affiliateOffers'), snap=>{
    const data = snap.val()||{};
    const now  = Date.now();
    allOffers  = Object.values(data)
      .filter(o=>o.active && (!o.validUntil || o.validUntil>now))
      .sort((a,b)=>(b.featured?1:0)-(a.featured?1:0)||(b.createdAt||0)-(a.createdAt||0));
    applyFilters();
  });
}

function applyFilters(){
  const text = (document.getElementById('f-text')?.value||'').toLowerCase();
  const uf   = document.getElementById('f-uf')?.value||'';
  const city = document.getElementById('f-city')?.value||'';
  const type = document.getElementById('f-type')?.value||'';
  const filtered = allOffers.filter(o=>{
    if(uf   && o.uf!==uf) return false;
    if(city && o.citySlug!==city) return false;
    if(type && (o.type||o.offerType)!==type) return false;
    if(text && !(o.title||'').toLowerCase().includes(text) && !(o.description||'').toLowerCase().includes(text)) return false;
    return true;
  });
  renderOffers(filtered);
}

// ── RENDER ────────────────────────────────────────────────────────────────────
function fmtDiscount(o){
  if(o.discountType==='percent' && o.discountValue) return `-${o.discountValue}%`;
  if(o.discountType==='fixed' && o.discountValue)   return `-R$${o.discountValue}`;
  if(o.discountType==='frete_gratis') return 'Frete grátis';
  return '';
}
function fmtValidity(o){
  if(!o.validUntil) return '';
  const d = new Date(o.validUntil);
  const diff = o.validUntil - Date.now();
  const days = Math.ceil(diff/(86400000));
  const str = d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
  if(days<=3) return `⚠️ Expira em ${days}d (${str})`;
  return `✅ Válido até ${str}`;
}

function renderOffers(list){
  const grid = document.getElementById('offers-grid');
  document.getElementById('results-meta').textContent = list.length+' oferta'+(list.length!==1?'s':'')+' encontrada'+(list.length!==1?'s':'');
  if(!list.length){
    grid.innerHTML='<div class="empty-state"><span>🏷️</span>Nenhuma oferta encontrada.</div>'; return;
  }
  const offerType = o => o.type||o.offerType||'custom';
  grid.innerHTML = list.map(o=>{
    const disc   = fmtDiscount(o);
    const valid  = fmtValidity(o);
    const typeK  = offerType(o);
    return `<div class="offer-card-item${o.featured?' featured':''}">
      ${o.featured?'<div class="offer-featured-glow"></div>':''}
      <div class="offer-card-badges">
        <span class="badge badge-${typeK}">${TYPE_LABEL[typeK]||typeK}</span>
        ${o.featured?'<span class="badge badge-featured">⭐ Destaque</span>':''}
      </div>
      <div class="offer-title-card">${esc(o.title)}</div>
      <div class="offer-biz-line">🏪 ${esc(o.city||'')}/${esc(o.uf||'')} · ${esc(o.category||'')}</div>
      ${disc?`<div class="offer-discount">${disc}</div>`:''}
      ${o.couponCode?`<div class="offer-coupon-preview">🏷️ ${esc(o.couponCode)}</div>`:''}
      ${valid?`<div class="offer-validity">${valid}</div>`:''}
      <a class="btn-offer" href="offer.html?id=${esc(o.offerId)}">Ver oferta →</a>
    </div>`;
  }).join('');
}

init();
