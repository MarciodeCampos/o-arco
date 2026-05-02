import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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
const db  = getDatabase(app);

// Mapa centralizado no Brasil — auto-fit nos markers depois
const map = L.map('map', { zoomControl: false }).setView([-27.0, -50.0], 6);
L.control.zoom({ position: 'bottomright' }).addTo(map);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap', maxZoom: 19
}).addTo(map);

let allMarkers = [];
let activeFilter = '';
let selectedMarker = null;

const ICONS = {
  commerce: { emoji:'🏪', cls:'cpin-commerce'  },
  place:    { emoji:'📍', cls:'cpin-place'     },
  provider: { emoji:'🔧', cls:'cpin-provider'  },
  offer:    { emoji:'🎯', cls:'cpin-offer'     },
};
const STATUS_CLS   = { claimed:'badge-claimed', unclaimed:'badge-unclaimed', premium:'badge-premium' };
const STATUS_LABEL = { claimed:'✅ Ativo', unclaimed:'🔓 Não reivindicado', premium:'⭐ Premium', available:'Disponível', active:'Ativo' };

// ── SEED DEMONSTRAÇÃO — dados plausíveis por cidade ───────────────
const SEED = [
  // ── BALNEÁRIO CAMBORIÚ SC ──────────────────────────────────────
  { name:'Quiosque Beira Mar',     category:'Alimentação',   type:'commerce',  city:'Balneário Camboriú SC', lat:-26.9906, lng:-48.6348, status:'claimed',   address:'Av. Atlântica, 800 - BC' },
  { name:'Surf Shop Camboriú',     category:'Moda/Esporte',  type:'commerce',  city:'Balneário Camboriú SC', lat:-26.9921, lng:-48.6339, status:'claimed',   address:'Av. Brasil, 1200 - BC', whatsapp:'4799880001' },
  { name:'Hotel Atlântico',        category:'Hotelaria',     type:'commerce',  city:'Balneário Camboriú SC', lat:-26.9899, lng:-48.6355, status:'premium',   address:'Av. Atlântica, 2000 - BC' },
  { name:'Barbearia Styles BC',    category:'Barbearia',     type:'commerce',  city:'Balneário Camboriú SC', lat:-26.9945, lng:-48.6301, status:'unclaimed', address:'Rua 2000, 450 - BC' },
  { name:'Restaurante Mar Azul',   category:'Restaurante',   type:'commerce',  city:'Balneário Camboriú SC', lat:-26.9912, lng:-48.6330, status:'claimed',   address:'Av. Brasil, 500 - BC', whatsapp:'4799880002' },
  { name:'Imobiliária Praia',      category:'Imobiliária',   type:'commerce',  city:'Balneário Camboriú SC', lat:-26.9930, lng:-48.6315, status:'unclaimed', address:'Rua 3000, 150 - BC' },
  { name:'Academia Fitness BC',    category:'Academia',      type:'provider',  city:'Balneário Camboriú SC', lat:-26.9955, lng:-48.6288, status:'available', address:'Rua Dinamarca, 300 - BC' },
  { name:'Oferta: 20% Hotelaria',  category:'Oferta',        type:'offer',     city:'Balneário Camboriú SC', lat:-26.9901, lng:-48.6350, status:'active',    address:'Av. Atlântica, 2000 - BC' },
  { name:'Quiosque do Centrinho',  category:'Alimentação',   type:'commerce',  city:'Balneário Camboriú SC', lat:-26.9870, lng:-48.6380, status:'unclaimed', address:'Av. do Estado, 80 - BC' },
  { name:'Clínica Estética Praia', category:'Estética',      type:'provider',  city:'Balneário Camboriú SC', lat:-26.9938, lng:-48.6308, status:'claimed',   address:'Rua 1200, 99 - BC', whatsapp:'4799880003' },

  // ── FRANCISCO BELTRÃO PR ───────────────────────────────────────
  { name:'Padaria Central',        category:'Alimentação',   type:'commerce',  city:'Francisco Beltrão PR',  lat:-26.0783, lng:-53.0569, status:'unclaimed', address:'Rua Marcelino Dias, 215 - FB' },
  { name:'Barbearia do João',      category:'Barbearia',     type:'commerce',  city:'Francisco Beltrão PR',  lat:-26.0795, lng:-53.0551, status:'claimed',   address:'Av. Júlio Assis Cavalheiro, 890 - FB', whatsapp:'46999990001' },
  { name:'Farmácia Popular',       category:'Saúde',         type:'commerce',  city:'Francisco Beltrão PR',  lat:-26.0770, lng:-53.0580, status:'claimed',   address:'Rua Souza Naves, 450 - FB' },
  { name:'Mercado São João',       category:'Supermercado',  type:'commerce',  city:'Francisco Beltrão PR',  lat:-26.0801, lng:-53.0541, status:'premium',   address:'Av. General Ernesto Geisel, 2500 - FB' },
  { name:'Restaurante Sabor',      category:'Restaurante',   type:'commerce',  city:'Francisco Beltrão PR',  lat:-26.0790, lng:-53.0558, status:'claimed',   address:'Rua Dez de Novembro, 320 - FB' },
  { name:'Praça da Bíblia',        category:'Praça',         type:'place',     city:'Francisco Beltrão PR',  lat:-26.0778, lng:-53.0560, status:'claimed',   address:'Centro - FB' },
  { name:'UBS Centro FB',          category:'Saúde',         type:'place',     city:'Francisco Beltrão PR',  lat:-26.0788, lng:-53.0575, status:'claimed',   address:'Rua Dez de Novembro, 100 - FB' },
  { name:'Mecânica Rápida',        category:'Automotivo',    type:'provider',  city:'Francisco Beltrão PR',  lat:-26.0760, lng:-53.0595, status:'available', address:'Rua Tiradentes, 1200 - FB' },

  // ── CASCAVEL PR ────────────────────────────────────────────────
  { name:'Mecânica Silva',         category:'Automotivo',    type:'provider',  city:'Cascavel PR',           lat:-24.9580, lng:-53.4590, status:'unclaimed', address:'Rua Tiradentes, 1200 - Cascavel' },
  { name:'Lanchonete Central',     category:'Alimentação',   type:'commerce',  city:'Cascavel PR',           lat:-24.9570, lng:-53.4600, status:'claimed',   address:'Av. Brasil, 500 - Cascavel' },

  // ── PATO BRANCO PR ────────────────────────────────────────────
  { name:'Pet Shop Amigo Fiel',    category:'Pet Shop',      type:'commerce',  city:'Pato Branco PR',        lat:-26.2267, lng:-52.6718, status:'claimed',   address:'Rua Caramuru, 400 - PB' },
  { name:'Clínica Odonto',         category:'Saúde',         type:'provider',  city:'Pato Branco PR',        lat:-26.2280, lng:-52.6700, status:'unclaimed', address:'Av. Brasil, 1100 - PB' },

  // ── DOIS VIZINHOS PR ──────────────────────────────────────────
  { name:'Salão Beleza & Arte',    category:'Beleza',        type:'commerce',  city:'Dois Vizinhos PR',      lat:-25.7519, lng:-53.0571, status:'unclaimed', address:'Rua XV de Novembro, 180 - DV' },
];

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;') }

