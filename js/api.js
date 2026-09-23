// fetch 래퍼 · 세션 · 에러 표준화 (지시서 §3-4 · §4-1)
import { FN } from "./const.js";

const KEY = "ex:session";

export const session = {
  get() { try { return JSON.parse(localStorage.getItem(KEY) || sessionStorage.getItem(KEY) || "null"); } catch { return null; } },
  set(s, remember = false) { this.clear(); (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(s)); },   // 로그인 유지 = localStorage
  clear() { try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch {} },
  token() { return this.get()?.token || ""; },
  user() { return this.get()?.user || null; },
  isAdmin() { return this.user()?.role === "admin"; },
};

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || ("오류 " + status));
    this.status = status; this.code = body?.code || "ERROR"; this.at = body?.at; this.body = body;
  }
}

/** 모든 함수 호출. 실패는 ApiError {status, code, message}. 401이면 세션 지우고 로그인으로 */
export async function api(fn, body, { auth = true, timeoutMs = 90000 } = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  let r, j;
  try {
    r = await fetch(FN(fn), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(auth && session.token() ? { Authorization: "Bearer " + session.token() } : {}) },
      body: JSON.stringify(body || {}),
      signal: ac.signal,
    });
    const text = await r.text();
    try { j = JSON.parse(text); } catch { j = { code: "BAD_RESPONSE", message: text.slice(0, 200) }; }
  } catch (e) {
    throw new ApiError(0, { code: e.name === "AbortError" ? "TIMEOUT" : "NETWORK", message: e.name === "AbortError" ? "응답이 너무 늦습니다. 다시 시도하세요." : "네트워크 오류. 인터넷 연결을 확인하세요." });
  } finally { clearTimeout(t); }
  if (!r.ok) {
    if (r.status === 401 && auth) { session.clear(); location.hash = "#/login"; }
    throw new ApiError(r.status, j);
  }
  return j;
}

/* ── 작은 DOM 도우미 ── */
export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let toastTimer = null;
export function toast(msg, kind = "info", ms = 3200) {
  let el = $("#toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; document.body.appendChild(el); }
  el.textContent = msg; el.className = "show " + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ""; }, ms);
}
export const errMsg = (e) => (e instanceof ApiError ? e.message + (e.code ? " (" + e.code + ")" : "") : String(e?.message || e));

export function busy(on, text = "처리 중…") {
  let el = $("#busy");
  if (!el) { el = document.createElement("div"); el.id = "busy"; document.body.appendChild(el); }
  el.textContent = text; el.hidden = !on;
}

export const fmtDate = (iso) => { if (!iso) return ""; const d = new Date(iso); return d.getFullYear() + "." + String(d.getMonth() + 1).padStart(2, "0") + "." + String(d.getDate()).padStart(2, "0"); };
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
