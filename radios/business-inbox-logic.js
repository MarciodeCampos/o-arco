import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, get, set, update, push } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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

// ── HELPERS ───────────────────────────────────────────────────────────────────
function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmt(ts){ if(!ts) return ''; const d=new Date(ts); return d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}); }

// ── STATE ─────────────────────────────────────────────────────────────────────
let currentUser    = null;
let myBizList      = [];    // perfis business do usuário logado
let activeBizId    = null;  // business selecionado
let allConversations = [];
let activeConv     = null;
let statusFilter   = '';
let msgUnsubscribe = null;
let convUnsubscribe = null;

// ── AUTH ──────────────────────────────────────────────────────────────────────
window.doLogin = async function(){
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider).catch(e=>alert('Erro: '+e.message));
};

onAuthStateChanged(auth, async user=>{
  currentUser = user;
  if(!user){
    show('auth-gate'); hide('no-biz-gate'); hide('main-inbox'); return;
  }
  await loadMyBusinesses(user.uid);
});

async function loadMyBusinesses(uid){
  const snap = await get(ref(db,'profiles'));
  const all  = snap.val()||{};
  myBizList  = Object.values(all).filter(p=>p.type==='business' && p.ownerUid===uid);
  if(!myBizList.length){
    show('no-biz-gate'); hide('auth-gate'); hide('main-inbox'); return;
  }
  hide('auth-gate'); hide('no-biz-gate'); show('main-inbox');
  // Selector
  const sel = document.getElementById('biz-selector');
  if(myBizList.length>1){
    show('biz-selector-bar');
    sel.innerHTML = myBizList.map(b=>`<option value="${esc(b.profileId)}">${esc(b.name)}</option>`).join('');
    sel.onchange = ()=>{ activeBizId=sel.value; startInbox(); };
  }
  activeBizId = myBizList[0].profileId;
  document.getElementById('biz-name-header').textContent = myBizList[0].name||'';
  startInbox();
}

// ── INBOX ─────────────────────────────────────────────────────────────────────
function startInbox(){
  if(convUnsubscribe) convUnsubscribe();
  convUnsubscribe = onValue(ref(db,'businessInbox/'+activeBizId), snap=>{
    const data = snap.val()||{};
    allConversations = Object.values(data).sort((a,b)=>(b.lastMessageAt||0)-(a.lastMessageAt||0));
    updateCounters();
    renderConvList();
  });

  // Filtros
  let d;
  document.getElementById('conv-search')?.addEventListener('input',()=>{clearTimeout(d);d=setTimeout(renderConvList,200);});
}

// ── COUNTERS ──────────────────────────────────────────────────────────────────
function updateCounters(){
  const count = s=>allConversations.filter(c=>c.status===s).length;
  document.getElementById('cnt-all').textContent   = allConversations.length;
  document.getElementById('cnt-aberto').textContent       = count('aberto');
  document.getElementById('cnt-respondido').textContent   = count('respondido');
  document.getElementById('cnt-aguardando').textContent   = count('aguardando_cliente');
  document.getElementById('cnt-resolvido').textContent    = count('resolvido');
  document.getElementById('cnt-arquivado').textContent    = count('arquivado');
}

window.setStatusFilter = function(el, val){
  statusFilter = val;
  document.querySelectorAll('.counter-card').forEach(c=>c.classList.remove('active-filter'));
  el.classList.add('active-filter');
  renderConvList();
};

// ── CONV LIST ─────────────────────────────────────────────────────────────────
function renderConvList(){
  const search = (document.getElementById('conv-search')?.value||'').toLowerCase();
  const filtered = allConversations.filter(c=>{
    if(statusFilter && c.status!==statusFilter) return false;
    if(search && !(c.customerName||'').toLowerCase().includes(search)) return false;
    return true;
  });
  const el = document.getElementById('conv-list');
  if(!filtered.length){
    el.innerHTML='<div class="empty-state"><span>💬</span>Nenhuma conversa aqui.</div>'; return;
  }
  el.innerHTML = filtered.map(c=>`
    <div class="conv-item ${c.unread?'unread':''} ${activeConv?.chatId===c.chatId?'active':''}"
         onclick="openConv('${esc(c.chatId)}')">
      <div class="conv-customer">
        <span class="conv-status-dot dot-${esc(c.status||'aberto')}"></span>
        ${esc(c.customerName||'Cliente')}
      </div>
      <div class="conv-preview">${esc(c.lastMessage||'Conversa iniciada')}</div>
      <div class="conv-time">${fmt(c.lastMessageAt)}</div>
    </div>`).join('');
}

