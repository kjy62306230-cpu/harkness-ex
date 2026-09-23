// 시험 목록·등록·문항표·확정 + 로그인 + 학생 관리 (지시서 §4-2 · §4-3)
import { TYPES, TYPE_LABEL, TYPE_KEY, DIFFICULTY_LABEL, SOURCES, SOURCE_LABEL, CONFIDENCES, CONFIDENCE_LABEL, EXAM_KIND_LABEL, LEVEL_LABEL, APP_VERSION, itemLabel } from "./const.js";
import { api, session, $, $$, esc, toast, errMsg, busy, fmtDate } from "./api.js";

const opt = (list, label, cur) => list.map((v) => '<option value="' + v + '"' + (v === cur ? " selected" : "") + ">" + esc(label[v] ?? v) + "</option>").join("");
export const examTitle = (ex) => ex.year + " " + ex.school + " " + ex.grade + "학년 " + ex.semester + "학기 " + (EXAM_KIND_LABEL[ex.kind] || ex.kind) + (ex.form ? " " + ex.form + "형" : "");

/* ───────── 로그인 ───────── */
export function renderLogin(app) {
  app.innerHTML = '<div class="login card"><div class="mark">H</div><h1>시험지 분석기</h1><p class="muted">선생님께 받은 승인코드 8자를 입력하세요</p>' +
    '<input id="lname" placeholder="선생님 이름 (예: J)" autocomplete="username" style="width:100%;text-align:center;font-size:18px;margin-top:14px">' +
    '<input id="code" maxlength="24" autocomplete="one-time-code" inputmode="latin" placeholder="승인코드">' +
    '<p style="text-align:left;margin:10px 0 0"><label><input type="checkbox" id="remember" checked> 로그인 유지 (이 기기에서 30일)</label></p>' +
    '<p><button id="go" class="primary big" style="width:100%;margin-top:6px">들어가기</button></p><div id="lerr"></div>' +
    '<p class="muted">하크니스영어학원 · v' + APP_VERSION + "</p></div>";
  const go = async () => {
    const code = $("#code").value.trim(), name = $("#lname").value.trim();
    if (!name) { $("#lname").focus(); return; }
    if (code.length < 4) { $("#code").focus(); return; }
    $("#go").disabled = true; $("#lerr").textContent = "";
    try {
      const remember = $("#remember").checked;
      const r = await api("ex-auth", { action: "login", code, name, remember }, { auth: false });
      session.set({ token: r.token, user: r.user, expires_at: r.expires_at }, remember);
      location.hash = "#/exams";
    } catch (e) { $("#lerr").innerHTML = '<div class="err-box">' + esc(errMsg(e)) + "</div>"; }
    finally { $("#go").disabled = false; }
  };
  $("#go").onclick = go;
  $("#lname").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#code").focus(); });
  $("#code").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  try { const last = localStorage.getItem("ex:lastname"); if (last) $("#lname").value = last; } catch {}
  $("#lname").addEventListener("change", () => { try { localStorage.setItem("ex:lastname", $("#lname").value.trim()); } catch {} });
  ($("#lname").value ? $("#code") : $("#lname")).focus();
}

/* ───────── 시험 목록 ───────── */
export async function renderExamList(app) {
  app.innerHTML = '<div class="row" style="margin-bottom:6px"><h1 style="margin:0">시험 목록</h1><span class="grow"></span><button id="new" class="primary">+ 새 시험</button></div><div id="newForm"></div><div class="exam-list" id="list"><p class="muted">불러오는 중…</p></div>';
  $("#new").onclick = newExamForm;   // 목록 로딩 전에도 눌리게 먼저 붙인다
  const r = await api("ex-exam", { action: "exam_list" });
  const list = $("#list");
  list.innerHTML = r.exams.length ? "" : '<div class="card empty">아직 시험이 없습니다.<br><span class="muted">[+ 새 시험]을 눌러 시험지 사진이나 PDF로 시작하세요.</span></div>';
  for (const ex of r.exams) {
    const d = document.createElement("div");
    d.className = "card";
    d.innerHTML = '<div class="grow"><div class="title">' + esc(examTitle(ex)) + '</div><div class="meta"><span class="tag">문항 ' + ex.item_count + '</span><span class="tag">정답 확정 ' + ex.confirmed_count + "/" + ex.item_count + '</span><span class="tag ' + (Math.abs(ex.points_sum - 100) < 0.001 ? "" : "bad") + '">배점 ' + ex.points_sum + '</span><span class="tag">채점 ' + ex.results_count + "</span>" + (ex.regrade_count ? '<span class="tag bad">재채점 ' + ex.regrade_count + "</span>" : "") + "</div></div>" +
      '<span class="tag ' + (ex.status === "confirmed" ? "ok" : "warn") + '">' + (ex.status === "confirmed" ? "✓ 확정" : "작성 중") + "</span>";
    d.onclick = () => { location.hash = "#/exam/" + ex.id + "/items"; };
    list.appendChild(d);
  }
}

