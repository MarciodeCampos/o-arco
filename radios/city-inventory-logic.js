import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, get, set, push, update, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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

function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmt(ts){ return ts?new Date(ts).toLocaleDateString('pt-BR'):'—'; }
function showFb(el,type,msg){ el.className='form-feedback '+type; el.textContent=msg; el.style.display=''; if(type==='err')setTimeout(()=>el.style.display='none',4000); }

// ── SEED ─────────────────────────────────────────────────────
const SEED_CITIES = {
  'francisco-beltrao-pr': {
    citySlug:'francisco-beltrao-pr', cityName:'Francisco Beltrão', uf:'PR',
    masterId:'', status:'onboarding', activationScore:0,
    stats:{ commerces:0, places:0, providers:0, offers:0, affiliates:0 },
    inventory:{
      formalCompanies:  4200,
      importedBusinesses:312,
      serviceProviders:  890,
      publicPlaces:       54,
      claimableAddresses:180,
      activeCategories:   32,
      unclaimedProfiles:4170,
      estimatedOpps:     195,
      population:      90000,
      updatedAt: Date.now()
    },
    createdAt: Date.now(), updatedAt: Date.now()
  }
};

const SEED_OPPS = {
  'francisco-beltrao-pr':[
    {title:'Restaurantes sem perfil na Rua XV de Novembro',type:'commercial',description:'Aproximadamente 18 restaurantes e lanchonetes sem perfil reivindicado na principal rua gastronômica.',priority:5,estimatedRevenue:2700,status:'open'},
    {title:'Categoria Eletricistas — 0 prestadores cadastrados',type:'service',description:'Alta demanda local, categoria sem nenhum prestador no sistema. Potencial imediato.',priority:5,estimatedRevenue:1500,status:'open'},
    {title:'Posto de Saúde do Alvorada — sem responsável',type:'place',description:'Lugar público de alta frequência sem responsável vinculado. Gestão de avisos públicos.',priority:4,estimatedRevenue:0,status:'open'},
    {title:'Imobiliárias locais — perfis sem ofertas',type:'commercial',description:'7 imobiliárias com perfis importados mas sem nenhuma oferta criada.',priority:4,estimatedRevenue:2100,status:'open'},
    {title:'Clínicas e consultórios — nenhum reivindicado',type:'commercial',description:'23 estabelecimentos de saúde no diretório sem dono ativo.',priority:4,estimatedRevenue:3450,status:'open'},
    {title:'Categoria Pedreiros — ativar 5 prestadores âncora',type:'service',description:'Categoria mais pesquisada localmente. Iniciar com 5 prestadores de confiança.',priority:3,estimatedRevenue:750,status:'open'},
    {title:'Praça Central — mural público vazio',type:'place',description:'Lugar com alta movimentação mas sem publicações ou responsável.',priority:3,estimatedRevenue:0,status:'open'},
    {title:'Escolas estaduais — 4 sem página responsável',type:'place',description:'Instituições de ensino sem representante vinculado no sistema.',priority:3,estimatedRevenue:0,status:'in_progress'},
    {title:'Agropecuárias — categoria sem segmento no diretório',type:'category',description:'Francisco Beltrão tem base rural expressiva. Criar categoria agro no diretório.',priority:2,estimatedRevenue:1200,status:'open'},
    {title:'Hotéis e pousadas — integração com ofertas',type:'commercial',description:'6 meios de hospedagem com perfis mas sem nenhuma oferta ou cupom.',priority:2,estimatedRevenue:900,status:'open'},
  ]
};

// ── ADMIN GATE ─────────────────────────────────────────────────
const ADMIN_KEY='cidadeonline2026';
window.checkGate=function(){
  if((document.getElementById('gate-input')?.value||'').trim()===ADMIN_KEY){
    localStorage.setItem('ci_admin',ADMIN_KEY);
    document.getElementById('admin-gate').style.display='none';
    document.getElementById('main-panel').style.display='';
    init();
  } else { document.getElementById('gate-err').style.display=''; document.getElementById('gate-input').value=''; }
};
document.getElementById('gate-input')?.addEventListener('keydown',e=>{ if(e.key==='Enter')window.checkGate(); });
if(localStorage.getItem('ci_admin')===ADMIN_KEY){
  document.getElementById('admin-gate').style.display='none';
  document.getElementById('main-panel').style.display='';
  document.addEventListener('DOMContentLoaded',()=>init());
}

// ── STATE ─────────────────────────────────────────────────────
let allCities      = [];
let currentSlug    = '';
let currentInv     = null;
let allOpps        = [];
let editingOppId   = null;

