import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, get, set, update, push } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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

// ── HELPERS ───────────────────────────────────────────────────────────────────
function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function slugify(s){ return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
function randId(){ return Math.random().toString(36).slice(2,10); }
function normalizeWa(w){ return (w||'').replace(/\D/g,''); }
function normalizeInstagram(v){
  if(!v) return '';
  if(v.startsWith('@')) return 'https://instagram.com/'+v.slice(1);
  if(!v.startsWith('http')) return 'https://instagram.com/'+v;
  return v;
}
function normalizeUrl(u){
  if(!u) return '';
  if(!u.startsWith('http')) return 'https://'+u;
  return u;
}

// ── ADMIN GATE ────────────────────────────────────────────────────────────────
const ADMIN_KEY = 'cidadeonline2026';

window.setAdminKey = function(){
  const val = document.getElementById('admin-key-input')?.value.trim();
  if(val === ADMIN_KEY){
    localStorage.setItem('ir_admin', val);
    unlockPanel();
  } else {
    alert('Chave incorreta.');
  }
};

function unlockPanel(){
  document.getElementById('locked-msg').style.display = 'none';
  document.getElementById('main-panel').style.display = 'block';
  document.getElementById('admin-gate').style.display = 'none';
  document.getElementById('admin-label').style.display = '';
  init();
}

// ── BOOT ──────────────────────────────────────────────────────────────────────
if(localStorage.getItem('ir_admin') === ADMIN_KEY){
  unlockPanel();
}

// ── STATE ─────────────────────────────────────────────────────────────────────
let allCandidates = [];
let _dupTarget = null;

// ── INIT ──────────────────────────────────────────────────────────────────────
function init(){
  loadStatesFilter();
  setupFilters();
  listenCandidates();
}

// ── GEO ───────────────────────────────────────────────────────────────────────
const BR_STATES=[{uf:'PR',name:'Paraná'},{uf:'SC',name:'Santa Catarina'},{uf:'SP',name:'São Paulo'},{uf:'RS',name:'Rio Grande do Sul'},{uf:'MG',name:'Minas Gerais'},{uf:'RJ',name:'Rio de Janeiro'},{uf:'BA',name:'Bahia'},{uf:'GO',name:'Goiás'},{uf:'MT',name:'Mato Grosso'},{uf:'MS',name:'Mato Grosso do Sul'},{uf:'CE',name:'Ceará'},{uf:'PE',name:'Pernambuco'},{uf:'AM',name:'Amazonas'},{uf:'PA',name:'Pará'},{uf:'MA',name:'Maranhão'},{uf:'PI',name:'Piauí'},{uf:'RN',name:'Rio Grande do Norte'},{uf:'PB',name:'Paraíba'},{uf:'SE',name:'Sergipe'},{uf:'AL',name:'Alagoas'},{uf:'TO',name:'Tocantins'},{uf:'RO',name:'Rondônia'},{uf:'AP',name:'Amapá'},{uf:'RR',name:'Roraima'},{uf:'AC',name:'Acre'},{uf:'DF',name:'Distrito Federal'},{uf:'ES',name:'Espírito Santo'}];

function loadStatesFilter(){
  const sel = document.getElementById('f-uf');
  sel.innerHTML = '<option value="">Todos os estados</option>'
    + BR_STATES.map(s=>`<option value="${s.uf}">${s.name} (${s.uf})</option>`).join('');
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

// ── FILTERS ───────────────────────────────────────────────────────────────────
function setupFilters(){
  ['f-city','f-type','f-status'].forEach(id=>document.getElementById(id)?.addEventListener('change',applyFilters));
  let d; document.getElementById('f-name')?.addEventListener('input',()=>{clearTimeout(d);d=setTimeout(applyFilters,200);});
}

function applyFilters(){
  const name   = (document.getElementById('f-name')?.value||'').toLowerCase();
  const uf     = document.getElementById('f-uf')?.value||'';
  const city   = document.getElementById('f-city')?.value||'';
  const type   = document.getElementById('f-type')?.value||'';
  const status = document.getElementById('f-status')?.value||'';

  const filtered = allCandidates.filter(c=>{
    if(name   && !(c.name||'').toLowerCase().includes(name)) return false;
    if(uf     && c.uf !== uf) return false;
    if(city   && c.citySlug !== city) return false;
    if(type   && c.channelType !== type) return false;
    if(status && c.reviewStatus !== status) return false;
    return true;
  }).sort((a,b)=>{
    const order={pending:0,approved:1,published:2,rejected:3,duplicate:4};
    return (order[a.reviewStatus]||5)-(order[b.reviewStatus]||5);
  });

  renderList(filtered);
}

// ── LISTEN ────────────────────────────────────────────────────────────────────
function listenCandidates(){
  onValue(ref(db,'cityImportCandidates'), snap=>{
    const data = snap.val()||{};
    allCandidates = Object.values(data);
    updateCounters(allCandidates);
    applyFilters();
  });
}

function updateCounters(list){
  const count = s => list.filter(c=>c.reviewStatus===s).length;
  document.getElementById('cnt-total').querySelector('span').textContent = list.length;
  document.getElementById('cnt-pending').querySelector('span').textContent = count('pending');
  document.getElementById('cnt-published').querySelector('span').textContent = count('published');
  document.getElementById('cnt-rejected').querySelector('span').textContent = count('rejected');
  document.getElementById('cnt-duplicate').querySelector('span').textContent = count('duplicate');
}

// ── RENDER ────────────────────────────────────────────────────────────────────
const STATUS_LABELS = {pending:'⏳ Pendente',approved:'✓ Aprovado',published:'✅ Publicado',rejected:'❌ Rejeitado',duplicate:'🔁 Duplicata'};
const TYPE_LABELS   = {commerce:'🏪 Comércio',radio:'📻 Rádio',service:'⚙️ Serviço',church:'⛪ Igreja',school:'🏫 Escola',realstate:'🏠 Imobiliária',news:'📰 Portal',creator:'🎙️ Criador'};

function renderList(list){
  const el = document.getElementById('candidates-list');
  const meta = document.getElementById('results-meta');
  meta.textContent = list.length+' candidato'+(list.length!==1?'s':'');
  if(!list.length){
    el.innerHTML='<div class="empty-state"><span>🔍</span>Nenhum candidato encontrado.</div>';
    return;
  }
  el.innerHTML = list.map(c=>{
    const statusBadge = `<span class="badge badge-${c.reviewStatus}">${STATUS_LABELS[c.reviewStatus]||c.reviewStatus}</span>`;
    const typeBadge   = `<span class="badge badge-type">${TYPE_LABELS[c.channelType]||c.channelType||'?'}</span>`;
    const srcBadge    = c.sourceRaw?`<span class="badge badge-source">${esc(c.sourceRaw)}</span>`:'';
    const isPending   = c.reviewStatus==='pending'||c.reviewStatus==='approved';
    const isPublished = c.reviewStatus==='published';
    const viewLink    = isPublished&&c.publishedProfileId
      ? `<div class="cand-published-link">Perfil: <a href="profile.html?pid=${esc(c.publishedProfileId)}" target="_blank">${esc(c.publishedProfileId)}</a></div>` : '';
    return `<div class="cand-card status-${c.reviewStatus}" id="cand-${esc(c.candidateId)}">
      <div class="cand-header">
        <div>
          <div class="cand-title">${esc(c.name)}</div>
          <div class="cand-meta">${esc(c.category||'')} · ${esc(c.city||'')}/${esc(c.uf||'')} · ${esc(c.neighborhood||'')}</div>
        </div>
        <div class="cand-badges">${statusBadge}${typeBadge}${srcBadge}</div>
      </div>
      <div class="cand-details">
        ${field('Categoria', c.category)}
        ${field('Bairro', c.neighborhood)}
        ${field('Telefone', c.phone)}
        ${field('WhatsApp', c.whatsapp ? `<a href="https://wa.me/${normalizeWa(c.whatsapp)}" target="_blank">${esc(c.whatsapp)}</a>` : '', true)}
        ${field('Instagram', c.instagram ? `<a href="${esc(normalizeInstagram(c.instagram))}" target="_blank">${esc(c.instagram)}</a>` : '', true)}
        ${field('Site', c.website ? `<a href="${esc(normalizeUrl(c.website))}" target="_blank">${esc(c.website)}</a>` : '', true)}
        ${field('Google Maps', c.googleMapsUrl ? `<a href="${esc(c.googleMapsUrl)}" target="_blank">Abrir</a>` : '', true)}
        ${field('Descrição', c.description)}
        ${field('Job', c.jobId)}
        ${c.duplicateOf?field('Duplicata de', c.duplicateOf):''}
      </div>
      ${viewLink}
      <div class="cand-actions">
        ${isPending?`<button class="btn-action btn-publish" onclick="publishCandidate('${esc(c.candidateId)}')">✅ Publicar</button>`:''}
        ${isPending?`<button class="btn-action btn-reject" onclick="rejectCandidate('${esc(c.candidateId)}')">❌ Rejeitar</button>`:''}
        ${isPending?`<button class="btn-action btn-dup" onclick="openDupModal('${esc(c.candidateId)}')">🔁 Duplicata</button>`:''}
        ${isPublished?`<a class="btn-action btn-view" href="profile.html?pid=${esc(c.publishedProfileId)}" target="_blank">👤 Ver perfil</a>`:''}
      </div>
    </div>`;
  }).join('');
}

function field(label, val, raw=false){
  if(!val) return '';
  return `<div class="cand-field"><strong>${label}</strong>${raw?val:esc(val)}</div>`;
}

// ── PUBLISH ───────────────────────────────────────────────────────────────────
window.publishCandidate = async function(candidateId){
  const c = allCandidates.find(x=>x.candidateId===candidateId);
  if(!c){ alert('Candidato não encontrado.'); return; }
  if(c.reviewStatus==='published'){ alert('Já publicado.'); return; }

  // Anti-duplicidade: normalizedName+citySlug+uf
  const slug = slugify(c.name);
  const existSnap = await get(ref(db,'profiles'));
  const allProfiles = existSnap.val()||{};
  const duplicate = Object.values(allProfiles).find(p=>
    slugify(p.name||'')=== slug && p.citySlug===c.citySlug && p.uf===c.uf
  );
  if(duplicate){
    if(!confirm(`Perfil similar já existe: "${duplicate.name}" (${duplicate.profileId}). Publicar mesmo assim?`)) return;
  }

  const profileId = 'biz_'+c.citySlug+'_'+slug+'_'+randId();
  const now = Date.now();

  // profiles/
  await set(ref(db,'profiles/'+profileId),{
    profileId, type:'business',
    name: c.name, slug,
    bio: c.description||'',
    city: c.city, citySlug: c.citySlug, uf: c.uf, stateName: c.stateName||'',
    category: c.category||'', categorySlug: c.categorySlug||slugify(c.category||''),
    photoURL: c.photoURL||'', coverURL:'',
    whatsapp: normalizeWa(c.whatsapp),
    instagram: normalizeInstagram(c.instagram),
    website: normalizeUrl(c.website),
    facebook: c.facebook||'',
    tiktok:'', youtube:'',
    claimStatus:'unclaimed', verificationStatus:'unverified',
    ownerUid:'', verified:false,
    importedFrom: candidateId, importedJob: c.jobId||'',
    createdAt:now, updatedAt:now
  });

  // businessProfiles/
  await set(ref(db,'businessProfiles/'+profileId),{
    businessId:profileId, profileId,
    name:c.name, category:c.category||'', categorySlug:c.categorySlug||slugify(c.category||''),
    city:c.city, citySlug:c.citySlug, uf:c.uf, stateName:c.stateName||'',
    whatsapp:normalizeWa(c.whatsapp), description:c.description||'',
    claimed:false, active:true, priority:c.priority||50, createdAt:now
  });

  // profileLinks/ automáticos
  let order=1;
  if(c.whatsapp){
    await push(ref(db,'profileLinks/'+profileId),{title:'WhatsApp',url:'https://wa.me/'+normalizeWa(c.whatsapp),type:'whatsapp',icon:'whatsapp',order:order++,active:true,createdAt:now});
  }
  if(c.instagram){
    await push(ref(db,'profileLinks/'+profileId),{title:'Instagram',url:normalizeInstagram(c.instagram),type:'instagram',icon:'instagram',order:order++,active:true,createdAt:now});
  }
  if(c.website){
    await push(ref(db,'profileLinks/'+profileId),{title:'Site',url:normalizeUrl(c.website),type:'website',icon:'website',order:order++,active:true,createdAt:now});
  }
  if(c.googleMapsUrl){
    await push(ref(db,'profileLinks/'+profileId),{title:'Google Maps',url:c.googleMapsUrl,type:'google_maps',icon:'google_maps',order:order++,active:true,createdAt:now});
  }
  if(c.facebook){
    await push(ref(db,'profileLinks/'+profileId),{title:'Facebook',url:c.facebook,type:'facebook',icon:'facebook',order:order++,active:true,createdAt:now});
  }

  // Atualizar candidato
  await update(ref(db,'cityImportCandidates/'+candidateId),{
    reviewStatus:'published', publishedProfileId:profileId,
    publishedAt:now, reviewedAt:now
  });

  alert('✅ Publicado! profileId: '+profileId);
};

// ── REJECT ────────────────────────────────────────────────────────────────────
window.rejectCandidate = async function(candidateId){
  if(!confirm('Rejeitar este candidato?')) return;
  await update(ref(db,'cityImportCandidates/'+candidateId),{
    reviewStatus:'rejected', reviewedAt:Date.now()
  });
};

// ── DUPLICATE ─────────────────────────────────────────────────────────────────
window.openDupModal = function(candidateId){
  _dupTarget = candidateId;
  document.getElementById('dup-of-input').value='';
  document.getElementById('dup-modal').style.display='flex';
};
window.closeDupModal = function(){
  document.getElementById('dup-modal').style.display='none';
  _dupTarget=null;
};
window.confirmDuplicate = async function(){
  if(!_dupTarget) return;
  const dupOf = document.getElementById('dup-of-input').value.trim();
  await update(ref(db,'cityImportCandidates/'+_dupTarget),{
    reviewStatus:'duplicate', duplicateOf:dupOf||'', reviewedAt:Date.now()
  });
  closeDupModal();
};

// ── SEED ──────────────────────────────────────────────────────────────────────
const SEED_JOB = {
  jobId:'job_francisco_beltrao_pr_2026',
  city:'Francisco Beltrão', citySlug:'francisco-beltrao',
  uf:'PR', stateName:'Paraná',
  source:'manual', status:'in_review',
  totalCandidates:15, publishedCount:0, rejectedCount:0,
  createdAt:Date.now(), updatedAt:Date.now(), createdBy:'operador', notes:'Batch inicial'
};

const SEED_CANDIDATES = [
  {name:'Supermercado Bom Preço',category:'Supermercado',categorySlug:'supermercado',channelType:'commerce',whatsapp:'5546991110001',description:'Supermercado com ampla variedade e preços imbatíveis.'},
  {name:'Supermercado Rech',category:'Supermercado',categorySlug:'supermercado',channelType:'commerce',whatsapp:'5546991110002',description:'Filial central com açougue e padaria própria.'},
  {name:'Farmácia Saúde Total',category:'Farmácia',categorySlug:'farmacia',channelType:'commerce',whatsapp:'5546991110003',description:'Medicamentos, dermocosméticos e atendimento rápido.'},
  {name:'Farmácia Popular Beltrão',category:'Farmácia',categorySlug:'farmacia',channelType:'commerce',whatsapp:'5546991110004',description:'Remédios com desconto e convênio PBM.'},
  {name:'Pizzaria Bella Napoli',category:'Restaurante',categorySlug:'restaurante',channelType:'commerce',whatsapp:'5546991110005',description:'Pizzas artesanais e delivery na região central.',instagram:'@bellanapoli.beltrao'},
  {name:'Restaurante Sabor da Serra',category:'Restaurante',categorySlug:'restaurante',channelType:'commerce',whatsapp:'5546991110006',description:'Almoço executivo e buffet por kg. Seg a sáb.'},
  {name:'Padaria Pão & Arte',category:'Padaria',categorySlug:'padaria',channelType:'commerce',whatsapp:'5546991110007',description:'Pão fresquinho, salgados e café colonial.'},
  {name:'Barbearia do Deco',category:'Salão de Beleza',categorySlug:'salao',channelType:'service',whatsapp:'5546991110008',description:'Corte masculino, barba e design. Agendamento pelo WhatsApp.'},
  {name:'Salão Espaço Beleza',category:'Salão de Beleza',categorySlug:'salao',channelType:'commerce',whatsapp:'5546991110009',description:'Corte, escova, coloração e tratamentos capilares.',instagram:'@espacobeleza.beltrao'},
  {name:'Academia Fit Life',category:'Academia',categorySlug:'academia',channelType:'commerce',whatsapp:'5546991110010',description:'Musculação, funcional e aulas em grupo. Horários flexíveis.'},
  {name:'Pet Shop Bicho Feliz',category:'Pet Shop',categorySlug:'petshop',channelType:'commerce',whatsapp:'5546991110011',description:'Banho, tosa, veterinário e ração para pets.'},
  {name:'Oficina do Zé Mecânico',category:'Mecânica',categorySlug:'mecanica',channelType:'service',whatsapp:'5546991110012',description:'Revisão, funilaria e mecânica geral.'},
  {name:'Clínica Saúde Familiar',category:'Saúde/Clinica',categorySlug:'saude',channelType:'service',whatsapp:'5546991110013',description:'Consultas, exames e atendimento geral.'},
  {name:'Imobiliária Lar Ideal',category:'Contabilidade',categorySlug:'servicos',channelType:'realstate',whatsapp:'5546991110014',description:'Compra, venda e locação de imóveis em Francisco Beltrão e região.'},
  {name:'Rádio Regional FM',category:'Rádio',categorySlug:'servicos',channelType:'radio',whatsapp:'5546991110015',description:'Rádio local com programação regional ao vivo.',instagram:'@radioregionalfm'},
];

window.runSeed = async function(){
  if(!confirm('Executar seed de 15 candidatos para Francisco Beltrão/PR?')) return;
  // Job
  const jobSnap = await get(ref(db,'cityImportJobs/'+SEED_JOB.jobId));
  if(!jobSnap.exists()) await set(ref(db,'cityImportJobs/'+SEED_JOB.jobId), SEED_JOB);

  // Candidatos
  const now = Date.now();
  for(const [i,s] of SEED_CANDIDATES.entries()){
    const cid = 'cand_fbeltrao_'+String(i+1).padStart(3,'0');
    const snap = await get(ref(db,'cityImportCandidates/'+cid));
    if(snap.exists()) continue;
    await set(ref(db,'cityImportCandidates/'+cid),{
      candidateId:cid, jobId:SEED_JOB.jobId,
      channelType:s.channelType, name:s.name,
      category:s.category, categorySlug:s.categorySlug,
      city:'Francisco Beltrão', citySlug:'francisco-beltrao',
      uf:'PR', stateName:'Paraná',
      neighborhood:'Centro', address:'',
      phone:'', whatsapp:s.whatsapp||'',
      instagram:s.instagram||'', facebook:'', website:'', googleMapsUrl:'',
      description:s.description||'', photoURL:'',
      sourceRaw:'manual', reviewStatus:'pending',
      reviewedBy:'', reviewedAt:null, publishedProfileId:'', duplicateOf:'',
      priority:80-i*2, tags:[], createdAt:now, updatedAt:now, createdBy:'operador'
    });
  }
  alert('🌱 Seed concluído! 15 candidatos criados.');
};