function newExamForm() {
    const y = new Date().getFullYear();
    $("#newForm").innerHTML = '<div class="card"><h2 style="margin-top:0">새 시험</h2><div class="form-grid">' +
      '<label>연도<input id="f_year" class="num" type="number" value="' + y + '"></label>' +
      '<label>학교<input id="f_school" placeholder="예: ○○중"></label>' +
      '<label>학년<select id="f_grade"><option value="1">1학년</option><option value="2" selected>2학년</option><option value="3">3학년</option></select></label>' +
      '<label>급<select id="f_level"><option value="middle">중학교</option><option value="high">고등학교</option></select></label>' +
      '<label>학기<select id="f_sem"><option value="1">1학기</option><option value="2" selected>2학기</option></select></label>' +
      '<label>종류<select id="f_kind"><option value="mid">중간고사</option><option value="final">기말고사</option></select></label>' +
      '<label>형<select id="f_form"><option value="">없음</option><option value="A">A형</option><option value="B">B형</option></select></label>' +
      '<label>문항 수<input id="f_n" type="number" value="20" min="0" max="60"></label></div>' +
      '<h2>📷 시험지 파일로 문항표 자동 초안 <span class="muted">선택 · 원본은 저장하지 않습니다</span></h2>' +
      '<div class="dropzone" id="f_drop"><div class="dz-icon">📄</div><div class="dz-title">시험지 사진이나 PDF를 여기에 끌어다 놓거나 클릭해서 선택</div><div class="dz-sub">사진 최대 8장 또는 PDF 1개 · 파일당 6MB 이하</div><div class="dz-files" id="f_fileinfo"></div>' +
      '<input id="f_files" type="file" accept="image/*,application/pdf" multiple></div>' +
      '<div class="row" style="margin-top:10px"><label><input type="checkbox" id="f_mask"> <b>이름·학번을 가렸습니다</b> <span class="muted">(파일을 올릴 때 필수)</span></label><span class="grow"></span><button id="f_go" class="primary big">만들기</button></div>' +
      '<p class="muted" style="margin-bottom:0">문항 수만큼 빈 행이 생기고, 파일을 올리면 그 행을 판독 초안으로 채웁니다(추정 표시 → 확인 필요). 서술형이 있으면 그 수까지 포함하세요 (예: 객관식 20 + 서술형 3 = 23).</p></div>';
    $("#f_school").focus();
    wireDropzone($("#f_drop"), $("#f_files"), (fs) => { $("#f_fileinfo").innerHTML = fs.map((f) => '<span class="tag blue">' + esc(f.name) + " · " + Math.round(f.size / 1024) + "KB</span>").join("") + (fs.some((f) => f.type === "application/pdf") && fs.length > 1 ? '<span class="tag bad">PDF는 1개만</span>' : ""); });
    const go = async () => {
      const fs = Array.from($("#f_files").files || []);
      if (fs.length && !$("#f_mask").checked) return toast("파일을 올리려면 '이름·학번을 가렸습니다'에 체크하세요", "err");
      let examId = null;
      try {
        busy(true, "시험 만드는 중…");
        const r = await api("ex-exam", { action: "exam_create", year: $("#f_year").value, school: $("#f_school").value, grade: $("#f_grade").value, level: $("#f_level").value, semester: $("#f_sem").value, kind: $("#f_kind").value, form: $("#f_form").value || null, item_count: $("#f_n").value });
        examId = r.exam.id;
      } catch (e) { toast(errMsg(e), "err"); busy(false); return; }
      if (fs.length) {
        try {
          busy(true, "파일 준비 중…");
          const files = await prepFiles(fs, 0.12);
          busy(true, "AI 판독 중… (15~40초)");
          const d = await api("ex-draft", { exam_id: examId, files, masked: true }, { timeoutMs: 150000 });
          if (!d.ok) toast("판독 실패: " + (d.error?.message || "") + " — 수기로 입력하세요", "err", 6000);
          else {
            const f = await api("ex-exam", { action: "items_fill_draft", exam_id: examId, items: d.items });
            toast("초안 " + d.count + "문항 · 배점 합 " + d.points_sum + (d.missing.length ? " · 빠진 번호 " + d.missing.join(",") : "") + " → 채움 " + f.filled + " 추가 " + f.added + " — 노란 행을 확인하고 '정답지/확인'으로 바꾸세요", "ok", 8000);
          }
        } catch (e) { toast("판독 오류: " + errMsg(e) + " — 수기로 입력하세요", "err", 6000); }
      }
      busy(false);
      location.hash = "#/exam/" + examId + "/items";
    };
    $("#f_go").onclick = go;
    $("#newForm").addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") go(); });
}

/* ───────── 시험 상세 ───────── */
let S = null;   // {exam, items, students, results, reports, problems}
const ACTIVE = new Set();                                   // 진행 중인 행 저장 큐
export const whenSaved = () => Promise.all([...ACTIVE]);   // 확정 전에 저장이 다 끝나길 기다린다

