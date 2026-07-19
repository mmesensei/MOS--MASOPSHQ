/**
 * i18n — lightweight Korean / English language context for MASOPS.
 *
 * Usage:
 *   const { lang, setLang } = useLanguage();   // toggle
 *   const t = useT();                           // static string lookup
 *   t("nav_hq")                                // → "본부" | "Headquarters"
 *
 * For dynamic AI-generated content, use <TranslateButton> instead.
 */
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type Lang = "en" | "ko";

// ─── Korean translations ───────────────────────────────────────────────────
// Every string is translated for natural, contextual Korean — not word-for-word.
const KO: Record<string, string> = {
  // Navigation
  nav_hq:          "본부",
  nav_engine:      "기회 연구소",
  nav_committee:   "경영진 위원회",
  nav_council:     "경영진 협의회",
  nav_missions:    "미션",
  nav_sops:        "운영 절차 및 프레임워크",
  nav_katana:      "KATANA 매출 현황판",
  nav_assets:      "자산 팩토리",
  nav_library:     "기관 도서관",
  nav_vault:       "인텔리전스 금고",
  nav_exec_offices:"임원 사무실",

  // Shell
  label_operator:  "오퍼레이터",
  btn_signout:     "로그아웃",
  doctrine_title:  "운영 원칙",
  doctrine_text:   "오퍼레이터가 최종 권한을 갖습니다. 임원진은 정보 제공, 보호, 실행을 담당하며 — 결코 지배하지 않습니다.",

  // HQ page
  hq_status:           "임원 본부 · 시스템 정상 운영",
  hq_welcome:          "돌아오셨군요, 오퍼레이터.",
  hq_desc:             "협의회가 대기 중입니다. 미션을 개설하거나, 의사결정을 위해 소집하거나, 임원 사무실로 입장하세요.",
  hq_session_active:   "MASOPS · 세션 활성화",
  hq_sentinel_mon:     "SENTINEL 모니터링 중",
  hq_command_active:   "지휘 · 임원 4명 활성화",
  hq_convene:          "협의회 소집",
  hq_active_missions:  "활성 미션",
  hq_current_obj:      "현재 목표",
  hq_obj_empty:        "브리핑 대기 중",
  hq_systems_ok:       "전 시스템 정상 운영",
  hq_new_mission:      "새 미션",
  hq_all_missions:     "전체 미션",
  hq_charter_desc:     "협의회와 함께 IRIS → APEX → KATANA → SENTINEL 순으로 진행합니다.",
  hq_journal_title:    "성장 일지",
  hq_journal_subtitle: "임원진이 학습한 내용",
  hq_journal_empty:    "임원진이 아직 일지를 작성하지 않았습니다. 대화를 시작하면 학습을 시작합니다.",
  hq_quick_actions:    "빠른 실행",
  hq_quick_council:    "협의회 소집",
  hq_quick_mission:    "미션 개설",
  hq_quick_intel:      "인텔리전스 추가",
  hq_quick_journal:    "일지 검토",

  // Auth
  auth_signin_slug:    "인증",
  auth_signup_slug:    "오퍼레이터 등록",
  auth_signin_title:   "본부에 입장하세요",
  auth_signup_title:   "지휘권을 확립하세요",
  auth_label_name:     "오퍼레이터 이름",
  auth_label_email:    "이메일",
  auth_label_pw:       "비밀번호",
  auth_btn_signin:     "HQ 입장",
  auth_btn_signup:     "지휘권 확립",
  auth_google:         "Google로 계속하기",
  auth_need_signup:    "아직 등록하지 않으셨나요?",
  auth_do_signup:      "등록하기",
  auth_need_signin:    "이미 오퍼레이터이신가요?",
  auth_do_signin:      "로그인",

  // Executive actions (chambers)
  exec_action_iris:     "전략 보기",
  exec_action_apex:     "시스템 열기",
  exec_action_katana:   "운영 현황 보기",
  exec_action_sentinel: "보안 열기",

  // Missions
  mission_title:        "미션",
  mission_desc:         "중요한 모든 일은 미션이 됩니다. 협의회가 개설하고, KATANA가 추적하며, SENTINEL이 보호합니다.",
  mission_charter:      "새 미션 개설",
  mission_empty_title:  "진행 중인 미션 없음",
  mission_empty_desc:   "협의회와 함께 첫 번째 미션을 개설하세요.",

  // Office
  office_engagements:    "활성 업무",
  office_btn_begin:      "업무 시작",
  office_standing_by:    "대기 중.",

  // 404 / error
  page_404_slug:    "MOS · 404",
  page_404_title:   "해당 섹터를 찾을 수 없습니다",
  page_404_desc:    "이 위치는 본부에 속하지 않습니다. 운영 층으로 돌아가세요.",
  page_404_btn:     "본부로 돌아가기",
  error_slug:       "시스템 오류",
  error_title:      "본부가 응답하지 않습니다",
  error_desc:       "SENTINEL이 오류를 기록했습니다. 다시 시도할 수 있습니다.",
  btn_retry:        "재시도",
  btn_home:         "홈",

  // Callback / auth flow
  auth_callback_wait:  "세션 설정 중…",
  auth_callback_error: "로그인을 완료할 수 없습니다.",
  auth_callback_back:  "로그인으로 돌아가기",

  // HQ extra strings
  hq_in_flight:          "진행 중",
  hq_track_missions:     "생애주기 추적, 활동 기록, 교훈 정리.",
  hq_sentinel_mon:       "SENTINEL 모니터링 중",
  hq_session_active:     "MASOPS · 세션 활성화",
  hq_footer:             "MOS 커널 · 임원 헌장 적용 · SENTINEL 모니터링 활성",

  // Founding VIP
  vip_banner_slug:       "파운딩 라이프타임 VIP",
  vip_banner_title:      "#{n} · 평생 창립 회원",
  vip_banner_desc:       "전체 MOS 경험에 대한 영구 평생 액세스. 만료 없음, 갱신 없음.",

  // Executive chambers
  exec_status_idle:      "대기",
  exec_status_listening: "청취 중",
  exec_status_thinking:  "분석 중",
  exec_status_speaking:  "발언 중",
  exec_status_reviewing: "검토 중",

  // Office
  office_thread_new:     "새 세션 시작",
  office_thread_history: "이전 세션",
  office_empty_title:    "대기 중",
  office_empty_desc:     "질문하거나 전략적 요청을 시작하세요.",

  // Council
  council_title:         "임원 협의회",
  council_new:           "새 협의회 세션",
  council_empty:         "협의회 세션이 아직 없습니다.",

  // Missions
  mission_stage_active:  "진행 중",
  mission_stage_done:    "완료",
  mission_stage_held:    "보류",
  mission_new_title:     "새 미션 개설",
  mission_new_desc:      "협의회가 안내합니다",

  // SOPs
  sop_title:             "운영 절차 및 프레임워크",
  sop_empty:             "아직 등록된 절차가 없습니다.",
  sop_add:               "새 절차 추가",

  // Vault
  vault_title:           "인텔리전스 금고",
  vault_empty:           "인텔리전스 항목이 없습니다.",
  vault_add:             "인텔리전스 추가",

  // Settings / errors
  settings_title:        "설정",
  error_network:         "네트워크 오류. 연결을 확인하세요.",
  error_session:         "세션이 만료되었습니다. 다시 로그인하세요.",
  error_permission:      "이 기능에 대한 권한이 없습니다.",
  error_generic:         "오류가 발생했습니다. 다시 시도하세요.",

  // Notifications / toasts
  toast_saved:           "저장되었습니다",
  toast_deleted:         "삭제되었습니다",
  toast_copied:          "복사되었습니다",

  // Exec chamber action labels
  exec_action_iris:     "전략 보기",
  exec_action_apex:     "시스템 열기",
  exec_action_katana:   "운영 보기",
  exec_action_sentinel: "보안 열기",

  // Translate toggle
  btn_translate_ko: "한국어",
  btn_translate_en: "English",
  btn_translating:  "번역 중…",
};

// ─── Context ───────────────────────────────────────────────────────────────
interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
}

const I18nContext = createContext<I18nContextValue>({ lang: "en", setLang: () => {} });

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Always start with "en" on both server and client — avoids SSR/hydration mismatch.
  // The stored preference is read in useEffect (client-only) after hydration.
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("mos-lang");
      if (stored === "ko") setLangState("ko");
    } catch { /* localStorage unavailable — stay with "en" */ }
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("mos-lang", l); } catch { /* ignore */ }
  };

  // Keep <html lang="..."> in sync
  useEffect(() => {
    document.documentElement.lang = lang === "ko" ? "ko" : "en";
  }, [lang]);

  return <I18nContext.Provider value={{ lang, setLang }}>{children}</I18nContext.Provider>;
}

export function useLanguage() {
  return useContext(I18nContext);
}

/** Returns a `t(key)` function that resolves to Korean or English. */
export function useT() {
  const { lang } = useLanguage();
  return (key: string, fallback?: string): string => {
    if (lang === "ko") return KO[key] ?? fallback ?? key;
    return fallback ?? key;
  };
}
