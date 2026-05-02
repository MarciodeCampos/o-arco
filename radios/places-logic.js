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

// ── TYPE MAP ─────────────────────────────────────────────────────────────────
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

const STATUS_BADGE = {
  unclaimed: ['badge-unclaimed','Não reivindicado'],
  pending:   ['badge-pending','Em análise'],
  claimed:   ['badge-claimed','Reivindicado']
};

// ── STATE ─────────────────────────────────────────────────────────────────────
let allPlaces = [];

// ── SEED ─────────────────────────────────────────────────────────────────────
const SEED = [
  {placeId:'place_fbeltrao_postoalvorada_001',name:'Posto de Saúde do Alvorada',type:'health_unit',status:'unclaimed',description:'Unidade Básica de Saúde do Bairro Alvorada.',address:{street:'Rua das Flores',number:'120',neighborhood:'Alvorada',city:'Francisco Beltrão',citySlug:'francisco-beltrao',uf:'PR'}},
  {placeId:'place_fbeltrao_pracacentral_001',name:'Praça Central',type:'neighborhood_place',status:'unclaimed',description:'Principal praça de lazer do centro de Francisco Beltrão.',address:{street:'',number:'',neighborhood:'Centro',city:'Francisco Beltrão',citySlug:'francisco-beltrao',uf:'PR'}},
  {placeId:'place_fbeltrao_prefeitura_001',name:'Prefeitura Municipal de Francisco Beltrão',type:'public_service',status:'unclaimed',description:'Sede administrativa do município de Francisco Beltrão.',address:{street:'Rua Otávio Rocha',number:'600',neighborhood:'Centro',city:'Francisco Beltrão',citySlug:'francisco-beltrao',uf:'PR'}},
  {placeId:'place_fbeltrao_igrejamatriz_001',name:'Igreja Matriz São Francisco',type:'church',status:'unclaimed',description:'Igreja matriz principal de Francisco Beltrão.',address:{street:'',number:'',neighborhood:'Centro',city:'Francisco Beltrão',citySlug:'francisco-beltrao',uf:'PR'}},
  {placeId:'place_fbeltrao_ponto_comercial_001',name:'Ponto Comercial — Galeria Centro',type:'commercial_point',status:'unclaimed',description:'Ponto comercial disponível no coração do centro.',address:{street:'Rua Marrecas',number:'',neighborhood:'Centro',city:'Francisco Beltrão',citySlug:'francisco-beltrao',uf:'PR'}},
  {placeId:'place_fbeltrao_escola_julia_001',name:'Colégio Estadual Júlia Wanderley',type:'school',status:'unclaimed',description:'Tradicional colégio estadual do centro de Francisco Beltrão.',address:{street:'',number:'',neighborhood:'Centro',city:'Francisco Beltrão',citySlug:'francisco-beltrao',uf:'PR'}},
  {placeId:'place_fbeltrao_terreno_norte_001',name:'Terreno — Bairro Industrial Norte',type:'property',status:'unclaimed',description:'Terreno disponível para projetos industriais ou comerciais.',address:{street:'',number:'',neighborhood:'Industrial Norte',city:'Francisco Beltrão',citySlug:'francisco-beltrao',uf:'PR'}},
  {placeId:'place_fbeltrao_residencial_alvorada_001',name:'Endereço Residencial — Alvorada',type:'residential_address',status:'unclaimed',description:'',address:{street:'Rua Belo Horizonte',number:'45',neighborhood:'Alvorada',city:'Francisco Beltrão',citySlug:'francisco-beltrao',uf:'PR'}},
  {placeId:'place_fbeltrao_marco_esquina_001',name:'Esquina da Rádio — Ponto de Referência',type:'landmark',status:'unclaimed',description:'Histórico ponto de referência no centro da cidade.',address:{street:'Rua Marrecas',number:'',neighborhood:'Centro',city:'Francisco Beltrão',citySlug:'francisco-beltrao',uf:'PR'}}
];

async function seedIfEmpty(){
  const snap = await get(ref(db,'places'));
  if(snap.exists()) return;
  const now = Date.now();
  for(const p of SEED){
    const d = {...p, active:true, featured:false, priority:0,
      claimedBy:'', claimedAt:null, claimId:'', linkedBusinessId:'',
      links:[], whatsapp:'', phone:'', mural:[], publicNote:'',
      createdAt:now, updatedAt:now, createdBy:'seed'};
    await set(ref(db,'places/'+p.placeId), d);
  }
}

