import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, get, push, set, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const FB={apiKey:"AIzaSyDa0XWSvNISi47olox7U2HHawf3pf1rOjI",authDomain:"triadic-radios.firebaseapp.com",databaseURL:"https://triadic-radios-default-rtdb.firebaseio.com",projectId:"triadic-radios",storageBucket:"triadic-radios.firebasestorage.app",messagingSenderId:"574115949337",appId:"1:574115949337:web:527670aa35d9bb939f3388"};
const app=initializeApp(FB); const db=getDatabase(app);
const ADMIN_KEY='cidadeonline2026';

function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmt(ts){ return ts?new Date(ts).toLocaleDateString('pt-BR'):'—'; }
function showFb(id,type,msg){ const el=document.getElementById(id); el.className='form-feedback '+type; el.textContent=msg; el.style.display=''; if(type==='err')setTimeout(()=>el.style.display='none',4000); }

// ── GATE ──────────────────────────────────────────────────────
window.checkGate=function(){
  if((document.getElementById('gate-input')?.value||'').trim()===ADMIN_KEY){
    localStorage.setItem('sa_admin',ADMIN_KEY);
    document.getElementById('admin-gate').style.display='none';
    document.getElementById('main-panel').style.display='';
    init();
  } else { document.getElementById('gate-err').style.display=''; document.getElementById('gate-input').value=''; }
};
document.getElementById('gate-input')?.addEventListener('keydown',e=>{ if(e.key==='Enter')window.checkGate(); });
if(localStorage.getItem('sa_admin')===ADMIN_KEY){
  document.getElementById('admin-gate').style.display='none';
  document.getElementById('main-panel').style.display='';
  document.addEventListener('DOMContentLoaded',()=>init());
}

// ── STATE ─────────────────────────────────────────────────────
let allRequests=[]; let allProviders=[]; let allCategories=[];
let editingProvId=null; let assigningReqId=null;

// ── SEED PROVIDERS ────────────────────────────────────────────
const SEED_PROVIDERS=[
  {name:'José Antônio Pereira',phone:'46991110001',city:'Francisco Beltrão',uf:'PR',area:'Centro e Zona Norte',categories:['pedreiro'],bio:'20 anos de experiência em reformas residenciais e comerciais.',available:true,rating:4.8,ratingCount:12,whatsappPublic:true},
  {name:'Carlos Alves Neto',phone:'46991110002',city:'Francisco Beltrão',uf:'PR',area:'Toda a cidade',categories:['pedreiro'],bio:'Especialidade em alvenaria e acabamentos finos.',available:true,rating:4.5,ratingCount:8,whatsappPublic:false},
  {name:'Roberto Eletrik',phone:'46991110003',city:'Francisco Beltrão',uf:'PR',area:'Centro, Alvorada e adjacentes',categories:['eletricista'],bio:'NR10, experiência em industrial e residencial.',available:true,rating:4.9,ratingCount:21,whatsappPublic:true},
  {name:'Marcos Fios',phone:'46991110004',city:'Francisco Beltrão',uf:'PR',area:'Toda a cidade',categories:['eletricista'],bio:'Instalações residenciais e quadros de distribuição.',available:false,rating:4.3,ratingCount:5,whatsappPublic:false},
  {name:'Paulo Pintura',phone:'46991110005',city:'Francisco Beltrão',uf:'PR',area:'Zona Sul e Centro',categories:['pintor'],bio:'Pintura lisa, texturizada e impermeabilização de fachadas.',available:true,rating:4.7,ratingCount:17,whatsappPublic:true},
  {name:'Adriano Cores',phone:'46991110006',city:'Francisco Beltrão',uf:'PR',area:'Toda a cidade',categories:['pintor'],bio:'Especialidade em texturas decorativas e pinturas industriais.',available:true,rating:4.4,ratingCount:9,whatsappPublic:false},
  {name:'Nivaldo Canos',phone:'46991110007',city:'Francisco Beltrão',uf:'PR',area:'Centro e adjacentes',categories:['encanador'],bio:'Instalações hidráulicas, detecção e reparo de vazamentos.',available:true,rating:4.6,ratingCount:14,whatsappPublic:true},
  {name:'Maria da Faxina',phone:'46991110008',city:'Francisco Beltrão',uf:'PR',area:'Centro e Jardim',categories:['diarista'],bio:'Limpeza residencial, faxina periódica e pós-obra.',available:true,rating:5.0,ratingCount:33,whatsappPublic:false},
  {name:'Sandro Jardins',phone:'46991110009',city:'Francisco Beltrão',uf:'PR',area:'Toda a cidade',categories:['jardineiro'],bio:'Paisagismo, corte, poda e manutenção de jardins.',available:true,rating:4.7,ratingCount:11,whatsappPublic:true},
  {name:'Felipe Informática',phone:'46991110010',city:'Francisco Beltrão',uf:'PR',area:'Toda a cidade e remoto',categories:['tecnico_informatica'],bio:'Manutenção, formatação, redes e suporte remoto.',available:true,rating:4.8,ratingCount:28,whatsappPublic:true},
  {name:'André Marceneiro',phone:'46991110011',city:'Francisco Beltrão',uf:'PR',area:'Toda a cidade',categories:['marceneiro','instalador'],bio:'Móveis planejados, portas, janelas e box.',available:false,rating:4.5,ratingCount:7,whatsappPublic:false},
];

