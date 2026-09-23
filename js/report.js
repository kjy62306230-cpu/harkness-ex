// ③ 결과지 — 학부모용·학생용 각 세로 2장(1080px SVG → PNG) (지시서 §4-5 · §5 · 2026-09-23 J님 요청: 2장으로 세부화)
import { TYPE_LABEL, TEACHER_COMMENTS, NOTICE_PARENT, NOTICE_STUDENT, NEXT_ACTION, COLOR, INPUT_LEVEL_LABEL, itemLabel } from "./const.js";
import { api, $, $$, esc, toast, errMsg, busy, fmtDate } from "./api.js";
import { escapeXml, textBlock, tileMap, hBars, donut } from "./charts.js";

const W = 1080, PAD = 50, CW = W - PAD * 2, TOP = 60, BOTTOM = 70;

export function renderReportTab(body, S, rest = []) {
  const ex = S.exam;
  if (ex.status !== "confirmed") { body.innerHTML = '<div class="err-box">정답이 확정되지 않은 시험입니다.</div>'; return; }
  const cur = rest[0] || "";
  const rows = S.students.map((s) => {
    const r = S.results.find((x) => x.student_id === s.id);
    const rp = S.reports.filter((x) => x.student_id === s.id);
    const parent = rp.find((x) => x.kind === "parent");
    return '<tr><td><b>' + esc(s.name) + "</b> <span class=\"muted\">" + esc(s.school) + s.grade + "</span>" + (s.consent_at ? "" : ' <span class="tag bad">동의 없음</span>') + "</td><td>" +
      (r ? esc(INPUT_LEVEL_LABEL[r.input_level]) + (r.totals?.mc_score != null ? " · " + r.totals.mc_score + "/" + r.totals.mc_max : "") + (r.needs_regrade ? ' <span class="tag bad">재채점 필요</span>' : "") : '<span class="muted">채점 없음</span>') + "</td><td>" +
      (parent ? (parent.delivered_at ? '<span class="tag ok">전달 ' + fmtDate(parent.delivered_at) + "</span>" : '<span class="tag">생성됨</span>') : "") + "</td><td>" +
      (r ? (r.needs_regrade ? '<a href="#/exam/' + ex.id + "/grade/" + s.id + '">재계산 후 가능</a>' : '<a href="#/exam/' + ex.id + "/report/" + s.id + '/parent">학부모용</a> · <a href="#/exam/' + ex.id + "/report/" + s.id + '/student">학생용</a>') : '<a href="#/exam/' + ex.id + "/grade/" + s.id + '">채점하러</a>') + "</td></tr>";
  }).join("");
  body.innerHTML = '<table class="simple"><thead><tr><th>학생</th><th>채점</th><th>학부모용</th><th></th></tr></thead><tbody>' + rows + '</tbody></table><div id="rBody"></div>';
  if (cur) renderOne($("#rBody"), S, cur, rest[1] || "parent");
}

