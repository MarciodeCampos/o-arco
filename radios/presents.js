// presents.js — Social Core Bloco 2A
// Módulo compartilhado: catálogo de Presentes, modal de envio, lógica de transação
// UI pública usa: Moedas · Presentes · Diamantes · XP  (nunca "Gift" ou "Coins")

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, get, set, push, update, runTransaction }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ── CONFIG (reutiliza instância existente se já iniciada) ───────
const FB = {
  apiKey:"AIzaSyDa0XWSvNISi47olox7U2HHawf3pf1rOjI",
  authDomain:"triadic-radios.firebaseapp.com",
  databaseURL:"https://triadic-radios-default-rtdb.firebaseio.com",
  projectId:"triadic-radios",
  storageBucket:"triadic-radios.firebasestorage.app",
  messagingSenderId:"574115949337",
  appId:"1:574115949337:web:527670aa35d9bb939f3388"
};
const app = getApps().length ? getApps()[0] : initializeApp(FB);
const auth = getAuth(app);
const db   = getDatabase(app);

// ── CATÁLOGO LOCAL (verdade canônica — seed no Firebase se ausente) ──
export const PRESENTS_CATALOG = [
  { presentId:'present_rosa',      displayName:'Rosa',                  emoji:'🌹', rarity:'common',    coinCost:1,     diamondReward:1,    xpAwardSender:1,    galleryVisibleDays:7  },
  { presentId:'present_buque',     displayName:'Buquê',                 emoji:'💐', rarity:'common',    coinCost:5,     diamondReward:4,    xpAwardSender:5,    galleryVisibleDays:7  },
  { presentId:'present_chocolate', displayName:'Chocolate',             emoji:'🍫', rarity:'common',    coinCost:10,    diamondReward:8,    xpAwardSender:10,   galleryVisibleDays:7  },
  { presentId:'present_litrao',    displayName:'Litrão da Praça',       emoji:'🍺', rarity:'rare',      coinCost:50,    diamondReward:40,   xpAwardSender:50,   galleryVisibleDays:14 },
  { presentId:'present_mic',       displayName:'Microfone de Ouro',     emoji:'🎙️', rarity:'epic',      coinCost:100,   diamondReward:80,   xpAwardSender:100,  galleryVisibleDays:30 },
  { presentId:'present_coroa',     displayName:'Coroa da Praça',        emoji:'👑', rarity:'legendary', coinCost:500,   diamondReward:400,  xpAwardSender:500,  galleryVisibleDays:60 },
  { presentId:'present_galaxia',   displayName:'Galáxia da Cidade',     emoji:'🌌', rarity:'legendary', coinCost:1000,  diamondReward:800,  xpAwardSender:1000, galleryVisibleDays:90 },
  { presentId:'present_universo',  displayName:'Universo CIDADEONLINE', emoji:'🚀', rarity:'mythic',    coinCost:5000,  diamondReward:4000, xpAwardSender:5000, galleryVisibleDays:365},
];

const RARITY_LABEL = { common:'Comum', rare:'Raro', epic:'Épico', legendary:'Lendário', mythic:'Mítico' };

// ── SEED catálogo no Firebase (apenas se coleção ausente) ─────────
export async function seedPresentsCatalog() {
  const snap = await get(ref(db, 'presents/present_rosa'));
  if (snap.exists()) return; // já seeded
  const updates = {};
  for (const p of PRESENTS_CATALOG) {
    updates[`presents/${p.presentId}`] = { ...p, presentClass:'social', usageMode:'network', redeemable:false, transferable:false, active:true, createdAt:Date.now() };
  }
  await update(ref(db), updates);
}

// ── CARREGAR catálogo do Firebase (com fallback local) ───────────
async function loadCatalog() {
  try {
    const snap = await get(ref(db, 'presents'));
    if (snap.exists()) {
      return Object.values(snap.val()).filter(p => p.active !== false);
    }
  } catch(e) {}
  return PRESENTS_CATALOG; // fallback local
}

// ── HELPERS ─────────────────────────────────────────────────────
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
function fmt(n){ return Number(n||0).toLocaleString('pt-BR'); }

// ── MODAL ────────────────────────────────────────────────────────
let _modalOpen = false;
let _selectedPresent = null;

/**
 * Abre o modal de Presentes.
 * @param {Object} config
 *   recipientUid     string|null  — uid do destinatário (null = canal)
 *   recipientName    string       — nome exibido
 *   targetType       'user'|'channel'
 *   channelId        string|null  — id do canal (para targetType='channel')
 *   onDelivered      function     — callback após envio (ex: adicionar mensagem no chat)
 */
