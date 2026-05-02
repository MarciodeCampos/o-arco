import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, get, set, push } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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

signInAnonymously(auth).catch(()=>{});

// ── STATE ─────────────────────────────────────────────────────────────────────
let allBiz = [];
let categories = {};

// ── HELPERS ───────────────────────────────────────────────────────────────────
function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function slugify(s){ return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }

// ── SEED CATEGORIES ───────────────────────────────────────────────────────────
const SEED_CATEGORIES = [
  {id:'supermercado',  name:'Supermercado',    icon:'🛒', order:1},
  {id:'restaurante',   name:'Restaurante',      icon:'🍽️', order:2},
  {id:'farmacia',      name:'Farmácia',         icon:'💊', order:3},
  {id:'padaria',       name:'Padaria',          icon:'🥖', order:4},
  {id:'roupas',        name:'Loja de Roupas',   icon:'👕', order:5},
  {id:'calcados',      name:'Calçados',         icon:'👟', order:6},
  {id:'petshop',       name:'Pet Shop',         icon:'🐾', order:7},
  {id:'mecanica',      name:'Mecânica',         icon:'🔧', order:8},
  {id:'salao',         name:'Salão de Beleza',  icon:'💇', order:9},
  {id:'estetica',      name:'Estética',         icon:'✨', order:10},
  {id:'construcao',    name:'Construção/Material', icon:'🏗️', order:11},
  {id:'eletronicos',   name:'Eletrônicos',      icon:'📱', order:12},
  {id:'moveis',        name:'Móveis',           icon:'🛋️', order:13},
  {id:'contabilidade', name:'Contabilidade',    icon:'📊', order:14},
  {id:'advocacia',     name:'Advocacia',        icon:'⚖️', order:15},
  {id:'saude',         name:'Saúde/Clinica',    icon:'🏥', order:16},
  {id:'academia',      name:'Academia',         icon:'💪', order:17},
  {id:'sorveteria',    name:'Sorveteria',       icon:'🍦', order:18},
  {id:'lanchonete',    name:'Lanchonete',       icon:'🍔', order:19},
  {id:'servicos',      name:'Serviços Gerais',  icon:'⚙️', order:20},
];

