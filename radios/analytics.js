// analytics.js — Módulo de rastreamento de eventos CIDADEONLINE
// Fire-and-forget: nunca bloqueia a UX
import { getDatabase, ref, push, get, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

function db(){ return getDatabase(getApp()); }
function today(){ return new Date().toISOString().slice(0,10); }

/**
 * track(eventType, businessId, meta?)
 * eventType: 'profile_view' | 'whatsapp_click' | 'link_click' | 'post_click'
 *            | 'message_start' | 'business_card_click' | 'business_card_view'
 * businessId: profileId / businessId do comércio
 * meta: objeto extra opcional (linkId, source, etc.)
 */
export async function track(eventType, businessId, meta={}){
  if(!businessId) return;
  try{
    const now = Date.now();
    const d   = today();
    // 1. Raw event log
    push(ref(db(),'analyticsEvents'),{
      eventType, businessId, meta,
      ts:now, date:d,
      source: window.location.pathname.split('/').pop()||'unknown'
    });
    // 2. Aggregate increment businessMetrics/{bizId}/{date}/{type}
    const aggRef = ref(db(),`businessMetrics/${businessId}/${d}/${eventType}`);
    const snap   = await get(aggRef);
    await set(aggRef,(snap.val()||0)+1);
  }catch(e){ /* silencioso */ }
}