export async function renderExam(app, examId, tab = "items", rest = []) {
  app.innerHTML = '<p class="muted">불러오는 중…</p>';
  S = await api("ex-exam", { action: "exam_get", exam_id: examId });
  const ex = S.exam, admin = session.isAdmin();
  const conf = ex.status === "confirmed";
  app.innerHTML =
    '<div class="exam-head"><div class="row"><span class="title">' + esc(examTitle(ex)) + "</span>" +
    '<span class="tag ' + (conf ? "ok" : "warn") + '">' + (conf ? "확정 " + fmtDate(ex.confirmed_at) : "작성 중") + "</span>" +
    '<span class="tag" id="h_conf">정답 확정 ' + ex.confirmed_count + "/" + ex.item_count + "</span>" +
    '<span class="tag ' + (Math.abs(ex.points_sum - 100) < 0.001 ? "ok" : "bad") + '" id="h_pts">배점 합 ' + ex.points_sum + "</span>" +
    (ex.form ? '<span class="tag blue">' + ex.form + "형</span>" : "") +
    (ex.regrade_count ? '<span class="tag bad">채점 ' + ex.regrade_count + "건 재채점 필요</span>" : "") +
    '<span class="grow"></span>' +
    (conf ? (admin ? '<button id="unconfirm">확정 해제</button>' : "") : '<button id="confirm" class="primary">확정</button>') +
    (admin ? '<button id="delExam" class="danger">삭제</button>' : "") +
    "</div>" +
    '<div class="tabs">' + [["items", "① 문항표"], ["grade", "② 채점"], ["report", "③ 결과지"], ["analysis", "④ 시험 분석"]].map(([k, l]) => '<button data-tab="' + k + '" class="' + (k === tab ? "on" : "") + '">' + l + "</button>").join("") + "</div></div>" +
    '<div id="tabBody"></div>';
  $$(".tabs button").forEach((b) => b.onclick = () => { location.hash = "#/exam/" + examId + "/" + b.dataset.tab; });

  if ($("#confirm")) $("#confirm").onclick = () => confirmExam(app, examId);
  if ($("#unconfirm")) $("#unconfirm").onclick = async () => {
    if (S.results.length && !confirm("채점 " + S.results.length + "건에 영향이 있습니다. 확정을 해제할까요? (결과는 지워지지 않습니다)")) return;
    try { await api("ex-exam", { action: "exam_unconfirm", exam_id: examId }); toast("확정 해제됨", "ok"); renderExam(app, examId, tab); } catch (e) { toast(errMsg(e), "err"); }
  };
  if ($("#delExam")) $("#delExam").onclick = async () => {
    if (!confirm("이 시험을 목록에서 숨깁니다 (물리 삭제 아님). 계속할까요?")) return;
    try { await api("ex-exam", { action: "exam_delete", exam_id: examId }); location.hash = "#/exams"; } catch (e) { toast(errMsg(e), "err"); }
  };

  const body = $("#tabBody");
  if (tab === "items") return renderItems(body, examId);
  if (tab === "grade") { const m = await import("./grade.js?v=" + APP_VERSION); return m.renderGrade(body, S, rest); }
  if (tab === "report") { const m = await import("./report.js?v=" + APP_VERSION); return m.renderReportTab(body, S, rest); }
  if (tab === "analysis") { const m = await import("./analysis.js?v=" + APP_VERSION); return m.renderAnalysis(body, S); }
}

async function confirmExam(app, examId, force = false, reason = "") {
  try {
    busy(true, "저장 마무리 중…");
    await whenSaved();
    busy(true, "확정 검사 중…");
    const r = await api("ex-exam", { action: "exam_confirm", exam_id: examId, force, reason });
    toast(r.forced ? "강제 확정됨 (사유 기록)" : "확정됐습니다", "ok");
    renderExam(app, examId, "items");
  } catch (e) {
    const probs = e.body?.problems || [];
    const box = $("#problems") || Object.assign(document.createElement("div"), { id: "problems" });
    box.className = "problems";
    box.innerHTML = "<b>확정할 수 없습니다</b><ul>" + (probs.length ? probs.map((p) => "<li>" + esc(p.message) + "</li>").join("") : "<li>" + esc(errMsg(e)) + "</li>") + "</ul>";
    const hard = probs.some((p) => ["AI_ITEMS", "NUMBERING", "NO_ITEMS", "NO_ANSWER"].includes(p.code));
    if (session.isAdmin() && probs.length && !hard) {
      const b = document.createElement("button"); b.className = "danger"; b.textContent = "사유 적고 강제 확정 (관리자)";
      b.onclick = () => { const rs = prompt("강제 확정 사유"); if (rs && rs.trim().length >= 2) confirmExam(app, examId, true, rs.trim()); };
      box.appendChild(b);
    }
    $("#tabBody").prepend(box);
    box.scrollIntoView({ block: "center" });
  } finally { busy(false); }
}

/* 확정 후 수정 사유 — 시험당 한 번 물어보고 재사용 (매 셀마다 prompt ✕). 바꾸려면 [사유 변경] */
const REASONS = {};
function askReason(examId) {
  if (REASONS[examId]) return REASONS[examId];
  const r = (prompt("확정 후 수정 사유 (이 시험에서 계속 사용 · 기록됨)") || "").trim();
  if (r.length >= 2) REASONS[examId] = r;
  return REASONS[examId] || "";
}

/* ───────── ① 문항표 ───────── */
function ansText(a) { return Array.isArray(a) ? a.join("") : ""; }
function parseAns(s) { const d = String(s).replace(/[^1-5]/g, "").split("").map(Number); return d.length ? [...new Set(d)].sort() : null; }
function rubricText(r) { return Array.isArray(r) ? r.map((x) => x.rule_id + "|" + (x.label ?? "") + "|" + (x.deduct ?? 0)).join("\n") : ""; }
function parseRubric(s) { return String(s).split(/\n+/).map((l) => l.split("|").map((x) => x.trim())).filter((a) => a[0]).map((a) => ({ rule_id: a[0], label: a[1] || a[0], deduct: Number(a[2]) || 0 })); }

