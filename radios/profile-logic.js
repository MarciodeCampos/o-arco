import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, set, get, push, update, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
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

let _myPid      = localStorage.getItem('spes_pid') || '';
let _myChatId   = null;
let _theirPid   = null;
let _dmListener = null;
let currentProfile = null;
let currentLinks   = [];

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
    fillEditFields();
    loadStates();
  }

  // Init add-link button
  document.getElementById('add-link-btn')?.addEventListener('click', addProfileLink);

  // Listen profile
  onValue(ref(db,'profiles/'+pid), snap => {
    const p = snap.val();
    if(!p){ renderNotFound(); return; }
    currentProfile = p;
    renderProfile(p, isOwn, user);
    renderOwnerControls(p, user);
  });

  // Listen linktree
  listenLinktree(pid, user);
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
    // Claim button: business não reivindicado + usuário logado
    if(p.type==='business' && (p.claimStatus==='unclaimed'||!p.claimStatus) && user){
      html += `<button class="btn-claim" onclick="openClaimForm('${esc(p.profileId)}','${esc(p.name||'')}')">🏪 Este comércio é meu</button>`;
    }
    el.innerHTML = html;
  }
}

// ── CLAIM FORM ────────────────────────────────────────────────────────────────
window.openClaimForm = function(profileId, bizName){
  const existing = document.getElementById('claim-form-overlay');
  if(existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'claim-form-overlay';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:900;display:flex;align-items:center;justify-content:center;padding:20px';
  overlay.innerHTML=`
    <div style="background:#13131f;border:1px solid rgba(124,110,247,.35);border-radius:18px;padding:28px;max-width:420px;width:100%">
      <div style="font-size:1rem;font-weight:800;margin-bottom:6px">🏪 Reivindicar comércio</div>
      <div style="font-size:.8rem;color:#64748b;margin-bottom:18px">${esc(bizName)}</div>
      <div style="display:grid;gap:10px">
        <input id="claim-name" class="claim-input" type="text" placeholder="Seu nome completo *" required>
        <input id="claim-phone" class="claim-input" type="tel" placeholder="WhatsApp / Telefone *" required>
        <input id="claim-email" class="claim-input" type="email" placeholder="E-mail">
        <textarea id="claim-msg" class="claim-input" placeholder="Mensagem (opcional)" style="min-height:70px;resize:vertical"></textarea>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button onclick="submitClaim('${esc(profileId)}','${esc(bizName)}')" style="flex:1;background:linear-gradient(135deg,#7c6ef7,#a78bfa);color:#fff;border:none;border-radius:10px;padding:10px;cursor:pointer;font-weight:700;font-size:.85rem;font-family:inherit">Enviar solicitação</button>
        <button onclick="document.getElementById('claim-form-overlay').remove()" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#94a3b8;border-radius:10px;padding:10px 16px;cursor:pointer;font-family:inherit">Cancelar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  // Estilo inline para inputs do form
  overlay.querySelectorAll('.claim-input').forEach(el=>{
    el.style.cssText='background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#e2e8f0;padding:9px 12px;font-family:inherit;font-size:.84rem;outline:none;width:100%';
    el.onfocus=()=>el.style.borderColor='#7c6ef7';
    el.onblur=()=>el.style.borderColor='rgba(255,255,255,.1)';
  });
};

window.submitClaim = async function(profileId, bizName){
  const name  = document.getElementById('claim-name')?.value.trim();
  const phone = document.getElementById('claim-phone')?.value.trim();
  const email = document.getElementById('claim-email')?.value.trim();
  const msg   = document.getElementById('claim-msg')?.value.trim();
  if(!name||!phone){ alert('Nome e telefone são obrigatórios.'); return; }
  const u = auth.currentUser;
  if(!u){ alert('Faça login para continuar.'); return; }
  const claimRef = push(ref(db,'businessClaims'));
  await set(claimRef,{
    claimId: claimRef.key,
    businessId:profileId, profileId,
    bizName,
    requestedBy:u.uid,
    requesterName:name,
    requesterEmail:email||u.email||'',
    requesterPhone:phone,
    requesterPhoto:u.photoURL||'',
    message:msg||'',
    status:'pending',
    createdAt:Date.now(), reviewedAt:null, reviewedBy:''
  });
  document.getElementById('claim-form-overlay')?.remove();
  alert('✅ Solicitação enviada! Entraremos em contato para validação.');
};



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
function listenLinktree(pid, user){
  onValue(ref(db,'profileLinks/'+pid), snap => {
    const data = snap.val()||{};
    currentLinks = Object.entries(data)
      .map(([k,v])=>({linkId:k,...v}))
      .sort((a,b)=>(a.order||999)-(b.order||999));
    const active = currentLinks.filter(l=>l.active!==false);
    const sec = document.getElementById('linktree-section');
    const list = document.getElementById('linktree-list');
    if(!active.length){ sec.style.display='none'; } else {
      sec.style.display='block';
      list.innerHTML = active.map(l=>`
        <a class="linktree-item lt-${esc(l.type||'custom')}" href="${esc(normalizeUrl(l.url))}" target="_blank" rel="noopener noreferrer">
          <span class="linktree-title">${esc(l.title||'Link')}</span>
          <span class="linktree-type">${esc(getLinkTypeLabel(l.type))}</span>
        </a>`).join('');
    }
    if(user && currentProfile && isProfileOwner(currentProfile, user)){
      renderLinkManager(currentLinks);
    }
  });
}

// ── MEDIA HELPERS ─────────────────────────────────────────────────────────────
function extractYouTubeId(url){
  try{
    const u=new URL(url);
    if(u.hostname.includes('youtu.be')) return u.pathname.slice(1).split('?')[0];
    if(u.hostname.includes('youtube.com')){
      if(u.pathname.includes('/shorts/')) return u.pathname.split('/shorts/')[1].split('?')[0];
      return u.searchParams.get('v');
    }
  }catch(e){}
  return null;
}
function getMediaType(url){
  if(!url) return 'link';
  const u=url.toLowerCase();
  if(u.includes('youtu.be/')||u.includes('youtube.com/')) return 'youtube';
  if(u.includes('instagram.com/')) return 'instagram';
  if(u.includes('tiktok.com/')) return 'tiktok';
  if(u.includes('facebook.com/')||u.includes('fb.watch/')) return 'facebook';
  if(u.includes('suno.ai/')||u.includes('suno.com/')) return 'suno';
  if(u.includes('soundcloud.com/')) return 'soundcloud';
  if(u.includes('spotify.com/')) return 'spotify';
  return 'link';
}
const MEDIA_ICONS={youtube:'▶️',instagram:'📸',tiktok:'🎵',facebook:'📘',suno:'🎵',soundcloud:'🎧',spotify:'🎵',link:'🔗'};
const MEDIA_LABELS={youtube:'YouTube',instagram:'Instagram',tiktok:'TikTok',facebook:'Facebook',suno:'Suno',soundcloud:'SoundCloud',spotify:'Spotify',link:'Link'};

function renderPostMedia(url){
  if(!url) return '';
  const type=getMediaType(url);
  const safe=esc(normalizeUrl(url));
  if(type==='youtube'){
    const vid=extractYouTubeId(url);
    if(vid) return `<div class="post-embed-wrap"><iframe class="post-yt" src="https://www.youtube.com/embed/${esc(vid)}?rel=0" allow="autoplay;encrypted-media;picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
  }
  return `<div class="post-preview-card"><div class="ppc-icon">${MEDIA_ICONS[type]||'🔗'}</div><div class="ppc-info"><strong>${MEDIA_LABELS[type]||'Link'}</strong><div class="ppc-url">${esc(url)}</div></div><a class="ppc-btn" href="${safe}" target="_blank" rel="noopener">Abrir →</a></div>`;
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
      <div class="post-card" data-id="${esc(p.postId)}">
        ${p.text?`<div class="post-text">${esc(p.text)}</div>`:''}
        ${renderPostMedia(p.url)}
        <div class="post-time">${fmt(p.createdAt)}</div>
      </div>`).join('');
  });
}

// ── CREATE POST ───────────────────────────────────────────────────────────────
window.createPost = async function(){
  if(!currentProfile||!auth.currentUser) return;
  if(!isProfileOwner(currentProfile,auth.currentUser)) return;
  const textEl=document.getElementById('post-text-input');
  const urlEl=document.getElementById('post-url-input');
  const text=textEl?.value.trim();
  const url=urlEl?.value.trim();
  if(!text&&!url){ alert('Escreva algo ou cole um link.'); return; }
  const mediaType=getMediaType(url);
  await push(ref(db,'profilePosts/'+currentProfile.profileId),{
    type: url?'video_embed':'text',
    text: text||'',
    url:  url?normalizeUrl(url):'',
    mediaType,
    createdAt:Date.now(),
    createdBy:auth.currentUser.uid
  });
  if(textEl) textEl.value='';
  if(urlEl)  urlEl.value='';
};



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
  // businessInbox hook: se for perfil business, registrar atendimento
  if(currentProfile && currentProfile.type==='business'){
    const bizId = currentProfile.profileId;
    const chatId = _myChatId;
    const u = auth.currentUser;
    const customerUid = u?.uid||_myPid;
    const customerName = u?.displayName||localStorage.getItem('spes_chat_nick')||'Cliente';
    get(ref(db,'businessInbox/'+bizId+'/'+chatId)).then(snap=>{
      if(!snap.exists()){
        set(ref(db,'businessInbox/'+bizId+'/'+chatId),{
          businessId:bizId, profileId:bizId, chatId,
          customerUid, customerName, customerPhoto:u?.photoURL||'',
          lastMessage:'', lastMessageAt:Date.now(),
          status:'aberto', unread:true,
          assignedTo:'', tags:[], notes:'',
          createdAt:Date.now(), updatedAt:Date.now()
        });
      }
    }).catch(()=>{});
  }
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
  const now = Date.now();
  await push(ref(db,'directChats/'+_myChatId+'/messages'),{from:_myPid,to:_theirPid,text,ts:now});
  await set(ref(db,'userInbox/'+_myPid+'/'+_myChatId),{with:_theirPid,name:document.getElementById('dm-hname').textContent,lastMessage:text,ts:now});
  await set(ref(db,'userInbox/'+_theirPid+'/'+_myChatId),{with:_myPid,name:myName,photo:myPhoto,lastMessage:text,ts:now,unread:true});
  // businessInbox sync
  if(currentProfile && currentProfile.type==='business'){
    const bizId = currentProfile.profileId;
    update(ref(db,'businessInbox/'+bizId+'/'+_myChatId),{
      lastMessage:text, lastMessageAt:now, unread:true, updatedAt:now, status:'aberto'
    }).catch(()=>{});
  }
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
  document.getElementById('edit-bio').value       = p.bio||'';
  document.getElementById('edit-instagram').value = p.instagram||'';
  document.getElementById('edit-youtube').value   = p.youtube||'';
  document.getElementById('edit-tiktok').value    = p.tiktok||'';
  document.getElementById('edit-facebook').value  = p.facebook||'';
  document.getElementById('edit-whatsapp').value  = p.whatsapp||'';
  document.getElementById('edit-website').value   = p.website||'';
  // Geo: load states then pre-select saved uf+city
  await loadStates();
  if(p.uf){
    document.getElementById('edit-uf').value = p.uf;
    await loadCitiesByUf(p.uf, p.citySlug||'');
  }
}

window.saveProfile = async function(){
  const ufSel   = document.getElementById('edit-uf');
  const citySel = document.getElementById('edit-city');
  const cityOpt = citySel.options[citySel.selectedIndex];
  const data = {
    name:      document.getElementById('edit-name').value.trim(),
    type:      document.getElementById('edit-type').value,
    category:  document.getElementById('edit-category').value.trim(),
    uf:        ufSel.value,
    city:      cityOpt?.dataset.city || citySel.value,
    citySlug:  citySel.value,
    stateName: cityOpt?.dataset.stateName || '',
    bio:       document.getElementById('edit-bio').value.trim(),
    instagram: document.getElementById('edit-instagram').value.trim(),
    youtube:   document.getElementById('edit-youtube').value.trim(),
    tiktok:    document.getElementById('edit-tiktok').value.trim(),
    facebook:  document.getElementById('edit-facebook').value.trim(),
    whatsapp:  document.getElementById('edit-whatsapp').value.trim(),
    website:   document.getElementById('edit-website').value.trim(),
    updatedAt: Date.now()
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

// ── GEO: ESTADOS BR ───────────────────────────────────────────────────────────
const BR_STATES = [
  {uf:'AC',name:'Acre'},{uf:'AL',name:'Alagoas'},{uf:'AP',name:'Amapá'},
  {uf:'AM',name:'Amazonas'},{uf:'BA',name:'Bahia'},{uf:'CE',name:'Ceará'},
  {uf:'DF',name:'Distrito Federal'},{uf:'ES',name:'Espírito Santo'},
  {uf:'GO',name:'Goiás'},{uf:'MA',name:'Maranhão'},{uf:'MT',name:'Mato Grosso'},
  {uf:'MS',name:'Mato Grosso do Sul'},{uf:'MG',name:'Minas Gerais'},
  {uf:'PA',name:'Pará'},{uf:'PB',name:'Paraíba'},{uf:'PR',name:'Paraná'},
  {uf:'PE',name:'Pernambuco'},{uf:'PI',name:'Piauí'},{uf:'RJ',name:'Rio de Janeiro'},
  {uf:'RN',name:'Rio Grande do Norte'},{uf:'RS',name:'Rio Grande do Sul'},
  {uf:'RO',name:'Rondônia'},{uf:'RR',name:'Roraima'},{uf:'SC',name:'Santa Catarina'},
  {uf:'SP',name:'São Paulo'},{uf:'SE',name:'Sergipe'},{uf:'TO',name:'Tocantins'}
];

async function loadStates(){
  const sel = document.getElementById('edit-uf');
  if(!sel) return;
  sel.innerHTML = '<option value="">Selecione o estado</option>';
  BR_STATES.forEach(s=>{
    const o = document.createElement('option');
    o.value = s.uf; o.textContent = s.name + ' (' + s.uf + ')';
    sel.appendChild(o);
  });
  sel.onchange = async (e) => { await loadCitiesByUf(e.target.value); };
}

async function loadCitiesByUf(uf, selectedSlug=''){
  const sel = document.getElementById('edit-city');
  if(!sel) return;
  sel.innerHTML = '<option value="">Carregando...</option>';
  sel.disabled = true;
  if(!uf){ sel.innerHTML='<option value="">Selecione primeiro o estado</option>'; return; }
  const snap = await get(ref(db,'geoCities/'+uf));
  const data = snap.val()||{};
  const cities = Object.values(data).filter(c=>c.active!==false)
    .sort((a,b)=>(a.city||'').localeCompare(b.city||''));
  sel.innerHTML = '<option value="">Selecione a cidade</option>';
  if(!cities.length){
    // Fallback: allow free text via hidden input
    sel.innerHTML = '<option value="">Nenhuma cidade cadastrada para este estado</option>';
  } else {
    cities.forEach(c=>{
      const o = document.createElement('option');
      o.value = c.citySlug;
      o.textContent = c.city;
      o.dataset.city = c.city;
      o.dataset.uf = c.uf;
      o.dataset.stateName = c.stateName||BR_STATES.find(s=>s.uf===uf)?.name||'';
      sel.appendChild(o);
    });
    if(selectedSlug) sel.value = selectedSlug;
  }
  sel.disabled = false;
}

// ── LINK MANAGER ──────────────────────────────────────────────────────────────
function isProfileOwner(profile, user){
  return !!(user && profile && user.uid && profile.ownerUid && user.uid === profile.ownerUid);
}

function renderOwnerControls(profile, user){
  const sec = document.getElementById('link-manager-section');
  const postSec = document.getElementById('post-create-section');
  const isOwner = isProfileOwner(profile, user);
  if(sec) sec.style.display = isOwner ? 'block' : 'none';
  if(postSec) postSec.style.display = isOwner ? 'block' : 'none';
}

function renderLinkManager(links){
  const container = document.getElementById('link-manager-list');
  if(!container) return;
  if(!links.length){ container.innerHTML='<div class="empty-state">Nenhum link ainda. Adicione acima.</div>'; return; }
  container.innerHTML='';
  links.forEach(link=>{
    const el = document.createElement('div');
    el.className='link-manager-item';
    const isActive = link.active !== false;
    el.innerHTML=`
      <div class="link-manager-row">
        <div class="link-manager-info">
          <strong>${esc(link.title||'Link')}</strong>
          <div class="link-manager-url">${esc(link.url||'')}</div>
          <div class="link-manager-meta">${esc(getLinkTypeLabel(link.type))} · ordem ${link.order||0} · <span class="${isActive?'link-manager-status-on':'link-manager-status-off'}">${isActive?'ativo':'inativo'}</span></div>
        </div>
      </div>
      <div class="link-manager-actions">
        <button class="lm-btn" data-a="up">↑</button>
        <button class="lm-btn" data-a="down">↓</button>
        <button class="lm-btn" data-a="edit">Editar</button>
        <button class="lm-btn ${isActive?'':'success'}" data-a="toggle">${isActive?'Desativar':'Ativar'}</button>
        <button class="lm-btn danger" data-a="del">Remover</button>
      </div>`;
    el.querySelector('[data-a="up"]').onclick   = ()=>moveLink(link.linkId,-1);
    el.querySelector('[data-a="down"]').onclick = ()=>moveLink(link.linkId,1);
    el.querySelector('[data-a="edit"]').onclick = ()=>editLink(link);
    el.querySelector('[data-a="toggle"]').onclick = ()=>toggleLink(link);
    el.querySelector('[data-a="del"]').onclick  = ()=>deleteLink(link);
    container.appendChild(el);
  });
}

async function addProfileLink(){
  if(!currentProfile) return;
  const u = auth.currentUser;
  if(!isProfileOwner(currentProfile,u)) return;
  const title = document.getElementById('link-title-input')?.value.trim();
  const url   = document.getElementById('link-url-input')?.value.trim();
  const type  = document.getElementById('link-type-input')?.value||'custom';
  if(!title||!url){ alert('Informe título e URL.'); return; }
  const nextOrder = currentLinks.length ? Math.max(...currentLinks.map(l=>Number(l.order||0)))+1 : 1;
  const now = Date.now();
  await push(ref(db,'profileLinks/'+currentProfile.profileId),{
    title, url:normalizeUrl(url), type, icon:type, order:nextOrder,
    active:true, createdAt:now, updatedAt:now, createdBy:u.uid, updatedBy:u.uid
  });
  document.getElementById('link-title-input').value='';
  document.getElementById('link-url-input').value='';
}

async function editLink(link){
  if(!currentProfile||!auth.currentUser) return;
  const title = prompt('Título do link:', link.title||'');
  if(title===null) return;
  const url = prompt('URL do link:', link.url||'');
  if(url===null) return;
  await update(ref(db,'profileLinks/'+currentProfile.profileId+'/'+link.linkId),{
    title:title.trim(), url:normalizeUrl(url.trim()),
    updatedAt:Date.now(), updatedBy:auth.currentUser.uid
  });
}

async function toggleLink(link){
  if(!currentProfile||!auth.currentUser) return;
  await update(ref(db,'profileLinks/'+currentProfile.profileId+'/'+link.linkId),{
    active: link.active===false, updatedAt:Date.now(), updatedBy:auth.currentUser.uid
  });
}

async function deleteLink(link){
  if(!currentProfile||!auth.currentUser) return;
  if(!confirm('Remover "'+link.title+'"?')) return;
  await remove(ref(db,'profileLinks/'+currentProfile.profileId+'/'+link.linkId));
}

async function moveLink(linkId, dir){
  if(!currentProfile||!auth.currentUser) return;
  const ordered = [...currentLinks].sort((a,b)=>(a.order||999)-(b.order||999));
  const idx = ordered.findIndex(l=>l.linkId===linkId);
  if(idx<0) return;
  const ti = idx+dir;
  if(ti<0||ti>=ordered.length) return;
  const curr = ordered[idx], tgt = ordered[ti];
  const now = Date.now(), uid = auth.currentUser.uid;
  await update(ref(db,'profileLinks/'+currentProfile.profileId+'/'+curr.linkId),{order:tgt.order||ti+1,updatedAt:now,updatedBy:uid});
  await update(ref(db,'profileLinks/'+currentProfile.profileId+'/'+tgt.linkId),{order:curr.order||idx+1,updatedAt:now,updatedBy:uid});
}
