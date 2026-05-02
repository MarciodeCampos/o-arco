import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, get, set, push, update, query, orderByChild, limitToLast }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ── CONFIG ─────────────────────────────────────────────────────
const FB = {
  apiKey:"AIzaSyDa0XWSvNISi47olox7U2HHawf3pf1rOjI",
  authDomain:"triadic-radios.firebaseapp.com",
  databaseURL:"https://triadic-radios-default-rtdb.firebaseio.com",
  projectId:"triadic-radios",
  storageBucket:"triadic-radios.firebasestorage.app",
  messagingSenderId:"574115949337",
  appId:"1:574115949337:web:527670aa35d9bb939f3388"
};
const app  = initializeApp(FB);
const auth = getAuth(app);
const db   = getDatabase(app);
const provider = new GoogleAuthProvider();

// ── LEVEL CONFIG ───────────────────────────────────────────────
const LEVELS = [
  { tier: '1-10',  name: 'Visitante',     emoji: '🌱', min: 0       },
  { tier: '11-20', name: 'Morador',       emoji: '🏠', min: 5000    },
  { tier: '21-30', name: 'Cidadão',       emoji: '🗳️', min: 15000   },
  { tier: '31-40', name: 'Influente',     emoji: '📣', min: 35000   },
  { tier: '41-50', name: 'Referência',    emoji: '⭐', min: 75000   },
  { tier: '51-60', name: 'Lenda da Rede', emoji: '🌟', min: 150000  },
  { tier: '61+',   name: 'Fundador',      emoji: '🏛️', min: 300000  },
];

function calcLevel(xp) {
  let tier = LEVELS[0];
  for (const t of LEVELS) { if (xp >= t.min) tier = t; else break; }
  const idx = LEVELS.indexOf(tier);
  const next = LEVELS[idx + 1];
  const lv = Math.floor(1 + (xp / Math.max(tier.min || 1, 1)) * 9);
  const realLv = Math.min(Math.max(idx * 10 + Math.floor((xp - tier.min) / Math.max((next ? next.min - tier.min : 150000) / 10, 1)) + 1, 1), 70);
  const pct = next ? Math.min(((xp - tier.min) / (next.min - tier.min)) * 100, 100) : 100;
  return { name: tier.name, emoji: tier.emoji, tier: tier.tier, level: realLv, pct };
}

function fmtNum(n) { return Number(n||0).toLocaleString('pt-BR'); }
function fmtDate(ts) { return ts ? new Date(ts).toLocaleDateString('pt-BR') : '—'; }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
function giftIcon(type) {
  return { discount:'🏷️', service:'🔧', visual:'🎨', ticket:'🎫', experience:'✨', ad:'📣' }[type] || '🎁';
}

// ── STATE ──────────────────────────────────────────────────────
let currentUid = null;
let currentWallet = {};
let allUserGifts = {};
let allGifts = {};
let activeGiftTab = 'active';
let activeHistTab = 'coins';
let coinTxs = [];
let diamondTxs = [];

// ── AUTH ──────────────────────────────────────────────────────
window.loginGoogle = async function() {
  try { await signInWithPopup(auth, provider); }
  catch(e) { console.error('Login error', e); }
};

window.logoutWallet = async function() {
  await signOut(auth);
  location.reload();
};

onAuthStateChanged(auth, async user => {
  document.getElementById('wallet-loading').style.display = 'none';
  if (!user) {
    document.getElementById('login-gate').style.display = 'flex';
    document.getElementById('wallet-main').style.display = 'none';
    return;
  }
  document.getElementById('login-gate').style.display = 'none';
  document.getElementById('wallet-main').style.display = 'block';
  currentUid = user.uid;
  await initWallet(user);
  await loadGifts();
  await loadHistory();
});

