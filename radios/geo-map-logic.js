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

const DEFAULT_CENTER = [-26.0782, -53.0568];
const DEFAULT_ZOOM   = 14;

const map = L.map('map', { zoomControl: false }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
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

const SEED = [
  { name:'Padaria Central',        category:'Alimentação',  type:'commerce', lat:-26.0782, lng:-53.0568, status:'unclaimed', address:'Rua Marcelino Dias, 215' },
  { name:'Barbearia do João',      category:'Barbearia',    type:'commerce', lat:-26.0795, lng:-53.0551, status:'claimed',   address:'Av. Júlio Assis Cavalheiro, 890', whatsapp:'46999990001' },
  { name:'Farmácia Popular',       category:'Saúde',        type:'commerce', lat:-26.0770, lng:-53.0580, status:'claimed',   address:'Rua Souza Naves, 450' },
  { name:'Auto Mecânica Silva',    category:'Automotivo',   type:'provider', lat:-26.0760, lng:-53.0595, status:'available', address:'Rua Tiradentes, 1200' },
  { name:'Mercado Beltrão',        category:'Supermercado', type:'commerce', lat:-26.0800, lng:-53.0540, status:'premium',   address:'Av. General Ernesto Geisel, 2500' },
  { name:'Praça da Bíblia',        category:'Praça',        type:'place',    lat:-26.0778, lng:-53.0560, status:'claimed',   address:'Centro, Francisco Beltrão' },
  { name:'UBS Centro',             category:'Saúde',        type:'place',    lat:-26.0788, lng:-53.0575, status:'claimed',   address:'Rua Dez de Novembro, 100' },
  { name:'Academia Fitness',       category:'Academia',     type:'provider', lat:-26.0755, lng:-53.0610, status:'available', address:'Av. Presidente Vargas, 600' },
  { name:'Escritório Contábil',    category:'Contabilidade',type:'provider', lat:-26.0810, lng:-53.0530, status:'unclaimed', address:'Rua XV de Novembro, 330' },
  { name:'Oferta: Desconto Barber',category:'Oferta',       type:'offer',    lat:-26.0793, lng:-53.0548, status:'active',    address:'Av. Júlio Assis Cavalheiro, 890' },
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
  if (selectedMarker && selectedMarker !== marker) {
    selectedMarker.getElement()?.querySelector('.cpin')?.classList.remove('selected');
  }
  selectedMarker = marker;
  marker.getElement()?.querySelector('.cpin')?.classList.add('selected');

  const ic = ICONS[d.type] || { emoji:'📍' };
  document.getElementById('d-icon').textContent = d.icon || ic.emoji;
  document.getElementById('d-name').textContent = d.name || 'Sem nome';
  document.getElementById('d-cat').textContent  = d.category || d.type || '';

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
  if (d.hours)    rows += `<div class="detail-row"><strong>🕐</strong><span>${esc(d.hours)}</span></div>`;
  document.getElementById('d-rows').innerHTML = rows;

  const tags = [d.category, d.state, d.type].filter(Boolean);
  document.getElementById('d-tags').innerHTML = tags.map(t=>`<span class="detail-tag">${esc(t)}</span>`).join('');
  document.getElementById('d-desc').textContent = d.description || '';

  let footer = '';
  if (d.slug || d.id) footer += `<a class="btn-primary" href="profile.html?id=${esc(d.slug||d.id)}" target="_blank">👁 Ver Perfil</a>`;
  if (d.whatsapp) footer += `<a class="btn-secondary" href="https://wa.me/55${d.whatsapp.replace(/\D/g,'')}" target="_blank">💬 WhatsApp</a>`;
  if (!d.slug && !d.whatsapp && d.status === 'unclaimed') footer += `<a class="btn-secondary" href="business-claims.html">🔓 Reivindicar perfil</a>`;
  document.getElementById('d-footer').innerHTML = footer;

  document.getElementById('detail-panel').classList.add('open');
  map.panTo([d.lat, d.lng], { animate: true });
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
  setTimeout(() => el.classList.remove('show'), 3000);
}

window.setFilter = function(btn, filter) {
  activeFilter = filter;
  document.querySelectorAll('.tb-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filterMarkers();
};
window.filterMarkers = function() {
  const q = (document.getElementById('tb-search')?.value || '').toLowerCase();
  let visible = 0;
  allMarkers.forEach(m => {
    const d = m._data;
    const mt = !activeFilter || d.type === activeFilter;
    const mq = !q || (d.name||'').toLowerCase().includes(q) || (d.category||'').toLowerCase().includes(q) || (d.address||'').toLowerCase().includes(q);
    if (mt && mq) { m.addTo(map); visible++; } else m.remove();
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
    if (biz.exists())    Object.values(biz.val()).forEach(b => { if(b.lat&&b.lng){ addMarker({...b,type:'commerce',icon:'🏪'}); count++; }});
    if (places.exists()) Object.values(places.val()).forEach(p => { if(p.lat&&p.lng){ addMarker({...p,type:'place',icon:'📍'}); count++; }});
    if (prov.exists())   Object.values(prov.val()).forEach(p => { if(p.lat&&p.lng){ addMarker({...p,type:'provider',icon:'🔧'}); count++; }});
    if (offers.exists()) Object.values(offers.val()).filter(o=>o.active&&o.lat&&o.lng).forEach(o => { addMarker({...o,type:'offer',icon:'🎯'}); count++; });
  } catch(e) { console.warn('Firebase error:', e); }

  if (count === 0) {
    SEED.forEach(s => addMarker(s));
    count = SEED.length;
    toast('Demonstração — adicione lat/lng nos perfis para pins reais.');
  }
  document.getElementById('tb-count').textContent = `${count} pontos`;
  document.getElementById('map-loading').style.display = 'none';
}

loadData();
map.on('click', e => { if (!e.originalEvent.target.closest('.cpin')) closeDetail(); });