// ── INIT ──────────────────────────────────────────────────────
async function init(){
  await seedIfEmpty();
  onValue(ref(db,'cityOperations'), snap=>{
    allCities=Object.values(snap.val()||{}).sort((a,b)=>(a.cityName||'').localeCompare(b.cityName||''));
    buildCitySelect();
  });
  // Load city from URL param or default
  const urlSlug=new URLSearchParams(location.search).get('city')||'francisco-beltrao-pr';
  loadCity(urlSlug);
}

async function seedIfEmpty(){
  const snap=await get(ref(db,'cityOperations'));
  if(!snap.exists()){
    for(const [slug,data] of Object.entries(SEED_CITIES)){
      await set(ref(db,'cityOperations/'+slug),data);
    }
  }
  const oppSnap=await get(ref(db,'masterOpportunities'));
  if(!oppSnap.exists()){
    for(const [slug,opps] of Object.entries(SEED_OPPS)){
      for(const o of opps){
        const r=push(ref(db,'masterOpportunities/'+slug));
        await set(r,{...o,opportunityId:r.key,citySlug:slug,createdAt:Date.now(),updatedAt:Date.now()});
      }
    }
  }
  // Seed cityInventory if not exists
  const invSnap=await get(ref(db,'cityInventory'));
  if(!invSnap.exists()){
    for(const [slug,data] of Object.entries(SEED_CITIES)){
      await set(ref(db,'cityInventory/'+slug),data.inventory);
    }
  }
}

function buildCitySelect(){
  const sel=document.getElementById('city-select');
  const cur=sel.value||currentSlug;
  sel.innerHTML='<option value="">Selecione a cidade</option>';
  allCities.forEach(c=>{
    const o=document.createElement('option');
    o.value=c.citySlug; o.textContent=`${c.cityName} / ${c.uf}`;
    if(c.citySlug===cur)o.selected=true;
    sel.appendChild(o);
  });
  if(!sel.value && allCities.length){
    sel.value=allCities[0].citySlug;
    if(!currentSlug) loadCity(allCities[0].citySlug);
  }
}

// ── LOAD CITY ─────────────────────────────────────────────────
window.loadCity = async function(slug){
  if(!slug) return;
  currentSlug=slug;
  document.getElementById('city-select').value=slug;

  // Score banner
  const cityOp = allCities.find(c=>c.citySlug===slug);
  const cityName = cityOp?.cityName||slug;
  document.getElementById('score-city-name').textContent=cityName+(cityOp?.uf?' / '+cityOp.uf:'');

  // Load inventory
  const invSnap=await get(ref(db,'cityInventory/'+slug));
  if(invSnap.exists()){
    currentInv=invSnap.val();
  } else {
    // Compute from live data
    currentInv=await computeInventory(slug,cityOp);
    await set(ref(db,'cityInventory/'+slug),{...currentInv,updatedAt:Date.now()});
  }
  renderInventory(currentInv);
  updateScore(currentInv, cityOp);

  // Load opportunities
  onValue(ref(db,'masterOpportunities/'+slug), snap=>{
    allOpps=Object.values(snap.val()||{}).sort((a,b)=>(b.priority||0)-(a.priority||0));
    renderOpps();
  });

  const ts=currentInv?.updatedAt;
  document.getElementById('last-updated').textContent=ts?'Atualizado em '+fmt(ts):'';
};

async function computeInventory(slug, cityOp){
  const [bSnap,pSnap,offSnap,affSnap]=await Promise.all([
    get(ref(db,'businessProfiles')),
    get(ref(db,'places')),
    get(ref(db,'affiliateOffers')),
    get(ref(db,'affiliateClicks'))
  ]);
  const bs  =Object.values(bSnap.val()||{});
  const ps  =Object.values(pSnap.val()||{});
  const offs=Object.values(offSnap.val()||{});
  const aff =Object.values(affSnap.val()||{});
  const claimed=bs.filter(b=>b.claimed||b.status==='claimed').length;
  const unclaimed=bs.length-claimed;
  return {
    formalCompanies:   cityOp?.inventory?.formalCompanies||bs.length,
    importedBusinesses:bs.length,
    serviceProviders:  0,
    publicPlaces:      ps.length,
    claimableAddresses:ps.filter(p=>p.status==='unclaimed').length,
    activeCategories:  [...new Set(bs.map(b=>b.category).filter(Boolean))].length,
    unclaimedProfiles: unclaimed,
    estimatedOpps:     Math.round((unclaimed+ps.filter(p=>p.status==='unclaimed').length)*0.05),
    updatedAt:Date.now()
  };
}