// ── INIT WALLET ────────────────────────────────────────────────
async function initWallet(user) {
  const wRef = ref(db, `wallets/${user.uid}`);
  const snap = await get(wRef);

  if (!snap.exists()) {
    // Nova wallet → seed 500 Coins
    const wallet = {
      coins: 500, diamonds: 0, xpGlobal: 0, levelGlobal: 1,
      levelName: 'Visitante', createdAt: Date.now(), uid: user.uid,
      displayName: user.displayName || 'Usuário', photoURL: user.photoURL || ''
    };
    await set(wRef, wallet);
    currentWallet = wallet;

    // Registrar seed transaction
    await push(ref(db, 'coinTransactions'), {
      uid: user.uid,
      type: 'purchase',
      amount: 500,
      description: '🎁 Bônus de boas-vindas — 500 Coins de teste',
      relatedEntity: 'seed_welcome',
      createdAt: Date.now()
    });
  } else {
    currentWallet = snap.val();
    // Atualizar displayName/photo se mudou
    if (user.displayName && currentWallet.displayName !== user.displayName) {
      await update(wRef, { displayName: user.displayName, photoURL: user.photoURL });
      currentWallet.displayName = user.displayName;
      currentWallet.photoURL = user.photoURL;
    }
  }

  renderHero(user);
  renderStats();
}

