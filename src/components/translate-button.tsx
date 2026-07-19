/**
 * TranslateButton — wraps any content block with an EN ↔ 한국어 toggle.
 *
 * Usage (two patterns):
 *
 * 1. Wrap children — the button appears above the content:
 *    <TranslateButton text={rawEnglishText}>
 *      <p>{rawEnglishText}</p>
 *    </TranslateButton>
 *
 * 2. Text-only — renders the translated string inline, no wrapper chrome:
 *    <TranslateButton text={rawEnglishText} inline />
 *
 * Translation is fetched lazily on first Korean request and cached for the
 * lifetime of the component. The global language context is respected:
 * if the user sets the app to 한국어, all mounted TranslateButtons auto-translate.
 */
import { useState, useEffect, useRef, type ReactNode } from "react";
import { useLanguage } from "@/lib/i18n";
import { translateToKorean } from "@/lib/translate.server";

interface Props {
  /** The English source text to translate. Should be stable (no re-renders with new text). */
  text: string;
  /** If true, renders only the text string (no wrapper div or toggle button chrome). */
  inline?: boolean;
  /** Optional children — if provided, shown in the EN state. Korean replaces this entirely. */
  children?: ReactNode;
  className?: string;
}

type Status = "idle" | "loading" | "done" | "error";

export function TranslateButton({ text, inline = false, children, className }: Props) {
  const { lang } = useLanguage();
  const [status, setStatus] = useState<Status>("idle");
  const [translated, setTranslated] = useState<string | null>(null);
  const [showKo, setShowKo] = useState(false);
  const fetchedRef = useRef(false);

  // When global lang switches to KO, auto-trigger translation
  useEffect(() => {
    if (lang === "ko" && !showKo) {
      setShowKo(true);
      fetchTranslation();
    } else if (lang === "en" && showKo) {
      setShowKo(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  async function fetchTranslation() {
    if (fetchedRef.current) return; // Already fetched or in-flight
    fetchedRef.current = true;
    setStatus("loading");
    try {
      const result = await translateToKorean({ data: { text } });
      setTranslated(result.translated);
      setStatus("done");
    } catch {
      setStatus("error");
      fetchedRef.current = false; // Allow retry
    }
  }

  function toggle() {
    const next = !showKo;
    setShowKo(next);
    if (next) fetchTranslation();
  }

  // ── Inline mode — just the text, no button ───────────────────────────────
  if (inline) {
    if (showKo) {
      if (status === "loading") return <span className="animate-pulse text-muted-foreground">번역 중…</span>;
      if (status === "done" && translated) return <>{translated}</>;
      if (status === "error") return <>{text}</>; // Fallback silently
    }
    return <>{text}</>;
  }

  // ── Block mode — toggle button + content ─────────────────────────────────
  const isKo = showKo && status === "done" && translated;
  const isLoading = showKo && status === "loading";

  return (
    <div className={className}>
      {/* Toggle pill */}
      <div className="mb-2 flex justify-end">
        <button
          onClick={toggle}
          disabled={isLoading}
          className={`
            inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5
            text-[10px] font-mono uppercase tracking-wider
            transition-colors duration-150 select-none
            ${showKo
              ? "border-gold/40 bg-gold/10 text-gold hover:bg-gold/20"
              : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
            }
            disabled:cursor-wait disabled:opacity-50
          `}
          aria-label={showKo ? "Show English" : "Translate to Korean"}
        >
          {isLoading ? (
            <>
              <span className="inline-block h-2 w-2 animate-spin rounded-full border border-current border-t-transparent" />
              번역 중
            </>
          ) : showKo ? (
            "🇰🇷 한국어"
          ) : (
            "🌐 한국어"
          )}
        </button>
      </div>

      {/* Content */}
      {isKo ? (
        <div className="whitespace-pre-wrap leading-relaxed">{translated}</div>
      ) : isLoading ? (
        <div className="space-y-2 opacity-40">
          {children ?? <p>{text}</p>}
        </div>
      ) : status === "error" ? (
        <>
          {children ?? <p>{text}</p>}
          <p className="mt-1 text-[10px] text-destructive">번역 실패 — 다시 시도하려면 클릭하세요.</p>
        </>
      ) : (
        children ?? <p>{text}</p>
      )}
    </div>
  );
}