function ansCell(it) {
  return it.type === "writing" ? '<span class="muted">모범답안 ▾</span>' : '<input class="ans" name="answers" value="' + ansText(it.answers) + '" placeholder="1~5" inputmode="numeric" maxlength="5">';
}
function rowHtml(it) {
  const w = it.type === "writing";
  return '<tr data-id="' + it.id + '" class="' + (it.answer_confidence === "ai" ? "ai" : "") + '">' +
    '<td class="no"><input class="num" name="no" value="' + it.no + '" type="number" min="1" title="100 이상 = 별도 번호 서술형 (예: 서답형1 = 101)">' + (it.label ? '<div class="muted" style="font-size:11px">' + esc(it.label) + "</div>" : (it.no >= 100 ? '<div class="muted" style="font-size:11px">서술형' + (it.no - 100) + "</div>" : "")) + "</td>" +
    '<td><select name="type">' + opt(TYPES, TYPE_LABEL, it.type) + "</select></td>" +
    '<td><input class="num" name="points" type="number" step="0.5" min="0" value="' + (Number(it.points) || "") + '" placeholder="배점"></td>' +
    '<td class="anscell">' + ansCell(it) + "</td>" +
    '<td><select name="answer_confidence">' + opt(CONFIDENCES, CONFIDENCE_LABEL, it.answer_confidence) + "</select></td>" +
    '<td><select name="difficulty">' + opt([1, 2, 3], DIFFICULTY_LABEL, Number(it.difficulty)) + "</select></td>" +
    '<td><input class="txt" name="unit" value="' + esc(it.unit ?? "") + '" placeholder="단원·포인트"></td>' +
    '<td><button class="more" title="출처·의도·함정·모범답안·감점기준">' + (w ? "모범답안" : "상세") + "</button></td>" +
    '<td class="st" title="저장 상태"></td></tr>' +
    '<tr class="detail" data-for="' + it.id + '" hidden><td colspan="9"><div class="row">' +
    '<label>출처 <select name="source">' + opt(SOURCES, SOURCE_LABEL, it.source) + "</select></label>" +
    '<label>표기 <input name="label" style="width:90px" value="' + esc(it.label ?? "") + '" placeholder="서답형1"></label>' +
    '<label class="grow">출제 의도 <input name="intent" style="width:100%" value="' + esc(it.intent ?? "") + '" placeholder="킬러 문항에만"></label>' +
    '<label class="grow">함정 <input name="trap_note" style="width:100%" value="' + esc(it.trap_note ?? "") + '"></label></div>' +
    '<div class="row" style="margin-top:6px"><label class="grow">모범답안 (서술형)<textarea name="model_answer">' + esc(it.model_answer ?? "") + "</textarea></label>" +
    '<label class="grow">감점 위험 포인트 (한 줄에 코드|라벨|감점) <textarea name="rubric" placeholder="tense|시제 일치|2">' + esc(rubricText(it.rubric)) + "</textarea></label></div>" +
    '<div class="row" style="margin-top:6px"><span class="muted">' + (it.confidence != null ? "판독 확신 " + Math.round(it.confidence * 100) + "%" : "") + '</span><span class="grow"></span><button class="del danger">행 삭제</button></div></td></tr>';
}

