import React, { useState, useMemo, useEffect, useRef } from "react";
import { WIKI_SECTIONS, WikiSection } from "./data/wikiContent";
import { NAV_TREE, FEATURED_TOPIC_GROUPS } from "./data/navigation";
import { extractHeadings } from "./utils/markdown";

import { DiagramPanel } from "./components/DiagramPanel";
import { ChapterArticle } from "./components/ChapterArticle";
import { ChapterNavigation } from "./components/ChapterNavigation";
import { GalleryPage } from "./components/GalleryPage";
import { SimulationPanel } from "./components/SimulationPanel";
import {
  Layers,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  FileCode2,
  Wrench,
  Sparkles,
  Hash,
  GitBranch,
  Link2,
  Check,
  Calculator,
} from "lucide-react";

const VALID_SECTION_IDS = new Set<string>(WIKI_SECTIONS.map((s) => s.id));

function parseLocationRoute(): { sectionId: string; hash: string } {
  if (typeof window === "undefined") {
    return { sectionId: WIKI_SECTIONS[0].id, hash: "" };
  }

  const rawPath = window.location.pathname.replace(/^\/+|\/+$/g, "");
  const rawHash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(window.location.search);
  const queryPage = params.get("page") || params.get("chapter") || "";

  // Support /#/chapter-id or #chapter-id if pathname is root
  if (!rawPath && rawHash) {
    const cleanHashPath = rawHash.replace(/^\/+/, "");
    if (VALID_SECTION_IDS.has(cleanHashPath)) {
      return { sectionId: cleanHashPath, hash: "" };
    }
  }

  if (rawPath && VALID_SECTION_IDS.has(rawPath)) {
    return { sectionId: rawPath, hash: rawHash };
  }

  if (queryPage && VALID_SECTION_IDS.has(queryPage)) {
    return { sectionId: queryPage, hash: rawHash };
  }

  return { sectionId: WIKI_SECTIONS[0].id, hash: rawHash };
}

