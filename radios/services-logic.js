import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, get, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const FB = { apiKey:"AIzaSyDa0XWSvNISi47olox7U2HHawf3pf1rOjI", authDomain:"triadic-radios.firebaseapp.com", databaseURL:"https://triadic-radios-default-rtdb.firebaseio.com", projectId:"triadic-radios", storageBucket:"triadic-radios.firebasestorage.app", messagingSenderId:"574115949337", appId:"1:574115949337:web:527670aa35d9bb939f3388" };
const app=initializeApp(FB); const db=getDatabase(app);

const CATS=[
  {slug:'pedreiro',name:'Pedreiro',emoji:'🧱',desc:'Construção, reformas, alvenaria e acabamentos.'},
  {slug:'pintor',name:'Pintor',emoji:'🎨',desc:'Pintura interna e externa, texturas e impermeabilização.'},
  {slug:'eletricista',name:'Eletricista',emoji:'⚡',desc:'Instalações elétricas, quadros e manutenção.'},
  {slug:'encanador',name:'Encanador',emoji:'🔩',desc:'Encanamentos, vazamentos, instalação de registros.'},
  {slug:'diarista',name:'Diarista',emoji:'🧹',desc:'Limpeza doméstica, faxina e organização.'},
  {slug:'jardineiro',name:'Jardineiro',emoji:'🌿',desc:'Paisagismo, corte de grama e jardins.'},
  {slug:'marceneiro',name:'Marceneiro',emoji:'🪚',desc:'Móveis planejados, reparos e trabalho em madeira.'},
  {slug:'gesseiro',name:'Gesseiro',emoji:'🏛️',desc:'Molduras, sancas, forros de gesso e drywall.'},
  {slug:'instalador',name:'Instalador',emoji:'🔨',desc:'Portas, janelas, box, pisos e revestimentos.'},
  {slug:'ar_condicionado',name:'Ar-condicionado',emoji:'❄️',desc:'Instalação, manutenção e higienização de aparelhos.'},
  {slug:'freteiro',name:'Freteiro',emoji:'🚚',desc:'Fretes locais, mudanças e entrega de materiais.'},
  {slug:'montador_moveis',name:'Montador de Móveis',emoji:'🪑',desc:'Montagem de móveis de caixas e projetos.'},
  {slug:'serralheiro',name:'Serralheiro',emoji:'🔐',desc:'Portões, grades, estruturas metálicas.'},
  {slug:'vidraceiro',name:'Vidraceiro',emoji:'🪟',desc:'Espelhos, box, janelas e fechamento em vidro.'},
  {slug:'tecnico_informatica',name:'Técnico de Informática',emoji:'💻',desc:'Reparos, formatação, redes e manutenção de computadores.'}
];

async function seedCategories(){
  const snap=await get(ref(db,'serviceCategories'));
  if(snap.exists())return;
  for(const c of CATS){
    await set(ref(db,'serviceCategories/'+c.slug),{...c,active:true,providerCount:0,requestCount:0,createdAt:Date.now()});
  }
}

window.filterByCity=function(v){ currentCity=v; renderCats(); };
let currentCity='francisco-beltrao';
let catCounts={};

async function init(){
  await seedCategories();
  // Load provider counts per category
  const pSnap=await get(ref(db,'serviceProviders'));
  const provs=Object.values(pSnap.val()||{});
  provs.forEach(p=>(p.categories||[]).forEach(c=>{ catCounts[c]=(catCounts[c]||0)+1; }));
  onValue(ref(db,'serviceCategories'),snap=>{
    renderCats(Object.values(snap.val()||{}));
  });
}
function renderCats(cats){
  if(!cats){ const el=document.getElementById('cat-grid'); if(el)el.innerHTML='<div class="loading">Carregando...</div>'; return; }
  const sorted=cats.filter(c=>c.active).sort((a,b)=>(catCounts[b.slug]||0)-(catCounts[a.slug]||0));
  document.getElementById('cat-grid').innerHTML=sorted.map(c=>{
    const cnt=catCounts[c.slug]||0;
    return `<a href="service.html?cat=${c.slug}" class="cat-card">
      <div class="cat-emoji">${c.emoji}</div>
      <div class="cat-name">${c.name}</div>
      <div class="cat-count">${cnt} prestador${cnt!==1?'es':''}</div>
      <span class="cat-avail ${cnt>0?'has':'empty'}">${cnt>0?'Disponível':'Cadastre-se'}</span>
    </a>`;
  }).join('');
}
init();