function renderItems(body, examId) {
  const conf = S.exam.status === "confirmed";
  body.innerHTML =
    '<div class="toolbar">' +
    '<button id="addRow">+ 행 추가</button>' +
    '<span class="row" style="gap:4px">빈 배점 채우기 <input id="fillPts" type="number" step="0.5" style="width:64px" placeholder="4"> <button id="fillGo">채우기</button></span>' +
    (conf ? "" : '<button id="draftBtn">📷 사진·PDF로 초안 채우기</button>') +
    '<span class="hint">Tab/Enter 이동 · 정답 칸 숫자키 → 다음 행 · 유형 칸 v/g/r/d/w</span></div>' +
    '<div id="draftPanel"></div>' +
    (S.problems?.length ? '<div class="problems" id="problems"><b>확정 전 확인</b><ul>' + S.problems.map((p) => "<li>" + esc(p.message) + "</li>").join("") + "</ul></div>" : "") +
    (conf ? '<p class="muted">확정된 시험입니다. 수정은 관리자만 가능하며 사유가 기록되고, 채점된 결과에 재채점 표시가 붙습니다. <button id="reasonBtn">사유 변경</button></p>' : "") +
    '<div class="items-wrap"><table class="items"><thead><tr><th>번호</th><th>유형</th><th>배점</th><th>정답</th><th>확인</th><th>난이도</th><th>단원</th><th></th><th></th></tr></thead><tbody id="tb">' +
    S.items.map(rowHtml).join("") + "</tbody></table></div>";

  const tb = $("#tb");
  const rowOf = (el) => el.closest("tr[data-id]") || $('tr[data-id="' + el.closest("tr.detail")?.dataset.for + '"]');
  const itemOf = (tr) => S.items.find((i) => i.id === tr.dataset.id);

  // 행마다 저장 큐: 빠르게 연달아 바꿔도 요청은 한 번에 하나 (낙관적 락 updated_at 이 꼬이지 않게)
  const Q = new Map();
  const save = (tr, patch) => new Promise((resolve) => {
    const it = itemOf(tr);
    const st = Q.get(it.id) || { pending: {}, busy: false, waiters: [] };
    Q.set(it.id, st);
    Object.assign(st.pending, patch); st.waiters.push(resolve);
    const mark = $(".st", tr); if (mark) { mark.textContent = "…"; mark.className = "st"; }
    if (!st.busy) { const p = flush(it.id, st); ACTIVE.add(p); p.finally(() => ACTIVE.delete(p)); }
  });
  const flush = async (id, st) => {
    st.busy = true;
    while (Object.keys(st.pending).length) {
      const patch = st.pending; st.pending = {}; const waiters = st.waiters; st.waiters = [];
      const tr = $('tr[data-id="' + id + '"]', tb);
      const ok = tr ? await doSave(tr, patch) : false;
      waiters.forEach((w) => w(ok));
    }
    st.busy = false;
  };
  const doSave = async (tr, patch) => {
    const it = itemOf(tr);
    let reason = "";
    if (conf) { reason = askReason(examId); if (!reason) { toast("사유가 없어 저장하지 않았습니다", "err"); return false; } }
    tr.classList.add("saving"); tr.classList.remove("err");
    try {
      const r = await api("ex-exam", { action: "item_save", exam_id: examId, item: { id: it.id, updated_at: it.updated_at, ...patch }, reason });
      Object.assign(it, r.item);
      tr.classList.toggle("ai", it.answer_confidence === "ai");
      const st = $(".st", tr); st.textContent = "✓"; st.className = "st ok";
      updateHead();
      return true;
    } catch (e) {
      tr.classList.add("err");
      const st = $(".st", tr); st.textContent = "!"; st.className = "st bad"; st.title = errMsg(e);
      toast(errMsg(e), "err");
      if (e.code === "STALE") setTimeout(() => renderExam($("#app"), examId, "items"), 1200);
      return false;
    } finally { tr.classList.remove("saving"); }
  };

  const updateHead = () => {
    const sum = Math.round(S.items.reduce((s, i) => s + (Number(i.points) || 0), 0) * 10) / 10;
    const c = S.items.filter((i) => i.answer_confidence !== "ai").length;
    if ($("#h_pts")) { $("#h_pts").textContent = "배점 합 " + sum; $("#h_pts").className = "tag " + (Math.abs(sum - 100) < 0.001 ? "ok" : "bad"); }
    if ($("#h_conf")) $("#h_conf").textContent = "정답 확정 " + c + "/" + S.items.length;
  };

  tb.addEventListener("change", (e) => {
    const f = e.target; const tr = rowOf(f); if (!tr) return;
    const name = f.name; if (!name) return;
    let v = f.value;
    if (name === "answers") { v = parseAns(v); f.value = ansText(v); }
    else if (name === "rubric") v = parseRubric(v);
    else if (name === "points" || name === "no" || name === "difficulty") v = Number(v);
    const patch = { [name]: v };
    if (name === "type") {   // 서술형 ↔ 객관식 전환: 행은 그대로 두고 정답 셀·버튼 라벨만 제자리에서 바꾼다 (입력 중 포커스 보존)
      const wasW = itemOf(tr).type === "writing", nowW = v === "writing";
      save(tr, patch).then((ok) => {
        if (!ok || wasW === nowW) return;
        const it = itemOf(tr); const cell = $("td.anscell", tr); if (cell) cell.innerHTML = ansCell(it);
        const more = $("button.more", tr); if (more) more.textContent = nowW ? "모범답안" : "상세";
      });
      return;
    }
    save(tr, patch);
  });

  // 키보드: 정답 칸 숫자키 → 저장 + 다음 행 / Enter → 다음 행 같은 칸 / 유형 v g r d w
  tb.addEventListener("keydown", (e) => {
    const f = e.target; const tr = rowOf(f); if (!tr) return;
    if (f.name === "answers" && /^[1-5]$/.test(e.key) && !e.shiftKey) {
      e.preventDefault(); f.value = e.key; f.dispatchEvent(new Event("change", { bubbles: true })); focusNext(tr, "select[name=type]"); return;
    }
    if (f.name === "type" && TYPE_KEY[e.key.toLowerCase()]) { e.preventDefault(); f.value = TYPE_KEY[e.key.toLowerCase()]; f.dispatchEvent(new Event("change", { bubbles: true })); return; }
    if (e.key === "Enter" && f.tagName !== "TEXTAREA") { e.preventDefault(); f.blur(); focusNext(tr, "[name=" + f.name + "]"); }
  });
  const focusNext = (tr, sel) => { let n = tr.nextElementSibling; while (n && !n.dataset.id) n = n.nextElementSibling; const t = n && $(sel, n); if (t) { t.focus(); if (t.select) t.select(); } };

  tb.addEventListener("click", async (e) => {
    if (e.target.classList.contains("more")) { const tr = rowOf(e.target); const det = $('tr.detail[data-for="' + tr.dataset.id + '"]', tb); det.hidden = !det.hidden; return; }
    if (e.target.classList.contains("del")) {
      const tr = rowOf(e.target); const it = itemOf(tr);
      if (!confirm(it.no + "번 행을 지울까요?")) return;
      let reason = ""; if (conf) { reason = askReason(examId); if (!reason) return; }
      try { await api("ex-exam", { action: "item_delete", exam_id: examId, item_id: it.id, reason }); S.items = S.items.filter((x) => x.id !== it.id); $('tr.detail[data-for="' + it.id + '"]', tb).remove(); tr.remove(); updateHead(); }
      catch (err) { toast(errMsg(err), "err"); }
    }
  });

  $("#addRow").onclick = async () => {
    const no = S.items.reduce((m, i) => Math.max(m, i.no), 0) + 1;
    let reason = ""; if (conf) { reason = askReason(examId); if (!reason) return; }
    try {
      const r = await api("ex-exam", { action: "item_save", exam_id: examId, item: { no, sub_no: 0, type: "reading", points: 0 }, reason });
      S.items.push(r.item); const tmp = document.createElement("tbody"); tmp.innerHTML = rowHtml(r.item); tb.append(...tmp.children); updateHead();
      $('tr[data-id="' + r.item.id + '"] select[name=type]', tb).focus();
    } catch (err) { toast(errMsg(err), "err"); }
  };
  $("#fillGo").onclick = async () => {
    const v = Number($("#fillPts").value); if (!(v > 0)) return toast("배점을 입력하세요", "err");
    for (const it of S.items) if (!(Number(it.points) > 0)) { const tr = $('tr[data-id="' + it.id + '"]', tb); $('[name=points]', tr).value = v; await save(tr, { points: v }); }
  };
  if ($("#draftBtn")) $("#draftBtn").onclick = () => renderDraftPanel($("#draftPanel"), examId);
  if ($("#reasonBtn")) $("#reasonBtn").onclick = () => { delete REASONS[examId]; askReason(examId); };

  const first = $("tr[data-id] select[name=type]", tb); if (first) first.focus();
}

