import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EXECUTIVE_LIST } from "@/lib/executives";
import { Home, Users, Target, BookOpen, ScrollText, LogOut, Menu, X, Zap, Cloud, TrendingUp, Gavel, BarChart2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { MasopsLogo } from "@/components/masops-logo";
import { ExecSymbol } from "@/components/exec-symbol";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useLanguage, useT } from "@/lib/i18n";

export function MosShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin } = useIsAdmin();
  const { lang, setLang } = useLanguage();
  const t = useT();
  const [operator, setOperator] = useState<string>("Operator");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const name =
        (data.user?.user_metadata as { display_name?: string } | undefined)?.display_name ||
        data.user?.email?.split("@")[0] ||
        "Operator";
      setOperator(name);
    });
  }, []);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const path = location.pathname;
  const navItem = (to: string, label: string, Icon: typeof Home, active?: boolean) => (
    <Link
      to={to}
      onClick={() => setOpen(false)}
      className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition ${
        active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </Link>
  );

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button className="rounded-md p-1.5 hover:bg-accent md:hidden" onClick={() => setOpen(!open)}>
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
            <Link to="/hq" className="flex items-center gap-2">
              <MasopsLogo size={26} />
            </Link>
          </div>
          <div className="flex items-center gap-3">
            {/* EN ↔ 한국어 toggle */}
            <button
              onClick={() => setLang(lang === "en" ? "ko" : "en")}
              className="hidden rounded-full border border-border/60 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground transition hover:border-gold/40 hover:bg-gold/10 hover:text-gold sm:block"
              aria-label={lang === "en" ? "한국어로 전환" : "Switch to English"}
            >
              {lang === "en" ? "한국어" : "English"}
            </button>

            <div className="hidden text-right text-xs sm:block">
              <div className="text-muted-foreground">{t("label_operator", "Operator")}</div>
              <div className="font-medium">{operator}</div>
            </div>
            <button onClick={signOut} className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground" title={t("btn_signout", "Sign out")}>
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 top-14 z-20 w-64 border-r border-border/60 bg-surface/80 p-4 backdrop-blur transition-transform md:sticky md:top-14 md:h-[calc(100vh-3.5rem)] md:translate-x-0 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="space-y-1">
            {navItem("/hq",        t("nav_hq",        "Headquarters"),          Home,     path === "/hq")}
            {isAdmin && navItem("/engine",    t("nav_engine",    "Opportunity Lab"),        TrendingUp, path.startsWith("/engine"))}
            {isAdmin && navItem("/committee", t("nav_committee", "Executive Committee"),    Gavel,      path.startsWith("/committee"))}
            {navItem("/council",   t("nav_council",   "Executive Council"),      Users,    path.startsWith("/council"))}
            {navItem("/missions",  t("nav_missions",  "Missions"),               Target,   path.startsWith("/missions"))}
            {navItem("/sops",      t("nav_sops",      "SOPs & Frameworks"),      ScrollText, path.startsWith("/sops"))}
            {navItem("/katana",    t("nav_katana",    "KATANA Revenue Board"),   BarChart2, path.startsWith("/katana"))}
            {navItem("/assets",    t("nav_assets",    "Asset Factory"),          Zap,      path.startsWith("/assets"))}
            {navItem("/library",   t("nav_library",   "Institutional Library"),  BookOpen, path.startsWith("/library"))}
            {navItem("/vault",     t("nav_vault",     "Intelligence Vault"),     Cloud,    path.startsWith("/vault"))}
          </div>

          <div className="mt-6 mb-2 px-3 text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground">
            {t("nav_exec_offices", "Executive Offices")}
          </div>
          <div className="space-y-1">
            {EXECUTIVE_LIST.map((e) => {
              const active = path.includes(`/office/${e.id}`);
              return (
                <Link
                  key={e.id}
                  to={`/office/${e.id}`}
                  onClick={() => setOpen(false)}
                  className={`group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition ${
                    active ? "bg-accent" : "hover:bg-accent/50"
                  }`}
                >
                  <ExecSymbol
                    executive={e.id}
                    size={14}
                    className={`shrink-0 transition ${active ? e.colorClass : "text-muted-foreground group-hover:" + e.colorClass}`}
                    strokeWidth={1.8}
                  />
                  <span className={`font-medium ${active ? e.colorClass : "text-foreground/80 group-hover:text-foreground"}`}>
                    {e.name}
                  </span>
                  <span className="ml-auto text-[10px] text-muted-foreground">{e.environment.split(" ")[0]}</span>
                </Link>
              );
            })}
          </div>

          <div className="mt-8 rounded-md border border-border/60 bg-background/50 p-3 text-[11px] leading-relaxed text-muted-foreground">
            <div className="font-mono uppercase tracking-[0.2em] text-foreground/80">{t("doctrine_title", "Doctrine")}</div>
            <div className="mt-1.5 italic">{t("doctrine_text", "The Operator has final authority. The executives inform, protect, and execute — never dominate.")}</div>
          </div>

          {/* Mobile language toggle */}
          <button
            onClick={() => setLang(lang === "en" ? "ko" : "en")}
            className="mt-4 w-full rounded-full border border-border/60 py-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground transition hover:border-gold/40 hover:bg-gold/10 hover:text-gold sm:hidden"
          >
            {lang === "en" ? "🌐 한국어로 전환" : "🌐 Switch to English"}
          </button>
        </aside>

        {open && (
          <div className="fixed inset-0 top-14 z-10 bg-background/60 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)} />
        )}

        {/* mos-page-enter gives a subtle slide-in on every route change */}
        <main key={path} className="min-h-[calc(100vh-3.5rem)] flex-1 mos-page-enter">{children}</main>
      </div>
    </div>
  );
}
