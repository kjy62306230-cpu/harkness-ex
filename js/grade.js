// ② 채점 입력 — 3단 폴백 (지시서 §4-4). 점수 계산은 서버 코드(ex-grade). localStorage 임시 저장(§3-4).
import { INPUT_LEVELS, INPUT_LEVEL_LABEL, TYPE_LABEL, itemLabel } from "./const.js";
import { api, session, $, $$, esc, toast, errMsg, busy } from "./api.js";
import { prepFiles, wireDropzone } from "./exam.js";

const draftKey = (examId, studentId) => "ex:draft:" + examId + ":" + studentId;
const IK = (i) => i.no + "-" + (i.sub_no || 0);   // 문항 키 = 서버 key() 와 동일 — 22-1, 22-2 구분 (draftKey 변수 K 와 이름 겹치지 않게)
const loadDraft = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const saveDraft = (k, d) => { try { localStorage.setItem(k, JSON.stringify(d)); } catch {} };
const dropDraft = (k) => { try { localStorage.removeItem(k); } catch {} };

export function renderGrade(body, S, rest = []) {
  const ex = S.exam;
  if (ex.status !== "confirmed") { body.innerHTML = '<div class="err-box">정답이 확정되지 않은 시험입니다. ① 문항표에서 [확정] 후 채점할 수 있습니다.</div>'; return; }
  const students = S.students;
  const cur = rest[0] || "";
  body.innerHTML = '<div class="row" style="margin:8px 0"><label>학생 <select id="gStudent"><option value="">— 선택 —</option>' +
    students.map((s) => { const r = S.results.find((x) => x.student_id === s.id); return '<option value="' + s.id + '"' + (s.id === cur ? " selected" : "") + ">" + esc(s.name) + " (" + esc(s.school) + s.grade + ")" + (s.consent_at ? "" : " · 동의없음") + (r ? " · 채점됨" + (r.needs_regrade ? "·재채점필요" : "") : "") + "</option>"; }).join("") +
    '</select></label><span class="muted">담당 학생만 보입니다. 학생 추가·동의는 관리자 [학생 관리]</span></div><div id="gBody"></div>';
  $("#gStudent").onchange = (e) => { location.hash = "#/exam/" + ex.id + "/grade/" + e.target.value; };
  if (cur) renderStudentGrade($("#gBody"), S, students.find((s) => s.id === cur));
}