// ── BOOT ─────────────────────────────────────────────────────────────────────
async function init(){
  await seedIfEmpty();
  // Build UF selector from data
  onValue(ref(db,'places'), snap=>{
    const data = snap.val()||{};
    allPlaces = Object.values(data).filter(p=>p.active!==false);
    buildSelectors();
    applyFilters();
  });
  // Event listeners
  ['f-text','f-type','f-status','f-uf','f-city'].forEach(id=>{
    let d; document.getElementById(id)?.addEventListener('input',()=>{clearTimeout(d);d=setTimeout(applyFilters,180);});
    document.getElementById(id)?.addEventListener('change',()=>applyFilters());
  });
  document.getElementById('f-uf')?.addEventListener('change', syncCitySelect);
}

function buildSelectors(){
  const ufEl   = document.getElementById('f-uf');
  const cityEl = document.getElementById('f-city');
  const ufs    = [...new Set(allPlaces.map(p=>p.address?.uf).filter(Boolean))].sort();
  // Only rebuild if options changed
  if(ufEl.children.length -1 !== ufs.length){
    const curUf=ufEl.value; ufEl.innerHTML='<option value="">Todos os estados</option>';
    ufs.forEach(u=>{ const o=document.createElement('option'); o.value=u; o.textContent=u; if(u===curUf)o.selected=true; ufEl.appendChild(o); });
  }
  syncCitySelect();
}

function syncCitySelect(){
  const ufEl   = document.getElementById('f-uf');
  const cityEl = document.getElementById('f-city');
  const selUf  = ufEl.value;
  cityEl.disabled = !selUf;
  const cities = [...new Set(allPlaces.filter(p=>!selUf||p.address?.uf===selUf).map(p=>p.address?.city).filter(Boolean))].sort();
  const curCity=cityEl.value; cityEl.innerHTML='<option value="">Todas as cidades</option>';
  cities.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; if(c===curCity)o.selected=true; cityEl.appendChild(o); });
}

function applyFilters(){
  const text   = (document.getElementById('f-text')?.value||'').toLowerCase();
  const uf     = document.getElementById('f-uf')?.value||'';
  const city   = document.getElementById('f-city')?.value||'';
  const type   = document.getElementById('f-type')?.value||'';
  const status = document.getElementById('f-status')?.value||'';

  const filtered = allPlaces.filter(p=>{
    if(uf     && p.address?.uf!==uf) return false;
    if(city   && p.address?.city!==city) return false;
    if(type   && p.type!==type) return false;
    if(status && p.status!==status) return false;
    if(text){
      const hay=`${p.name} ${p.description||''} ${p.address?.neighborhood||''} ${p.address?.city||''}`.toLowerCase();
      if(!hay.includes(text)) return false;
    }
    return true;
  });

  document.getElementById('results-meta').textContent = `${filtered.length} lugar${filtered.length!==1?'es':''} encontrado${filtered.length!==1?'s':''}`;
  renderGrid(filtered);
}

function renderGrid(places){
  const el=document.getElementById('places-grid');
  if(!places.length){ el.innerHTML='<div class="empty-state"><span>📍</span>Nenhum lugar encontrado com esses filtros.</div>'; return; }
  el.innerHTML=places.map(p=>{
    const t=TYPE[p.type]||{icon:'📍',label:p.type,privacy:'public'};
    const s=STATUS_BADGE[p.status]||STATUS_BADGE.unclaimed;
    const addr=fmtAddress(p);
    return `<div class="place-card">
      <div class="place-card-top">
        <div class="place-card-icon">${t.icon}</div>
        <div>
          <div class="place-card-name">${esc(p.name)}</div>
          <div class="place-card-meta">${addr}</div>
        </div>
      </div>
      <div class="place-card-badges">
        <span class="badge ${s[0]}">${s[1]}</span>
        <span class="badge badge-type">${t.label}</span>
      </div>
      <a class="btn-place-view" href="place.html?id=${esc(p.placeId)}">Ver lugar →</a>
    </div>`;
  }).join('');
}

function fmtAddress(p){
  const a=p.address||{};
  const priv=(TYPE[p.type]?.privacy)||'public';
  if(priv==='neighborhood') return [a.neighborhood,a.city,a.uf].filter(Boolean).join(' · ');
  const parts=[a.neighborhood,a.city,a.uf].filter(Boolean);
  return parts.join(' · ');
}

init();