function updateScore(inv, cityOp){
  const score = cityOp?.activationScore || calcScore(inv);
  const fill=document.getElementById('score-bar-fill');
  const num=document.getElementById('score-num');
  const sub=document.getElementById('score-sub-label');
  if(fill) fill.style.width=Math.min(score,100)+'%';
  if(num)  num.textContent=score+' / 100';
  const levels=[[0,'Cidade inexplorada'],[21,'Início de ativação'],[41,'Em crescimento'],[61,'Cidade ativa'],[81,'Cidade consolidada']];
  const [,label]=([...levels].reverse().find(([m])=>score>=m)||levels[0]);
  if(sub) sub.textContent=label;
}

function calcScore(inv){
  if(!inv)return 0;
  const tot=inv.importedBusinesses||1;
  const claimed=tot-(inv.unclaimedProfiles||tot);
  const score=Math.round(
    (claimed/tot)*30 +
    Math.min((inv.publicPlaces-inv.claimableAddresses)/Math.max(inv.publicPlaces,1),1)*20 +
    Math.min(tot/100,1)*15 +
    Math.min(inv.serviceProviders/20,1)*15 +
    Math.min(inv.activeCategories/30,1)*20
  );
  return Math.max(0,Math.min(100,score));
}

// ── INVENTORY CARDS ────────────────────────────────────────────
function renderInventory(inv){
  const cards=[
    {icon:'🏢',label:'Empresas formais',value:n(inv.formalCompanies),sub:'CNPJ ativo na cidade',cls:'c-commerce text-gold'},
    {icon:'🏪',label:'Comércios importados',value:n(inv.importedBusinesses),sub:'No diretório CIDADEONLINE',cls:'c-commerce text-gold'},
    {icon:'🔧',label:'Prestadores cadastráveis',value:n(inv.serviceProviders),sub:'Profissionais locais estimados',cls:'c-service text-orange'},
    {icon:'📍',label:'Lugares públicos',value:n(inv.publicPlaces),sub:'Postos, praças, escolas, igrejas...',cls:'c-place text-teal'},
    {icon:'🏠',label:'Cascas reivindicáveis',value:n(inv.claimableAddresses),sub:'Endereços sem responsável',cls:'c-place text-teal'},
    {icon:'🗂️',label:'Categorias ativas',value:n(inv.activeCategories),sub:'Segmentos no diretório',cls:'c-category text-purple'},
    {icon:'🔓',label:'Perfis não reivindicados',value:n(inv.unclaimedProfiles),sub:'Oportunidades de ativação imediata',cls:'c-opportunity text-green'},
    {icon:'💰',label:'Oportunidades estimadas',value:n(inv.estimatedOpps),sub:'Potencial de receita mensal',cls:'c-opportunity text-green'}
  ];
  document.getElementById('inv-grid').innerHTML=cards.map(c=>`
    <div class="inv-card ${c.cls.split(' ')[0]}">
      <div class="inv-card-icon">${c.icon}</div>
      <div class="inv-card-label">${c.label}</div>
      <div class="inv-card-value ${c.cls.split(' ')[1]||''}">${c.value}</div>
      <div class="inv-card-sub">${c.sub}</div>
    </div>`).join('');
}
function n(v){ return v!=null?v.toLocaleString('pt-BR'):'—'; }

// ── OPPORTUNITIES ──────────────────────────────────────────────
window.renderOpps = function(){
  const typeF  =document.getElementById('f-type')?.value||'';
  const statusF=document.getElementById('f-status')?.value||'';
  const priF   =document.getElementById('f-priority')?.value||'';
  const filtered=allOpps.filter(o=>{
    if(typeF   && o.type!==typeF)   return false;
    if(statusF && o.status!==statusF)return false;
    if(priF    && String(o.priority)!==priF)return false;
    return true;
  });
  document.getElementById('opp-count').textContent=`${filtered.length} oportunidade${filtered.length!==1?'s':''}`;
  const el=document.getElementById('opp-list');
  if(!filtered.length){ el.innerHTML='<div class="empty-state">📭 Nenhuma oportunidade com esses filtros.</div>'; return; }

  const typeIcon={commercial:'🏪',service:'🔧',place:'📍',category:'🗂️'};
  const statusInfo={
    open:      ['badge-open','Aberta'],
    in_progress:['badge-in_progress','Em progresso'],
    closed:    ['badge-closed','Fechada']
  };
  const stars=n=>Array.from({length:5},(_, i)=>i<n?'⭐':'·').join('');

  el.innerHTML=`<div class="opp-list-inner">${filtered.map(o=>{
    const [sCls,sLbl]=statusInfo[o.status]||statusInfo.open;
    return `<div class="opp-row">
      <div class="opp-type-icon">${typeIcon[o.type]||'📋'}</div>
      <div class="opp-info">
        <div class="opp-title">${esc(o.title)}</div>
        <div class="opp-desc">${esc(o.description||'')}</div>
        <div class="opp-meta">Criada ${fmt(o.createdAt)}</div>
      </div>
      <div class="opp-priority" title="Prioridade">${stars(o.priority||1)}</div>
      ${o.estimatedRevenue?`<div class="opp-revenue">R$ ${Number(o.estimatedRevenue).toLocaleString('pt-BR')}/mês</div>`:''}
      <div class="opp-actions">
        <span class="badge ${sCls}">${sLbl}</span>
        <button class="btn-sm" onclick="cycleStatus('${esc(o.opportunityId)}','${esc(o.status)}')">↻</button>
        <button class="btn-sm" onclick="editOpp('${esc(o.opportunityId)}')">✏️</button>
        <button class="btn-sm red" onclick="deleteOpp('${esc(o.opportunityId)}')">✕</button>
      </div>
    </div>`;
  }).join('')}</div>`;
};