/* ───────── 판독 보조 (마스킹 게이트 · 브라우저 메모리에서 바로 전송) ───────── */
function renderDraftPanel(host, examId) {
  host.innerHTML = '<div class="card draft-panel"><h2>📷 사진으로 초안 채우기 (보조)</h2>' +
    '<p class="muted">사진 1~2장. 긴 변 1600px로 줄여 바로 전송하며 <b>서버·저장소에 저장하지 않습니다</b>. 실패해도 수기로 진행하면 됩니다. 결과는 전부 "추정(AI)"로 들어오니 확인 후 "정답지/선생님 확인"으로 바꾸세요.</p>' +
    '<div class="dropzone" id="dDrop"><div class="dz-icon">📄</div><div class="dz-title">사진이나 PDF를 끌어다 놓거나 클릭해서 선택</div><div class="dz-sub">사진 최대 8장 또는 PDF 1개</div><input id="dFiles" type="file" accept="image/*,application/pdf" multiple></div>' +
    '<div class="row" style="margin-top:8px"><label>상단 잘라내기(사진만) <input id="dCrop" type="range" min="0" max="40" value="12"> <span id="dCropV">12%</span></label></div>' +
    '<div class="previews" id="dPrev"></div>' +
    '<p><label><input type="checkbox" id="dMask"> <b>이름·학번이 가려졌습니다</b> (체크해야 전송됩니다)</label></p>' +
    '<div class="row"><button id="dGo" class="primary" disabled>판독 요청</button><button id="dClose">닫기</button></div><div id="dOut"></div></div>';
  let imgs = [];   // {canvas(full)|pdf(File), name}
  const crop = () => Number($("#dCrop").value) / 100;
  const render = () => {
    $("#dCropV").textContent = Math.round(crop() * 100) + "%";
    $("#dPrev").innerHTML = "";
    for (const im of imgs) {
      const d = document.createElement("div");
      if (im.pdf) { d.innerHTML = '<div class="muted">📄 ' + esc(im.name) + " (" + Math.round(im.pdf.size / 1024) + "KB) — PDF는 그대로 전송</div>"; }
      else { const c = cropped(im.canvas, crop()); d.innerHTML = '<div class="muted">' + esc(im.name) + " " + c.width + "×" + c.height + "</div>"; const img = new Image(); img.src = c.toDataURL("image/jpeg", 0.6); d.appendChild(img); }
      $("#dPrev").appendChild(d);
    }
    $("#dGo").disabled = !(imgs.length && $("#dMask").checked);
  };
  $("#dCrop").oninput = render; $("#dMask").onchange = render; $("#dClose").onclick = () => { host.innerHTML = ""; };
  wireDropzone($("#dDrop"), $("#dFiles"), async (fs) => {
    imgs = [];
    for (const f of fs.slice(0, 8)) imgs.push(f.type === "application/pdf" ? { name: f.name, pdf: f } : { name: f.name, canvas: await loadResized(f, 1600) });
    render();
  });
  $("#dGo").onclick = async () => {
    const files = await Promise.all(imgs.map(async (im) => im.pdf ? { mime: "application/pdf", data: await fileToB64(im.pdf) } : { mime: "image/jpeg", data: cropped(im.canvas, crop()).toDataURL("image/jpeg", 0.8).split(",")[1] }));
    $("#dGo").disabled = true; $("#dOut").innerHTML = '<p class="muted">판독 중… (보통 15~30초)</p>';
    try {
      busy(true, "AI 판독 중…");
      const r = await api("ex-draft", { exam_id: examId, files, masked: true }, { timeoutMs: 150000 });
      if (!r.ok) { $("#dOut").innerHTML = '<div class="err-box">판독 실패: ' + esc(r.error?.message || "") + "\n수기로 입력하세요.</div>"; return; }
      $("#dOut").innerHTML = '<div class="card"><b>' + r.count + "문항</b> · 배점 합 " + r.points_sum + (r.missing.length ? ' · <span class="tag bad">빠진 번호 ' + r.missing.join(",") + "</span>" : ' · <span class="tag ok">번호 연속</span>') + ' · 모델 ' + esc(r.used?.model || "") + " · " + Math.round(r.ms / 1000) + "초" +
        '<p class="muted">빈 행(배점 0·정답 없음)만 채우고, 손으로 채운 행은 건드리지 않습니다.</p><button id="dApply" class="primary">표에 반영</button></div>';
      $("#dApply").onclick = async () => {
        try { busy(true, "반영 중…"); const f = await api("ex-exam", { action: "items_fill_draft", exam_id: examId, items: r.items }); toast("반영: 채움 " + f.filled + " · 추가 " + f.added + (f.skipped.length ? " · 건너뜀 " + f.skipped.join(",") : ""), "ok"); renderExam($("#app"), examId, "items"); }
        catch (err) { toast(errMsg(err), "err"); } finally { busy(false); }
      };
    } catch (e) { $("#dOut").innerHTML = '<div class="err-box">' + esc(errMsg(e)) + "\n수기로 입력하세요.</div>"; }
    finally { busy(false); $("#dGo").disabled = false; }
  };
}
/** 드래그앤드롭 + 클릭 선택. onFiles(File[]) 호출. input.files 도 동기화해서 기존 코드가 그대로 읽게 한다 */
export function wireDropzone(zone, input, onFiles) {
  const accept = (list) => Array.from(list).filter((f) => /^image\//.test(f.type) || f.type === "application/pdf");
  const set = (files) => { try { const dt = new DataTransfer(); files.forEach((f) => dt.items.add(f)); input.files = dt.files; } catch {} onFiles(files); };
  input.addEventListener("change", () => onFiles(accept(input.files)));
  ["dragenter", "dragover"].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove("over"); }));
  zone.addEventListener("drop", (e) => { const fs = accept(e.dataTransfer.files); if (fs.length) set(fs); else toast("사진(JPG/PNG) 또는 PDF만 올릴 수 있어요", "err"); });
}
export function fileToB64(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(file); });
}
/** 새 시험 폼용: 사진은 1600px 리사이즈 + 상단 crop, PDF 는 그대로 (최대 2개 · PDF 는 1개) */
export async function prepFiles(fileList, cropRatio) {
  const out = [];
  for (const f of fileList.slice(0, 8)) {
    if (f.type === "application/pdf") { if (out.some((x) => x.mime === "application/pdf")) continue; out.push({ mime: "application/pdf", data: await fileToB64(f) }); }
    else { const c = cropped(await loadResized(f, 1600), cropRatio); out.push({ mime: "image/jpeg", data: c.toDataURL("image/jpeg", 0.8).split(",")[1] }); }
  }
  return out;
}
function loadResized(file, maxSide) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => { const s = Math.min(1, maxSide / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c); };
    img.onerror = rej; img.src = url;
  });
}
function cropped(canvas, topRatio) {
  const top = Math.round(canvas.height * topRatio); const c = document.createElement("canvas"); c.width = canvas.width; c.height = canvas.height - top;
  c.getContext("2d").drawImage(canvas, 0, top, canvas.width, c.height, 0, 0, canvas.width, c.height); return c;
}