function renderStudentGrade(host, S, st) {
  const ex = S.exam, items = S.items;
  if (!st) { host.innerHTML = '<div class="err-box">학생을 찾지 못했습니다.</div>'; return; }
  const mc = items.filter((i) => i.type !== "writing"), wr = items.filter((i) => i.type === "writing");
  const existing = S.results.find((r) => r.student_id === st.id);
  const K = draftKey(ex.id, st.id);
  let D = loadDraft(K) || { level: null, chosen: {}, wrong: [], manual: "", writing: {}, checked: false };
  const persist = () => saveDraft(K, D);

  host.innerHTML = '<div class="student-name-big">' + esc(st.name) + ' <span class="muted" style="font-size:14px">' + esc(st.school) + " " + st.grade + "학년</span>" + (st.consent_at ? "" : ' <span class="tag bad">동의 없음 — 저장 거부됨</span>') + "</div>" +
    (existing ? '<div class="card"><b>저장된 결과</b> · ' + esc(INPUT_LEVEL_LABEL[existing.input_level]) + (existing.totals?.mc_score != null ? " · 객관식 " + existing.totals.mc_score + "/" + existing.totals.mc_max : "") + (existing.needs_regrade ? ' <span class="tag bad">문항이 바뀌어 재채점 필요</span> <button id="gRegrade">재계산</button>' : "") + ' <a href="#/exam/' + ex.id + "/report/" + st.id + '">결과지 →</a><div class="muted">다시 저장하면 이 결과를 덮어씁니다 (직전 값 1세대 보관)</div></div>' : "") +
    (loadDraft(K) ? '<p class="muted">임시 저장된 입력을 복구했습니다.</p>' : "") +
    '<div id="gScan"></div><div id="gLevel"></div><div id="gInput"></div><div id="gWriting"></div><div id="gFoot"></div>';

  if ($("#gRegrade")) $("#gRegrade").onclick = async () => {
    try { busy(true, "재계산 중…"); const r = await api("ex-grade", { action: "regrade", exam_id: ex.id, student_id: st.id }); toast("재계산 완료: 객관식 " + (r.result.totals.mc_score ?? "-") + "/" + r.result.totals.mc_max, "ok"); location.reload(); }
    catch (e) { toast(errMsg(e), "err"); } finally { busy(false); }
  };

  // 📷 채점된 시험지 판독 → 입력 미리 채움 (선생님이 확인 후 저장)
  const renderScan = () => {
    $("#gScan").innerHTML = '<div class="card"><div class="row"><b>📷 채점된 시험지로 미리 채우기</b><span class="muted">형광펜 큰 동그라미 = 틀린 문항으로 읽어 채웁니다(실측 93%). 연필 표시(고른 번호)는 참고용. PDF보다 <b>면마다 찍은 사진</b>이 훨씬 정확합니다. 사진은 저장하지 않습니다.</span></div>' +
      '<div class="dropzone" id="gDrop" style="margin-top:8px"><div class="dz-icon">📷</div><div class="dz-title">채점된 시험지 사진(최대 8장) 또는 PDF를 끌어다 놓기</div><div class="dz-files" id="gFiles"></div><input id="gFilesIn" type="file" accept="image/*,application/pdf" multiple></div>' +
      '<div class="row" style="margin-top:8px"><label><input type="checkbox" id="gMask"> <b>이름·학번을 가렸습니다</b></label><span class="grow"></span><button id="gScanGo" class="primary" disabled>판독해서 채우기</button></div><div id="gScanOut"></div></div>';
    let files = [];
    const refresh = () => { $("#gScanGo").disabled = !(files.length && $("#gMask").checked); };
    wireDropzone($("#gDrop"), $("#gFilesIn"), (fs) => { files = fs; $("#gFiles").innerHTML = fs.map((f) => '<span class="tag blue">' + esc(f.name) + "</span>").join(""); refresh(); });
    $("#gMask").onchange = refresh;
    $("#gScanGo").onclick = async () => {
      try {
        busy(true, "파일 준비 중…");
        const payload = await prepFiles(files, 0);
        busy(true, "AI 판독 중… (20~60초)");
        const r = await api("ex-draft", { mode: "answers", exam_id: ex.id, student_id: st.id, files: payload, masked: true }, { timeoutMs: 170000 });
        if (!r.ok) { $("#gScanOut").innerHTML = '<div class="err-box">판독 실패: ' + esc(r.error?.message || "") + "\n손으로 입력하세요.</div>"; return; }
        // 2026-09-23 실물 측정: 형광펜 틀림 표시 판독 93% · 고른 번호 판독 67~83% → 정/오답은 '틀림 표시' 기준(wrong_only)으로 채우고,
        // 고른 번호는 틀린 문항에만 참고로 붙인다(낚시 포인트 분석용). 두 판독이 어긋나면 선생님 확인 목록에 올린다.
        D = { level: "wrong_only", chosen: {}, wrong: [], wrongChosen: {}, manual: "", writing: {}, checked: false };
        const conflicts = [];
        for (const a of r.items) {
          const it = items.find((i) => i.no === a.no && i.sub_no === a.sub_no); if (!it) continue;
          if (it.type === "writing") { D.writing[IK(it)] = { written: a.written || "", risk: [], unknown: !a.written }; continue; }
          const pick = a.chosen.length === 1 ? a.chosen[0] : null;
          const pickCorrect = pick != null && (it.answers || []).map(Number).includes(pick);
          if (a.circled) {
            D.wrong.push(IK(it));
            if (pick != null && !pickCorrect) D.wrongChosen[IK(it)] = pick;
            else if (pickCorrect) conflicts.push(itemLabel(it) + "번: 틀림 표시인데 고른 번호(" + pick + ")가 정답 — 틀림으로 채움, 고른 번호는 뺐음");
          } else if (pick != null && !pickCorrect) conflicts.push(itemLabel(it) + "번: 고른 번호(" + pick + ")가 오답인데 틀림 표시 없음 — 맞음으로 채움, 시험지 확인");
        }
        persist(); renderLevel(); renderInput();
        $("#gScanOut").innerHTML = '<div class="card" style="border-color:var(--green)"><b>채워 넣었습니다</b> · 표시 방식: ' + esc(r.marking_note || "—") + " · 틀림 표시 " + r.circled_count + "개 · 고른 번호 읽힘 " + r.chosen_count + "/" + r.mc_count + " · " + Math.round(r.ms / 1000) + "초" +
          (r.partial ? '<div class="err-box" style="margin-top:8px">판독 절반 실패(' + esc(r.partial === "circled" ? "틀림 표시" : "고른 번호") + ") — 그 부분은 손으로 채우세요.</div>" : "") +
          (conflicts.length ? '<div class="problems" style="margin-top:8px"><b>확인 필요 ' + conflicts.length + "건</b><ul>" + conflicts.map((c) => "<li>" + esc(c) + "</li>").join("") + "</ul></div>" : "") +
          '<div class="muted" style="margin-top:6px">형광펜 틀림 표시를 기준으로 채웠습니다. 틀린 번호 타일을 훑어보고 고친 뒤 [저장]하세요. 점수는 서버 코드가 계산합니다.</div></div>';
        $("#gLevel").scrollIntoView({ block: "start" });
      } catch (e) { $("#gScanOut").innerHTML = '<div class="err-box">' + esc(errMsg(e)) + "</div>"; }
      finally { busy(false); }
    };
  };
  const renderLevel = () => {
    $("#gLevel").innerHTML = '<h2>입력 수준</h2><div class="grade-level">' + INPUT_LEVELS.map((l) => '<button class="big ' + (D.level === l ? "primary" : "") + '" data-l="' + l + '">' + esc(INPUT_LEVEL_LABEL[l]) + '<div class="muted" style="font-size:12px;color:inherit;opacity:.8">' + ({ chosen: "문항마다 고른 번호 1~5 (가장 자세한 결과지)", wrong_only: "틀린 번호만 탭 (대부분 여기)", total_only: "점수 하나만 (컷 대비 위치만)" })[l] + "</div></button>").join("") + "</div>";
    $$("#gLevel button").forEach((b) => b.onclick = () => { D.level = b.dataset.l; persist(); renderLevel(); renderInput(); });
  };

  const renderInput = () => {
    const h = $("#gInput");
    if (!D.level) { h.innerHTML = '<p class="muted">입력 수준을 먼저 고르세요.</p>'; $("#gWriting").innerHTML = ""; $("#gFoot").innerHTML = ""; return; }
    if (D.level === "chosen") {
      h.innerHTML = '<h2>고른 번호 <span class="muted">숫자키 1~5 → 자동 다음 · 0 = 모름(빈칸)</span></h2><div id="gRows" tabindex="0">' +
        mc.map((i) => '<div class="grade-row" data-k="' + IK(i) + '"><span class="no">' + esc(itemLabel(i)) + '</span><span class="pts">' + TYPE_LABEL[i.type] + " " + Number(i.points) + '</span><span class="btns">' + [1, 2, 3, 4, 5].map((n) => '<button data-n="' + n + '">' + n + "</button>").join("") + '<button data-n="0" title="모름">-</button></span><span class="muted" style="font-size:12px"></span></div>').join("") + "</div>";
      let idx = 0;
      const rows = $$("#gRows .grade-row");
      const paint = () => rows.forEach((r, k) => {
        r.classList.toggle("cur", k === idx);
        const v = D.chosen[r.dataset.k]; const it = mc[k];
        $$(".btns button", r).forEach((b) => { const n = Number(b.dataset.n); const on = (v === n) || (v === null && n === 0); b.className = on ? "pick" + ((it.answers || []).includes(n) ? " right" : "") : ""; });
        $("span:last-child", r).textContent = v === undefined ? "" : v === null ? "빈칸" : ((it.answers || []).includes(v) ? "정답" : "오답 (정답 " + (it.answers || []).join(",") + ")");
      });
      const set = (k, n) => { D.chosen[IK(mc[k])] = n === 0 ? null : n; persist(); idx = Math.min(k + 1, rows.length - 1); paint(); rows[idx].scrollIntoView({ block: "nearest" }); };
      rows.forEach((r, k) => r.onclick = (e) => { const b = e.target.closest("button"); if (b) set(k, Number(b.dataset.n)); else { idx = k; paint(); } });
      $("#gRows").onkeydown = (e) => {
        if (/^[0-5]$/.test(e.key)) { e.preventDefault(); set(idx, Number(e.key)); }
        else if (e.key === "ArrowDown") { e.preventDefault(); idx = Math.min(idx + 1, rows.length - 1); paint(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); idx = Math.max(idx - 1, 0); paint(); }
      };
      paint(); $("#gRows").focus();
    } else if (D.level === "wrong_only") {
      // 판독으로 채운 경우 틀린 타일에 '학생이 고른 번호'를 작게 표시 (참고용 · 저장되지 않음 · 판독 정확도 67~83%)
      const pickBadge = (i) => { const n = D.wrongChosen && D.wrongChosen[IK(i)]; return n ? '<small style="display:block;font-size:11px;opacity:.75">' + "①②③④⑤"[n - 1] + " 골랐음</small>" : ""; };
      h.innerHTML = '<h2>틀린 번호만 탭 <span class="muted">나머지는 정답 처리</span></h2><div class="tile-grid" id="gTiles">' + mc.map((i) => '<button data-k="' + IK(i) + '" class="' + (D.wrong.includes(IK(i)) ? "wrong" : "") + '">' + esc(itemLabel(i)) + pickBadge(i) + "</button>").join("") + '</div><p class="muted">틀린 문항 <b id="gWrongN">' + D.wrong.length + "</b>개</p>";
      $$("#gTiles button").forEach((b) => b.onclick = () => { const no = b.dataset.k; D.wrong = D.wrong.includes(no) ? D.wrong.filter((x) => x !== no) : [...D.wrong, no]; persist(); b.classList.toggle("wrong"); $("#gWrongN").textContent = D.wrong.length; });
    } else {
      h.innerHTML = '<h2>총점만</h2><div class="row"><input id="gManual" type="number" min="0" max="100" step="0.5" style="width:120px;font-size:24px" value="' + esc(D.manual) + '"> <span class="muted">/ 100 (객관식+서술형 합계로 학생이 아는 점수)</span></div>';
      $("#gManual").oninput = (e) => { D.manual = e.target.value; persist(); };
    }
    renderWriting(); renderFoot();
  };

  const renderWriting = () => {
    const h = $("#gWriting");
    if (!wr.length) { h.innerHTML = ""; return; }
    h.innerHTML = "<h2>서술형 <span class=\"muted\">배점·모범답안 · 감점 위험 체크 (숫자 점수 ✕)</span></h2>" + wr.map((i) => {
      const w = D.writing[IK(i)] || { written: "", risk: [], unknown: false };
      return '<div class="wr-card" data-k="' + IK(i) + '"><div class="row"><b>' + esc(itemLabel(i)) + (i.label || i.no >= 100 ? "" : "번") + "</b> <span class=\"muted\">" + Number(i.points) + "점" + (i.unit ? " · " + esc(i.unit) : "") + '</span><span class="grow"></span><label><input type="checkbox" class="wUnknown"' + (w.unknown ? " checked" : "") + "> 모름</label></div>" +
        (i.model_answer ? '<div class="model">' + esc(i.model_answer) + "</div>" : '<div class="muted">모범답안 없음 (문항표에서 입력)</div>') +
        '<textarea class="wWritten" placeholder="학생이 기억하는 답안 (선택)">' + esc(w.written) + "</textarea>" +
        '<div class="row">' + (Array.isArray(i.rubric) && i.rubric.length ? i.rubric.map((r) => '<label><input type="checkbox" class="wRisk" value="' + esc(r.rule_id) + '"' + (w.risk.includes(r.rule_id) ? " checked" : "") + "> " + esc(r.label || r.rule_id) + (r.deduct ? " (−" + r.deduct + ")" : "") + "</label>").join("") : '<span class="muted">감점 기준 없음</span>') + "</div></div>";
    }).join("");
    $$("#gWriting .wr-card").forEach((c) => {
      const no = c.dataset.k;
      const upd = () => { D.writing[no] = { written: $(".wWritten", c).value, risk: $$(".wRisk:checked", c).map((x) => x.value), unknown: $(".wUnknown", c).checked }; persist(); };
      c.addEventListener("input", upd); c.addEventListener("change", upd);
    });
  };

  const renderFoot = () => {
    $("#gFoot").innerHTML = '<div class="card"><label><input type="checkbox" id="gChecked"' + (D.checked ? " checked" : "") + '> 학생이 입력 내용을 확인함</label>' +
      '<div class="row" style="margin-top:10px"><button id="gSave" class="primary big">' + esc(st.name) + ' 학생 결과 저장</button><button id="gClear">입력 지우기</button></div><div id="gOut"></div></div>';
    $("#gChecked").onchange = (e) => { D.checked = e.target.checked; persist(); };
    $("#gClear").onclick = () => { if (confirm("입력을 모두 지울까요?")) { dropDraft(K); D = { level: null, chosen: {}, wrong: [], manual: "", writing: {}, checked: false }; renderLevel(); renderInput(); } };
    $("#gSave").onclick = async () => {
      if (!confirm(st.name + " 학생 결과를 저장합니다. 맞나요?")) return;   // 다른 학생 덮어쓰기 방지 1단계 확인
      const answers = [];
      if (D.level === "chosen") for (const i of mc) answers.push({ no: i.no, sub_no: i.sub_no, chosen: D.chosen[IK(i)] === undefined ? null : D.chosen[IK(i)] });
      if (D.level === "wrong_only") for (const k of D.wrong) { const i = mc.find((x) => IK(x) === k); if (i) answers.push({ no: i.no, sub_no: i.sub_no, chosen: null, correct: false }); }
      for (const i of wr) { const w = D.writing[IK(i)]; if (w) answers.push({ no: i.no, sub_no: i.sub_no, written: w.written || undefined, risk: w.risk || [], unknown: !!w.unknown }); }
      try {
        busy(true, "저장·채점 중…");
        const r = await api("ex-grade", { action: "save", exam_id: ex.id, student_id: st.id, input_level: D.level, answers, total_score_manual: D.level === "total_only" ? D.manual : null, student_checked: D.checked });
        dropDraft(K);
        const t = r.result.totals;
        $("#gOut").innerHTML = '<div class="card" style="border-color:var(--green)"><b>저장됨</b>' + (r.overwrote ? " (이전 결과 덮어씀)" : "") + (t.mc_score != null ? " · 객관식 " + t.mc_score + " / " + t.mc_max + " · 서술형 별도 " + t.wr_max + "점" : " · 총점 " + t.total_manual) + ' · <a href="#/exam/' + ex.id + "/report/" + st.id + '">결과지 만들기 →</a></div>';
        toast("저장됐습니다", "ok");
      } catch (e) { $("#gOut").innerHTML = '<div class="err-box">' + esc(errMsg(e)) + "</div>"; toast(errMsg(e), "err"); }
      finally { busy(false); }
    };
  };

  renderScan(); renderLevel(); renderInput();
}