async function renderOne(host, S, studentId, kind) {
  const ex = S.exam, st = S.students.find((s) => s.id === studentId);
  if (!st) { host.innerHTML = '<div class="err-box">학생을 찾지 못했습니다.</div>'; return; }
  host.innerHTML = '<div class="card"><div class="student-name-big">' + esc(st.name) + ' <span class="muted" style="font-size:14px">' + (kind === "parent" ? "학부모용" : "학생용") + " · 2장</span></div>" +
    (kind === "parent" ? '<div class="row"><label>선생님 한마디 <select id="rKey"><option value="">— 선택 —</option>' + Object.entries(TEACHER_COMMENTS).map(([k, v]) => '<option value="' + k + '">' + esc(v) + "</option>").join("") + '</select></label><input id="rExtra" placeholder="한 줄 덧붙이기 (선택)" maxlength="120" style="flex:1;min-width:200px"></div>' : "") +
    '<div class="row" style="margin-top:8px"><button id="rBuild" class="primary">결과지 만들기</button><button id="rSave" disabled>이미지 저장 (2장)</button><button id="rDeliver" disabled>전달 체크</button><span class="muted" id="rInfo"></span></div><div id="rErr"></div></div>' +
    '<div class="report-preview" id="rPrev"></div>';
  let payload = null, reportId = null, delivered = null;
  const setInfo = () => { $("#rInfo").textContent = reportId ? "생성됨" + (delivered ? " · 전달 " + fmtDate(delivered) : "") : ""; $("#rDeliver").textContent = delivered ? "전달 취소" : "전달 체크"; };

  function show() {
    $("#rPrev").innerHTML = composePages(payload).map((svg, i) => '<div class="muted" style="margin:10px 0 4px">' + (i + 1) + " / 2</div>" + svg).join("");
    $("#rSave").disabled = false; $("#rDeliver").disabled = !reportId; setInfo();
  }
  const build = async (force = false) => {
    $("#rErr").innerHTML = "";
    try {
      busy(true, "결과지 생성 중…");
      const r = await api("ex-report", { action: "build", exam_id: ex.id, student_id: st.id, kind, force, teacher_comment_key: $("#rKey")?.value || null, teacher_comment_extra: $("#rExtra")?.value || null });
      payload = r.payload; reportId = r.report.id; delivered = r.report.delivered_at; show(); toast("결과지 생성됨", "ok");
    } catch (e) {
      if (e.code === "REPORT_DELIVERED" && !force && confirm(e.message + "\n\n다시 만들까요?")) return build(true);
      $("#rErr").innerHTML = '<div class="err-box">' + esc(errMsg(e)) + "</div>";
    } finally { busy(false); }
  };
  $("#rBuild").onclick = () => build(false);
  $("#rSave").onclick = () => savePng(payload, ex, st);
  $("#rDeliver").onclick = async () => {
    if (!delivered && !confirm(st.name + " 학생 (" + (kind === "parent" ? "학부모용" : "학생용") + ") 전달 완료로 표시할까요?")) return;
    try { const r = await api("ex-report", { action: "delivered", report_id: reportId, undo: !!delivered }); delivered = r.report.delivered_at; setInfo(); toast(delivered ? "전달 체크됨" : "전달 취소됨", "ok"); }
    catch (e) { toast(errMsg(e), "err"); }
  };

  // 기존 캐시 있으면 바로 보여준다 (핸들러를 먼저 붙인 뒤에 기다린다)
  try {
    const g = await api("ex-report", { action: "get", exam_id: ex.id, student_id: st.id, kind });
    if (g.stale) $("#rErr").innerHTML = '<div class="err-box">문항이 바뀌어 예전 결과지는 숨겼습니다. ② 채점에서 [재계산] 후 다시 만드세요.</div>';
    if (g.report && !payload) { payload = g.report.payload; reportId = g.report.id; delivered = g.report.delivered_at; if ($("#rKey") && g.report.teacher_comment_key) $("#rKey").value = g.report.teacher_comment_key; if ($("#rExtra") && g.report.teacher_comment_extra) $("#rExtra").value = g.report.teacher_comment_extra; show(); }
  } catch {}
}