/* ───────── 강사 계정 (admin) — 코드는 발급 순간 한 번만 보인다 ───────── */
function renderUsersCard(host, users, reload) {
  host.innerHTML = '<div class="card"><div class="row"><h2 style="margin:0">강사 계정</h2><span class="muted">로그인은 이름 + 승인코드. 코드는 발급할 때 한 번만 보이니 바로 전달하세요.</span><span class="grow"></span><button id="uAdd" class="primary">+ 강사 추가</button></div>' +
    '<div id="uCode"></div>' +
    '<table class="simple" style="margin-top:10px"><thead><tr><th>이름</th><th>역할</th><th>마지막 로그인</th><th>상태</th><th></th></tr></thead><tbody>' +
    users.map((u) => '<tr data-id="' + u.id + '"><td><b>' + esc(u.name) + "</b></td><td>" + (u.role === "admin" ? '<span class="tag blue">관리자</span>' : '<span class="tag">강사</span>') + '</td><td class="muted">' + (u.last_login_at ? fmtDate(u.last_login_at) : "—") + "</td><td>" + (u.active ? '<span class="tag ok">사용 중</span>' : '<span class="tag bad">중지</span>') + '</td><td><button class="ureset">코드 재발급</button> ' + (u.id !== session.user().id ? '<button class="' + (u.active ? "uoff danger" : "uon") + '">' + (u.active ? "중지" : "다시 사용") + "</button>" : "") + "</td></tr>").join("") + "</tbody></table></div>";
  const showCode = (name, code) => { $("#uCode").innerHTML = '<div class="card" style="border-color:var(--green);background:var(--green-50)"><b>' + esc(name) + ' 선생님 승인코드</b><div style="font-size:30px;font-weight:800;letter-spacing:6px;margin:6px 0;font-family:monospace">' + esc(code) + '</div><div class="muted">지금 캡처해서 전달하세요. 이 화면을 벗어나면 다시 볼 수 없습니다 (해시만 저장). 로그인: 이름 「' + esc(name) + '」 + 이 코드</div></div>'; };
  $("#uAdd").onclick = async () => {
    const name = (prompt("강사 이름 (로그인할 때 그대로 입력합니다)") || "").trim(); if (!name) return;
    try { const r = await api("ex-auth", { action: "user_add", name, role: "teacher" }); showCode(r.user.name, r.code); toast("강사 추가됨", "ok"); }
    catch (e) { toast(errMsg(e), "err"); }
  };
  host.addEventListener("click", async (e) => {
    const tr = e.target.closest("tr[data-id]"); if (!tr) return;
    const u = users.find((x) => x.id === tr.dataset.id);
    try {
      if (e.target.classList.contains("ureset")) { if (!confirm(u.name + " 코드를 새로 만들까요? 기존 코드는 즉시 무효가 됩니다.")) return; const r = await api("ex-auth", { action: "user_reset_code", user_id: u.id }); showCode(u.name, r.code); }
      else if (e.target.classList.contains("uoff")) { if (!confirm(u.name + " 계정을 중지할까요? (로그인 불가)")) return; await api("ex-auth", { action: "user_set_active", user_id: u.id, active: false }); reload(); }
      else if (e.target.classList.contains("uon")) { await api("ex-auth", { action: "user_set_active", user_id: u.id, active: true }); reload(); }
    } catch (err) { toast(errMsg(err), "err"); }
  });
}

