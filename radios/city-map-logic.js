import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const FB={apiKey:"AIzaSyDa0XWSvNISi47olox7U2HHawf3pf1rOjI",authDomain:"triadic-radios.firebaseapp.com",databaseURL:"https://triadic-radios-default-rtdb.firebaseio.com",projectId:"triadic-radios",storageBucket:"triadic-radios.firebasestorage.app",messagingSenderId:"574115949337",appId:"1:574115949337:web:527670aa35d9bb939f3388"};
const app=initializeApp(FB); const db=getDatabase(app);

function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmt(ts){ return ts?new Date(ts).toLocaleDateString('pt-BR'):'—'; }

// ── ITEM REGISTRY ─────────────────────────────────────────────
let allItems=[];       // normalized
let filteredItems=[];  // after filters
let activeType='';
let selectedItem=null;

// ── NORMALIZE ─────────────────────────────────────────────────
function normalizeCommerce(b){
  const plan=(b.plan||'free').toLowerCase();
  const claimed=!!(b.claimed||b.status==='claimed'||b.claimedAt);
  const isPremium=plan==='premium'||plan==='destaque';
  let subtype='commerce-unclaimed';
  if(isPremium) subtype='commerce-premium';
  else if(claimed) subtype='commerce-claimed';
  return {
    id:b.businessId||b.id||Math.random().toString(36).slice(2),
    type:'commerce', subtype, name:b.name||b.businessName||'—',
    category:b.category||b.segment||'', plan, city:b.city||b.cidade||'',
    uf:b.uf||b.estado||'', status:claimed?(isPremium?'premium':'claimed'):'unclaimed',
    claimed, isPremium,
    icon: isPremium?'⭐': claimed?'🏪':'🔓',
    tagClass: isPremium?'commerce-premium': claimed?'commerce-claimed':'commerce-unclaimed',
    tagLabel: isPremium?'Premium': claimed?'Ativo':'Disponível',
    tileClass: isPremium?'tile-commerce-premium'+(isPremium?' has-pulse':''): claimed?'tile-commerce-claimed':'tile-commerce-unclaimed',
    link: b.businessId?`profile.html?pid=${b.businessId}`:(b.id?`profile.html?pid=${b.id}`:'business.html'),
    desc: b.description||b.desc||'',
    raw:b
  };
}
function normalizePlace(p){
  const claimed=!!(p.claimed||p.status==='claimed');
  return {
    id:p.placeId||p.id||Math.random().toString(36).slice(2),
    type:'place', subtype: claimed?'place-claimed':'place-unclaimed',
    name:p.name||'—', category:p.type||p.category||'',
    plan:'', city:p.city||p.cidade||'', uf:p.uf||p.estado||'',
    status: claimed?'claimed':'unclaimed', claimed,
    icon: claimed?'📍':'📌',
    tagClass: claimed?'place-claimed':'place-unclaimed',
    tagLabel: claimed?'Ativo':'Disponível',
    tileClass: claimed?'tile-place-claimed':'tile-place-unclaimed',
    link: p.placeId?`place.html?id=${p.placeId}`:(p.id?`place.html?id=${p.id}`:'places.html'),
    desc: p.description||'',
    raw:p
  };
}
function normalizeProvider(p){
  const avail=p.available!==false;
  return {
    id:p.providerId||Math.random().toString(36).slice(2),
    type:'provider', subtype: avail?'provider-available':'provider-unavailable',
    name:p.name||'—', category:(p.categories||[]).join(', '),
    plan:'', city:p.city||'', uf:p.uf||'',
    status: avail?'available':'unavailable',
    icon:'🔧', tagClass: avail?'provider-available':'provider-unavailable',
    tagLabel: avail?'Disponível':'Indisponível',
    tileClass: avail?'tile-provider-available':'tile-provider-unavailable',
    link: p.providerId?`provider-profile.html?id=${p.providerId}`:'services.html',
    desc: p.bio||'',
    rating:p.rating||0, ratingCount:p.ratingCount||0,
    raw:p
  };
}
function normalizeOffer(o){
  return {
    id:o.offerId||o.id||Math.random().toString(36).slice(2),
    type:'offer', subtype:'offer-active',
    name:o.title||o.name||'Oferta',
    category:o.category||'',
    plan:'', city:o.city||'', uf:o.uf||'',
    status:'active',
    icon:'🎯', tagClass:'offer-active', tagLabel:'Oferta ativa',
    tileClass:'tile-offer-active',
    link: o.offerId?`offer.html?id=${o.offerId}`:(o.id?`offer.html?id=${o.id}`:'offers.html'),
    desc: o.description||o.desc||'',
    discount: o.discount||o.discountValue||'',
    raw:o
  };
}
function normalizeOpportunity(o){
  return {
    id:o.opportunityId||o.id||Math.random().toString(36).slice(2),
    type:'opportunity', subtype:'opportunity',
    name:o.title||'Oportunidade',
    category:o.type||'', plan:'', city:'', uf:'',
    status:'open', icon:'⬡', tagClass:'opportunity', tagLabel:'Oportunidade',
    tileClass:'tile-opportunity',
    link:'city-inventory.html',
    desc:o.description||'',
    revenue:o.estimatedRevenue||0,
    priority:o.priority||1,
    raw:o
  };
}

