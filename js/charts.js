// SVG 유틸 + 차트 3종 (지시서 §5-3). 외부 라이브러리 ✕. 축 라벨 동적 배치 ✕.
import { COLOR, TYPE_LABEL } from "./const.js";

export const escapeXml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
export const polarToXY = (cx, cy, r, deg) => { const a = ((deg - 90) * Math.PI) / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
export function arcPath(cx, cy, r, r2, a0, a1) {   // 도넛 조각 (a0→a1 도, 시계방향)
  if (a1 - a0 >= 359.99) a1 = a0 + 359.99;
  const [x0, y0] = polarToXY(cx, cy, r, a0), [x1, y1] = polarToXY(cx, cy, r, a1);
  const [x2, y2] = polarToXY(cx, cy, r2, a1), [x3, y3] = polarToXY(cx, cy, r2, a0);
  const big = a1 - a0 > 180 ? 1 : 0;
  return "M" + x0 + " " + y0 + " A" + r + " " + r + " 0 " + big + " 1 " + x1 + " " + y1 + " L" + x2 + " " + y2 + " A" + r2 + " " + r2 + " 0 " + big + " 0 " + x3 + " " + y3 + " Z";
}
export function niceTicks(max, n = 4) {
  if (max <= 0) return [0];
  const raw = max / n, p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw) || p * 10;
  const out = []; for (let v = 0; v <= max + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  if (out[out.length - 1] < max) out.push(Math.round((out[out.length - 1] + step) * 100) / 100);
  return out;
}
/** 글자 폭 추정 (px): 한글 1em · 영숫자 0.56em */
export const textW = (s, fs) => Array.from(String(s ?? "")).reduce((w, ch) => w + (/[ᄀ-ᇿ㄰-㆏가-힯　-〿＀-￯]/.test(ch) ? fs : fs * 0.56), 0);
/** 폭에 맞춰 줄바꿈 (SVG 는 자동 줄바꿈 없음) */
export function wrap(s, fs, width) {
  const lines = []; let cur = "";
  for (const para of String(s ?? "").split("\n")) {
    cur = "";
    for (const word of para.split(/(\s+)/)) {
      if (textW(cur + word, fs) <= width) { cur += word; continue; }
      if (cur.trim()) lines.push(cur.trim());
      cur = "";
      // 단어 하나가 폭보다 길면 글자 단위로 자른다
      for (const ch of word) { if (textW(cur + ch, fs) > width) { lines.push(cur); cur = ""; } cur += ch; }
    }
    lines.push(cur.trim());
  }
  return lines.filter((l, i, a) => l || (i < a.length - 1));
}
export function textBlock(x, y, s, { fs = 26, width = 980, lh = 1.5, fill = COLOR.ink, weight = 400, anchor = "start" } = {}) {
  const lines = wrap(s, fs, width);
  const svg = lines.map((l, i) => '<text x="' + x + '" y="' + (y + fs + i * fs * lh) + '" font-size="' + fs + '" font-weight="' + weight + '" fill="' + fill + '" text-anchor="' + anchor + '">' + escapeXml(l) + "</text>").join("");
  return { svg, height: lines.length * fs * lh + fs * 0.3 };
}

/** 문항 타일맵: items(정렬됨) · state(key→ 'ok'|'wrong'|'na'|'writing') · 킬러(difficulty 3) 테두리 */
export function tileMap(x, y, items, state, { width = 980, size = 72, gap = 12 } = {}) {
  const per = Math.max(1, Math.floor((width + gap) / (size + gap)));
  let svg = "";
  items.forEach((it, k) => {
    const cx = x + (k % per) * (size + gap), cy = y + Math.floor(k / per) * (size + gap);
    const st = state[it.no + "-" + (it.sub_no || 0)] || "na";
    const fill = st === "wrong" ? COLOR.red : st === "ok" ? COLOR.blue : st === "writing" ? "#fff" : COLOR.soft;
    const color = st === "wrong" || st === "ok" ? "#fff" : COLOR.ink;
    const stroke = Number(it.difficulty) === 3 ? ' stroke="' + COLOR.ink + '" stroke-width="4"' : (st === "writing" ? ' stroke="#bbb" stroke-width="2" stroke-dasharray="6 4"' : "");
    svg += '<rect x="' + cx + '" y="' + cy + '" width="' + size + '" height="' + size + '" rx="12" fill="' + fill + '"' + stroke + "/>";
    const lbl = it.label ? it.label.replace(/^(서답형|서술형|논술형)\s*/, "서") : (it.no >= 100 ? "서" + (it.no - 100) : String(it.no) + (it.sub_no ? "-" + it.sub_no : ""));
    svg += '<text x="' + (cx + size / 2) + '" y="' + (cy + size / 2 + 9) + '" font-size="' + (lbl.length > 2 ? 20 : 26) + '" font-weight="700" fill="' + color + '" text-anchor="middle">' + escapeXml(lbl) + "</text>";
  });
  const rows = Math.ceil(items.length / per);
  return { svg, height: rows * (size + gap) - gap };
}

/** 가로 막대: rows [{label, value, max}] · 라벨 좌측 고정폭 */
export function hBars(x, y, rows, { width = 980, labelW = 130, barH = 34, gap = 18, color = COLOR.red, track = COLOR.soft, unit = "점", valueW = 300 } = {}) {
  const max = Math.max(1, ...rows.map((r) => r.max ?? r.value));
  const bw = width - labelW - valueW;
  let svg = "";
  rows.forEach((r, i) => {
    const cy = y + i * (barH + gap);
    const w = Math.max(0, (r.value / max) * bw);
    svg += '<text x="' + x + '" y="' + (cy + barH * 0.72) + '" font-size="26" fill="' + COLOR.ink + '">' + escapeXml(r.label) + "</text>";
    svg += '<rect x="' + (x + labelW) + '" y="' + cy + '" width="' + bw + '" height="' + barH + '" rx="8" fill="' + track + '"/>';
    if (w > 0) svg += '<rect x="' + (x + labelW) + '" y="' + cy + '" width="' + w + '" height="' + barH + '" rx="8" fill="' + color + '"/>';
    svg += '<text x="' + (x + labelW + bw + 14) + '" y="' + (cy + barH * 0.72) + '" font-size="24" font-weight="700" fill="' + COLOR.ink + '">' + escapeXml(r.text ?? (r.value + unit)) + "</text>";
  });
  return { svg, height: rows.length * (barH + gap) - gap };
}

/** 도넛: parts [{label, value}] · 5계열까지 명도 변형 */
export function donut(x, y, parts, { r = 110, r2 = 66, width = 980 } = {}) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const shades = [COLOR.blue, "#8ea2ff", "#c3ccff", "#2f4bd6", "#6178ff"];
  const cx = x + r + 10, cy = y + r + 10;
  let a = 0, svg = "";
  parts.forEach((p, i) => {
    const sweep = (p.value / total) * 360;
    if (sweep > 0) svg += '<path d="' + arcPath(cx, cy, r, r2, a, a + sweep) + '" fill="' + shades[i % shades.length] + '"/>';
    const ly = y + 20 + i * 38;
    svg += '<rect x="' + (cx + r + 50) + '" y="' + (ly - 22) + '" width="26" height="26" rx="6" fill="' + shades[i % shades.length] + '"/>';
    svg += '<text x="' + (cx + r + 88) + '" y="' + ly + '" font-size="26" fill="' + COLOR.ink + '">' + escapeXml(p.label) + " " + p.value + "점 (" + Math.round((p.value / total) * 100) + "%)</text>";
    a += sweep;
  });
  return { svg, height: Math.max(2 * r + 20, parts.length * 38 + 10) };
}

export const typeLabel = (t) => TYPE_LABEL[t] || t;
