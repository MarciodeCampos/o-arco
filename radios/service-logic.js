import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const FB={apiKey:"AIzaSyDa0XWSvNISi47olox7U2HHawf3pf1rOjI",authDomain:"triadic-radios.firebaseapp.com",databaseURL:"https://triadic-radios-default-rtdb.firebaseio.com",projectId:"triadic-radios",storageBucket:"triadic-radios.firebasestorage.app",messagingSenderId:"574115949337",appId:"1:574115949337:web:527670aa35d9bb939f3388"};
const app=initializeApp(FB); const db=getDatabase(app);
const params=new URLSearchParams(location.search);
const catSlug=params.get('cat')||'pedreiro';

let category=null;
let allProviders=[];

async function init(){
  // Load category
  const cSnap=await get(ref(db,'serviceCategories/'+catSlug));
  category=cSnap.val()||{slug:catSlug,name:catSlug,emoji:'🔧',desc:''};
  document.title=category.name+' | CIDADEONLINE';
  document.getElementById('page-title').textContent=category.name+' | CIDADEONLINE';
  document.getElementById('cat-icon').textContent=category.emoji||'🔧';
  document.getElementById('cat-name').textContent=category.name;
  document.getElementById('cat-desc').textContent=category.desc||'';
  // Patch request links with cat param
  ['cta-request','cta-request2'].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.href='service-request.html?cat='+catSlug;
  });
  // Load providers
  onValue(ref(db,'serviceProviders'),snap=>{
    const all=Object.values(snap.val()||{});
    allProviders=all.filter(p=>(p.categories||[]).includes(catSlug));
    document.getElementById('prov-count').textContent=allProviders.length+' prestador'+(allProviders.length!==1?'es':'');
    renderProviders();
  });
  // Load open requests count for this category
  onValue(ref(db,'serviceRequests'),snap=>{
    const all=Object.values(snap.val()||{});
    const open=all.filter(r=>r.categorySlug===catSlug&&r.status==='open').length;
    document.getElementById('req-count').textContent=open+' chamada'+(open!==1?'s':'')+' abertas';
  });
}

window.renderProviders=function(){
  const onlyAvail=document.getElementById('f-avail')?.checked;
  let list=allProviders;
  if(onlyAvail) list=list.filter(p=>p.available);
  const grid=document.getElementById('providers-grid');
  if(!list.length){
    grid.innerHTML=`<div class="empty-state">😔 Nenhum prestador disponível no momento.<br><a href="service-request.html?cat=${catSlug}" style="color:#f97316;font-weight:700">Abra um pedido de orçamento →</a></div>`;
    return;
  }
  const stars=n=>n?'★'.repeat(Math.round(n))+'☆'.repeat(5-Math.round(n)):'-';
  grid.innerHTML=list.map(p=>{
    const avail=p.available!==false;
    return `<div class="prov-card">
      <div class="prov-card-top">
        <div class="prov-avatar">${(p.name||'?')[0].toUpperCase()}</div>
        <div>
          <div class="prov-name">${p.name}</div>
          <div class="prov-meta">📍 ${p.city||'—'}${p.area?', '+p.area:''}</div>
        </div>
        <span class="avail-badge ${avail?'avail-yes':'avail-no'}" style="margin-left:auto">${avail?'Disponível':'Indisponível'}</span>
      </div>
      <div class="prov-cats">${(p.categories||[]).map(c=>`<span class="cat-tag">${c}</span>`).join('')}</div>
      <div class="prov-rating">${p.ratingCount?stars(p.rating)+' ('+p.ratingCount+')':'Sem avaliações ainda'}</div>
      <div class="prov-actions">
        <a href="provider-profile.html?id=${p.providerId}" class="btn-sm">👤 Ver perfil</a>
        <a href="service-request.html?cat=${catSlug}&pid=${p.providerId}" class="btn-sm primary">📋 Pedir orçamento</a>
      </div>
    </div>`;
  }).join('');
};
init();