// ── LOAD ──────────────────────────────────────────────────────
async function loadAll(){
  const [bSnap,pSnap,prSnap,offSnap,oppSnap]=await Promise.all([
    get(ref(db,'businessProfiles')),
    get(ref(db,'places')),
    get(ref(db,'serviceProviders')),
    get(ref(db,'affiliateOffers')),
    get(ref(db,'masterOpportunities/francisco-beltrao-pr'))
  ]);
  allItems=[];
  // Commerce
  const biz=Object.values(bSnap.val()||{});
  biz.forEach(b=>{ try{ allItems.push(normalizeCommerce(b)); }catch(e){} });
  // Places
  const places=Object.values(pSnap.val()||{});
  places.forEach(p=>{ try{ allItems.push(normalizePlace(p)); }catch(e){} });
  // Providers
  const provs=Object.values(prSnap.val()||{});
  provs.forEach(p=>{ try{ allItems.push(normalizeProvider(p)); }catch(e){} });
  // Offers
  const offers=Object.values(offSnap.val()||{});
  offers.filter(o=>o.status==='active'||!o.status).forEach(o=>{ try{ allItems.push(normalizeOffer(o)); }catch(e){} });
  // Opportunities
  const opps=Object.values(oppSnap.val()||{});
  opps.filter(o=>o.status==='open'||o.status==='in_progress').forEach(o=>{ try{ allItems.push(normalizeOpportunity(o)); }catch(e){} });
  // Update stats
  updateStats();
  applyFilters();
}

function updateStats(){
  const total=allItems.length;
  const active=allItems.filter(i=>i.status==='claimed'||i.status==='available'||i.status==='active'||i.status==='premium').length;
  const opps=allItems.filter(i=>i.type==='opportunity').length+allItems.filter(i=>i.status==='unclaimed').length;
  const offers=allItems.filter(i=>i.type==='offer').length;
  const el=(id,val)=>{ const e=document.getElementById(id); if(e)e.textContent=val; };
  el('sc-total',total+' ativos');
  el('sc-active',active+' reivindicados');
  el('sc-opps',opps+' oportunidades');
  el('sc-offers',offers+' ofertas');
}