function makeIcon(type, status) {
  const ic = ICONS[type] || { emoji:'📍', cls:'cpin-commerce' };
  const ex = status === 'unclaimed' ? ' cpin-unclaimed' : '';
  return L.divIcon({ html:`<div class="cpin ${ic.cls}${ex}">${ic.emoji}</div>`, className:'', iconSize:[32,32], iconAnchor:[16,16] });
}

function addMarker(item) {
  if (!item.lat || !item.lng) return null;
  const marker = L.marker([item.lat, item.lng], { icon: makeIcon(item.type, item.status) });
  marker._data = item;
  marker.addTo(map);
  marker.on('click', () => openDetail(marker));
  allMarkers.push(marker);
  return marker;
}

function openDetail(marker) {
  const d = marker._data;
  if (selectedMarker && selectedMarker !== marker)
    selectedMarker.getElement()?.querySelector('.cpin')?.classList.remove('selected');
  selectedMarker = marker;
  marker.getElement()?.querySelector('.cpin')?.classList.add('selected');

  const ic = ICONS[d.type] || { emoji:'📍' };
  document.getElementById('d-icon').textContent = ic.emoji;
  document.getElementById('d-name').textContent = d.name || 'Sem nome';
  document.getElementById('d-cat').textContent  = [d.category, d.city].filter(Boolean).join(' · ');

  const bc = STATUS_CLS[d.status] || 'badge-unclaimed';
  const bl = STATUS_LABEL[d.status] || d.status;
  let badges = `<span class="detail-badge ${bc}">${bl}</span>`;
  if (d.plan) badges += ` <span class="detail-badge badge-premium">${d.plan}</span>`;
  document.getElementById('d-badges').innerHTML = badges;

  let rows = '';
  if (d.address)  rows += `<div class="detail-row"><strong>📍</strong><span>${esc(d.address)}</span></div>`;
  if (d.city)     rows += `<div class="detail-row"><strong>🏙️</strong><span>${esc(d.city)}</span></div>`;
  if (d.phone)    rows += `<div class="detail-row"><strong>📞</strong><span>${esc(d.phone)}</span></div>`;
  if (d.whatsapp) rows += `<div class="detail-row"><strong>💬</strong><a href="https://wa.me/55${d.whatsapp.replace(/\D/g,'')}" target="_blank" style="color:#25d366">${esc(d.whatsapp)}</a></div>`;
  document.getElementById('d-rows').innerHTML = rows;

  const tags = [d.category, d.type].filter(Boolean);
  document.getElementById('d-tags').innerHTML = tags.map(t=>`<span class="detail-tag">${esc(t)}</span>`).join('');
  document.getElementById('d-desc').textContent = d.description || '';

  let footer = '';
  if (d.slug||d.id) footer += `<a class="btn-primary" href="profile.html?id=${esc(d.slug||d.id)}" target="_blank">👁 Ver Perfil</a>`;
  if (d.whatsapp)   footer += `<a class="btn-secondary" href="https://wa.me/55${d.whatsapp.replace(/\D/g,'')}" target="_blank">💬 WhatsApp</a>`;
  if (!d.slug&&!d.whatsapp&&d.status==='unclaimed') footer += `<a class="btn-secondary" href="business-claims.html">🔓 Reivindicar perfil</a>`;
  document.getElementById('d-footer').innerHTML = footer;

  document.getElementById('detail-panel').classList.add('open');
  map.panTo([d.lat, d.lng], { animate:true });
}