async function seedProviders(){
  const snap=await get(ref(db,'serviceProviders'));
  if(snap.exists())return;
  for(const p of SEED_PROVIDERS){
    const r=push(ref(db,'serviceProviders'));
    await set(r,{...p,providerId:r.key,createdAt:Date.now(),updatedAt:Date.now()});
  }
}

// ── INIT ──────────────────────────────────────────────────────
async function init(){
  await seedProviders();
  onValue(ref(db,'serviceRequests'),snap=>{
    allRequests=Object.values(snap.val()||{}).sort((a,b)=>b.createdAt-a.createdAt);
    document.getElementById('tb-requests').textContent=allRequests.filter(r=>r.status==='open').length||'';
    populateCatFilter();
    renderRequests();
  });
  onValue(ref(db,'serviceProviders'),snap=>{
    allProviders=Object.values(snap.val()||{}).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    document.getElementById('tb-providers').textContent=allProviders.length;
    renderProviders();
    buildProviderSelect();
    buildCatCheckGrid();
  });
  onValue(ref(db,'serviceCategories'),snap=>{
    allCategories=Object.values(snap.val()||{}).filter(c=>c.active).sort((a,b)=>a.name.localeCompare(b.name));
    renderCategories();
  });
}

// ── TABS ──────────────────────────────────────────────────────
window.switchTab=function(tab){
  ['requests','providers','categories'].forEach(t=>{
    document.getElementById('tab-'+t).style.display=t===tab?'':'none';
  });
  document.querySelectorAll('.tab-btn').forEach((btn,i)=>{
    const tabs=['requests','providers','categories'];
    btn.className='tab-btn'+(tabs[i]===tab?' active':'');
  });
};

// ── REQUESTS ──────────────────────────────────────────────────
function populateCatFilter(){
  const sel=document.getElementById('f-cat'); if(!sel)return;
  const cur=sel.value; sel.innerHTML='<option value="">Todas as categorias</option>';
  const cats=[...new Set(allRequests.map(r=>r.categorySlug).filter(Boolean))];
  cats.sort().forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c.replace('_',' '); if(c===cur)o.selected=true; sel.appendChild(o); });
}

window.renderRequests=function(){
  const stF=document.getElementById('f-status')?.value||'';
  const catF=document.getElementById('f-cat')?.value||'';
  const list=allRequests.filter(r=>(!stF||r.status===stF)&&(!catF||r.categorySlug===catF));
  document.getElementById('req-count').textContent=list.length+' chamada'+(list!==1?'s':'');
  const el=document.getElementById('requests-list');
  if(!list.length){ el.innerHTML='<div class="empty-state">📭 Nenhuma chamada com esses filtros.</div>'; return; }
  const stInfo={open:['badge-open','Aberta'],assigned:['badge-assigned','Atribuída'],in_progress:['badge-in_progress','Em andamento'],done:['badge-done','Concluída'],cancelled:['badge-cancelled','Cancelada']};
  const urgBadge={urgent:'<span class="badge badge-urgency-urgent">Urgente</span>',soon:'<span class="badge badge-urgency-soon">Logo</span>'};
  el.innerHTML=`<div class="req-list">${list.map(r=>{
    const [sCls,sLbl]=stInfo[r.status]||stInfo.open;
    const prov=r.assignedProviderId?allProviders.find(p=>p.providerId===r.assignedProviderId):null;
    const catInfo=allCategories.find(c=>c.slug===r.categorySlug);
    return `<div class="req-row">
      <div class="req-cat-icon">${catInfo?.emoji||'📋'}</div>
      <div class="req-info">
        <div class="req-client">📞 ${esc(r.clientName)} · ${esc(r.city)}/${esc(r.uf)}</div>
        <div class="req-desc">${esc(r.description)}</div>
        <div class="req-meta">${esc(r.categorySlug||'').replace('_',' ')} · ${fmt(r.createdAt)}${prov?' · Prestador: '+esc(prov.name):''}</div>
      </div>
      <div class="req-badges">
        <span class="badge ${sCls}">${sLbl}</span>
        ${urgBadge[r.urgency]||''}
      </div>
      <div class="req-actions">
        ${r.status==='open'?`<button class="btn-sm assign" onclick="openAssign('${r.requestId}')">✅ Atribuir</button>`:''}
        ${r.status!=='done'&&r.status!=='cancelled'?`<button class="btn-sm" onclick="advanceStatus('${r.requestId}','${r.status}')">→ Avançar</button>`:''}
        ${r.status!=='cancelled'?`<button class="btn-sm" onclick="cancelRequest('${r.requestId}')">✕ Cancelar</button>`:''}
      </div>
    </div>`;
  }).join('')}</div>`;
};