/* ───────── 학생 관리 (admin) ───────── */
export async function renderStudents(app) {
  if (!session.isAdmin()) { app.innerHTML = '<div class="err-box">관리자만 볼 수 있습니다.</div>'; return; }
  app.innerHTML = '<h1>학생 · 강사 관리</h1><div id="uform"></div><div id="sform"></div><div id="slist"><p class="muted">불러오는 중…</p></div>';
  const [st, us] = await Promise.all([api("ex-exam", { action: "student_list" }), api("ex-auth", { action: "user_list" })]);
  const users = us.users.filter((u) => u.active);
  renderUsersCard($("#uform"), us.users, () => renderStudents(app));
  const form = (s = {}) => {
    $("#sform").innerHTML = '<div class="card"><h2>' + (s.id ? "학생 수정" : "학생 추가") + '</h2><div class="row">' +
      '<input id="s_name" placeholder="이름" value="' + esc(s.name ?? "") + '" style="width:110px">' +
      '<input id="s_school" placeholder="학교" value="' + esc(s.school ?? "") + '" style="width:120px">' +
      '<select id="s_grade">' + [1, 2, 3].map((g) => '<option value="' + g + '"' + (g === (s.grade ?? 2) ? " selected" : "") + ">" + g + "학년</option>").join("") + "</select>" +
      '<select id="s_level">' + opt(["middle", "high"], LEVEL_LABEL, s.level ?? "middle") + "</select>" +
      '<select id="s_teacher">' + users.map((u) => '<option value="' + u.id + '"' + (u.id === (s.teacher_id ?? session.user().id) ? " selected" : "") + ">" + esc(u.name) + "</option>").join("") + "</select>" +
      '<label><input type="checkbox" id="s_consent"' + (s.consent_at ? " checked" : "") + "> 개인정보 동의</label>" +
      '<input id="s_guardian" placeholder="보호자명" value="' + esc(s.guardian_name ?? "") + '" style="width:100px">' +
      '<label><input type="checkbox" id="s_under14"' + (s.under14 ?? true ? " checked" : "") + "> 만 14세 미만</label>" +
      (s.id ? '<label><input type="checkbox" id="s_active"' + (s.active ? " checked" : "") + "> 재원</label>" : "") +
      '<button id="s_go" class="primary">저장</button>' + (s.id ? '<button id="s_cancel">취소</button>' : "") + "</div>" +
      '<p class="muted">동의 없는 학생은 채점·결과지 생성이 서버에서 거부됩니다 (§12). 학생 삭제는 없고 "재원" 해제만 합니다.</p></div>';
    $("#s_go").onclick = async () => {
      const student = { id: s.id, name: $("#s_name").value, school: $("#s_school").value, grade: $("#s_grade").value, level: $("#s_level").value, teacher_id: $("#s_teacher").value, consent: $("#s_consent").checked, guardian_name: $("#s_guardian").value, under14: $("#s_under14").checked };
      if (s.id) student.active = $("#s_active").checked;
      if (s.id && !!s.consent_at === $("#s_consent").checked) delete student.consent;   // 안 바뀌면 consent_at 유지
      try { await api("ex-exam", { action: "student_save", student }); toast("저장됨", "ok"); renderStudents(app); } catch (e) { toast(errMsg(e), "err"); }
    };
    if ($("#s_cancel")) $("#s_cancel").onclick = () => form();
    $("#s_name").focus();
  };
  form();
  const rows = st.students.map((s) => '<tr data-id="' + s.id + '"><td>' + esc(s.name) + (s.anonymized_at ? ' <span class="tag">익명화</span>' : "") + "</td><td>" + esc(s.school) + " " + s.grade + "</td><td>" + esc(users.find((u) => u.id === s.teacher_id)?.name ?? "?") + "</td><td>" + (s.consent_at ? '<span class="tag ok">동의 ' + fmtDate(s.consent_at) + "</span>" : '<span class="tag bad">동의 없음</span>') + "</td><td>" + (s.active ? "재원" : '<span class="muted">퇴원</span>') + '</td><td><button class="edit">수정</button>' + (!s.active && !s.anonymized_at ? ' <button class="anon danger" title="퇴원 6개월 후 이름을 학생_xxxx 로 바꿉니다">익명화</button>' : "") + "</td></tr>").join("");
  $("#slist").innerHTML = '<table class="simple"><thead><tr><th>이름</th><th>학교·학년</th><th>담당</th><th>동의</th><th>상태</th><th></th></tr></thead><tbody>' + rows + "</tbody></table>" +
    '<div class="card"><b>보관·파기 (§12)</b> <button id="purgeReports">90일 지난 결과지 캐시 삭제</button> <span class="muted">결과지는 재생성 가능한 캐시입니다. 퇴원 학생 익명화는 위 표의 [익명화] (재원 해제 후).</span></div>';
  $("#slist").addEventListener("click", async (e) => {
    if (e.target.classList.contains("edit")) return form(st.students.find((s) => s.id === e.target.closest("tr").dataset.id));
    if (e.target.classList.contains("anon")) {
      const s = st.students.find((x) => x.id === e.target.closest("tr").dataset.id);
      if (!confirm(s.name + " 학생 이름을 익명 토큰으로 바꿉니다. 되돌릴 수 없습니다. 계속할까요?")) return;
      try { await api("ex-exam", { action: "student_anonymize", student_id: s.id }); toast("익명화됨", "ok"); renderStudents(app); } catch (err) { toast(errMsg(err), "err"); }
    }
  });
  $("#purgeReports").onclick = async () => {
    if (!confirm("생성된 지 90일이 지난 결과지 캐시를 삭제할까요? (필요하면 다시 만들 수 있습니다)")) return;
    try { const r = await api("ex-exam", { action: "reports_purge" }); toast("삭제 " + r.deleted + "건", "ok"); } catch (err) { toast(errMsg(err), "err"); }
  };
}