export async function openPresentModal(config = {}) {
  if (_modalOpen) return;
  _modalOpen = true;

  // Injetar CSS se ainda não estiver
  if (!document.getElementById('present-modal-css')) {
    const link = document.createElement('link');
    link.id = 'present-modal-css';
    link.rel = 'stylesheet';
    link.href = 'present-modal.css';
    document.head.appendChild(link);
  }

  const user = auth.currentUser;
  if (!user) { alert('Faça login para enviar Presentes.'); _modalOpen = false; return; }

  // Checar saldo
  const walletSnap = await get(ref(db, `wallets/${user.uid}`));
  const wallet = walletSnap.val() || { coins: 0 };
  if (!walletSnap.exists()) { alert('Crie sua Wallet primeiro em wallet.html'); _modalOpen = false; return; }

  // Carregar catálogo
  const catalog = await loadCatalog();
  _selectedPresent = catalog[0];

  // Construir modal
  const overlay = document.createElement('div');
  overlay.className = 'present-overlay';
  overlay.id = 'present-overlay';

  const recipientLabel = config.targetType === 'channel'
    ? `Canal da Cidade — ${esc(config.recipientName || 'Rádio')}`
    : `👤 ${esc(config.recipientName || 'Usuário')}`;

  overlay.innerHTML = `
  <div class="present-modal" id="present-modal">
    <button class="pm-close" onclick="window._closePresentModal()">✕ Fechar</button>
    <div class="pm-title">🎁 Enviar Presente</div>
    <div class="pm-subtitle">Presente encanta · Diamante recompensa · XP transforma gesto em status</div>
    <div class="pm-recipient">Para: <strong>${recipientLabel}</strong></div>
    <div class="pm-grid" id="pm-grid">${catalog.map(p => `
      <div class="pm-item${p.presentId === _selectedPresent.presentId ? ' selected' : ''}"
           id="pmitem-${p.presentId}"
           onclick="window._selectPresent('${p.presentId}')">
        <span class="pm-rarity rarity-${p.rarity}" title="${RARITY_LABEL[p.rarity]||p.rarity}">${(RARITY_LABEL[p.rarity]||'')[0]}</span>
        <div class="pm-emoji">${p.emoji}</div>
        <div class="pm-name">${esc(p.displayName)}</div>
        <div class="pm-cost">🪙 ${fmt(p.coinCost)}</div>
      </div>`).join('')}
    </div>
    <div class="pm-preview" id="pm-preview">${renderPreview(_selectedPresent)}</div>
    <div class="pm-balance">
      <span>Seu saldo</span>
      <span class="pm-balance-val">🪙 ${fmt(wallet.coins)} Moedas</span>
    </div>
    <div class="pm-error" id="pm-error"></div>
    <div class="pm-actions">
      <button class="pm-btn-cancel" onclick="window._closePresentModal()">Cancelar</button>
      <button class="pm-btn-send" id="pm-send-btn" onclick="window._sendPresent()">
        Enviar ${_selectedPresent.emoji} Presente →
      </button>
    </div>
  </div>`;

  document.body.appendChild(overlay);

  // Fechar ao clicar fora
  overlay.addEventListener('click', e => { if (e.target === overlay) window._closePresentModal(); });

  // Expor funções globais para o modal
  window._closePresentModal = function() {
    overlay.remove();
    _modalOpen = false;
    _selectedPresent = null;
  };

  window._selectPresent = function(presentId) {
    _selectedPresent = catalog.find(p => p.presentId === presentId) || catalog[0];
    document.querySelectorAll('.pm-item').forEach(el => el.classList.remove('selected'));
    document.getElementById(`pmitem-${presentId}`)?.classList.add('selected');
    document.getElementById('pm-preview').innerHTML = renderPreview(_selectedPresent);
    const btn = document.getElementById('pm-send-btn');
    if (btn) btn.textContent = `Enviar ${_selectedPresent.emoji} Presente →`;
  };

  window._sendPresent = async function() {
    const btn = document.getElementById('pm-send-btn');
    const errEl = document.getElementById('pm-error');
    errEl.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    try {
      await sendPresent({ ...config, present: _selectedPresent, senderUid: user.uid, senderName: user.displayName || 'Usuário', wallet });
      window._closePresentModal();
      if (config.onDelivered) config.onDelivered(_selectedPresent);
    } catch(err) {
      errEl.textContent = err.message || 'Erro ao enviar. Tente novamente.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = `Enviar ${_selectedPresent.emoji} Presente →`;
    }
  };
}

function renderPreview(p) {
  return `
    <div class="pm-preview-emoji">${p.emoji}</div>
    <div class="pm-preview-info">
      <div class="pm-preview-name">${esc(p.displayName)} <span style="font-size:.6rem;color:#64748b">${RARITY_LABEL[p.rarity]||''}</span></div>
      <div class="pm-preview-chips">
        <span class="pm-chip pm-chip-coin">🪙 ${fmt(p.coinCost)} Moedas</span>
        <span class="pm-chip pm-chip-diamond">💎 +${fmt(p.diamondReward)} Diamantes ao recebedor</span>
        <span class="pm-chip pm-chip-xp">⚡ +${fmt(p.xpAwardSender)} XP para você</span>
      </div>
    </div>`;
}

