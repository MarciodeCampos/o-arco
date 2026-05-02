import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get, push, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const FB={apiKey:"AIzaSyDa0XWSvNISi47olox7U2HHawf3pf1rOjI",authDomain:"triadic-radios.firebaseapp.com",databaseURL:"https://triadic-radios-default-rtdb.firebaseio.com",projectId:"triadic-radios",storageBucket:"triadic-radios.firebasestorage.app",messagingSenderId:"574115949337",appId:"1:574115949337:web:527670aa35d9bb939f3388"};
const app=initializeApp(FB); const db=getDatabase(app);
const params=new URLSearchParams(location.search);
const preCat=params.get('cat')||'';

function showFb(type,msg){ const el=document.getElementById('req-fb'); el.className='form-feedback '+type; el.textContent=msg; el.style.display=''; if(type==='err')setTimeout(()=>el.style.display='none',4500); }

async function init(){
  // Populate category select
  const snap=await get(ref(db,'serviceCategories'));
  const cats=Object.values(snap.val()||{}).filter(c=>c.active).sort((a,b)=>a.name.localeCompare(b.name));
  const sel=document.getElementById('r-cat');
  sel.innerHTML='<option value="">Selecione o serviço...</option>';
  cats.forEach(c=>{
    const o=document.createElement('option');
    o.value=c.slug; o.textContent=c.emoji+' '+c.name;
    if(c.slug===preCat)o.selected=true;
    sel.appendChild(o);
  });
  // Pre-fill city
  document.getElementById('r-city').value='Francisco Beltrão';
  document.getElementById('r-uf').value='PR';
}

window.submitRequest=async function(e){
  e.preventDefault();
  const name=(document.getElementById('r-name')?.value||'').trim();
  const phone=(document.getElementById('r-phone')?.value||'').replace(/\D/g,'');
  const city=(document.getElementById('r-city')?.value||'').trim();
  const uf=(document.getElementById('r-uf')?.value||'').trim().toUpperCase();
  const neighborhood=(document.getElementById('r-neighborhood')?.value||'').trim();
  const cat=document.getElementById('r-cat')?.value||'';
  const desc=(document.getElementById('r-desc')?.value||'').trim();
  const urgency=document.getElementById('r-urgency')?.value||'normal';
  const btn=document.getElementById('btn-submit');
  if(!name||!phone||!city||!cat||!desc){ showFb('err','⚠️ Preencha todos os campos obrigatórios.'); return; }
  btn.disabled=true; btn.textContent='Enviando...';
  try{
    const r=push(ref(db,'serviceRequests'));
    await set(r,{
      requestId:r.key,
      clientName:name,clientPhone:phone,
      city,uf,neighborhood,
      categorySlug:cat,description:desc,urgency,
      status:'open',
      assignedProviderId:'',
      createdAt:Date.now(),updatedAt:Date.now()
    });
    document.getElementById('req-form').style.display='none';
    document.getElementById('req-success').style.display='';
  }catch(err){
    showFb('err','❌ Erro ao enviar: '+err.message);
    btn.disabled=false; btn.textContent='📋 Enviar pedido de orçamento';
  }
};
init();