// ── OPEN CONV ─────────────────────────────────────────────────────────────────
window.openConv = function(chatId){
  activeConv = allConversations.find(c=>c.chatId===chatId);
  if(!activeConv) return;

  // Mark as read
  update(ref(db,'businessInbox/'+activeBizId+'/'+chatId),{unread:false}).catch(()=>{});

  // UI
  hide('chat-empty'); show('chat-active');
  document.getElementById('chat-customer-name').textContent = activeConv.customerName||'Cliente';
  document.getElementById('chat-customer-meta').textContent = 'Chat ID: '+chatId+' · '+fmt(activeConv.createdAt);
  document.getElementById('status-select').value = activeConv.status||'aberto';
  document.getElementById('saved-note').textContent = activeConv.notes ? '📝 '+activeConv.notes : '';
  document.getElementById('notes-input').value = activeConv.notes||'';
  renderConvList(); // refresh para marcar active

  // Messages
  if(msgUnsubscribe) msgUnsubscribe();
  msgUnsubscribe = onValue(ref(db,'directChats/'+chatId+'/messages'), snap=>{
    const msgs = Object.values(snap.val()||{}).sort((a,b)=>(a.ts||0)-(b.ts||0));
    const box = document.getElementById('chat-msgs');
    if(!msgs.length){ box.innerHTML='<div class="empty-state"><span>👋</span>Sem mensagens.</div>'; return; }
    box.innerHTML = msgs.map(m=>{
      // business pid = activeBizId; cliente = outros
      const isBiz = m.from===activeBizId || m.to===activeConv.customerUid;
      const cls   = isBiz?'biz-bubble':'customer-bubble';
      return `<div class="${cls}">${esc(m.text||'')}<div class="bubble-time">${fmt(m.ts)}</div></div>`;
    }).join('');
    box.scrollTop=box.scrollHeight;
  });
};

window.closeChat = function(){
  if(msgUnsubscribe){ msgUnsubscribe(); msgUnsubscribe=null; }
  activeConv=null;
  hide('chat-active'); show('chat-empty');
  renderConvList();
};

// ── STATUS ────────────────────────────────────────────────────────────────────
window.changeStatus = async function(val){
  if(!activeConv||!activeBizId) return;
  await update(ref(db,'businessInbox/'+activeBizId+'/'+activeConv.chatId),{
    status:val, updatedAt:Date.now()
  });
  activeConv.status=val;
};

// ── NOTES ─────────────────────────────────────────────────────────────────────
window.saveNote = async function(){
  if(!activeConv) return;
  const note = document.getElementById('notes-input').value.trim();
  await update(ref(db,'businessInbox/'+activeBizId+'/'+activeConv.chatId),{
    notes:note, updatedAt:Date.now()
  });
  document.getElementById('saved-note').textContent = note ? '📝 '+note : '';
  activeConv.notes=note;
};

// ── REPLY ─────────────────────────────────────────────────────────────────────
window.sendReply = async function(){
  if(!activeConv||!activeBizId) return;
  const inp = document.getElementById('reply-input');
  const text = inp.value.trim();
  if(!text) return;
  inp.value='';
  const now = Date.now();
  const chatId = activeConv.chatId;
  const bizPid = activeBizId;
  const customerUid = activeConv.customerUid;

  // Mensagem no directChat
  await push(ref(db,'directChats/'+chatId+'/messages'),{
    from:bizPid, to:customerUid, text, ts:now
  });
  // userInbox do cliente
  await set(ref(db,'userInbox/'+customerUid+'/'+chatId),{
    with:bizPid, name:myBizList.find(b=>b.profileId===bizPid)?.name||'Comércio',
    lastMessage:text, ts:now, unread:true
  });
  // businessInbox atualiza
  await update(ref(db,'businessInbox/'+bizPid+'/'+chatId),{
    lastMessage:text, lastMessageAt:now, status:'respondido', updatedAt:now
  });
};

// ── UTIL ──────────────────────────────────────────────────────────────────────
function show(id){ const el=document.getElementById(id); if(el) el.style.display=''; }
function hide(id){ const el=document.getElementById(id); if(el) el.style.display='none'; }
