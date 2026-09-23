// 상수는 여기 한 곳 (지시서 §2-1 · §4-1 · §5-1). 여기 없는 값은 만들지 않는다.
export const APP_VERSION = "20260923d";
export const SB_URL = "https://mlrjiabejpnoutwmzkcr.supabase.co";
export const FN = (name) => SB_URL + "/functions/v1/" + name;

export const ROLES = ["admin", "teacher"];
export const TYPES = ["vocab", "grammar", "reading", "dialog", "writing"];
export const TYPE_LABEL = { vocab: "어휘", grammar: "문법", reading: "독해", dialog: "대화문", writing: "서술형" };
export const TYPE_KEY = { v: "vocab", g: "grammar", r: "reading", d: "dialog", w: "writing" };   // 키보드 단축
export const DIFFICULTY_LABEL = { 1: "1 기본", 2: "2 꼬임", 3: "3 킬러" };
export const SOURCES = ["textbook", "external", "unknown"];
export const SOURCE_LABEL = { textbook: "교과서", external: "외부", unknown: "모름" };
export const CONFIDENCES = ["given", "ai", "confirmed"];
export const CONFIDENCE_LABEL = { given: "정답지", ai: "추정(AI)", confirmed: "선생님 확인" };
export const EXAM_KIND_LABEL = { mid: "중간", final: "기말" };
export const LEVEL_LABEL = { middle: "중", high: "고" };
export const INPUT_LEVELS = ["chosen", "wrong_only", "total_only"];
export const INPUT_LEVEL_LABEL = { chosen: "고른 번호 있음", wrong_only: "틀린 번호만", total_only: "총점만" };
export const REPORT_KINDS = ["student", "parent"];   // blog 는 앱 밖 (결정 A)
/** 문항 표기: label 이 있으면 그대로(서답형1), 없으면 번호(-하위번호). no ≥ 100 은 별도 번호 체계의 서술형 */
export const itemLabel = (it) => it.label ? it.label : (it.no >= 100 ? "서술형" + (it.no - 100) : String(it.no) + (it.sub_no ? "-" + it.sub_no : ""));

// 성취도 컷 (중등 고정)
export const CUTS = { A: 90, B: 80, C: 70, D: 60 };

// 색 (§5-3)
export const COLOR = { blue: "#5170ff", red: "#ff5757", ink: "#111", soft: "#f2f4f8" };

// 선생님 한마디 6개 (§5-1 블록 8)
export const TEACHER_COMMENTS = {
  steady: "기본기가 탄탄합니다. 지금 페이스를 유지하면 됩니다.",
  careless: "아는 문제에서 실수가 있었습니다. 검토 습관을 같이 잡겠습니다.",
  grammar: "문법 영역에서 점수를 놓쳤습니다. 이번 주부터 집중 보완합니다.",
  reading: "독해 지문의 세부 내용 파악을 보완하면 한 단계 오릅니다.",
  writing: "서술형 감점 위험 포인트를 정리해 두었습니다. 상담 때 같이 보겠습니다.",
  growth: "지난 시험보다 나아진 부분이 분명합니다. 다음 목표를 함께 잡겠습니다.",
};

// 고지 문구 — 하드코딩 · 항상 렌더 · 삭제 불가 (§5-1)
export const NOTICE_PARENT =
  "이 결과지는 학교 공식 성적이 아닙니다. 학생이 가져온 시험지와 기억한 답안을 바탕으로 본 학원이 분석한 예상 결과이며, 실제 학교 채점과 다를 수 있습니다. 특히 서술형은 학교 채점 기준에 따라 차이가 큽니다. 성적 이의는 학교로 문의해 주세요.\n" +
  "문항 정리에는 AI 분석 도구를 보조로 사용하며, 최종 확인과 해석은 담당 선생님이 합니다. 시험지 이미지는 저장하지 않으며, 학생 정보는 동의하신 범위 안에서만 보관합니다.";
export const NOTICE_STUDENT =
  "학교 공식 성적이 아닌 학원 분석 예상 결과입니다. 서술형 점수는 참고용이며 학교 채점과 다를 수 있습니다.";

// 다음 행동 문구 템플릿 (§5-1 블록 9) — lost_by_type 상위 2개 영역
export const NEXT_ACTION = {
  vocab: "교과서 단원 어휘 목록을 다시 외우고, 동의어·영영풀이 유형을 하루 5문항씩 풉니다.",
  grammar: "틀린 문항의 문법 포인트를 노트에 정리하고, 같은 포인트 문제를 10개 더 풉니다.",
  reading: "지문의 근거 문장에 밑줄을 긋는 연습을 합니다. 선택지와 본문을 1:1로 대조합니다.",
  dialog: "대화문은 앞뒤 흐름 파악이 핵심입니다. 교과서 대화문을 소리 내어 읽고 순서를 맞춥니다.",
};