const SEED_BUSINESSES = [
  {
    businessId:'business_mercado_sao_joao',
    profileId:'business_mercado_sao_joao',
    name:'Mercado São João',
    category:'Supermercado', categorySlug:'supermercado',
    city:'Francisco Beltrão', citySlug:'francisco-beltrao', uf:'PR', stateName:'Paraná',
    whatsapp:'5546999990001', description:'Mercado com as melhores ofertas semanais da região.',
    claimed:false, active:true, priority:100, photoURL:'', createdAt:Date.now()
  },
  {
    businessId:'business_padaria_central',
    profileId:'business_padaria_central',
    name:'Padaria Central',
    category:'Padaria', categorySlug:'padaria',
    city:'Francisco Beltrão', citySlug:'francisco-beltrao', uf:'PR', stateName:'Paraná',
    whatsapp:'5546999990002', description:'Pão quentinho e salgados todos os dias.',
    claimed:false, active:true, priority:90, photoURL:'', createdAt:Date.now()
  },
  {
    businessId:'business_farmacia_popular',
    profileId:'business_farmacia_popular',
    name:'Farmácia Popular',
    category:'Farmácia', categorySlug:'farmacia',
    city:'Francisco Beltrão', citySlug:'francisco-beltrao', uf:'PR', stateName:'Paraná',
    whatsapp:'5546999990003', description:'Medicamentos, dermocosméticos e atendimento rápido.',
    claimed:false, active:true, priority:85, photoURL:'', createdAt:Date.now()
  },
  {
    businessId:'business_petshop_amigo',
    profileId:'business_petshop_amigo',
    name:'Pet Shop Amigo Fiel',
    category:'Pet Shop', categorySlug:'petshop',
    city:'Pato Branco', citySlug:'pato-branco', uf:'PR', stateName:'Paraná',
    whatsapp:'5546999990004', description:'Tosa, banho, veterinário e produtos para pets.',
    claimed:false, active:true, priority:80, photoURL:'', createdAt:Date.now()
  },
  {
    businessId:'business_restaurante_sabor',
    profileId:'business_restaurante_sabor',
    name:'Restaurante Sabor Caseiro',
    category:'Restaurante', categorySlug:'restaurante',
    city:'Francisco Beltrão', citySlug:'francisco-beltrao', uf:'PR', stateName:'Paraná',
    whatsapp:'5546999990005', description:'Almoço executivo e à la carte. Segunda a sábado.',
    claimed:false, active:true, priority:88, photoURL:'', createdAt:Date.now()
  },
  {
    businessId:'business_salao_beleza',
    profileId:'business_salao_beleza',
    name:'Salão Beleza & Arte',
    category:'Salão de Beleza', categorySlug:'salao',
    city:'Dois Vizinhos', citySlug:'dois-vizinhos', uf:'PR', stateName:'Paraná',
    whatsapp:'5546999990006', description:'Corte, coloração, escova e tratamentos capilares.',
    claimed:false, active:true, priority:78, photoURL:'', createdAt:Date.now()
  },
  {
    businessId:'business_mecanica_silva',
    profileId:'business_mecanica_silva',
    name:'Mecânica Silva',
    category:'Mecânica', categorySlug:'mecanica',
    city:'Cascavel', citySlug:'cascavel', uf:'PR', stateName:'Paraná',
    whatsapp:'5545999990007', description:'Revisão, funilaria e serviços em geral.',
    claimed:false, active:true, priority:75, photoURL:'', createdAt:Date.now()
  },
  {
    businessId:'business_loja_surf',
    profileId:'business_loja_surf',
    name:'Surf & Style',
    category:'Loja de Roupas', categorySlug:'roupas',
    city:'Balneário Camboriú', citySlug:'balneario-camboriu', uf:'SC', stateName:'Santa Catarina',
    whatsapp:'5547999990008', description:'Moda praia, surf e lifestyle em Balneário Camboriú.',
    claimed:false, active:true, priority:95, photoURL:'', createdAt:Date.now()
  },
];

// ── INIT ──────────────────────────────────────────────────────────────────────
async function init(){
  await runSeedIfNeeded();
  await loadCategories();
  loadStatesFilter();
  listenBusinesses();
  setupFilters();

  onAuthStateChanged(auth, user => {
    if(user){
      const pid = localStorage.getItem('spes_pid');
      const link = document.getElementById('header-profile-link');
      if(link && pid){ link.href = 'profile.html?pid='+pid; link.style.display=''; }
    }
  });
}

// ── SEED ──────────────────────────────────────────────────────────────────────
async function runSeedIfNeeded(){
  const snap = await get(ref(db,'businessCategories/supermercado'));
  if(snap.exists()) return; // já seedado
  for(const cat of SEED_CATEGORIES){
    await set(ref(db,'businessCategories/'+cat.id),{name:cat.name,icon:cat.icon,order:cat.order,slug:cat.id,active:true});
  }
  for(const biz of SEED_BUSINESSES){
    await set(ref(db,'businessProfiles/'+biz.businessId), biz);
    // Garante que profiles/ existe também
    const pSnap = await get(ref(db,'profiles/'+biz.profileId));
    if(!pSnap.exists()){
      await set(ref(db,'profiles/'+biz.profileId),{
        profileId:biz.profileId, type:'business', name:biz.name,
        slug:slugify(biz.name), photoURL:'', coverURL:'', bio:biz.description,
        city:biz.city, citySlug:biz.citySlug, uf:biz.uf, stateName:biz.stateName,
        category:biz.category, categorySlug:biz.categorySlug,
        verified:false, ownerUid:'', whatsapp:biz.whatsapp,
        instagram:'', youtube:'', tiktok:'', facebook:'', website:'',
        currentRadioId:'', currentRadioName:'',
        status:'online', createdAt:Date.now(), updatedAt:Date.now()
      });
    }
  }
  console.log('SEED BUSINESS OK');
}