// ── FILTERS ───────────────────────────────────────────────────
window.setFilter=function(btn,type){
  document.querySelectorAll('.ftab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  activeType=type;
  applyFilters();
};

window.applyFilters=function(){
  const status=document.getElementById('f-status')?.value||'';
  const plan=document.getElementById('f-plan')?.value||'';
  const search=(document.getElementById('f-search')?.value||'').toLowerCase().trim();
  filteredItems=allItems.filter(item=>{
    if(activeType && item.type!==activeType) return false;
    if(search && !(item.name.toLowerCase().includes(search)||item.category.toLowerCase().includes(search))) return false;
    if(status){
      if(status==='claimed'&&item.status!=='claimed') return false;
      if(status==='unclaimed'&&item.status!=='unclaimed') return false;
      if(status==='premium'&&item.status!=='premium') return false;
      if(status==='available'&&item.status!=='available') return false;
      if(status==='active'&&item.status!=='active') return false;
    }
    if(plan){
      if(plan==='premium'&&item.plan!=='premium') return false;
      if(plan==='destaque'&&item.plan!=='destaque') return false;
      if(plan==='free'&&item.plan&&item.plan!=='free') return false;
    }
    return true;
  });
  renderGrid();
};

// ── RENDER GRID ───────────────────────────────────────────────
function renderGrid(){
  const grid=document.getElementById('city-grid');
  const count=document.getElementById('grid-count');
  if(count) count.textContent=filteredItems.length+' ponto'+(filteredItems.length!==1?'s':'')+' no mapa';
  if(!filteredItems.length){
    grid.innerHTML=`<div class="empty-results" style="grid-column:1/-1">🗺️ Nenhum ponto com esses filtros.</div>`;
    return;
  }
  // Sort: premium first, then claimed, then unclaimed, then opportunity
  const order={premium:0,'commerce-premium':0,claimed:1,'commerce-claimed':1,'place-claimed':1,available:2,'provider-available':2,active:3,unclaimed:4,opportunity:5,unavailable:6};
  const sorted=[...filteredItems].sort((a,b)=>(order[a.status]||5)-(order[b.status]||5));
  grid.innerHTML=sorted.map(item=>`
    <div class="map-tile ${esc(item.tileClass)}" onclick="selectItem('${esc(item.id)}')" title="${esc(item.name)}">
      <div class="tile-icon">${item.icon}</div>
      <div class="tile-name">${esc(item.name)}</div>
      <span class="tile-tag tag-${esc(item.tagClass)}">${esc(item.tagLabel)}</span>
    </div>`).join('');
}

// ── DETAIL PANEL ──────────────────────────────────────────────
window.selectItem=function(id){
  const item=filteredItems.find(i=>i.id===id)||allItems.find(i=>i.id===id);
  if(!item)return;
  selectedItem=item;
  document.getElementById('detail-empty').style.display='none';
  document.getElementById('detail-content').style.display='flex';
  // Icon
  document.getElementById('d-icon').textContent=item.icon;
  // Type badge
  const tb=document.getElementById('d-type-badge');
  tb.textContent=typeName(item.type);
  tb.className='detail-type-badge tag-'+item.tagClass;
  // Name
  document.getElementById('d-name').textContent=item.name;
  // Meta
  const loc=[item.city,item.uf].filter(Boolean).join(' / ');
  document.getElementById('d-meta').textContent=[loc,item.category].filter(Boolean).join(' · ')||'—';
  // Tags
  const tags=[];
  if(item.plan&&item.plan!=='free') tags.push(`<span class="tile-tag tag-commerce-premium">${item.plan}</span>`);
  if(item.category) tags.push(`<span class="tile-tag tag-${item.tagClass}" style="opacity:.7">${esc(item.category)}</span>`);
  document.getElementById('d-tags').innerHTML=tags.join('');
  // Status
  const dstEl=document.getElementById('d-status');
  dstEl.innerHTML=`<span class="tile-tag tag-${esc(item.tagClass)}">${esc(item.tagLabel)}</span>`;
  // Desc
  document.getElementById('d-desc').textContent=item.desc||'';
  // Actions
  const acts=buildActions(item);
  document.getElementById('d-actions').innerHTML=acts;
  // Stats
  const stats=buildStats(item);
  document.getElementById('d-stat-row').innerHTML=stats;
  document.getElementById('detail-divider').style.display=stats?'':'none';
};

window.closeDetail=function(){
  selectedItem=null;
  document.getElementById('detail-empty').style.display='';
  document.getElementById('detail-content').style.display='none';
};

function typeName(type){
  return {commerce:'Comércio',place:'Lugar',provider:'Prestador',offer:'Oferta',opportunity:'Oportunidade'}[type]||type;
}

function buildActions(item){
  const acts=[];
  if(item.type==='commerce'){
    if(item.status==='unclaimed'){
      acts.push(`<a href="claims.html" class="d-btn d-btn-primary">🔑 Reivindicar perfil</a>`);
      acts.push(`<a href="${esc(item.link)}" class="d-btn d-btn-secondary">👁️ Ver perfil</a>`);
    } else {
      acts.push(`<a href="${esc(item.link)}" class="d-btn d-btn-primary">🏪 Ver perfil</a>`);
      acts.push(`<a href="affiliate-dashboard.html" class="d-btn d-btn-secondary">🔗 Gerar link</a>`);
    }
  } else if(item.type==='place'){
    if(item.status==='unclaimed'){
      acts.push(`<a href="place-claims.html" class="d-btn d-btn-primary">📌 Reivindicar lugar</a>`);
    }
    acts.push(`<a href="${esc(item.link)}" class="d-btn d-btn-secondary">📍 Ver lugar</a>`);
  } else if(item.type==='provider'){
    acts.push(`<a href="service-request.html?cat=${esc(item.category.split(',')[0]||'')}&pid=${esc(item.id)}" class="d-btn d-btn-primary">📋 Pedir orçamento</a>`);
    acts.push(`<a href="${esc(item.link)}" class="d-btn d-btn-secondary">👤 Ver perfil</a>`);
  } else if(item.type==='offer'){
    acts.push(`<a href="${esc(item.link)}" class="d-btn d-btn-primary">🎯 Ver oferta</a>`);
    acts.push(`<a href="affiliate-dashboard.html" class="d-btn d-btn-purple">🔗 Afiliar-se</a>`);
  } else if(item.type==='opportunity'){
    acts.push(`<a href="city-inventory.html" class="d-btn d-btn-primary">🗂️ Ver inventário</a>`);
    if(item.revenue) acts.push(`<div style="font-size:.72rem;color:#86efac;text-align:center;font-weight:700">💰 R$ ${Number(item.revenue).toLocaleString('pt-BR')}/mês estimado</div>`);
  }
  return acts.join('');
}

function buildStats(item){
  const stats=[];
  if(item.type==='provider'&&item.ratingCount){
    const s=Math.round(item.rating||0);
    stats.push(`<div class="d-stat"><div class="d-stat-val">${'★'.repeat(s)}</div><div class="d-stat-lbl">Rating</div></div>`);
    stats.push(`<div class="d-stat"><div class="d-stat-val">${item.ratingCount}</div><div class="d-stat-lbl">Avaliações</div></div>`);
  }
  if(item.type==='opportunity'&&item.priority){
    stats.push(`<div class="d-stat"><div class="d-stat-val">${'⭐'.repeat(item.priority)}</div><div class="d-stat-lbl">Prioridade</div></div>`);
    if(item.revenue) stats.push(`<div class="d-stat"><div class="d-stat-val" style="font-size:.8rem">R$ ${Number(item.revenue).toLocaleString('pt-BR')}</div><div class="d-stat-lbl">Receita est.</div></div>`);
  }
  if(item.type==='commerce'&&item.isPremium){
    stats.push(`<div class="d-stat"><div class="d-stat-val">⭐</div><div class="d-stat-lbl">Premium</div></div>`);
  }
  return stats.join('');
}

loadAll();
