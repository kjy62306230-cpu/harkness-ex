// ④ 시험 분석 (블로그용 진단) — 학생 데이터 ✕ · 시험지 원문 ✕ · 유형·배점·난이도·낚시 포인트만 (2026-09-23 J님 요청)
// 처방은 상담(§12) — 여기서는 진단 문장만 만든다.
import { TYPE_LABEL, DIFFICULTY_LABEL, COLOR, itemLabel } from "./const.js";
import { $, esc, toast } from "./api.js";
import { donut, hBars } from "./charts.js";
import { examTitle } from "./exam.js";

const r1 = (n) => Math.round(n * 10) / 10;

export function renderAnalysis(body, S) {
  const ex = S.exam, items = S.items;
  if (!items.length) { body.innerHTML = '<div class="err-box">문항이 없습니다.</div>'; return; }
  const mc = items.filter((i) => i.type !== "writing"), wr = items.filter((i) => i.type === "writing");
  const total = r1(items.reduce((s, i) => s + Number(i.points), 0));
  const byType = {}; for (const i of items) { byType[i.type] = byType[i.type] || { n: 0, pts: 0 }; byType[i.type].n++; byType[i.type].pts = r1(byType[i.type].pts + Number(i.points)); }
  const byDiff = { 1: { n: 0, pts: 0 }, 2: { n: 0, pts: 0 }, 3: { n: 0, pts: 0 } }; for (const i of items) { byDiff[i.difficulty].n++; byDiff[i.difficulty].pts = r1(byDiff[i.difficulty].pts + Number(i.points)); }
  const killers = items.filter((i) => Number(i.difficulty) === 3);
  const units = {}; for (const i of items) if (i.unit) units[i.unit] = (units[i.unit] || 0) + 1;
  const topUnits = Object.entries(units).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const typeOrder = Object.keys(byType).sort((a, b) => byType[b].pts - byType[a].pts);

  // 차트 (SVG)
  const W = 980; let y = 0, parts = [];
  const d = donut(0, y, typeOrder.map((k) => ({ label: TYPE_LABEL[k] || k, value: byType[k].pts })), { width: W }); parts.push(d.svg); y += d.height + 30;
  parts.push('<text x="0" y="' + (y + 28) + '" font-size="28" font-weight="800" fill="' + COLOR.ink + '">난이도 분포 (배점)</text>'); y += 46;
  const hb = hBars(0, y, [1, 2, 3].map((k) => ({ label: DIFFICULTY_LABEL[k], value: byDiff[k].pts, max: total, text: byDiff[k].n + "문항 · " + byDiff[k].pts + "점" })), { width: W, color: COLOR.blue }); parts.push(hb.svg); y += hb.height + 10;
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + " " + y + '" font-family="-apple-system, Apple SD Gothic Neo, Malgun Gothic, Noto Sans KR, sans-serif" style="max-width:640px;width:100%">' + parts.join("") + "</svg>";

  // 블로그 초안 (진단만 · 학교 실명은 J님이 판단 · 원문 ✕ · 학생 ✕)
  const lines = [];
  lines.push("[" + examTitle(ex) + " 영어 시험 분석]");
  lines.push("");
  lines.push("■ 구성: 객관식 " + mc.length + "문항(" + r1(mc.reduce((s, i) => s + Number(i.points), 0)) + "점) + 서술형 " + wr.length + "문항(" + r1(wr.reduce((s, i) => s + Number(i.points), 0)) + "점)");
  lines.push("■ 영역별 배점: " + typeOrder.map((k) => (TYPE_LABEL[k] || k) + " " + byType[k].pts + "점(" + byType[k].n + "문항, " + Math.round((byType[k].pts / total) * 100) + "%)").join(" · "));
  lines.push("■ 난이도: 기본 " + byDiff[1].n + " · 꼬임 " + byDiff[2].n + " · 킬러 " + byDiff[3].n + "문항 (킬러 배점 " + byDiff[3].pts + "점)");
  if (topUnits.length) lines.push("■ 자주 나온 개념: " + topUnits.map(([u, n]) => u + " " + n).join(" · "));
  lines.push("");
  lines.push("■ 킬러 문항 유형 " + Math.min(3, killers.length) + "개 (진단만 · 문항 원문 ✕)");
  for (const k of killers.slice(0, 3)) lines.push("  - " + itemLabel(k) + "번 " + (TYPE_LABEL[k.type] || k.type) + " " + Number(k.points) + "점" + (k.unit ? " · " + k.unit : "") + (k.trap_note ? " · 낚시 포인트: " + k.trap_note : "") + (k.intent ? " · 출제 의도: " + k.intent : ""));
  if (!killers.length) lines.push("  - 킬러 문항 없음 (난이도 3 표시된 문항 없음)");
  lines.push("");
  lines.push("■ 방향: 배점이 큰 " + (TYPE_LABEL[typeOrder[0]] || "") + " 영역과 킬러 문항의 개념을 중심으로 대비. 개별 처방은 상담에서.");
  lines.push("");
  lines.push("※ 학원이 수집한 시험지를 바탕으로 정리한 분석이며 학교 공식 자료가 아닙니다. 문항 원문은 게재하지 않습니다. 게시 중단 요청 시 즉시 내립니다.");
  const text = lines.join("\n");

  body.innerHTML = '<div class="card"><h2>④ 시험 분석 <span class="muted">블로그용 진단 · 학생 정보 없음 · 원문 없음</span></h2>' +
    '<div class="row"><span class="tag blue">총 ' + items.length + '문항 · ' + total + '점</span><span class="tag">킬러 ' + killers.length + '</span>' + typeOrder.map((k) => '<span class="tag">' + esc(TYPE_LABEL[k] || k) + " " + byType[k].n + "문항 " + byType[k].pts + "점</span>").join("") + "</div>" +
    '<div style="margin:12px 0">' + svg + "</div>" +
    '<h2>킬러 문항 (난이도 3)</h2>' + (killers.length ? '<table class="simple"><thead><tr><th>번호</th><th>유형</th><th>배점</th><th>개념</th><th>낚시 포인트</th><th>출제 의도</th></tr></thead><tbody>' +
      killers.map((k) => "<tr><td>" + esc(itemLabel(k)) + "</td><td>" + esc(TYPE_LABEL[k.type] || k.type) + "</td><td>" + Number(k.points) + "</td><td>" + esc(k.unit || "") + "</td><td>" + esc(k.trap_note || "") + "</td><td>" + esc(k.intent || "") + "</td></tr>").join("") + "</tbody></table>" : '<p class="muted">난이도 3으로 표시된 문항이 없습니다. ① 문항표에서 난이도를 지정하세요.</p>') +
    '<h2>블로그 초안 <span class="muted">복사해서 Claude 대화·블로그에 붙여넣기 (학교 실명 여부는 J님 판단)</span></h2>' +
    '<textarea id="anText" style="min-height:260px;font-family:inherit">' + esc(text) + '</textarea>' +
    '<div class="row" style="margin-top:6px"><button id="anCopy" class="primary">초안 복사</button><span class="muted">처방·학생 성적·문항 원문은 넣지 않습니다 (§12).</span></div></div>';
  $("#anCopy").onclick = async () => {
    try { await navigator.clipboard.writeText($("#anText").value); toast("복사됨", "ok"); }
    catch { $("#anText").select(); document.execCommand("copy"); toast("복사됨", "ok"); }
  };
}