// ── RENDER HERO ────────────────────────────────────────────────
function renderHero(user) {
  const lv = calcLevel(currentWallet.xpGlobal || 0);
  const av = document.getElementById('w-avatar');
  if (user.photoURL) {
    av.innerHTML = `<img src="${esc(user.photoURL)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
  } else {
    av.textContent = (user.displayName || 'U')[0].toUpperCase();
  }
  document.getElementById('w-name').textContent = user.displayName || 'Usuário';
  document.getElementById('w-level-badge').textContent = `Lv. ${lv.level} · ${lv.emoji} ${lv.name}`;
  document.getElementById('w-xp-fill').style.width = lv.pct + '%';
  document.getElementById('w-xp-label').textContent = fmtNum(currentWallet.xpGlobal || 0) + ' XP';

  // Highlight current level row in table
  const rows = document.querySelectorAll('.lt-row[data-range]');
  rows.forEach(r => {
    r.classList.toggle('current-level', r.dataset.range === lv.tier);
  });
}

// ── RENDER STATS ───────────────────────────────────────────────
function renderStats() {
  const lv = calcLevel(currentWallet.xpGlobal || 0);
  document.getElementById('w-coins').textContent    = fmtNum(currentWallet.coins);
  document.getElementById('w-diamonds').textContent = fmtNum(currentWallet.diamonds);
  document.getElementById('w-xp').textContent       = fmtNum(currentWallet.xpGlobal);
  document.getElementById('w-level').textContent    = `Lv. ${lv.level}`;
  document.getElementById('w-level-name').textContent = `${lv.emoji} ${lv.name}`;
}

// ── LOAD GIFTS ─────────────────────────────────────────────────
async function loadGifts() {
  // Load user's gift instances
  const ugSnap = await get(ref(db, `userGifts/${currentUid}`));
  allUserGifts = ugSnap.val() || {};

  // Load gift definitions for each
  const giftIds = Object.keys(allUserGifts);
  if (giftIds.length) {
    await Promise.all(giftIds.map(async gid => {
      const gSnap = await get(ref(db, `gifts/${gid}`));
      if (gSnap.exists()) allGifts[gid] = gSnap.val();
    }));
  }

  renderGifts();
}

window.switchGiftTab = function(tab) {
  activeGiftTab = tab;
  document.querySelectorAll('#stab-active,#stab-redeemed,#stab-expired')
    .forEach(b => b.classList.remove('active'));
  document.getElementById('stab-' + tab).classList.add('active');
  renderGifts();
};

function renderGifts() {
  const list = document.getElementById('gifts-list');
  const now = Date.now();
  const filtered = Object.entries(allUserGifts)
    .filter(([gid, ug]) => {
      if (activeGiftTab === 'active')   return ug.status === 'active' && (!allGifts[gid]?.expiresAt || allGifts[gid].expiresAt > now);
      if (activeGiftTab === 'redeemed') return ug.status === 'redeemed';
      if (activeGiftTab === 'expired')  return ug.status === 'expired' || (allGifts[gid]?.expiresAt && allGifts[gid].expiresAt <= now);
      return true;
    });

  if (!filtered.length) {
    const labels = { active: 'Nenhum Gift ativo.', redeemed: 'Nenhum Gift resgatado ainda.', expired: 'Nenhum Gift expirado.' };
    list.innerHTML = `<div class="empty-gifts"><div class="empty-icon">🎁</div><div>${labels[activeGiftTab]}</div><a href="offers.html" class="btn-sm-link">Ver ofertas →</a></div>`;
    return;
  }

  list.innerHTML = filtered.map(([gid, ug]) => {
    const g = allGifts[gid] || {};
    const statusLabel = { active: 'Ativo', redeemed: 'Resgatado', expired: 'Expirado' }[ug.status] || ug.status;
    const badgeClass  = { active: 'gbadge-active', redeemed: 'gbadge-redeemed', expired: 'gbadge-expired' }[ug.status] || '';
    const expires = g.expiresAt ? fmtDate(g.expiresAt) : 'Sem validade';
    const expiring = g.expiresAt && (g.expiresAt - now) < 3 * 24 * 3600 * 1000 && ug.status === 'active';
    return `
    <div class="gift-card">
      <div class="gift-card-top">
        <div class="gift-type-icon">${giftIcon(g.type)}</div>
        <div class="gift-card-title">${esc(g.title || 'Gift')}</div>
        <span class="gift-status-badge ${badgeClass}">${statusLabel}</span>
      </div>
      <div class="gift-city">📍 ${esc(g.citySlug || '—')}</div>
      <div class="gift-expires ${expiring ? 'expiring-soon' : ''}">
        ⏱ ${expiring ? '⚠️ ' : ''}Válido até ${expires}
      </div>
      ${ug.status === 'active' ? `<button class="btn-redeem" onclick="redeemGift('${gid}')">Usar Gift →</button>` : ''}
    </div>`;
  }).join('');
}

// ── REDEEM GIFT ────────────────────────────────────────────────
window.redeemGift = async function(gid) {
  if (!confirm('Deseja resgatar este Gift? Após o uso, ele será queimado.')) return;
  const g = allGifts[gid];
  if (!g) return;

  // Mark redeemed
  await update(ref(db, `userGifts/${currentUid}/${gid}`), { status: 'redeemed', redeemedAt: Date.now() });

  // Record redemption
  await push(ref(db, 'giftRedemptions'), {
    giftId: gid, uid: currentUid, issuerId: g.issuerId || '',
    citySlug: g.citySlug || '', xpAwarded: 300, createdAt: Date.now()
  });

  // Award XP
  const newXP = (currentWallet.xpGlobal || 0) + 300;
  const lv = calcLevel(newXP);
  await update(ref(db, `wallets/${currentUid}`), {
    xpGlobal: newXP, levelGlobal: lv.level, levelName: lv.name
  });
  currentWallet.xpGlobal = newXP;

  allUserGifts[gid].status = 'redeemed';
  renderGifts();
  renderStats();
  renderHero(auth.currentUser);
  alert('✅ Gift resgatado! +300 XP Global adicionado.');
};

// ── LOAD HISTORY ───────────────────────────────────────────────
async function loadHistory() {
  const [cSnap, dSnap] = await Promise.all([
    get(query(ref(db, 'coinTransactions'),    orderByChild('uid'))),
    get(query(ref(db, 'diamondTransactions'), orderByChild('uid')))
  ]);

  coinTxs    = Object.values(cSnap.val()    || {}).filter(t => t.uid === currentUid).sort((a,b) => b.createdAt - a.createdAt);
  diamondTxs = Object.values(dSnap.val()    || {}).filter(t => t.uid === currentUid).sort((a,b) => b.createdAt - a.createdAt);

  renderHistory();
}

window.switchHistTab = function(tab) {
  activeHistTab = tab;
  document.getElementById('htab-coins').classList.toggle('active', tab === 'coins');
  document.getElementById('htab-diamonds').classList.toggle('active', tab === 'diamonds');
  renderHistory();
};

function renderHistory() {
  const list = document.getElementById('history-list');
  const txs = activeHistTab === 'coins' ? coinTxs : diamondTxs;
  const symbol = activeHistTab === 'coins' ? '🪙' : '💎';

  if (!txs.length) {
    list.innerHTML = '<div class="empty-hist">Nenhuma movimentação ainda.</div>';
    return;
  }

  list.innerHTML = txs.slice(0, 30).map(t => {
    const isPos = t.type === 'purchase' || t.type === 'earned' || t.type === 'adjusted';
    const sign  = isPos ? '+' : '−';
    const cls   = isPos ? 'pos' : 'neg';
    return `
    <div class="hist-row">
      <div class="hist-icon">${symbol}</div>
      <div class="hist-info">
        <div class="hist-desc">${esc(t.description || t.reason || t.type)}</div>
        <div class="hist-date">${fmtDate(t.createdAt)}</div>
      </div>
      <div class="hist-amount ${cls}">${sign}${fmtNum(t.amount)}</div>
    </div>`;
  }).join('');
}