window.advanceStatus=async function(id,current){
  const next={open:'assigned',assigned:'in_progress',in_progress:'done'}[current];
  if(next) await update(ref(db,'serviceRequests/'+id),{status:next,updatedAt:Date.now()});
};
window.cancelRequest=async function(id){
  if(!confirm('Cancelar esta chamada?'))return;
  await update(ref(db,'serviceRequests/'+id),{status:'cancelled',updatedAt:Date.now()});
};

// ── ASSIGN ────────────────────────────────────────────────────
window.openAssign=function(reqId){
  assigningReqId=reqId;
  const req=allRequests.find(r=>r.requestId===reqId);
  if(!req)return;
  const catInfo=allCategories.find(c=>c.slug===req.categorySlug);
  document.getElementById('assign-req-info').innerHTML=`
    <strong>${esc(req.clientName)}</strong> — ${esc(req.categorySlug||'').replace('_',' ')}<br>
    ${esc(req.description)}<br>
    <small style="color:var(--muted)">${esc(req.city)}/${esc(req.uf)} · ${fmt(req.createdAt)}</small>`;
  buildProviderSelect(req.categorySlug);
  document.getElementById('assign-modal').style.display='flex';
};
window.closeAssignModal=function(e){ if(!e||e.target.id==='assign-modal') document.getElementById('assign-modal').style.display='none'; };

function buildProviderSelect(filterCat){
  const sel=document.getElementById('assign-provider-sel'); if(!sel)return;
  sel.innerHTML='<option value="">Selecione...</option>';
  const list=filterCat?allProviders.filter(p=>(p.categories||[]).includes(filterCat)):allProviders;
  list.forEach(p=>{
    const o=document.createElement('option');
    o.value=p.providerId;
    o.textContent=p.name+(p.available?' ✅':' 🔴')+' — '+p.city;
    sel.appendChild(o);
  });
}

window.doAssign=async function(){
  const provId=document.getElementById('assign-provider-sel')?.value;
  if(!provId||!assigningReqId){ showFb('assign-fb','err','Selecione um prestador.'); return; }
  const btn=document.getElementById('btn-do-assign');
  btn.disabled=true; btn.textContent='Atribuindo...';
  try{
    const now=Date.now();
    await update(ref(db,'serviceRequests/'+assigningReqId),{assignedProviderId:provId,status:'assigned',updatedAt:now});
    const r=push(ref(db,'serviceAssignments'));
    await set(r,{assignmentId:r.key,requestId:assigningReqId,providerId:provId,status:'pending',createdAt:now,doneAt:null});
    showFb('assign-fb','ok','✅ Prestador atribuído!');
    setTimeout(()=>window.closeAssignModal(),1000);
  }catch(err){
    showFb('assign-fb','err','❌ '+err.message);
  }finally{ btn.disabled=false; btn.textContent='✅ Atribuir'; }
};

// ── PROVIDERS ──────────────────────────────────────────────────
function renderProviders(){
  const el=document.getElementById('providers-list');
  if(!allProviders.length){ el.innerHTML='<div class="empty-state">Nenhum prestador cadastrado.</div>'; return; }
  el.innerHTML=`<div class="prov-list">${allProviders.map(p=>`
    <div class="prov-card">
      <div class="prov-top">
        <div class="prov-av">${(p.name||'?')[0].toUpperCase()}</div>
        <div>
          <div class="prov-name">${esc(p.name)}</div>
          <div class="prov-meta">${esc(p.city)}/${esc(p.uf)}</div>
        </div>
        <div class="avail-dot ${p.available?'yes':'no'}" title="${p.available?'Disponível':'Indisponível'}" style="margin-left:auto"></div>
      </div>
      <div class="prov-cats">${(p.categories||[]).map(c=>`<span class="cat-tag">${esc(c.replace('_',' '))}</span>`).join('')}</div>
      <div class="prov-actions">
        <a href="provider-profile.html?id=${p.providerId}" class="btn-sm">👤 Perfil</a>
        <button class="btn-sm" onclick="editProvider('${p.providerId}')">✏️ Editar</button>
        <button class="btn-sm" onclick="toggleAvail('${p.providerId}',${p.available})">${p.available?'⏸ Pausar':'▶ Ativar'}</button>
      </div>
    </div>`).join('')}</div>`;
}