/* ───────── 페이지 빌더 ───────── */
function page() {
  const parts = []; let y = TOP;
  const P = {
    add(svg, h) { parts.push(svg); y += h; },
    gap(h = 34) { y += h; },
    H(title) { P.add('<text x="' + PAD + '" y="' + (y + 30) + '" font-size="30" font-weight="800" fill="' + COLOR.ink + '">' + escapeXml(title) + "</text>", 48); },
    rule() { P.add('<rect x="' + PAD + '" y="' + y + '" width="' + CW + '" height="2" fill="#e5e8ef"/>', 2); },
    card(blocks, { stroke = "#e5e8ef" } = {}) {   // blocks: [{text, fs, fill, weight}] → 테두리 카드
      let h = 14; const inner = [];
      for (const b of blocks) { const t = textBlock(PAD + 20, y + h, b.text, { fs: b.fs ?? 24, width: CW - 40, fill: b.fill ?? "#333", weight: b.weight ?? 400 }); inner.push(t.svg); h += t.height; }
      h += 14;
      P.add('<rect x="' + PAD + '" y="' + y + '" width="' + CW + '" height="' + h + '" rx="14" fill="#fff" stroke="' + stroke + '" stroke-width="2"/>' + inner.join(""), h); P.gap(12);
    },
    get y() { return y; },
    done(footer) {
      if (footer) { const t = textBlock(PAD, y, footer, { fs: 20, width: CW, fill: "#888" }); parts.push(t.svg); y += t.height; }
      const Hh = Math.ceil(y + BOTTOM);
      return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + Hh + '" viewBox="0 0 ' + W + " " + Hh + '" font-family="-apple-system, Apple SD Gothic Neo, Malgun Gothic, Noto Sans KR, sans-serif"><rect width="' + W + '" height="' + Hh + '" fill="#fff"/>' + parts.join("") + "</svg>";
    },
  };
  return P;
}
function header(P, p, parent, pageNo) {
  const h = pageNo === 1 ? 200 : 120;
  const y0 = P.y - TOP;   // 헤더는 맨 위에 붙인다
  let svg = '<rect x="0" y="' + y0 + '" width="' + W + '" height="' + (h + TOP) + '" fill="' + COLOR.blue + '"/>' +
    '<text x="' + PAD + '" y="' + (y0 + 58) + '" font-size="26" font-weight="800" fill="#fff" letter-spacing="2">HARKNESS ENGLISH</text>' +
    '<text x="' + (W - PAD) + '" y="' + (y0 + 58) + '" font-size="24" fill="#dfe6ff" text-anchor="end">' + escapeXml((parent ? "학부모용" : "학생용") + " 결과지 " + pageNo + "/2 · " + fmtDate(p.generated_at)) + "</text>";
  if (pageNo === 1) {
    svg += '<text x="' + PAD + '" y="' + (y0 + 112) + '" font-size="38" font-weight="800" fill="#fff">' + escapeXml(p.exam.school + " " + p.exam.grade + "학년 · " + p.exam.title) + "</text>" +
      '<text x="' + PAD + '" y="' + (y0 + 162) + '" font-size="30" font-weight="700" fill="#fff">' + escapeXml(p.student.name + " 학생" + (p.teacher.name ? "  ·  담당 " + p.teacher.name + " 선생님" : "")) + "</text>";
  } else {
    svg += '<text x="' + PAD + '" y="' + (y0 + 108) + '" font-size="30" font-weight="700" fill="#fff">' + escapeXml(p.exam.school + " " + p.exam.grade + "학년 " + p.exam.title + "  ·  " + p.student.name + " 학생") + "</text>";
  }
  P.add(svg, h); P.gap(30);
}