export const App: React.FC = () => {
  const [activeSectionId, setActiveSectionId] = useState<string>(
    () => parseLocationRoute().sectionId,
  );
  const [activeHash, setActiveHash] = useState<string>(
    () => parseLocationRoute().hash,
  );
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [proseFont, setProseFont] = useState<"sans" | "serif">(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("mellangan-wiki-font");
      if (saved === "serif" || saved === "sans") return saved;
    }
    return "sans";
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isTopicsOpen, setIsTopicsOpen] = useState<boolean>(false);
  const topicsRef = useRef<HTMLDivElement>(null);
  const [activeDiagramTab, setActiveDiagramTab] = useState<"all" | number>(
    "all",
  );
  const sectionById = useMemo(() => {
    const map = new Map<string, WikiSection>();
    for (const s of WIKI_SECTIONS) {
      map.set(s.id, s);
    }
    return map;
  }, []);

  const orderedSectionIds = useMemo(() => {
    const ids: string[] = [];
    for (const grp of NAV_TREE) {
      for (const item of grp.items) {
        if (sectionById.has(item.id)) {
          ids.push(item.id);
        }
      }
    }
    return ids;
  }, [sectionById]);

  const activeSection = useMemo(() => {
    return sectionById.get(activeSectionId) || WIKI_SECTIONS[0];
  }, [activeSectionId, sectionById]);

  const activeGroup = useMemo(() => {
    return (
      NAV_TREE.find((g) =>
        g.items.some((i) => i.id === activeSection.id),
      ) || NAV_TREE[0]
    );
  }, [activeSection]);

  // Keep document title & canonical URL path synchronized
  useEffect(() => {
    document.title = `${activeSection.title} — Mellangan Docs`;
    const currentPath = window.location.pathname.replace(/^\/+|\/+$/g, "");
    if (!currentPath) {
      const hashSuffix = window.location.hash || "";
      window.history.replaceState(
        { sectionId: activeSection.id },
        "",
        `/${activeSection.id}${hashSuffix}`,
      );
    }
  }, [activeSection]);

  // Handle outside click & Escape key for Topics dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        topicsRef.current &&
        !topicsRef.current.contains(event.target as Node)
      ) {
        setIsTopicsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsTopicsOpen(false);
      }
    };
    if (isTopicsOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isTopicsOpen]);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMobileMenuOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isMobileMenuOpen]);

  // Listen to browser Back/Forward (popstate) and in-page hash navigation
  useEffect(() => {
    const onPopState = () => {
      const { sectionId, hash } = parseLocationRoute();
      setActiveSectionId(sectionId);
      setActiveHash(hash);
      setActiveDiagramTab("all");
      if (hash) {
        requestAnimationFrame(() => {
          const el = document.getElementById(hash);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Scroll to hash anchor on initial page load if present
  useEffect(() => {
    if (activeHash) {
      const timer = window.setTimeout(() => {
        const el = document.getElementById(activeHash);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 60);
      return () => window.clearTimeout(timer);
    }
  }, [activeSection.id, activeHash]);

  const activeHeadings = useMemo(() => {
    return extractHeadings(activeSection.content);
  }, [activeSection]);

  const currentIndex = orderedSectionIds.indexOf(activeSection.id);
  const prevSection =
    currentIndex > 0
      ? sectionById.get(orderedSectionIds[currentIndex - 1]) || null
      : null;
  const nextSection =
    currentIndex >= 0 && currentIndex < orderedSectionIds.length - 1
      ? sectionById.get(orderedSectionIds[currentIndex + 1]) || null
      : null;

  const diagrams = useMemo(() => {
    if (activeSection.mermaidCharts && activeSection.mermaidCharts.length > 0) {
      return activeSection.mermaidCharts;
    }
    if (activeSection.mermaidChart) {
      return [activeSection.mermaidChart];
    }
    return [];
  }, [activeSection]);

  const selectChapter = (id: string, e?: React.MouseEvent<HTMLElement>) => {
    if (
      e &&
      (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
    ) {
      return;
    }
    if (e) {
      e.preventDefault();
    }
    if (window.location.pathname !== `/${id}` || window.location.hash !== "") {
      window.history.pushState({ sectionId: id }, "", `/${id}`);
    }
    setActiveSectionId(id);
    setActiveHash("");
    setActiveDiagramTab("all");
    setIsMobileMenuOpen(false);
    setIsTopicsOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const scrollToAnchor = (slug: string, e?: React.MouseEvent<HTMLElement>) => {
    if (
      e &&
      (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
    ) {
      return;
    }
    if (e) {
      e.preventDefault();
    }
    const targetUrl = `/${activeSection.id}#${slug}`;
    if (`${window.location.pathname}${window.location.hash}` !== targetUrl) {
      window.history.pushState({ sectionId: activeSection.id }, "", targetUrl);
    }
    setActiveHash(slug);
    const el = document.getElementById(slug);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setIsMobileMenuOpen(false);
  };

  const copyCanonicalUrl = () => {
    const url = window.location.href;
    navigator.clipboard?.writeText(url);
    setCopiedUrl(true);
    window.setTimeout(() => setCopiedUrl(false), 1800);
  };

  return (
    <div className="wiki-shell min-h-screen text-slate-200 flex flex-col selection:bg-gold-500/30 selection:text-gold-200">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <header className="wiki-header sticky top-0 z-40 h-[58px] px-4 lg:px-6 flex items-center justify-between gap-4">
        <div className="max-w-[1340px] w-full mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg bg-[#120e1e] border border-dark-750 text-slate-300 hover:text-slate-100 hover:bg-[#1a1429] transition-colors"
              aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={isMobileMenuOpen}
              aria-controls="chapter-navigation"
            >
              {isMobileMenuOpen ? (
                <X className="w-4 h-4" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
            </button>
            <a
              href="/overview"
              onClick={(e) => selectChapter("overview", e)}
              className="flex items-center gap-2.5 text-left group"
            >
              <div className="wiki-mark flex items-center justify-center font-display font-black text-base">
                M
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-base tracking-normal text-slate-100">
                    Mellangan <span className="wiki-brand-sub hidden sm:inline">/ FIELD GUIDE</span>
                  </span>
                </div>
              </div>
            </a>
          </div>

          <div className="flex items-center gap-2">
            <div
              className="hidden sm:flex items-center bg-[#110d1c] p-0.5 rounded-lg border border-dark-750 text-[11px] font-mono"
              title="Switch article reading typography between Plus Jakarta Sans and Source Serif 4"
            >
              <button
                type="button"
                onClick={() => {
                  setProseFont("sans");
                  window.localStorage.setItem("mellangan-wiki-font", "sans");
                }}
                aria-pressed={proseFont === "sans"}
                className={`px-2 py-1 rounded-md transition-colors ${
                  proseFont === "sans"
                    ? "bg-gold-500/20 text-gold-300 border border-gold-500/40 font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Sans
              </button>
              <button
                type="button"
                onClick={() => {
                  setProseFont("serif");
                  window.localStorage.setItem("mellangan-wiki-font", "serif");
                }}
                aria-pressed={proseFont === "serif"}
                className={`px-2 py-1 rounded-md font-serif transition-colors ${
                  proseFont === "serif"
                    ? "bg-gold-500/20 text-gold-300 border border-gold-500/40 font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Serif
              </button>
            </div>
            {/* Direct Quick Link 1: Contribute */}
            <a
              href="/contribute-basics"
              onClick={(e) => selectChapter("contribute-basics", e)}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#110d1c] hover:bg-[#181326] border border-dark-750 hover:border-gold-500/40 text-xs font-mono text-slate-300 hover:text-gold-300 transition-colors"
              title="Contribution Guide &amp; Dev Toolchain"
            >
              <Wrench className="w-3.5 h-3.5 text-gold-400" />
              <span>Contribute</span>
            </a>

            {/* Direkter Schnellzugriff 2: Spielmathematik */}
            <a
              href="/engine-mathematics"
              onClick={(e) => selectChapter("engine-mathematics", e)}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#110d1c] hover:bg-[#181326] border border-dark-750 hover:border-indigo-500/40 text-xs font-mono text-slate-300 hover:text-indigo-300 transition-colors"
              title="Spielmathematik, Invarianten und Beweise"
            >
              <Calculator className="w-3.5 h-3.5 text-indigo-400" />
              <span>Spielmathematik</span>
            </a>

            {/* Unified Topics & Labs Dropdown Menu */}
            <div className="relative" ref={topicsRef}>
              <button
                type="button"
                onClick={() => setIsTopicsOpen(!isTopicsOpen)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                  isTopicsOpen
                    ? "bg-[#1d1630] text-gold-300 border border-gold-500/60 shadow-lg shadow-black"
                    : "bg-[#110d1c] hover:bg-[#181326] text-slate-200 hover:text-gold-300 border border-dark-750 hover:border-gold-500/40"
                }`}
                aria-expanded={isTopicsOpen}
                aria-haspopup="true"
                aria-label="Topics"
              >
                <Layers className="w-3.5 h-3.5 text-gold-400" />
                <span className="hidden sm:inline">Topics</span>
                <span className="hidden sm:inline-block px-1.5 py-0.2 rounded bg-gold-500/15 text-gold-300 border border-gold-500/30 text-[10px] font-semibold">
                  Labs
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                    isTopicsOpen ? "rotate-180 text-gold-300" : ""
                  }`}
                />
              </button>

              {isTopicsOpen && (
                <div
                  className="fixed left-3 right-3 top-[64px] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[680px] md:w-[760px] max-h-[calc(100vh-80px)] overflow-y-auto bg-[#0a0712] border border-dark-750 rounded-2xl shadow-2xl shadow-black z-50 flex flex-col"
                  role="menu"
                >
                  {/* Menu header */}
                  <div className="flex items-center justify-between p-4 sm:p-5 pb-3 sm:pb-3.5 border-b border-dark-800 bg-[#0e0a19]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-gold-400 animate-pulse"></div>
                      <div>
                        <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-100 flex items-center gap-2">
                          <span>Featured Topics &amp; Labs</span>
                          <span className="px-1.5 py-0.2 rounded bg-gold-500/15 text-gold-300 border border-gold-500/30 text-[10px]">
                            Interactive Labs
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-sans mt-0.5">
                          Architectural deep-dives and deterministic interactive simulators
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
                        Press <kbd className="px-1.5 py-0.5 rounded bg-dark-850 border border-dark-700 text-slate-400">Esc</kbd>
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsTopicsOpen(false)}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-dark-800 transition-colors"
                        title="Close menu"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* 3 Categories Grid */}
                  <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 bg-[#0a0712]">
                    {FEATURED_TOPIC_GROUPS.map((group) => (
                      <div key={group.groupName} className="flex flex-col gap-2">
                        <div className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-400 px-1 flex items-center justify-between">
                          <span>{group.groupName}</span>
                          <span className="text-slate-600 font-normal">({group.topics.length})</span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {group.topics.map((t) => {
                            const IconComponent = t.icon;
                            const isActive = activeSectionId === t.id;
                            return (
                              <a
                                key={t.id}
                                href={`/${t.id}`}
                                onClick={(e) => {
                                  selectChapter(t.id, e);
                                  setIsTopicsOpen(false);
                                }}
                                className={`group p-2.5 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                                  isActive
                                    ? "bg-[#1d1630] border-gold-500/70 shadow-md shadow-black"
                                    : "bg-[#130f1e] hover:bg-[#1a1428] border-dark-800 hover:border-dark-700"
                                }`}
                              >
                                <div
                                  className={`p-1.5 rounded-lg border shrink-0 mt-0.5 transition-colors ${
                                    isActive
                                      ? "bg-[#271d42] border-gold-500/50 text-gold-300"
                                      : "bg-[#0a0712] border-dark-750 text-slate-400 group-hover:text-gold-300 group-hover:border-gold-500/40"
                                  }`}
                                >
                                  <IconComponent className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-1">
                                    <span
                                      className={`text-xs font-semibold truncate ${
                                        isActive
                                          ? "text-gold-200"
                                          : "text-slate-200 group-hover:text-gold-300"
                                      }`}
                                    >
                                      {t.title}
                                    </span>
                                    {t.badge && (
                                      <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/80 font-semibold shrink-0">
                                        {t.badge}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-400 group-hover:text-slate-300 truncate mt-0.5">
                                    {t.subtitle}
                                  </p>
                                </div>
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer link to full index */}
                  <div className="p-3.5 sm:px-5 border-t border-dark-800 bg-[#0e0a19] flex items-center justify-between text-xs font-mono text-slate-400">
                    <span className="text-[11px]">{orderedSectionIds.length} Chapters across 6 modules</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsTopicsOpen(false);
                        setIsMobileMenuOpen(true);
                      }}
                      className="text-gold-400 hover:text-gold-300 text-[11px] font-semibold flex items-center gap-1 hover:underline"
                    >
                      Browse full index in sidebar &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>

            <a
              href="https://github.com/soulwax/Mellangan"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-dark-850 hover:bg-dark-800 border border-dark-700 text-xs font-mono text-slate-200 transition-colors"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                />
              </svg>
              <span className="hidden sm:inline">GitHub</span>
            </a>
          </div>
        </div>
      </header>

      <div className="wiki-layout flex-1 flex w-full mx-auto relative">
        {/* Mobile menu backdrop */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 top-[58px] bg-black/80 z-20 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}
        <ChapterNavigation
          isMobileMenuOpen={isMobileMenuOpen}
          chapterCount={orderedSectionIds.length}
          sectionById={sectionById}
          activeSection={activeSection}
          activeHash={activeHash}
          activeHeadings={activeHeadings}
          selectChapter={selectChapter}
          scrollToAnchor={scrollToAnchor}
        />

        <main id="main-content" tabIndex={-1} className="wiki-main flex-1 min-w-0 px-4 sm:px-8 lg:px-10 py-7">
          <div className="max-w-[820px] xl:max-w-[860px] mx-auto">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-400 mb-3">
              <div className="flex items-center gap-1.5 min-w-0">
                <a
                  href="/overview"
                  onClick={(e) => selectChapter("overview", e)}
                  className="hover:text-slate-200 transition-colors"
                >
                  Docs
                </a>
                <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
                <span
                  className={`uppercase font-semibold shrink-0 ${activeGroup.color}`}
                >
                  {activeGroup.label}
                </span>
                <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
                <a
                  href={`/${activeSection.id}`}
                  onClick={(e) => selectChapter(activeSection.id, e)}
                  className="text-slate-300 hover:text-gold-300 truncate transition-colors"
                >
                  /{activeSection.id}
                </a>
              </div>

              <button
                onClick={copyCanonicalUrl}
                aria-label={copiedUrl ? "Link copied" : "Copy link to this page"}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-dark-900 hover:bg-dark-800 border border-dark-750 text-[11px] font-mono text-slate-300 hover:text-gold-300 transition-colors"
                title="Copy direct page or section URL"
              >
                {copiedUrl ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-300">Copied URL</span>
                  </>
                ) : (
                  <>
                    <Link2 className="w-3 h-3 text-gold-400" />
                    <span>
                      /{activeSection.id}
                      {activeHash ? `#${activeHash.slice(0, 18)}` : ""}
                    </span>
                  </>
                )}
              </button>
            </div>

            <div className="wiki-hero pb-7 mb-8">
              <div className="wiki-kicker"><span className="wiki-kicker-dot" /> THE MELLANGAN FIELD GUIDE <span className="wiki-kicker-line" /> {String(currentIndex + 1).padStart(2, "0")} / {String(orderedSectionIds.length).padStart(2, "0")}</div>
              <h1 className="wiki-title font-display text-slate-100">
                {activeSection.title}
              </h1>
              <p className="wiki-deck text-slate-300/90 leading-relaxed">
                {activeSection.summary}
              </p>

              <div className="flex flex-wrap items-center gap-1.5 mb-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1 mr-1">
                  <FileCode2 className="w-3.5 h-3.5 text-gold-400" />
                  Source:
                </span>
                {activeSection.sourceFiles.map((file) => (
                  <a
                    key={file}
                    href={`https://github.com/soulwax/Mellangan/blob/main/${file}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2 py-0.5 rounded-md bg-dark-900 hover:bg-dark-800 border border-dark-750 hover:border-gold-500/40 text-[11px] font-mono text-gold-300 transition-colors"
                  >
                    {file}
                  </a>
                ))}
              </div>

              {(activeSection.interactiveComponent || diagrams.length > 0) && (
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  {activeSection.interactiveComponent && (
                    <a
                      href={`/${activeSection.id}#interactive-lab-anchor`}
                      onClick={(e) =>
                        scrollToAnchor("interactive-lab-anchor", e)
                      }
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs font-mono text-emerald-300 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Jump to Interactive Simulator ↓</span>
                    </a>
                  )}
                  {diagrams.length > 0 && (
                    <a
                      href={`/${activeSection.id}#architecture-diagrams-anchor`}
                      onClick={(e) =>
                        scrollToAnchor("architecture-diagrams-anchor", e)
                      }
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-xs font-mono text-sky-300 transition-colors"
                    >
                      <GitBranch className="w-3.5 h-3.5" />
                      <span>
                        Jump to Architecture Graphs ({diagrams.length}) ↓
                      </span>
                    </a>
                  )}
                </div>
              )}
            </div>

            <ChapterArticle content={activeSection.content} proseFont={proseFont} onAnchor={scrollToAnchor} />
            {activeSection.id === "gallery" && <GalleryPage />}
            <SimulationPanel name={activeSection.interactiveComponent} sourceFiles={activeSection.sourceFiles} />

            <DiagramPanel sectionId={activeSection.id} diagrams={diagrams} activeDiagramTab={activeDiagramTab} setActiveDiagramTab={setActiveDiagramTab} />

            <div className="mt-12 pt-6 border-t border-dark-800 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {prevSection ? (
                <a
                  href={`/${prevSection.id}`}
                  onClick={(e) => selectChapter(prevSection.id, e)}
                  className="p-3.5 rounded-xl border border-dark-800 hover:border-dark-700 bg-dark-900/60 hover:bg-dark-900 text-left transition-all group block"
                >
                  <div className="text-[10px] uppercase font-mono text-slate-400 mb-1 flex items-center justify-between">
                    <span>← Previous Chapter</span>
                    <span className="text-slate-600">/{prevSection.id}</span>
                  </div>
                  <div className="text-xs sm:text-sm font-semibold text-slate-200 group-hover:text-gold-300 transition-colors">
                    {prevSection.title}
                  </div>
                </a>
              ) : (
                <div />
              )}

              {nextSection && (
                <a
                  href={`/${nextSection.id}`}
                  onClick={(e) => selectChapter(nextSection.id, e)}
                  className="p-3.5 rounded-xl border border-dark-800 hover:border-dark-700 bg-dark-900/60 hover:bg-dark-900 text-right transition-all group sm:col-start-2 block"
                >
                  <div className="text-[10px] uppercase font-mono text-slate-400 mb-1 flex items-center justify-between">
                    <span className="text-slate-600">/{nextSection.id}</span>
                    <span>Next Chapter →</span>
                  </div>
                  <div className="text-xs sm:text-sm font-semibold text-slate-200 group-hover:text-gold-300 transition-colors">
                    {nextSection.title}
                  </div>
                </a>
              )}
            </div>
          </div>
        </main>

        <aside className="wiki-toc hidden xl:block sticky top-[58px] w-60 shrink-0 h-[calc(100vh-58px)] p-5 overflow-y-auto">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold mb-3 flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5 text-gold-400" />
            <span>On This Page</span>
          </div>

          <div className="space-y-0.5 border-l border-dark-800 pl-2.5">
            {activeHeadings.map((h) => {
              const isActive = activeHash === h.slug;
              return (
                <a
                  key={h.slug}
                  href={`/${activeSection.id}#${h.slug}`}
                  onClick={(e) => scrollToAnchor(h.slug, e)}
                  className={`w-full text-left py-1 px-1.5 rounded transition-all block truncate ${
                    isActive
                      ? "text-gold-300 font-semibold -ml-[11px] pl-2 border-l-2 border-gold-400 bg-gold-500/10"
                      : h.level === 4
                        ? "pl-2.5 text-[11px] font-mono text-slate-400 hover:text-slate-200 hover:bg-dark-850/60"
                        : "text-xs text-slate-300 hover:text-gold-300 font-medium hover:bg-dark-850/60"
                  }`}
                  title={h.text}
                >
                  {h.text}
                </a>
              );
            })}
            {activeSection.interactiveComponent && (
              <a
                href={`/${activeSection.id}#interactive-lab-anchor`}
                onClick={(e) => scrollToAnchor("interactive-lab-anchor", e)}
                className="w-full text-left py-1 text-xs font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 pt-2"
              >
                <Sparkles className="w-3 h-3 shrink-0" />
                <span className="truncate">Interactive Simulator</span>
              </a>
            )}
            {diagrams.length > 0 && (
              <a
                href={`/${activeSection.id}#architecture-diagrams-anchor`}
                onClick={(e) =>
                  scrollToAnchor("architecture-diagrams-anchor", e)
                }
                className="w-full text-left py-1 text-xs font-mono text-sky-400 hover:text-sky-300 block truncate"
              >
                Architecture Graphs ({diagrams.length})
              </a>
            )}
          </div>
        </aside>
      </div>

      <footer className="wiki-footer py-6 px-4 text-center text-xs text-slate-500 font-mono">
        <p>
          Mellangan Systems Architecture Wiki • C++20 / C11 • Vulkan2D • EnTT •
          SDL3
        </p>
        <p className="mt-1 text-[11px] text-slate-600">
          Submodule <code className="text-slate-400">./extern/wiki</code> • {orderedSectionIds.length} Chapters • 50+ Architecture Diagrams • Interactive Simulations
        </p>
      </footer>
    </div>
  );
};
