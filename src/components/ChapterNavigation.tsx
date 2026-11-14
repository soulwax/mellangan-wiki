import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { Search, X, ListTree, ChevronsUpDown, ChevronsDownUp, ChevronDown, ChevronRight, Sparkles, Terminal } from "lucide-react";
import { NAV_TREE } from "../data/navigation";
import type { WikiSection } from "../data/wikiContent";
import type { PageHeading } from "../utils/markdown";

interface ChapterNavigationProps {
  isMobileMenuOpen: boolean;
  chapterCount: number;
  sectionById: Map<string, WikiSection>;
  activeSection: WikiSection;
  activeHash: string;
  activeHeadings: PageHeading[];
  selectChapter: (id: string, event: MouseEvent<HTMLElement>) => void;
  scrollToAnchor: (slug: string, event: MouseEvent<HTMLElement>) => void;
}

export function ChapterNavigation({ isMobileMenuOpen, chapterCount, sectionById, activeSection, activeHash, activeHeadings, selectChapter, scrollToAnchor }: ChapterNavigationProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    "getting-started": true, tutorials: true, "ai-concurrency": true,
    rendering: true, "world-terrain": true, "core-memory": true, "gameplay-ai": true,
  });
  const activeGroup = NAV_TREE.find(group => group.items.some(item => item.id === activeSection.id));
  useEffect(() => {
    if (activeGroup) setExpandedGroups(prev => prev[activeGroup.key] ? prev : { ...prev, [activeGroup.key]: true });
  }, [activeGroup]);

  const filteredTree = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return NAV_TREE;
    return NAV_TREE.map(group => ({ ...group, items: group.items.filter(item => {
      const section = sectionById.get(item.id);
      return section && (item.shortTitle.toLowerCase().includes(q) ||
        section.title.toLowerCase().includes(q) || section.summary.toLowerCase().includes(q) ||
        section.content.toLowerCase().includes(q) || section.sourceFiles.some(file => file.toLowerCase().includes(q)));
    }) })).filter(group => group.items.length > 0);
  }, [searchQuery, sectionById]);
  const toggleGroup = (key: string) => setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  const setAllGroups = (open: boolean) => setExpandedGroups(Object.fromEntries(NAV_TREE.map(group => [group.key, open])));

  return (
    <aside
      id="chapter-navigation"
      aria-label="Chapter navigation"
      className={`wiki-sidebar fixed lg:sticky top-[58px] z-30 w-72 max-w-[85vw] shrink-0 h-[calc(100vh-58px)] flex flex-col transition-transform duration-200 ${
        isMobileMenuOpen
          ? "translate-x-0"
          : "-translate-x-full lg:translate-x-0"
      }`}
    >
      <div className="wiki-sidebar-tools p-4 space-y-3">
        <div className="relative">
          <Search aria-hidden="true" className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${chapterCount} chapters...`}
            aria-label="Search chapters and files"
            className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-[#110d1c] border border-dark-750 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-gold-500/60 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
              title="Clear search"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 px-0.5">
          <span className="uppercase tracking-wider font-semibold flex items-center gap-1.5">
            <ListTree className="w-3 h-3 text-gold-400" />
            Manual Contents
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAllGroups(true)}
              className="hover:text-gold-300 flex items-center gap-0.5 transition-colors"
              title="Expand all sections"
            >
              <ChevronsUpDown className="w-3 h-3" />
              <span>All</span>
            </button>
            <span className="text-dark-700">|</span>
            <button
              onClick={() => setAllGroups(false)}
              className="hover:text-gold-300 flex items-center gap-0.5 transition-colors"
              title="Collapse all sections"
            >
              <ChevronsDownUp className="w-3 h-3" />
              <span>Fold</span>
            </button>
          </div>
        </div>
      </div>

      <nav aria-label="Wiki chapters" className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
        {filteredTree.length === 0 && <p role="status" className="px-3 py-4 text-sm text-slate-400">No chapters match “{searchQuery}”. Try another term.</p>}
        {filteredTree.map((group) => {
          const Icon = group.icon;
          const isOpen =
            searchQuery.trim().length > 0 || !!expandedGroups[group.key];
          const hasActiveChild = group.items.some(
            (i) => i.id === activeSection.id,
          );

          return (
            <div
              key={group.key}
              className="wiki-nav-group overflow-hidden"
            >
              <button
                onClick={() => toggleGroup(group.key)}
                aria-expanded={isOpen}
                className={`w-full px-2.5 py-2 flex items-center justify-between gap-2 text-left transition-colors ${
                  hasActiveChild
                    ? "bg-dark-850/90 text-slate-100"
                    : "hover:bg-dark-900/80 text-slate-300"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${group.color}`} />
                  <span className="text-xs font-display font-bold tracking-wide truncate">
                    {group.label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${group.badgeColor}`}
                  >
                    {group.items.length}
                  </span>
                  {isOpen ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                  )}
                </div>
              </button>

              {isOpen && (
                <div className="px-1.5 pb-1.5 pt-1 space-y-0.5 border-t border-dark-850">
                  {group.items.map((item) => {
                    const sec = sectionById.get(item.id);
                    if (!sec) return null;
                    const isActive = sec.id === activeSection.id;

                    return (
                      <div key={item.id}>
                        <a
                          aria-current={isActive ? "page" : undefined}
                          href={`/${item.id}`}
                          onClick={(e) => selectChapter(item.id, e)}
                          className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-all flex items-center justify-between gap-1.5 ${
                            isActive
                              ? "bg-gold-500/15 text-gold-300 font-semibold border border-gold-500/40 shadow-sm"
                              : "text-slate-400 hover:text-slate-100 hover:bg-dark-850/60 border border-transparent"
                          }`}
                        >
                          <span className="wiki-nav-title">
                            {item.shortTitle}
                          </span>
                          {sec.interactiveComponent && (
                            <span
                              className="text-[9px] font-mono uppercase px-1 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0"
                              title="Includes Interactive Simulator"
                            >
                              Lab
                            </span>
                          )}
                        </a>

                        {isActive && activeHeadings.length > 0 && (
                          <div className="wiki-nav-headings ml-3 mt-1 mb-1.5 pl-2 border-l border-gold-500/30 space-y-0.5">
                            {activeHeadings.map((h) => (
                              <a
                                key={h.slug}
                                href={`/${activeSection.id}#${h.slug}`}
                                onClick={(e) => scrollToAnchor(h.slug, e)}
                                className={`w-full text-left py-1 px-1.5 rounded text-[11px] hover:text-gold-300 hover:bg-dark-850 transition-colors block truncate ${
                                  activeHash === h.slug
                                    ? "text-gold-300 bg-dark-850/80 font-semibold"
                                    : h.level === 4
                                      ? "pl-2.5 text-slate-400 font-mono text-[10px]"
                                      : "text-slate-300 font-medium"
                                }`}
                                title={h.text}
                              >
                                {h.text}
                              </a>
                            ))}
                            {sec.interactiveComponent && (
                              <a
                                href={`/${activeSection.id}#interactive-lab-anchor`}
                                onClick={(e) =>
                                  scrollToAnchor(
                                    "interactive-lab-anchor",
                                    e,
                                  )
                                }
                                className="w-full text-left py-1 px-1.5 rounded text-[11px] font-mono text-emerald-300 hover:bg-dark-850 flex items-center gap-1.5 truncate"
                              >
                                <Sparkles className="w-3 h-3 shrink-0" />
                                <span className="truncate">
                                  Interactive Simulator
                                </span>
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="wiki-sidebar-foot p-3 text-[10px] font-mono text-slate-400">
        <div className="flex items-center justify-between text-gold-400 font-semibold mb-1">
          <span className="flex items-center gap-1.5">
            <Terminal className="w-3 h-3" />
            <span>Engine Invariants</span>
          </span>
          <span className="text-slate-500">60 Hz DT</span>
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
          <div>
            Pool: <span className="text-slate-200">95 Size Classes</span>
          </div>
          <div>
            Grid: <span className="text-emerald-400">CSR Prefix</span>
          </div>
          <div>
            Sort: <span className="text-sky-400">12b Radix×3</span>
          </div>
          <div>
            Audio: <span className="text-amber-300">32 Voices</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