/* ───────── 2장 조립 (§5-1 블록 1~10 + 틀린 문항 진단) ───────── */
export function composePages(p) {
  const parent = p.kind === "parent";
  const level = p.input_level;

  // ── 1장: 점수 · 타일맵 · 놓친 점수 · 배점 ──
  const A = page();
  header(A, p, parent, 1);
  A.add('<rect x="' + PAD + '" y="' + A.y + '" width="' + CW + '" height="140" rx="18" fill="' + COLOR.soft + '"/>' +
    '<text x="' + (W / 2) + '" y="' + (A.y + 62) + '" font-size="44" font-weight="800" fill="' + COLOR.ink + '" text-anchor="middle">' + escapeXml(p.headline) + "</text>" +
    '<text x="' + (W / 2) + '" y="' + (A.y + 112) + '" font-size="30" font-weight="700" fill="' + COLOR.blue + '" text-anchor="middle">' + escapeXml(p.sub) + "</text>", 140);
  if (level !== "total_only") { A.gap(8); A.add('<text x="' + (W / 2) + '" y="' + (A.y + 22) + '" font-size="22" fill="#555" text-anchor="middle">서술형 ' + p.totals.wr_max + "점은 학교 채점 후 확정 · 성취도 컷 A 90 / B 80 / C 70 / D 60</text>", 30); }
  A.gap();
  if (level !== "total_only") {
    A.H("문항별 정오");
    const ly = A.y - 40;
    A.add('<rect x="' + (PAD + 200) + '" y="' + ly + '" width="22" height="22" rx="6" fill="' + COLOR.blue + '"/><text x="' + (PAD + 230) + '" y="' + (ly + 19) + '" font-size="24" fill="#333">정답</text>' +
      '<rect x="' + (PAD + 310) + '" y="' + ly + '" width="22" height="22" rx="6" fill="' + COLOR.red + '"/><text x="' + (PAD + 340) + '" y="' + (ly + 19) + '" font-size="24" fill="#333">오답</text>' +
      '<rect x="' + (PAD + 420) + '" y="' + ly + '" width="22" height="22" rx="6" fill="#fff" stroke="#bbb" stroke-dasharray="4 3"/><text x="' + (PAD + 450) + '" y="' + (ly + 19) + '" font-size="24" fill="#333">서술형</text>' +
      '<rect x="' + (PAD + 560) + '" y="' + ly + '" width="22" height="22" rx="6" fill="' + COLOR.soft + '" stroke="' + COLOR.ink + '" stroke-width="3"/><text x="' + (PAD + 590) + '" y="' + (ly + 19) + '" font-size="24" fill="#333">굵은 테두리 = 킬러 문항</text>', 0);
    const state = {}; for (const it of p.items) state[it.no + "-" + (it.sub_no || 0)] = it.correct ? "ok" : "wrong";
    for (const w of p.writing) state[w.no + "-" + (w.sub_no || 0)] = "writing";
    const all = [...p.items, ...p.writing].sort((a, b) => a.no - b.no || (a.sub_no || 0) - (b.sub_no || 0));
    const t = tileMap(PAD, A.y, all, state, { width: CW }); A.add(t.svg, t.height); A.gap();
    A.H("영역별 놓친 점수");
    const lost = p.totals.lost_by_type || {}, by = p.totals.by_type || {};
    const rows = Object.keys(by).map((k) => ({ label: TYPE_LABEL[k] || k, value: lost[k] ?? 0, max: Math.max(...Object.values(by).map((v) => v.max)), text: (lost[k] ?? 0) + "점 놓침 / " + by[k].max + "점" }));
    const b = hBars(PAD, A.y, rows, { width: CW }); A.add(b.svg, b.height); A.gap();
  }
  if (p.points_by_type) {
    A.H("이 시험의 영역별 배점");
    const d = donut(PAD, A.y, Object.entries(p.points_by_type).map(([k, v]) => ({ label: TYPE_LABEL[k] || k, value: v })), { width: CW }); A.add(d.svg, d.height); A.gap();
  }
  if (parent && p.compare) {
    A.add('<rect x="' + PAD + '" y="' + A.y + '" width="' + CW + '" height="70" rx="14" fill="' + COLOR.soft + '"/><text x="' + (W / 2) + '" y="' + (A.y + 45) + '" font-size="26" fill="' + COLOR.ink + '" text-anchor="middle">' + escapeXml("우리 학원 이 시험 응시생 " + p.compare.n + "명 객관식 평균 " + p.compare.avg + "점") + "</text>", 70);
  }
  const page1 = A.done("2장에 계속 → 틀린 문항 진단 · 서술형 · 이번 주 보완");

  // ── 2장: 틀린 문항 진단 · 부족한 개념 · 서술형 · 한마디 · 보완 · 고지 ──
  const B = page();
  header(B, p, parent, 2);
  const wrong = level === "total_only" ? [] : p.items.filter((i) => i.correct === false);
  if (level !== "total_only") {
    B.H("틀린 문항 진단 " + wrong.length + "개 — 낚시 포인트와 부족한 개념");
    if (!wrong.length) { const tb = textBlock(PAD, B.y, "객관식 오답이 없습니다. 서술형을 점검하세요.", { fs: 26, width: CW }); B.add(tb.svg, tb.height); B.gap(); }
    for (const it of wrong) {
      const blocks = [{ text: itemLabel(it) + "번 · " + (TYPE_LABEL[it.type] || it.type) + " " + it.points + "점" + (Number(it.difficulty) === 3 ? " · 킬러" : "") + (it.unit ? " · 부족한 개념: " + it.unit : ""), fs: 26, weight: 700, fill: COLOR.ink }];
      if (!parent && it.chosen != null) blocks.push({ text: "내가 고른 답 " + it.chosen + " → 정답 " + (it.answers || []).join(", "), fs: 24, fill: "#333" });
      else if (!parent) blocks.push({ text: "정답 " + (it.answers || []).join(", "), fs: 24, fill: "#333" });
      if (it.trap_note) blocks.push({ text: "낚시 포인트: " + it.trap_note, fs: 24, fill: COLOR.red });
      if (it.intent) blocks.push({ text: "출제 의도: " + it.intent, fs: 22, fill: "#555" });
      if (!it.trap_note && !it.intent && !it.unit) blocks.push({ text: "선생님이 상담 때 직접 짚어 드립니다.", fs: 22, fill: "#555" });
      B.card(blocks, { stroke: Number(it.difficulty) === 3 ? COLOR.ink : "#e5e8ef" });
    }
    if (p.weak_units?.length) {
      B.gap(10); B.H("부족한 개념 묶음");
      const line = p.weak_units.map((w) => w.unit + " " + w.n + "문항").join(" · ");
      const tb = textBlock(PAD + 10, B.y, line, { fs: 26, width: CW - 20, fill: COLOR.blue, weight: 700 }); B.add(tb.svg, tb.height); B.gap();
    } else B.gap(10);
  }
  if (p.writing.length) {
    B.H("서술형 " + p.writing.length + "문항 (" + p.totals.wr_max + "점) — " + (parent ? "감점 위험 포인트" : "모범답안과 내 답"));
    for (const w of p.writing) {
      const blocks = [{ text: itemLabel(w) + (w.label || w.no >= 100 ? "" : "번") + " · " + w.points + "점" + (w.unit ? " · " + w.unit : "") + (w.unknown ? " · 학생이 답을 기억하지 못함" : ""), fs: 26, weight: 700, fill: COLOR.ink }];
      if (!parent) { blocks.push({ text: "모범답안: " + (w.model_answer || "—"), fs: 24, fill: COLOR.blue }); blocks.push({ text: "내 답: " + (w.written || "(입력 없음)"), fs: 24, fill: "#333" }); }
      const risk = !parent && w.risk_deduct?.length ? "감점 위험: " + w.risk_deduct.map((r) => r.label + (r.deduct ? " (−" + r.deduct + ")" : "")).join(" · ")
        : w.risk_labels?.length ? "감점 위험: " + w.risk_labels.join(" · ") : "감점 위험 표시 없음";
      blocks.push({ text: risk, fs: 24, fill: w.risk_labels?.length ? COLOR.red : "#555" });
      B.card(blocks);
    }
    B.gap(10);
  }
  if (parent) {
    const text = (p.comment?.key ? TEACHER_COMMENTS[p.comment.key] || "" : "") + (p.comment?.extra ? (p.comment?.key ? " " : "") + p.comment.extra : "");
    if (text) { B.H("선생님 한마디"); B.card([{ text, fs: 26, fill: COLOR.ink }], { stroke: COLOR.blue }); B.gap(10); }
    B.H("이번 주 보완 2가지");
    const acts = (p.next_types || []).map((k) => "• " + (TYPE_LABEL[k] || k) + ": " + (NEXT_ACTION[k] || ""));
    if (!acts.length) acts.push("• 객관식 손실이 없습니다. 서술형 감점 포인트를 함께 점검합니다.");
    acts.push("• 자세한 방향은 상담에서 안내드립니다.");
    for (const a of acts) { const tb = textBlock(PAD + 10, B.y, a, { fs: 26, width: CW - 20 }); B.add(tb.svg, tb.height); B.gap(6); }
    B.gap(20);
  }
  // 고지 (하드코딩 · 항상 · 상수 우선)
  B.rule(); B.gap(16);
  const nb = textBlock(PAD, B.y, parent ? NOTICE_PARENT : NOTICE_STUDENT, { fs: 20, width: CW, fill: "#555", lh: 1.55 }); B.add(nb.svg, nb.height);
  return [page1, B.done()];
}
export const composeSVG = (p) => composePages(p).join("");