window.cycleStatus = async function(id, current){
  const next={open:'in_progress',in_progress:'closed',closed:'open'}[current]||'open';
  await update(ref(db,'masterOpportunities/'+currentSlug+'/'+id),{status:next,updatedAt:Date.now()});
};

window.deleteOpp = async function(id){
  if(!confirm('Remover esta oportunidade?')) return;
  await remove(ref(db,'masterOpportunities/'+currentSlug+'/'+id));
};

// ── OPP FORM ──────────────────────────────────────────────────
window.openOppForm = function(){
  editingOppId=null;
  clearOppForm();
  document.getElementById('opp-modal-title').textContent='Nova Oportunidade';
  document.getElementById('opp-modal').style.display='flex';
};
window.closeOppModal = function(e){ if(!e||e.target.id==='opp-modal') document.getElementById('opp-modal').style.display='none'; };
window.editOpp = function(id){
  const o=allOpps.find(x=>x.opportunityId===id); if(!o) return;
  editingOppId=id;
  document.getElementById('om-title').value=o.title||'';
  document.getElementById('om-desc').value=o.description||'';
  document.getElementById('om-type').value=o.type||'commercial';
  document.getElementById('om-priority').value=String(o.priority||3);
  document.getElementById('om-revenue').value=o.estimatedRevenue||0;
  document.getElementById('om-status').value=o.status||'open';
  document.getElementById('opp-modal-title').textContent='Editar Oportunidade';
  document.getElementById('opp-modal').style.display='flex';
};
function clearOppForm(){
  ['om-title','om-desc','om-revenue'].forEach(id=>{ if(document.getElementById(id))document.getElementById(id).value=''; });
  document.getElementById('om-type').value='commercial';
  document.getElementById('om-priority').value='3';
  document.getElementById('om-status').value='open';
}

window.saveOpp = async function(){
  if(!currentSlug){ alert('Selecione uma cidade primeiro.'); return; }
  const title  =(document.getElementById('om-title')?.value||'').trim();
  const desc   =(document.getElementById('om-desc')?.value||'').trim();
  const type   =document.getElementById('om-type')?.value||'commercial';
  const priority=parseInt(document.getElementById('om-priority')?.value||'3');
  const revenue =parseFloat(document.getElementById('om-revenue')?.value||'0');
  const status  =document.getElementById('om-status')?.value||'open';
  const fb      =document.getElementById('opp-fb');
  const btn     =document.getElementById('btn-save-opp');
  if(!title){ showFb(fb,'err','⚠️ Título obrigatório.'); return; }
  btn.disabled=true; btn.textContent='Salvando...';
  try{
    const now=Date.now();
    if(editingOppId){
      await update(ref(db,'masterOpportunities/'+currentSlug+'/'+editingOppId),
        {title,description:desc,type,priority,estimatedRevenue:revenue,status,updatedAt:now});
    } else {
      const r=push(ref(db,'masterOpportunities/'+currentSlug));
      await set(r,{opportunityId:r.key,citySlug:currentSlug,title,description:desc,
        type,priority,estimatedRevenue:revenue,status,
        assignedMasterId:'',createdAt:now,updatedAt:now});
    }
    showFb(fb,'ok','✅ Salvo!');
    setTimeout(()=>window.closeOppModal(),900);
  }catch(e){
    showFb(fb,'err','❌ Erro: '+e.message);
  }finally{ btn.disabled=false; btn.textContent='💾 Salvar'; }
};
