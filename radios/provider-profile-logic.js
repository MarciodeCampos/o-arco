import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const FB={apiKey:"AIzaSyDa0XWSvNISi47olox7U2HHawf3pf1rOjI",authDomain:"triadic-radios.firebaseapp.com",databaseURL:"https://triadic-radios-default-rtdb.firebaseio.com",projectId:"triadic-radios",storageBucket:"triadic-radios.firebasestorage.app",messagingSenderId:"574115949337",appId:"1:574115949337:web:527670aa35d9bb939f3388"};
const app=initializeApp(FB); const db=getDatabase(app);
const params=new URLSearchParams(location.search);
const pid=params.get('id')||'';
const preCat=params.get('cat')||'';

function fmt(ts){ return ts?new Date(ts).toLocaleDateString('pt-BR'):'—'; }
function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function stars(n){ return n?'★'.repeat(Math.round(n))+'☆'.repeat(5-Math.round(n)):'-'; }

async function init(){
  if(!pid){ showNotFound(); return; }
  const snap=await get(ref(db,'serviceProviders/'+pid));
  const p=snap.val();
  if(!p){ showNotFound(); return; }
  document.getElementById('pp-loading').style.display='none';
  document.getElementById('pp-main').style.display='';
  document.title=(p.name||'Prestador')+' | CIDADEONLINE';
  document.getElementById('page-title').textContent=(p.name||'Prestador')+' | CIDADEONLINE';
  // Avatar
  const av=document.getElementById('pp-avatar');
  if(av) av.textContent=(p.name||'?')[0].toUpperCase();
  // Name
  document.getElementById('pp-name').textContent=p.name||'—';
  // Categories
  const cats=p.categories||[];
  document.getElementById('pp-cats').innerHTML=cats.map(c=>`<span class="pp-cat-tag">${esc(c)}</span>`).join('');
  document.getElementById('pp-cats-detail').textContent=cats.join(', ')||'—';
  // Location
  const loc=[p.city,p.uf].filter(Boolean).join(' / ');
  document.getElementById('pp-location').textContent=loc?'📍 '+loc:'';
  document.getElementById('pp-area').textContent=[p.city,p.uf,p.area].filter(Boolean).join(' — ')||'—';
  // Availability
  const avEl=document.getElementById('pp-avail');
  const isAvail=p.available!==false;
  avEl.textContent=isAvail?'🟢 Disponível':'🔴 Indisponível';
  avEl.className='pp-avail '+(isAvail?'yes':'no');
  // Rating
  const rEl=document.getElementById('pp-rating-row');
  if(p.ratingCount){ rEl.textContent=stars(p.rating)+' — '+p.ratingCount+' avaliação'+(p.ratingCount!==1?'ões':''); }
  document.getElementById('pp-rating-detail').textContent=p.ratingCount?stars(p.rating)+' ('+p.ratingCount+')':'Sem avaliações ainda';
  // Bio
  if(p.bio){
    document.getElementById('pp-bio').textContent=p.bio;
    document.getElementById('pp-bio-card').style.display='';
  }
  // Since
  document.getElementById('pp-since').textContent=fmt(p.createdAt);
  // WhatsApp
  if(p.whatsappPublic && p.phone){
    const wa=document.getElementById('btn-whatsapp');
    if(wa){ wa.href='https://wa.me/55'+p.phone+'?text=Ol%C3%A1%20'+encodeURIComponent(p.name||'')+'.%20Vi%20seu%20perfil%20no%20CIDADEONLINE%20e%20gostaria%20de%20um%20or%C3%A7amento.'; wa.style.display=''; }
  }
  // Request links
  const catParam=preCat||cats[0]||'';
  ['btn-request','btn-request2'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.href='service-request.html?cat='+catParam+'&pid='+pid;
  });
}
function showNotFound(){ document.getElementById('pp-loading').style.display='none'; document.getElementById('pp-not-found').style.display=''; }
init();
