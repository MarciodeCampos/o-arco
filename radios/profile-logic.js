import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, set, get, push, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth, signInAnonymously, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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

const params    = new URLSearchParams(location.search);
const targetPid = params.get('pid') || '';

let _myPid     = localStorage.getItem('spes_pid') || '';
let _myChatId  = null;
let _theirPid  = null;
let _dmListener = null;

// ── HELPERS ───────────────────────────────────────────────────────────────────
function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmt(ts){ return ts ? new Date(ts).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : ''; }
function dmChatId(a,b){ return [a,b].sort().join('_'); }
function normalizeUrl(u){ if(!u) return '#'; return (u.startsWith('http')?u:'https://'+u); }

function getTypeLabel(t){
  return {user:'Usuário',business:'Comércio',artist:'Artista',songwriter:'Compositor',
    producer:'Produtor',announcer:'Locutor',sponsor:'Patrocinador',radio:'Rádio'}[t] || 'Perfil';
}
function getTypeClass(t){
  return {user:'type-user',business:'type-business',artist:'type-artist',radio:'type-radio'}[t] || 'type-user';
}
function getCoverClass(t){
  return {user:'cover-type-user',business:'cover-type-business',artist:'cover-type-artist',radio:'cover-type-radio'}[t] || 'cover-type-user';
}
function getLinkTypeLabel(t){
  const m={website:'Site',whatsapp:'WhatsApp',instagram:'Instagram',youtube:'YouTube',
    tiktok:'TikTok',facebook:'Facebook',spotify:'Spotify',deezer:'Deezer',
    soundcloud:'SoundCloud',telegram:'Telegram',google_maps:'Mapa',menu:'Cardápio',
    catalog:'Catálogo',store:'Loja',booking:'Agendamento',radio:'Rádio',
    live:'Ao vivo',video:'Vídeo',post:'Post',playlist:'Playlist',payment:'Pagamento',custom:'Link'};
  return m[t]||'Link';
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
signInAnonymously(auth).catch(()=>{});
onAuthStateChanged(auth, async user => {
  if(!user) return;
  if(!_myPid){
    _myPid = 'p_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('spes_pid', _myPid);
  }
  const pid = targetPid || _myPid;
  await ensureProfile(pid, user);
  loadPage(pid, user);
  if(pid === _myPid){ watchUnread(); }
});

// ── ENSURE PROFILE ────────────────────────────────────────────────────────────
async function ensureProfile(pid, user){
  const snap = await get(ref(db, 'profiles/' + pid));
  if(snap.exists()) return;
  // Fallback: check old users/ path
  const oldSnap = await get(ref(db, 'users/' + pid));
  if(oldSnap.exists()){
    const o = oldSnap.val();
    await set(ref(db,'profiles/'+pid), {
      profileId:pid, type:'user', name:o.name||'Ouvinte', slug:'',
      photoURL:o.photo||o.photoURL||'', coverURL:'', bio:o.bio||'',
      city:o.city||'', uf:'', category:'', verified:o.verified||false,
      ownerUid:o.uid||user.uid, whatsapp:'', instagram:'', youtube:'',
      tiktok:'', facebook:'', website:'',
      currentRadioId:o.radioId||'', currentRadioName:o.radioName||'',
      status:'online', createdAt:Date.now(), updatedAt:Date.now()
    });
    return;
  }
  // Only auto-create for own profile
  if(pid !== _myPid) return;
  await set(ref(db,'profiles/'+pid), {
    profileId:pid, type:'user',
    name:user.displayName||localStorage.getItem('spes_chat_nick')||'Ouvinte',
    slug:'', photoURL:user.photoURL||'', coverURL:'', bio:'',
    city:'', uf:'', category:'', verified:!!(user.providerData&&user.providerData.length),
    ownerUid:user.uid, whatsapp:'', instagram:'', youtube:'',
    tiktok:'', facebook:'', website:'',
    currentRadioId:'', currentRadioName:'',
    status:'online', createdAt:Date.now(), updatedAt:Date.now()
  });
}

// ── LOAD PAGE ─────────────────────────────────────────────────────────────────
function loadPage(pid, user){
  const isOwn = pid === _myPid;
  document.getElementById('own-tag').style.display = isOwn ? 'block' : 'none';

  if(isOwn){
    document.getElementById('dms-link').style.display = 'flex';
    document.getElementById('inbox-section').style.display = 'block';
    const isGoogle = user.providerData && user.providerData.length > 0;
    if(!isGoogle) document.getElementById('login-banner').style.display = 'flex';
    loadInbox();
    document.getElementById('edit-section') && fillEditFields();
  }

  // Listen profile
  onValue(ref(db,'profiles/'+pid), snap => {
    const p = snap.val();
    if(!p){ renderNotFound(); return; }
    renderProfile(p, isOwn, user);
  });

  // Listen linktree
  listenLinktree(pid);
  // Listen posts
  listenPosts(pid);
  // Listen presence
  listenPresence(pid);
}

// ── RENDER PROFILE ────────────────────────────────────────────────────────────
function renderProfile(p, isOwn, user){
  document.getElementById('pg-title').textContent = (p.name||'Perfil') + ' | triadic.life';
  document.getElementById('page-title-text').textContent = isOwn ? 'Meu Perfil' : (p.name||'Perfil');
  document.getElementById('profile-name').textContent = p.name||'Ouvinte';

  const tb = document.getElementById('type-badge');
  tb.textContent = getTypeLabel(p.type);
  tb.className = 'type-badge ' + getTypeClass(p.type);

  document.getElementById('verified-badge').style.display = p.verified ? 'inline-block' : 'none';

  const cover = document.getElementById('cover-wrap');
  cover.className = 'cover-wrap ' + getCoverClass(p.type);
  if(p.coverURL) cover.innerHTML = `<img src="${esc(p.coverURL)}" alt="capa"><div class="avatar-float" id="avatar-float"></div>`;

  const av = document.getElementById('avatar-float');
  if(av){
    if(p.photoURL){
      av.innerHTML = `<img src="${esc(p.photoURL)}" alt="${esc(p.name)}">`;
    } else {
      av.textContent = (p.name||'?')[0].toUpperCase();
    }
  }

  const meta = [];
  if(p.category) meta.push(p.category);
  if(p.city && p.uf) meta.push(p.city+'/'+p.uf);
  else if(p.city) meta.push(p.city);
  document.getElementById('profile-meta').textContent = meta.join(' · ');
  document.getElementById('profile-bio').textContent = p.bio||'';

  renderActions(p, isOwn, user);
  renderSocialLinks(p);
}

function renderActions(p, isOwn, user){
  const el = document.getElementById('profile-actions');
  if(isOwn){
    el.innerHTML = `<button class="btn-secondary" onclick="toggleEdit()">✏️ Editar perfil</button>`;
  } else {
    let html = `<button class="btn-primary" onclick="openDMWith('${esc(p.profileId)}','${esc(p.name||'Usuário')}','${esc(p.photoURL||'')}')">💬 Mensagem</button>`;
    const radioId = params.get('radioId')||'';
    const radioName = params.get('radioName')||'';
    if(radioId) html += `<button class="btn-secondary" onclick="sendRadioInvite('${esc(p.profileId)}','${esc(p.name||'')}','${esc(radioId)}','${esc(radioName)}')">📻 Convidar para rádio</button>`;
    if(p.whatsapp) html += `<a class="btn-whatsapp" href="https://wa.me/${p.whatsapp.replace(/\D/g,'')}" target="_blank" rel="noopener">WhatsApp</a>`;
    el.innerHTML = html;
  }
}

function renderSocialLinks(p){
  const items = [
    ['Instagram', p.instagram],['YouTube', p.youtube],['TikTok', p.tiktok],
    ['Facebook', p.facebook],['Site', p.website]
  ].filter(([,u])=>u);
  const sec = document.getElementById('social-section');
  const pills = document.getElementById('social-pills');
  if(!items.length){ sec.style.display='none'; return; }
  sec.style.display = 'block';
  pills.innerHTML = items.map(([l,u])=>`<a class="social-pill" href="${esc(normalizeUrl(u))}" target="_blank" rel="noopener">${esc(l)}</a>`).join('');
}

// ── LINKTREE ──────────────────────────────────────────────────────────────────
function listenLinktree(pid){
  onValue(ref(db,'profileLinks/'+pid), snap => {
    const data = snap.val()||{};
    const links = Object.entries(data)
      .map(([k,v])=>({linkId:k,...v}))
      .filter(l=>l.active!==false)
      .sort((a,b)=>(a.order||999)-(b.order||999));
    const sec = document.getElementById('linktree-section');
    const list = document.getElementById('linktree-list');
    if(!links.length){ sec.style.display='none'; return; }
    sec.style.display='block';
    list.innerHTML = links.map(l=>`
      <a class="linktree-item lt-${esc(l.type||'custom')}" href="${esc(normalizeUrl(l.url))}" target="_blank" rel="noopener noreferrer">
        <span class="linktree-title">${esc(l.title||'Link')}</span>
        <span class="linktree-type">${esc(getLinkTypeLabel(l.type))}</span>
      </a>`).join('');
  });
}

// ── POSTS ─────────────────────────────────────────────────────────────────────
function listenPosts(pid){
  onValue(ref(db,'profilePosts/'+pid), snap => {
    const data = snap.val()||{};
    const posts = Object.entries(data)
      .map(([k,v])=>({postId:k,...v}))
      .sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    const sec = document.getElementById('posts-section');
    const list = document.getElementById('posts-list');
    if(!posts.length){ sec.style.display='none'; return; }
    sec.style.display='block';
    list.innerHTML = posts.map(p=>`
      <div class="post-card">
        ${p.text?`<div class="post-text">${esc(p.text)}</div>`:''}
        ${p.url?`<div><a class="post-link" href="${esc(normalizeUrl(p.url))}" target="_blank" rel="noopener">${esc(p.url)}</a></div>`:''}
        <div class="post-time">${fmt(p.createdAt)}</div>
      </div>`).join('');
  });
}

// ── PRESENCE ──────────────────────────────────────────────────────────────────
function listenPresence(pid){
  onValue(ref(db,'userPresence/'+pid), snap => {
    const p = snap.val();
    const meta = document.getElementById('profile-meta');
    if(!meta) return;
    const base = meta.textContent.replace(/ · (🟢|⚫).*/,'');
    if(p&&p.online){
      meta.textContent = base + (base?' · ':'') + '🟢 Online';
      if(p.currentRadioName) meta.textContent += ' · 📻 '+p.currentRadioName;
    }
  });
}

// ── INBOX ─────────────────────────────────────────────────────────────────────
function loadInbox(){
  const listEl = document.getElementById('conv-list');
  onValue(ref(db,'userInbox/'+_myPid), snap => {
    const data = snap.val()||{};
    const convs = Object.entries(data)
      .map(([chatId,v])=>({chatId,...v}))
      .sort((a,b)=>(b.ts||0)-(a.ts||0));
    if(!convs.length){
      listEl.innerHTML='<div class="empty-state"><span>💬</span>Nenhuma conversa ainda</div>';
      return;
    }
    listEl.innerHTML = convs.map(c=>{
      const avHtml = c.photo
        ? `<div class="conv-av"><img src="${esc(c.photo)}" alt=""></div>`
        : `<div class="conv-av">${(c.name||'?')[0].toUpperCase()}</div>`;
      const unread = c.unread?`<span class="conv-unread">•</span>`:'';
      const time   = c.ts?`<span class="conv-time">${fmt(c.ts)}</span>`:'';
      return `<div class="conv-item" onclick="openConv('${esc(c.chatId)}','${esc(c.name||'')}','${esc(c.photo||'')}','${esc(c.with||'')}')">
        ${avHtml}
        <div class="conv-info">
          <div class="conv-name">${esc(c.name||'Usuário')}</div>
          <div class="conv-last">${esc(c.lastMessage||'')}</div>
        </div>
        ${unread}${time}
      </div>`;
    }).join('');
  });
}

function watchUnread(){
  onValue(ref(db,'userInbox/'+_myPid), snap => {
    const data = snap.val()||{};
    let count = 0;
    Object.values(data).forEach(c=>{ if(c.unread) count++; });
    const badge = document.getElementById('dms-badge');
    if(badge){ badge.textContent=count; badge.style.display=count>0?'inline-block':'none'; }
  });
}

// ── DM ────────────────────────────────────────────────────────────────────────
window.openDMWith = function(theirPid, name, photo){
  if(!theirPid||theirPid===_myPid) return;
  _myChatId = dmChatId(_myPid, theirPid);
  _theirPid = theirPid;
  renderDMArea(name, photo);
  set(ref(db,'userInbox/'+_myPid+'/'+_myChatId+'/unread'),false).catch(()=>{});
};

window.openConv = function(chatId, name, photo, withPid){
  _myChatId = chatId;
  _theirPid = withPid;
  renderDMArea(name, photo);
  set(ref(db,'userInbox/'+_myPid+'/'+chatId+'/unread'),false).catch(()=>{});
};

function renderDMArea(name, photo){
  document.getElementById('dm-area').classList.add('show');
  document.getElementById('dm-hname').textContent = name||'Usuário';
  const hav = document.getElementById('dm-hav');
  hav.innerHTML = photo?`<img src="${esc(photo)}" alt="">`:(name||'?')[0].toUpperCase();
  document.getElementById('inbox-section').style.opacity='.4';
  if(_dmListener){ _dmListener(); _dmListener=null; }
  _dmListener = onValue(ref(db,'directChats/'+_myChatId+'/messages'), snap => {
    const msgs = Object.values(snap.val()||{}).sort((a,b)=>(a.ts||0)-(b.ts||0));
    const box = document.getElementById('dm-msgs');
    if(!msgs.length){ box.innerHTML='<div class="empty-state"><span>👋</span>Comece a conversa!</div>'; return; }
    box.innerHTML = msgs.map(m=>{
      const mine = m.from===_myPid;
      let body;
      if(m.type==='radio_invite'){
        body=`<div class="invite-card"><strong>📻 ${esc(m.radioName||'Rádio')}</strong><small>${esc(m.text||'')}</small><br><a href="${esc(m.url||'#')}" target="_blank">Entrar na rádio →</a></div>`;
      } else { body=esc(m.text||''); }
      return `<div class="dm-bubble ${mine?'me':'other'}">${body}<div class="dm-time">${fmt(m.ts)}</div></div>`;
    }).join('');
    box.scrollTop=box.scrollHeight;
  });
}

window.closeDMArea = function(){
  document.getElementById('dm-area').classList.remove('show');
  document.getElementById('inbox-section').style.opacity='1';
  if(_dmListener){ _dmListener(); _dmListener=null; }
  _myChatId=null; _theirPid=null;
};

window.sendDM = async function(){
  const inp = document.getElementById('dm-input');
  const text = inp.value.trim();
  if(!text||!_myChatId||!_theirPid) return;
  const u = auth.currentUser;
  const myName = u?.displayName||localStorage.getItem('spes_chat_nick')||'Usuário';
  const myPhoto = u?.photoURL||'';
  inp.value='';
  await push(ref(db,'directChats/'+_myChatId+'/messages'),{from:_myPid,to:_theirPid,text,ts:Date.now()});
  await set(ref(db,'userInbox/'+_myPid+'/'+_myChatId),{with:_theirPid,name:document.getElementById('dm-hname').textContent,lastMessage:text,ts:Date.now()});
  await set(ref(db,'userInbox/'+_theirPid+'/'+_myChatId),{with:_myPid,name:myName,photo:myPhoto,lastMessage:text,ts:Date.now(),unread:true});
};

// ── EDIT / SAVE ───────────────────────────────────────────────────────────────
window.toggleEdit = function(){
  document.getElementById('edit-section').classList.toggle('show');
};

async function fillEditFields(){
  const snap = await get(ref(db,'profiles/'+_myPid));
  const p = snap.val()||{};
  document.getElementById('edit-name').value      = p.name||'';
  document.getElementById('edit-type').value      = p.type||'user';
  document.getElementById('edit-category').value  = p.category||'';
  document.getElementById('edit-city').value      = p.city||'';
  document.getElementById('edit-bio').value       = p.bio||'';
  document.getElementById('edit-instagram').value = p.instagram||'';
  document.getElementById('edit-youtube').value   = p.youtube||'';
  document.getElementById('edit-tiktok').value    = p.tiktok||'';
  document.getElementById('edit-facebook').value  = p.facebook||'';
  document.getElementById('edit-whatsapp').value  = p.whatsapp||'';
  document.getElementById('edit-website').value   = p.website||'';
}

window.saveProfile = async function(){
  const u = auth.currentUser;
  const data = {
    name:     document.getElementById('edit-name').value.trim(),
    type:     document.getElementById('edit-type').value,
    category: document.getElementById('edit-category').value.trim(),
    city:     document.getElementById('edit-city').value.trim(),
    bio:      document.getElementById('edit-bio').value.trim(),
    instagram:document.getElementById('edit-instagram').value.trim(),
    youtube:  document.getElementById('edit-youtube').value.trim(),
    tiktok:   document.getElementById('edit-tiktok').value.trim(),
    facebook: document.getElementById('edit-facebook').value.trim(),
    whatsapp: document.getElementById('edit-whatsapp').value.trim(),
    website:  document.getElementById('edit-website').value.trim(),
    updatedAt:Date.now()
  };
  await update(ref(db,'profiles/'+_myPid), data);
  if(data.name) localStorage.setItem('spes_chat_nick', data.name);
  document.getElementById('edit-section').classList.remove('show');
};

// ── RADIO INVITE ──────────────────────────────────────────────────────────────
window.sendRadioInvite = async function(theirPid, theirName, radioId, radioName){
  if(!theirPid||!radioId) return;
  const chatId = dmChatId(_myPid, theirPid);
  const u = auth.currentUser;
  const myName = u?.displayName||localStorage.getItem('spes_chat_nick')||'Usuário';
  const myPhoto = u?.photoURL||'';
  const url = '/radios/radio.html?id='+encodeURIComponent(radioId)+'&open=chat';
  const invite = {type:'radio_invite',from:_myPid,to:theirPid,radioId,radioName,text:'Vem ouvir '+radioName+' comigo.',url,ts:Date.now()};
  await push(ref(db,'directChats/'+chatId+'/messages'), invite);
  await set(ref(db,'userInbox/'+_myPid+'/'+chatId),{with:theirPid,name:theirName,lastMessage:'Convite para rádio',ts:Date.now()});
  await set(ref(db,'userInbox/'+theirPid+'/'+chatId),{with:_myPid,name:myName,photo:myPhoto,lastMessage:'Convite para rádio',ts:Date.now(),unread:true});
  alert('Convite enviado!');
};

// ── GOOGLE LOGIN ──────────────────────────────────────────────────────────────
window.loginGoogle = async function(){
  try{
    await signInWithPopup(auth, new GoogleAuthProvider());
    location.reload();
  }catch(e){ console.error(e); }
};

// ── SCROLL TO INBOX ───────────────────────────────────────────────────────────
window.scrollToInbox = function(){
  document.getElementById('inbox-section')?.scrollIntoView({behavior:'smooth'});
};

// ── NOT FOUND ─────────────────────────────────────────────────────────────────
function renderNotFound(){
  document.getElementById('profile-card').innerHTML='<div class="empty-state"><span>🔍</span>Perfil não encontrado</div>';
}