// ── TRANSAÇÃO DE PRESENTE ────────────────────────────────────────
async function sendPresent({ present, senderUid, senderName, recipientUid, recipientName, targetType, channelId, wallet }) {
  // Validação de saldo
  if ((wallet.coins || 0) < present.coinCost) {
    throw new Error(`Moedas insuficientes. Você tem 🪙 ${fmt(wallet.coins)} e este Presente custa 🪙 ${fmt(present.coinCost)}.`);
  }

  const now = Date.now();
  const galleryUntil = now + present.galleryVisibleDays * 24 * 3600 * 1000;

  // Débito atômico de Moedas do remetente
  await runTransaction(ref(db, `wallets/${senderUid}/coins`), current => {
    const current_ = current || 0;
    if (current_ < present.coinCost) throw new Error('Saldo insuficiente');
    return current_ - present.coinCost;
  });

  // Registrar transação de Moedas
  const coinTxRef = await push(ref(db, 'coinTransactions'), {
    uid: senderUid,
    type: 'spend',
    amount: present.coinCost,
    description: `🎁 Presente enviado: ${present.emoji} ${present.displayName} para ${recipientName || 'o Canal'}`,
    relatedEntity: present.presentId,
    createdAt: now
  });

  // Registrar a transação de Presente
  const ptxRef = await push(ref(db, 'presentTransactions'), {
    presentId: present.presentId,
    senderUid,
    senderName,
    recipientUid: recipientUid || null,
    recipientName: recipientName || 'Canal',
    targetType: targetType || 'channel',
    channelId: channelId || null,
    coinCost: present.coinCost,
    diamondsDelivered: recipientUid ? present.diamondReward : 0,
    xpAwardedSender: present.xpAwardSender,
    galleryVisibleUntil: galleryUntil,
    status: 'delivered',
    createdAt: now
  });
  const transactionId = ptxRef.key;

  // Crédito de Diamantes ao recebedor (se for usuário, não canal)
  if (recipientUid) {
    await runTransaction(ref(db, `wallets/${recipientUid}/diamonds`), current => (current || 0) + present.diamondReward);
    // Diamond transaction
    await push(ref(db, 'diamondTransactions'), {
      uid: recipientUid,
      type: 'earned',
      amount: present.diamondReward,
      reason: `🎁 Presente recebido: ${present.emoji} ${present.displayName} de ${senderName}`,
      relatedEntity: transactionId,
      createdAt: now
    });
    // Galeria do recebedor
    await set(ref(db, `presentGallery/${recipientUid}/${transactionId}`), {
      transactionId,
      presentId: present.presentId,
      presentName: present.displayName,
      presentEmoji: present.emoji,
      senderUid,
      senderName,
      diamondsReceived: present.diamondReward,
      galleryVisibleUntil: galleryUntil,
      createdAt: now
    });
  }

  // XP para o remetente
  const newXP = (wallet.xpGlobal || 0) + present.xpAwardSender;
  await update(ref(db, `wallets/${senderUid}`), { xpGlobal: newXP, updatedAt: now });
  await push(ref(db, 'xpLedger'), {
    uid: senderUid,
    type: 'global',
    amount: present.xpAwardSender,
    reason: `🎁 Presente enviado: ${present.emoji} ${present.displayName}`,
    relatedEntity: transactionId,
    createdAt: now
  });

  // Evento no canal (se targetType === 'channel')
  if (channelId) {
    await push(ref(db, `channelPresents/${channelId}`), {
      transactionId,
      senderUid,
      senderName,
      presentId: present.presentId,
      presentName: present.displayName,
      presentEmoji: present.emoji,
      targetType: targetType || 'channel',
      recipientUid: recipientUid || null,
      recipientName: recipientName || null,
      createdAt: now
    });
  }
}

// ── CARREGAR GALERIA DE PRESENTES RECEBIDOS ──────────────────────
export async function loadPresentGallery(uid, limit = 20) {
  const snap = await get(ref(db, `presentGallery/${uid}`));
  if (!snap.exists()) return [];
  const now = Date.now();
  return Object.values(snap.val())
    .filter(p => p.galleryVisibleUntil > now)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

// ── RENDER GALERIA ────────────────────────────────────────────────
export function renderGallery(items, containerEl) {
  if (!containerEl) return;
  if (!items.length) {
    containerEl.innerHTML = '<div style="text-align:center;color:#64748b;padding:24px;font-size:.8rem">Nenhum Presente recebido ainda.</div>';
    return;
  }
  containerEl.innerHTML = items.map(p => `
    <div class="pg-item">
      <div class="pg-emoji">${p.presentEmoji || '🎁'}</div>
      <div class="pg-info">
        <div class="pg-name">${esc(p.presentName || 'Presente')}</div>
        <div class="pg-from">De: ${esc(p.senderName || '—')}</div>
      </div>
      <div>
        <div class="pg-diamonds">💎 +${fmt(p.diamondsReceived)}</div>
        <div class="pg-date" style="font-size:.6rem;color:#475569;text-align:right">${new Date(p.createdAt).toLocaleDateString('pt-BR')}</div>
      </div>
    </div>`).join('');
}