// ── CATEGORIES ────────────────────────────────────────────────────────────────
async function loadCategories(){
  const snap = await get(ref(db,'businessCategories'));
  const data = snap.val()||{};
  categories = data;
  const sel = document.getElementById('filter-category');
  const sorted = Object.values(data).filter(c=>c.active).sort((a,b)=>(a.order||99)-(b.order||99));
  sel.innerHTML = '<option value="">Todas as categorias</option>'
    + sorted.map(c=>`<option value="${esc(c.slug||c.name)}">${esc(c.icon||'')} ${esc(c.name)}</option>`).join('');
}

// ── GEO FILTERS ───────────────────────────────────────────────────────────────
const BR_STATES=[{uf:'AC',name:'Acre'},{uf:'AL',name:'Alagoas'},{uf:'AP',name:'Amapá'},{uf:'AM',name:'Amazonas'},{uf:'BA',name:'Bahia'},{uf:'CE',name:'Ceará'},{uf:'DF',name:'Distrito Federal'},{uf:'ES',name:'Espírito Santo'},{uf:'GO',name:'Goiás'},{uf:'MA',name:'Maranhão'},{uf:'MT',name:'Mato Grosso'},{uf:'MS',name:'Mato Grosso do Sul'},{uf:'MG',name:'Minas Gerais'},{uf:'PA',name:'Pará'},{uf:'PB',name:'Paraíba'},{uf:'PR',name:'Paraná'},{uf:'PE',name:'Pernambuco'},{uf:'PI',name:'Piauí'},{uf:'RJ',name:'Rio de Janeiro'},{uf:'RN',name:'Rio Grande do Norte'},{uf:'RS',name:'Rio Grande do Sul'},{uf:'RO',name:'Rondônia'},{uf:'RR',name:'Roraima'},{uf:'SC',name:'Santa Catarina'},{uf:'SP',name:'São Paulo'},{uf:'SE',name:'Sergipe'},{uf:'TO',name:'Tocantins'}];

function loadStatesFilter(){
  const sel = document.getElementById('filter-uf');
  sel.innerHTML = '<option value="">Todos os estados</option>'
    + BR_STATES.map(s=>`<option value="${s.uf}">${s.name} (${s.uf})</option>`).join('');
  sel.onchange = async ()=>{
    const uf = sel.value;
    const city = document.getElementById('filter-city');
    city.innerHTML='<option value="">Todas as cidades</option>';
    city.disabled = !uf;
    if(!uf){ applyFilters(); return; }
    const snap = await get(ref(db,'geoCities/'+uf));
    const data = snap.val()||{};
    const sorted = Object.values(data).sort((a,b)=>(a.city||'').localeCompare(b.city||''));
    city.innerHTML = '<option value="">Todas as cidades</option>'
      + sorted.map(c=>`<option value="${esc(c.citySlug)}">${esc(c.city)}</option>`).join('');
    city.disabled = false;
    applyFilters();
  };
}

// ── LISTEN BUSINESSES ─────────────────────────────────────────────────────────
function listenBusinesses(){
  onValue(ref(db,'businessProfiles'), snap=>{
    const data = snap.val()||{};
    allBiz = Object.values(data).filter(b=>b.active!==false);
    applyFilters();
  });
}

// ── FILTERS ───────────────────────────────────────────────────────────────────
function setupFilters(){
  ['filter-city','filter-category','filter-whatsapp','filter-claimed'].forEach(id=>{
    document.getElementById(id)?.addEventListener('change', applyFilters);
  });
  let debounce;
  document.getElementById('filter-name')?.addEventListener('input', ()=>{
    clearTimeout(debounce);
    debounce = setTimeout(applyFilters, 250);
  });
}

