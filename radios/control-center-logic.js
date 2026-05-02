import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getAuth, signInWithPopup, signOut, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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

function show(id){ const el=document.getElementById(id); if(el)el.style.display=''; }
function hide(id){ const el=document.getElementById(id); if(el)el.style.display='none'; }
function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

const ADMIN_KEY = 'cidadeonline2026';
let currentUser = null;
let isAdmin     = false;

// ── AUTH ──────────────────────────────────────────────────────────────────────
window.doLogin  = ()=>signInWithPopup(auth,new GoogleAuthProvider()).catch(e=>alert('Erro: '+e.message));
window.doLogout = ()=>signOut(auth);

onAuthStateChanged(auth, async user=>{
  currentUser = user;
  if(user){
    hide('login-prompt');
    const chip = document.getElementById('user-name');
    chip.textContent = user.displayName||user.email||'';
    chip.style.display='';
    hide('btn-login'); show('btn-logout');
    document.getElementById('hero-sub').textContent = `Olá, ${(user.displayName||'').split(' ')[0]||'usuário'}! Selecione uma área abaixo.`;
    await loadUserContext(user);
  } else {
    show('login-prompt'); show('btn-login'); hide('btn-logout');
    hide('user-name');
    document.getElementById('hero-sub').textContent = 'Acesse todos os módulos do CIDADEONLINE em um só lugar.';
    // Still show public sections
  }
  applyAdminState();
});

// Check persisted admin key
if(localStorage.getItem('cc_admin')===ADMIN_KEY){ isAdmin=true; }

// ── ADMIN KEY ─────────────────────────────────────────────────────────────────
window.setAdminKey = function(){
  const val=(document.getElementById('admin-key-input')?.value||'').trim();
  if(val===ADMIN_KEY){
    localStorage.setItem('cc_admin',val); isAdmin=true; applyAdminState();
    loadAdminStats();
  } else { alert('Chave incorreta.'); }
};

function applyAdminState(){
  const overlay=document.getElementById('admin-lock-overlay');
  const keyArea=document.getElementById('admin-key-area');
  const activeLabel=document.getElementById('admin-active-label');
  const gated=document.querySelectorAll('.admin-gated');
  if(isAdmin){
    if(overlay) overlay.style.display='none';
    if(keyArea) keyArea.style.display='none';
    activeLabel.style.display='';
    gated.forEach(el=>el.style.pointerEvents='');
    loadAdminStats();
  } else {
    if(overlay) overlay.style.display='';
    gated.forEach(el=>el.style.pointerEvents='none');
  }
}

// ── USER CONTEXT ──────────────────────────────────────────────────────────────
async function loadUserContext(user){
  // Find owned businesses
  const snap = await get(ref(db,'businessProfiles'));
  const data  = snap.val()||{};
  const myBiz = Object.values(data).filter(b=>b.ownerUid===user.uid && b.active!==false);

  if(myBiz.length>0){
    const biz = myBiz[0];
    const bizId = biz.businessId||biz.profileId;
    // Link "Meu Perfil" to actual profile
    const card = document.getElementById('card-my-profile');
    if(card) card.href=`profile.html?pid=${encodeURIComponent(bizId)}`;
    hide('no-biz-msg');
    // Load affiliate link stats for this user
    loadAffiliateStats(user.uid);
  } else {
    show('no-biz-msg');
    // Card profile still goes to claim
    const card = document.getElementById('card-my-profile');
    if(card) card.href='business-claims.html';
    // Affiliate stats
    loadAffiliateStats(user.uid);
  }

  // Inbox unread count
  loadInboxStats(user.uid);
}

// ── AFFILIATE STATS ───────────────────────────────────────────────────────────
function loadAffiliateStats(uid){
  onValue(ref(db,'affiliateLinks'), snap=>{
    const data = snap.val()||{};
    const myLinks = Object.values(data).filter(l=>l.affiliateUid===uid && l.active);
    const totalClicks = myLinks.reduce((s,l)=>s+(l.clicks||0),0);
    const totalLeads  = myLinks.reduce((s,l)=>s+(l.leads||0),0);
    const stat = document.getElementById('stat-my-links');
    if(stat && myLinks.length>0){
      stat.textContent = `${myLinks.length} links · ${totalClicks} cliques · ${totalLeads} leads`;
      stat.style.display='';
    }
  });
}

// ── INBOX STATS ───────────────────────────────────────────────────────────────
async function loadInboxStats(uid){
  const snap = await get(ref(db,'businessProfiles'));
  const data  = snap.val()||{};
  const myBiz = Object.values(data).filter(b=>b.ownerUid===uid);
  if(!myBiz.length) return;
  const bizId = myBiz[0].businessId||myBiz[0].profileId;
  const csSnap = await get(ref(db,'businessConversations/'+bizId));
  const convs   = Object.values(csSnap.val()||{});
  const unread  = convs.filter(c=>c.status==='open'||(c.unreadCount||0)>0).length;
  if(unread>0){
    const stat=document.getElementById('stat-inbox');
    if(stat){ stat.textContent=`${unread} conversa${unread!==1?'s':''} ativa${unread!==1?'s':''}`; stat.style.display=''; }
  }
}

// ── ADMIN STATS ───────────────────────────────────────────────────────────────
async function loadAdminStats(){
  // Pending import candidates
  const impSnap = await get(ref(db,'cityImportCandidates'));
  const impData  = impSnap.val()||{};
  const pendImport = Object.values(impData).filter(c=>c.status==='pending').length;
  if(pendImport>0){
    const el=document.getElementById('stat-pending-import');
    if(el){ el.textContent=`${pendImport} pendente${pendImport!==1?'s':''}`; el.style.display=''; }
  }

  // Pending claims
  const clSnap = await get(ref(db,'businessClaims'));
  const clData  = clSnap.val()||{};
  const pendClaims = Object.values(clData).filter(c=>c.status==='pending').length;
  if(pendClaims>0){
    const el=document.getElementById('stat-pending-claims');
    if(el){ el.textContent=`${pendClaims} pendente${pendClaims!==1?'s':''}`; el.style.display=''; }
  }

  // Pending leads
  const ldSnap = await get(ref(db,'affiliateLeads'));
  const ldData  = ldSnap.val()||{};
  const pendLeads = Object.values(ldData).filter(l=>l.status==='pending').length;
  if(pendLeads>0){
    const el=document.getElementById('stat-pending-leads');
    if(el){ el.textContent=`${pendLeads} lead${pendLeads!==1?'s':''} pendente${pendLeads!==1?'s':''}`; el.style.display=''; }
  }
}