/* ───────── SVG → PNG (§4-5) ───────── */
export async function svgToPngBlob(svgText) {
  const w = W, h = Number(svgText.match(/height="(\d+)"/)[1]);
  const scale = Math.min(2, Math.sqrt(16e6 / (w * h)));
  const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("SVG 이미지 변환 실패")); i.src = url; });
    const c = document.createElement("canvas"); c.width = Math.round(w * scale); c.height = Math.round(h * scale);
    const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("PNG 생성 실패"))), "image/png"));
  } finally { URL.revokeObjectURL(url); }
}
export async function savePng(payload, ex, st) {
  try {
    busy(true, "이미지 2장 만드는 중…");
    const pages = composePages(payload);
    const mmdd = String(new Date().getMonth() + 1).padStart(2, "0") + String(new Date().getDate()).padStart(2, "0");
    const files = [], urls = [];
    for (let i = 0; i < pages.length; i++) {
      const png = await svgToPngBlob(pages[i]);
      const name = "하크니스_결과지_" + ex.school + ex.grade + "_" + mmdd + "_" + (i + 1) + ".png";   // 학생 실명 ✕
      files.push(new File([png], name, { type: "image/png" })); urls.push(URL.createObjectURL(png));
    }
    // 항상 동작하는 경로: 화면에 PNG 를 바로 띄운다 (폰: 길게 눌러 저장·공유). 새 탭 ✕
    let box = $("#rPng"); if (!box) { box = document.createElement("div"); box.id = "rPng"; box.className = "report-preview"; $("#rPrev").before(box); }
    box.innerHTML = '<div class="card" style="border-color:var(--green)"><b>PNG 2장 · ' + Math.round(files.reduce((s, f) => s + f.size, 0) / 1024) + 'KB</b> · <span class="muted">폰: 각 이미지를 길게 눌러 저장/공유 · PC: 자동 다운로드</span></div>' +
      urls.map((u, i) => '<img alt="' + esc(files[i].name) + '" src="' + u + '" style="width:100%;border:1px solid var(--line);border-radius:8px;margin-bottom:8px">').join("");
    box.scrollIntoView({ block: "start" });
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent);
    if (navigator.canShare && navigator.canShare({ files })) {
      try { await navigator.share({ files, title: files[0].name }); } catch (e) { /* 제스처 밖이면 막힐 수 있음 → 위 이미지로 저장 */ }
    } else if (!ios) {
      for (let i = 0; i < files.length; i++) { const a = document.createElement("a"); a.href = urls[i]; a.download = files[i].name; document.body.appendChild(a); a.click(); a.remove(); await new Promise((r) => setTimeout(r, 400)); }
    }
    toast("이미지 2장 준비됨", "ok");
  } catch (e) { toast(errMsg(e), "err"); }
  finally { busy(false); }
}