function closeDetail() {
  document.getElementById('detail-panel').classList.remove('open');
  if (selectedMarker) {
    selectedMarker.getElement()?.querySelector('.cpin')?.classList.remove('selected');
    selectedMarker = null;
  }
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3500);
}

window.setFilter = function(btn, filter) {
  activeFilter = filter;
  document.querySelectorAll('.tb-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filterMarkers();
};
window.filterMarkers = function() {
  const q = (document.getElementById('tb-search')?.value||'').toLowerCase();
  let visible = 0;
  allMarkers.forEach(m => {
    const d = m._data;
    const mt = !activeFilter || d.type === activeFilter;
    const mq = !q || (d.name||'').toLowerCase().includes(q)||(d.category||'').toLowerCase().includes(q)||(d.city||'').toLowerCase().includes(q)||(d.address||'').toLowerCase().includes(q);
    if (mt&&mq){ m.addTo(map); visible++; } else m.remove();
  });
  document.getElementById('tb-count').textContent = `${visible} pontos`;
};
window.closeDetail = closeDetail;

async function loadData() {
  let count = 0;
  try {
    const [biz, places, prov, offers] = await Promise.all([
      get(ref(db,'businessProfiles')), get(ref(db,'places')),
      get(ref(db,'serviceProviders')), get(ref(db,'businessOffers')),
    ]);
    if (biz.exists())    Object.values(biz.val()).forEach(b => { if(b.lat&&b.lng){ addMarker({...b,type:b.type||'commerce'}); count++; }});
    if (places.exists()) Object.values(places.val()).forEach(p => { if(p.lat&&p.lng){ addMarker({...p,type:'place'}); count++; }});
    if (prov.exists())   Object.values(prov.val()).forEach(p => { if(p.lat&&p.lng){ addMarker({...p,type:'provider'}); count++; }});
    if (offers.exists()) Object.values(offers.val()).filter(o=>o.active&&o.lat&&o.lng).forEach(o => { addMarker({...o,type:'offer'}); count++; });
  } catch(e) { console.warn('Firebase:', e); }

  // Sempre adiciona seed de demonstração para cidades sem coords no Firebase
  SEED.forEach(s => {
    const already = allMarkers.find(m => m._data.name === s.name);
    if (!already) { addMarker(s); count++; }
  });

  if (count === 0) {
    SEED.forEach(s => { addMarker(s); count++; });
  }

  document.getElementById('tb-count').textContent = `${count} pontos`;
  document.getElementById('map-loading').style.display = 'none';

  // Auto-fit para mostrar todos os markers
  if (allMarkers.length > 0) {
    const group = L.featureGroup(allMarkers);
    map.fitBounds(group.getBounds().pad(0.15));
  }
}

loadData();
map.on('click', e => { if (!e.originalEvent.target.closest('.cpin')) closeDetail(); });
// ── CAMADA DE PROPRIEDADES BC ─────────────────────────────────────
const PROP_ICON = L.divIcon({
  html: '<div class="cpin" style="background:#be185d;border:2px solid rgba(255,255,255,.3);font-size:11px">🏠</div>',
  className:'', iconSize:[28,28], iconAnchor:[14,14]
});

let propMarkers = [];
let propData    = [];
let propLayerOn = true;

async function loadProperties() {
  try {
    const resp = await fetch('bc-properties.json');
    propData = await resp.json();
    propData.forEach(p => {
      const m = L.marker([p.lat, p.lng], { icon: PROP_ICON });
      m._data = { ...p, name: `${p.logradouro}, ${p.numero}`, category: 'Imóvel', icon: '🏠' };
      m.on('click', () => openDetail(m));
      m.addTo(map);
      propMarkers.push(m);
    });
    const btn = document.getElementById('btn-properties');
    if (btn) btn.textContent = `🏠 Imóveis (${propData.length})`;
    updateCount();
  } catch(e) { console.warn('Propriedades:', e); }
}

window.toggleProperties = function() {
  propLayerOn = !propLayerOn;
  propMarkers.forEach(m => propLayerOn ? m.addTo(map) : m.remove());
  const btn = document.getElementById('btn-properties');
  if (btn) btn.classList.toggle('active', propLayerOn);
};

// Busca por endereço: geocodifica via Nominatim e navega
window.searchAddress = async function() {
  const q = document.getElementById('addr-search')?.value?.trim();
  if (!q || q.length < 3) return;
  const btn = document.getElementById('addr-btn');
  btn.textContent = '⌛'; btn.disabled = true;

  // Primeiro: buscar nos dados locais
  const local = propData.filter(p =>
    `${p.logradouro} ${p.numero} ${p.bairro}`.toLowerCase().includes(q.toLowerCase())
  );
  if (local.length > 0) {
    map.setView([local[0].lat, local[0].lng], 17, { animate: true });
    const m = propMarkers.find(m => m._data.numero === local[0].numero && m._data.logradouro === local[0].logradouro);
    if (m) openDetail(m);
    btn.textContent = '🔍'; btn.disabled = false;
    return;
  }

  // Fallback: Nominatim
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q+', Balneário Camboriú, SC, Brasil')}&format=json&limit=1`;
    const r = await fetch(url, { headers: { 'User-Agent':'CIDADEONLINE/1.0' } });
    const data = await r.json();
    if (data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      map.setView([lat, lng], 17, { animate: true });
      L.popup().setLatLng([lat, lng]).setContent(`📍 ${q}<br><small>${data[0].display_name}</small>`).openOn(map);
    } else {
      toast('Endereço não encontrado. Tente: "Rua 2438, 159"');
    }
  } catch(e) { toast('Erro na busca. Tente novamente.'); }
  btn.textContent = '🔍'; btn.disabled = false;
};

loadProperties();