window.toggleAvail=async function(id,current){ await update(ref(db,'serviceProviders/'+id),{available:!current,updatedAt:Date.now()}); };

// ── PROVIDER FORM ──────────────────────────────────────────────
window.openProviderForm=function(){ editingProvId=null; clearProvForm(); document.getElementById('prov-modal-title').textContent='Cadastrar Prestador'; document.getElementById('prov-modal').style.display='flex'; };
window.closeProvModal=function(e){ if(!e||e.target.id==='prov-modal') document.getElementById('prov-modal').style.display='none'; };
window.editProvider=function(id){
  const p=allProviders.find(x=>x.providerId===id); if(!p)return;
  editingProvId=id;
  document.getElementById('pm-name').value=p.name||'';
  document.getElementById('pm-phone').value=p.phone||'';
  document.getElementById('pm-city').value=p.city||'';
  document.getElementById('pm-uf').value=p.uf||'';
  document.getElementById('pm-area').value=p.area||'';
  document.getElementById('pm-bio').value=p.bio||'';
  document.getElementById('pm-avail').value=String(p.available!==false);
  document.getElementById('pm-wapub').value=String(p.whatsappPublic===true);
  document.querySelectorAll('.cat-check input').forEach(cb=>{ cb.checked=(p.categories||[]).includes(cb.value); });
  document.getElementById('prov-modal-title').textContent='Editar Prestador';
  document.getElementById('prov-modal').style.display='flex';
};
function clearProvForm(){
  ['pm-name','pm-phone','pm-city','pm-uf','pm-area','pm-bio'].forEach(id=>{ if(document.getElementById(id))document.getElementById(id).value=''; });
  document.querySelectorAll('.cat-check input').forEach(cb=>cb.checked=false);
  document.getElementById('pm-avail').value='true';
  document.getElementById('pm-wapub').value='false';
  document.getElementById('pm-city').value='Francisco Beltrão';
  document.getElementById('pm-uf').value='PR';
}
function buildCatCheckGrid(){
  const grid=document.getElementById('pm-cats-grid'); if(!grid)return;
  grid.innerHTML=allCategories.map(c=>`<label class="cat-check"><input type="checkbox" value="${esc(c.slug)}"> ${esc(c.emoji||'')} ${esc(c.name)}</label>`).join('');
}

window.saveProvider=async function(){
  const name=(document.getElementById('pm-name')?.value||'').trim();
  const phone=(document.getElementById('pm-phone')?.value||'').replace(/\D/g,'');
  const city=(document.getElementById('pm-city')?.value||'').trim();
  const uf=(document.getElementById('pm-uf')?.value||'').trim().toUpperCase();
  const area=(document.getElementById('pm-area')?.value||'').trim();
  const bio=(document.getElementById('pm-bio')?.value||'').trim();
  const avail=document.getElementById('pm-avail')?.value==='true';
  const wapub=document.getElementById('pm-wapub')?.value==='true';
  const cats=[...document.querySelectorAll('.cat-check input:checked')].map(cb=>cb.value);
  if(!name){ showFb('prov-fb','err','⚠️ Nome obrigatório.'); return; }
  if(!city){ showFb('prov-fb','err','⚠️ Cidade obrigatória.'); return; }
  const btn=document.getElementById('btn-save-prov');
  btn.disabled=true; btn.textContent='Salvando...';
  try{
    const now=Date.now();
    if(editingProvId){
      await update(ref(db,'serviceProviders/'+editingProvId),{name,phone,city,uf,area,bio,available:avail,whatsappPublic:wapub,categories:cats,updatedAt:now});
    } else {
      const r=push(ref(db,'serviceProviders'));
      await set(r,{providerId:r.key,name,phone,city,uf,area,bio,available:avail,whatsappPublic:wapub,categories:cats,rating:0,ratingCount:0,createdAt:now,updatedAt:now});
    }
    showFb('prov-fb','ok','✅ Prestador salvo!');
    setTimeout(()=>window.closeProvModal(),900);
  }catch(err){ showFb('prov-fb','err','❌ '+err.message); }
  finally{ btn.disabled=false; btn.textContent='💾 Salvar'; }
};

// ── CATEGORIES ────────────────────────────────────────────────
function renderCategories(){
  const el=document.getElementById('categories-list'); if(!el)return;
  el.innerHTML=`<div class="cat-list">${allCategories.map(c=>{
    const cnt=allProviders.filter(p=>(p.categories||[]).includes(c.slug)).length;
    return `<div class="cat-admin-card">
      <div class="cat-em">${c.emoji}</div>
      <div>
        <div class="cat-cn">${esc(c.name)}</div>
        <div class="cat-pm">${esc(c.desc||'')}</div>
        <div class="cat-pc">${cnt} prestador${cnt!==1?'es':''}</div>
      </div>
    </div>`;
  }).join('')}</div>`;
}