function applyFilters(){
  const uf      = document.getElementById('filter-uf')?.value||'';
  const city    = document.getElementById('filter-city')?.value||'';
  const cat     = document.getElementById('filter-category')?.value||'';
  const name    = (document.getElementById('filter-name')?.value||'').toLowerCase();
  const hasWa   = document.getElementById('filter-whatsapp')?.checked;
  const claimed = document.getElementById('filter-claimed')?.checked;

  let filtered = allBiz.filter(b=>{
    if(uf     && b.uf !== uf) return false;
    if(city   && b.citySlug !== city) return false;
    if(cat    && (b.categorySlug||slugify(b.category||'')) !== cat) return false;
    if(name   && !(b.name||'').toLowerCase().includes(name)) return false;
    if(hasWa  && !b.whatsapp) return false;
    if(claimed && !b.claimed) return false;
    return true;
  }).sort((a,b)=>{
    // featured ativos primeiro, depois por planScore, depois por priority
    const now = Date.now();
    const aFeat = a.featured && (!a.featuredUntil || a.featuredUntil > now) ? 1 : 0;
    const bFeat = b.featured && (!b.featuredUntil || b.featuredUntil > now) ? 1 : 0;
    if(bFeat !== aFeat) return bFeat - aFeat;
    const planScore = {partner:4,premium:3,featured:2,claimed:1,free:0};
    const aScore = planScore[a.plan||'free']||0;
    const bScore = planScore[b.plan||'free']||0;
    if(bScore !== aScore) return bScore - aScore;
    return (b.priority||0)-(a.priority||0);
  });

  renderGrid(filtered);
}

function planBadge(b){
  const now = Date.now();
  const isActiveFeatured = b.featured && (!b.featuredUntil || b.featuredUntil > now);
  if(isActiveFeatured) return `<span class="badge badge-featured">⭐ Destaque</span>`;
  if(b.plan==='partner')  return `<span class="badge badge-partner">🤝 Parceiro</span>`;
  if(b.plan==='premium')  return `<span class="badge badge-premium">💎 Premium</span>`;
  return '';
}

function renderGrid(list){
  const grid = document.getElementById('biz-grid');
  const meta = document.getElementById('results-meta');
  if(!list.length){
    grid.innerHTML = '<div class="empty-state"><span>🏪</span>Nenhum comércio encontrado com esses filtros.</div>';
    meta.textContent = '0 comércios encontrados';
    return;
  }
  meta.textContent = list.length + ' comércio' + (list.length>1?'s':'') + ' encontrado' + (list.length>1?'s':'');
  const now = Date.now();
  grid.innerHTML = list.map(b=>{
    const cat = Object.values(categories).find(c=>c.slug===(b.categorySlug||slugify(b.category||'')));
    const icon = cat?.icon || '🏪';
    const av = b.photoURL
      ? `<img src="${esc(b.photoURL)}" alt="${esc(b.name)}"> `
      : icon;
    const claimedBadge = b.claimed
      ? `<span class="badge badge-claimed">✓ Verificado</span>`
      : `<span class="badge badge-unclaimed">Não reivindicado</span>`;
    const waBadge = b.whatsapp ? `<span class="badge badge-whatsapp">WhatsApp</span>` : '';
    const planBdg = planBadge(b);
    const isFeat  = b.featured && (!b.featuredUntil || b.featuredUntil > now);
    const profileUrl = `profile.html?pid=${esc(b.profileId||b.businessId)}`;
    const waUrl = b.whatsapp ? `https://wa.me/${b.whatsapp.replace(/\D/g,'')}` : '';
    return `<div class="biz-card${isFeat?' biz-card-featured':''}">
      ${isFeat?'<div class="featured-glow"></div>':''}
      <div class="biz-card-top">
        <div class="biz-avatar">${av}</div>
        <div class="biz-info">
          <div class="biz-name">${esc(b.name)}</div>
          <div class="biz-category">${icon} ${esc(b.category||'')}</div>
          <div class="biz-location">📍 ${esc(b.city||'')}${b.uf?'/'+b.uf:''}</div>
        </div>
      </div>
      <div class="biz-badges">${planBdg}${claimedBadge}${waBadge}</div>
      ${b.description?`<div class="biz-description">${esc(b.description)}</div>`:''}
      <div class="biz-actions">
        <a class="btn-profile" href="${profileUrl}">👤 Ver perfil</a>
        ${waUrl?`<a class="btn-whatsapp" href="${esc(waUrl)}" target="_blank" rel="noopener">💬 WhatsApp</a>`:''}
      </div>
    </div>`;
  }).join('');
}


init();
