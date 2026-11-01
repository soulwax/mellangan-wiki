import React, { useState, useMemo, useEffect } from "react";
import { WIKI_SECTIONS, WikiSection } from "./data/wikiContent";
import { MermaidChart } from "./components/MermaidChart";
import { InteractiveGameLoop } from "./components/InteractiveGameLoop";
import { SlabMemoryVisualizer } from "./components/SlabMemoryVisualizer";
import { BiomeNoiseMap } from "./components/BiomeNoiseMap";
import { SpatialGridVisualizer } from "./components/SpatialGridVisualizer";
import { RadixDepthSorter } from "./components/RadixDepthSorter";
import { OuroborosBitLab } from "./components/OuroborosBitLab";
import { RecipeArsenalExplorer } from "./components/RecipeArsenalExplorer";
import { ContributorTutorialWizard } from "./components/ContributorTutorialWizard";
import { PixelShaderStudio } from "./components/PixelShaderStudio";
import { TerrainConstructionLab } from "./components/TerrainConstructionLab";
import { RendererPipelineInspector } from "./components/RendererPipelineInspector";
import {
  Cpu,
  Layers,
  Compass,
  Swords,
  Search,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  Terminal,
  FileCode2,
  Wrench,
  BookOpen,
  Sparkles,
  ListTree,
  ChevronsDownUp,
  ChevronsUpDown,
  Hash,
} from "lucide-react";

interface NavTreeItem {
  id: string;
  shortTitle: string;
}

interface NavTreeGroup {
  key: string;
  label: string;
  icon: React.ElementType;
  color: string;
  badgeColor: string;
  items: NavTreeItem[];
}

const GODOT_NAV_TREE: NavTreeGroup[] = [
  {
    key: "getting-started",
    label: "Getting Started & QA",
    icon: Wrench,
    color: "text-gold-400",
    badgeColor: "bg-gold-500/15 text-gold-300 border-gold-500/30",
    items: [
      {
        id: "contribute-basics",
        shortTitle: "Toolchain, Build & --dev Sandbox",
      },
      {
        id: "tutorial-testing-profiling",
        shortTitle: "Unit Tests, Visual QA & Prof.c",
      },
    ],
  },
  {
    key: "tutorials",
    label: "Step-by-Step Tutorials",
    icon: BookOpen,
    color: "text-emerald-400",
    badgeColor: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    items: [
      {
        id: "tutorial-weapon",
        shortTitle: "Adding a Weapon, Recipe & Evolution",
      },
      {
        id: "tutorial-enemy-biome",
        shortTitle: "Adding a Monster, AI Plan & Biome",
      },
      {
        id: "tutorial-hero-class",
        shortTitle: "Adding a Hero Class, Skill & Relic",
      },
      {
        id: "tutorial-structures-boss",
        shortTitle: "Adding Landmarks & 3-Phase Bosses",
      },
      {
        id: "tutorial-pixel-shader",
        shortTitle: "16×16 Pixel Art & Slang Shaders",
      },
    ],
  },
  {
    key: "rendering",
    label: "Rendering & GPU Pipeline",
    icon: Layers,
    color: "text-teal-400",
    badgeColor: "bg-teal-500/15 text-teal-300 border-teal-500/30",
    items: [
      {
        id: "renderer-in-context",
        shortTitle: "Renderer Architecture in Context",
      },
      {
        id: "radix-rendering",
        shortTitle: "64-Bit Radix Y-Sort & LightField",
      },
    ],
  },
  {
    key: "world-terrain",
    label: "World & Terrain Synthesis",
    icon: Compass,
    color: "text-sky-400",
    badgeColor: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    items: [
      {
        id: "terrain-construction",
        shortTitle: "How Terrain Is Constructed (7 Stages)",
      },
      {
        id: "world-generation",
        shortTitle: "Voronoi Biomes & Barycentric Blend",
      },
      {
        id: "weather-sky",
        shortTitle: "Diurnal Cycle, Weather & Footprints",
      },
    ],
  },
  {
    key: "core-memory",
    label: "Core Engine & Memory",
    icon: Cpu,
    color: "text-amber-400",
    badgeColor: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    items: [
      {
        id: "overview",
        shortTitle: "Engine Philosophy & 8-Slot Telemetry",
      },
      {
        id: "memory-slab",
        shortTitle: "Slab Allocator (Pool.c) & Deallocation",
      },
      {
        id: "workers-concurrency",
        shortTitle: "Atomic Worker Pool & 4-Barrier AI",
      },
      {
        id: "audio-qa",
        shortTitle: "32-Voice LRU Audio Mixer & QA Views",
      },
    ],
  },
  {
    key: "gameplay-ai",
    label: "Simulation, AI & Arsenal",
    icon: Swords,
    color: "text-rose-400",
    badgeColor: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    items: [
      {
        id: "spatial-grid",
        shortTitle: "CSR Prefix-Sum Spatial Grid",
      },
      {
        id: "goal-ai",
        shortTitle: "GoalQueue AI Ringbuffer & Ouroboros",
      },
      {
        id: "weapon-synthesis",
        shortTitle: "Combinatorial Weapon Recipes",
      },
      {
        id: "classes-encounters",
        shortTitle: "12 Hero Classes, Traits & Bosses",
      },
    ],
  },
];

function slugify(raw: string): string {
  return raw
    .replace(/`/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

interface PageHeading {
  level: 3 | 4;
  text: string;
  slug: string;
}

function extractHeadings(markdown: string): PageHeading[] {
  const out: PageHeading[] = [];
  const lines = markdown.split("\n");
  for (const line of lines) {
    if (line.startsWith("### ")) {
      const text = line.slice(4).trim().replace(/`/g, "");
      out.push({ level: 3, text, slug: slugify(text) });
    } else if (line.startsWith("#### ")) {
      const text = line.slice(5).trim().replace(/`/g, "");
      out.push({ level: 4, text, slug: slugify(text) });
    }
  }
  return out;
}

export const App: React.FC = () => {
  const [activeSectionId, setActiveSectionId] = useState<string>(
    WIKI_SECTIONS[0].id,
  );
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    "getting-started": true,
    tutorials: true,
    rendering: true,
    "world-terrain": true,
    "core-memory": true,
    "gameplay-ai": true,
  });

  const sectionById = useMemo(() => {
    const map = new Map<string, WikiSection>();
    for (const s of WIKI_SECTIONS) {
      map.set(s.id, s);
    }
    return map;
  }, []);

  const orderedSectionIds = useMemo(() => {
    const ids: string[] = [];
    for (const grp of GODOT_NAV_TREE) {
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
      GODOT_NAV_TREE.find((g) =>
        g.items.some((i) => i.id === activeSection.id),
      ) || GODOT_NAV_TREE[0]
    );
  }, [activeSection]);

  useEffect(() => {
    if (activeGroup) {
      setExpandedGroups((prev) =>
        prev[activeGroup.key] ? prev : { ...prev, [activeGroup.key]: true },
      );
    }
  }, [activeGroup]);

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

  const filteredTree = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return GODOT_NAV_TREE;
    return GODOT_NAV_TREE.map((group) => {
      const matchedItems = group.items.filter((item) => {
        const sec = sectionById.get(item.id);
        if (!sec) return false;
        return (
          item.shortTitle.toLowerCase().includes(q) ||
          sec.title.toLowerCase().includes(q) ||
          sec.summary.toLowerCase().includes(q) ||
          sec.content.toLowerCase().includes(q) ||
          sec.sourceFiles.some((f) => f.toLowerCase().includes(q))
        );
      });
      return { ...group, items: matchedItems };
    }).filter((g) => g.items.length > 0);
  }, [searchQuery, sectionById]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setAllGroups = (open: boolean) => {
    const next: Record<string, boolean> = {};
    for (const g of GODOT_NAV_TREE) {
      next[g.key] = open;
    }
    setExpandedGroups(next);
  };

  const selectChapter = (id: string) => {
    setActiveSectionId(id);
    setIsMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const scrollToAnchor = (slug: string) => {
    const el = document.getElementById(slug);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setIsMobileMenuOpen(false);
  };

  const formattedHtml = useMemo(() => {
    return activeSection.content
      .replace(
        /```cpp\n([\s\S]*?)```/g,
        (_m, code) =>
          `<pre class="p-4 my-4 rounded-xl bg-dark-900 border border-dark-750 overflow-x-auto text-xs font-mono text-slate-200 leading-relaxed">${code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`,
      )
      .replace(
        /```c\n([\s\S]*?)```/g,
        (_m, code) =>
          `<pre class="p-4 my-4 rounded-xl bg-dark-900 border border-dark-750 overflow-x-auto text-xs font-mono text-slate-200 leading-relaxed">${code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`,
      )
      .replace(/\n---\n/g, '<hr class="border-dark-800 my-6" />')
      .replace(
        /##### (.*?)\n/g,
        (_m, h) =>
          `<h5 id="${slugify(h)}" class="scroll-mt-20 text-sm font-bold text-emerald-400 mt-4 mb-1.5 font-mono">${h}</h5>`,
      )
      .replace(
        /### (.*?)\n/g,
        (_m, h) =>
          `<h3 id="${slugify(h)}" class="scroll-mt-20 text-xl font-bold text-slate-100 mt-7 mb-3 font-display border-b border-dark-800/80 pb-1.5">${h}</h3>`,
      )
      .replace(
        /#### (.*?)\n/g,
        (_m, h) =>
          `<h4 id="${slugify(h)}" class="scroll-mt-20 text-base font-bold text-gold-400 mt-5 mb-2">${h}</h4>`,
      )
      .replace(
        /\*\*(.*?)\*\*/g,
        '<strong class="text-slate-100 font-semibold">$1</strong>',
      )
      .replace(/\*(.*?)\*/g, '<em class="text-slate-300 italic">$1</em>')
      .replace(
        /`([^`\n]+)`/g,
        '<code class="px-1.5 py-0.5 rounded bg-dark-900 text-gold-300 border border-dark-750 text-xs font-mono">$1</code>',
      )
      .replace(
        /\n\n/g,
        '<p class="text-slate-300 text-sm leading-relaxed my-3"></p>',
      );
  }, [activeSection.content]);

  return (
    <div className="min-h-screen bg-dark-950 text-slate-200 flex flex-col selection:bg-gold-500/30 selection:text-gold-200">
      <header className="sticky top-0 z-40 h-[61px] bg-dark-950/95 backdrop-blur-md border-b border-dark-800 px-4 lg:px-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg bg-dark-900 border border-dark-750 text-slate-300"
          >
            {isMobileMenuOpen ? (
              <X className="w-4 h-4" />
            ) : (
              <Menu className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => selectChapter("overview")}
            className="flex items-center gap-2.5 text-left group"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-400 to-amber-600 flex items-center justify-center shadow-lg shadow-gold-500/20 font-display font-black text-dark-950 text-lg group-hover:scale-105 transition-transform">
              M
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-sm sm:text-base tracking-wider text-slate-100">
                  MELLANGAN DOCS
                </span>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-gold-500/15 text-gold-300 border border-gold-500/30 font-semibold">
                  v0.5.12
                </span>
              </div>
              <p className="text-[10px] font-mono text-slate-400 hidden sm:block">
                Engine Manual, Tutorials &amp; Interactive Architecture Reference
              </p>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => selectChapter("contribute-basics")}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold-500/15 hover:bg-gold-500/25 border border-gold-500/40 text-xs font-mono text-gold-300 font-semibold transition-colors"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Contribute Guide</span>
          </button>

          <button
            onClick={() => selectChapter("renderer-in-context")}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/40 text-xs font-mono text-teal-300 font-semibold transition-colors"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Renderer</span>
          </button>

          <button
            onClick={() => selectChapter("terrain-construction")}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-xs font-mono text-sky-300 font-semibold transition-colors"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Terrain</span>
          </button>

          <a
            href="https://github.com/soulwax/Mellangan"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-850 hover:bg-dark-800 border border-dark-700 text-xs font-mono text-slate-200 transition-colors"
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
      </header>

      <div className="flex-1 flex max-w-[1800px] w-full mx-auto">
        <aside
          className={`fixed lg:sticky top-[61px] z-30 w-80 shrink-0 h-[calc(100vh-61px)] bg-dark-950/98 lg:bg-dark-950/60 border-r border-dark-800/90 flex flex-col transition-transform duration-200 ${
            isMobileMenuOpen
              ? "translate-x-0"
              : "-translate-x-full lg:translate-x-0"
          }`}
        >
          <div className="p-3.5 border-b border-dark-800/80 bg-dark-950/90 space-y-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter docs, files, symbols..."
                className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-dark-900 border border-dark-750 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-gold-500/60 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 px-0.5">
              <span className="uppercase tracking-wider font-semibold flex items-center gap-1.5">
                <ListTree className="w-3 h-3 text-gold-400" />
                Documentation Tree
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAllGroups(true)}
                  className="hover:text-gold-300 flex items-center gap-0.5 transition-colors"
                  title="Expand all sections"
                >
                  <ChevronsUpDown className="w-3 h-3" />
                  <span>Expand</span>
                </button>
                <span className="text-dark-700">|</span>
                <button
                  onClick={() => setAllGroups(false)}
                  className="hover:text-gold-300 flex items-center gap-0.5 transition-colors"
                  title="Collapse all sections"
                >
                  <ChevronsDownUp className="w-3 h-3" />
                  <span>Collapse</span>
                </button>
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto p-3 space-y-2">
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
                  className="rounded-xl border border-dark-800/70 bg-dark-900/30 overflow-hidden"
                >
                  <button
                    onClick={() => toggleGroup(group.key)}
                    className={`w-full px-3 py-2 flex items-center justify-between gap-2 text-left transition-colors ${
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
                    <div className="px-2 pb-2 pt-1 space-y-0.5 border-t border-dark-850">
                      {group.items.map((item) => {
                        const sec = sectionById.get(item.id);
                        if (!sec) return null;
                        const isActive = sec.id === activeSection.id;

                        return (
                          <div key={item.id}>
                            <button
                              onClick={() => selectChapter(item.id)}
                              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all flex items-center justify-between gap-2 ${
                                isActive
                                  ? "bg-gold-500/15 text-gold-300 font-semibold border border-gold-500/40 shadow-sm"
                                  : "text-slate-400 hover:text-slate-100 hover:bg-dark-850/60 border border-transparent"
                              }`}
                            >
                              <span className="truncate">{item.shortTitle}</span>
                              {sec.interactiveComponent && (
                                <span
                                  className="text-[9px] font-mono uppercase px-1 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0"
                                  title="Includes Interactive Simulator"
                                >
                                  Lab
                                </span>
                              )}
                            </button>

                            {isActive && activeHeadings.length > 0 && (
                              <div className="ml-3.5 mt-1 mb-1.5 pl-2.5 border-l border-gold-500/30 space-y-0.5">
                                {sec.interactiveComponent && (
                                  <button
                                    onClick={() =>
                                      scrollToAnchor("interactive-lab-anchor")
                                    }
                                    className="w-full text-left py-1 px-1.5 rounded text-[11px] font-mono text-emerald-300 hover:bg-dark-850 flex items-center gap-1.5 truncate"
                                  >
                                    <Sparkles className="w-3 h-3 shrink-0" />
                                    <span className="truncate">
                                      Interactive Simulator
                                    </span>
                                  </button>
                                )}
                                {activeHeadings.map((h) => (
                                  <button
                                    key={h.slug}
                                    onClick={() => scrollToAnchor(h.slug)}
                                    className={`w-full text-left py-1 px-1.5 rounded text-[11px] hover:text-gold-300 hover:bg-dark-850 transition-colors block truncate ${
                                      h.level === 4
                                        ? "pl-3 text-slate-400 font-mono text-[10px]"
                                        : "text-slate-300 font-medium"
                                    }`}
                                    title={h.text}
                                  >
                                    {h.text}
                                  </button>
                                ))}
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

          <div className="p-3 border-t border-dark-800/80 bg-dark-950/90 text-[11px] font-mono text-slate-400">
            <div className="flex items-center justify-between text-gold-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5" />
                <span>Engine Quick-Facts</span>
              </span>
              <span className="text-[10px] text-slate-500">60 Hz DT</span>
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
              <div>
                Pool: <span className="text-slate-200">32 Slabs (16B)</span>
              </div>
              <div>
                Grid: <span className="text-emerald-400">CSR Prefix</span>
              </div>
              <div>
                Sort: <span className="text-sky-400">12b Radix×3</span>
              </div>
              <div>
                Audio: <span className="text-amber-300">32-Voice LRU</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 p-4 lg:p-8 max-w-4xl mx-auto overflow-hidden">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-3">
            <span>Docs</span>
            <ChevronRight className="w-3 h-3 text-slate-600" />
            <span className={`uppercase font-semibold ${activeGroup.color}`}>
              {activeGroup.label}
            </span>
            <ChevronRight className="w-3 h-3 text-slate-600" />
            <span className="text-slate-200 truncate">
              {activeSection.title}
            </span>
          </div>

          <div className="border-b border-dark-800 pb-5 mb-6">
            <h1 className="text-2xl sm:text-3xl font-display font-black text-slate-100 tracking-wide mb-2">
              {activeSection.title}
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed max-w-3xl mb-4">
              {activeSection.summary}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <FileCode2 className="w-3.5 h-3.5 text-gold-400" />
                Source Units:
              </span>
              {activeSection.sourceFiles.map((file) => (
                <a
                  key={file}
                  href={`https://github.com/soulwax/Mellangan/blob/main/${file}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2 py-0.5 rounded bg-dark-900 hover:bg-dark-800 border border-dark-750 hover:border-gold-500/40 text-[11px] font-mono text-gold-300 transition-colors"
                >
                  {file}
                </a>
              ))}
            </div>
          </div>

          <div id="interactive-lab-anchor" className="scroll-mt-20">
            {activeSection.interactiveComponent === "gameloop" && (
              <InteractiveGameLoop />
            )}
            {activeSection.interactiveComponent === "radix" && (
              <RadixDepthSorter />
            )}
            {activeSection.interactiveComponent === "slab" && (
              <SlabMemoryVisualizer />
            )}
            {activeSection.interactiveComponent === "spatial" && (
              <SpatialGridVisualizer />
            )}
            {activeSection.interactiveComponent === "ouroboros" && (
              <OuroborosBitLab />
            )}
            {activeSection.interactiveComponent === "noise" && (
              <BiomeNoiseMap />
            )}
            {activeSection.interactiveComponent === "arsenal" && (
              <RecipeArsenalExplorer />
            )}
            {activeSection.interactiveComponent === "contribute" && (
              <ContributorTutorialWizard />
            )}
            {activeSection.interactiveComponent === "pixelshader" && (
              <PixelShaderStudio />
            )}
            {activeSection.interactiveComponent === "terrain" && (
              <TerrainConstructionLab />
            )}
            {activeSection.interactiveComponent === "renderer" && (
              <RendererPipelineInspector />
            )}
          </div>

          <div id="architecture-diagrams-anchor" className="scroll-mt-20">
            {diagrams.map((d, idx) => (
              <MermaidChart
                key={`${activeSection.id}-chart-${idx}`}
                id={`${activeSection.id}-${idx}`}
                title={d.title}
                chart={d.chart}
              />
            ))}
          </div>

          <article className="prose prose-invert prose-sm sm:prose-base max-w-none prose-headings:font-display prose-headings:text-slate-100 prose-headings:font-bold prose-p:text-slate-300 prose-p:leading-relaxed prose-code:text-gold-300 prose-code:bg-dark-900 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:border prose-code:border-dark-750 prose-pre:bg-dark-900 prose-pre:border prose-pre:border-dark-750 prose-a:text-gold-400 hover:prose-a:underline">
            <div
              className="space-y-4"
              dangerouslySetInnerHTML={{ __html: formattedHtml }}
            />
          </article>

          <div className="mt-12 pt-6 border-t border-dark-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {prevSection ? (
              <button
                onClick={() => selectChapter(prevSection.id)}
                className="p-4 rounded-xl border border-dark-800 hover:border-dark-700 bg-dark-900/60 hover:bg-dark-900 text-left transition-all group"
              >
                <div className="text-[10px] uppercase font-mono text-slate-400 mb-1 flex items-center gap-1">
                  ← Previous Page
                </div>
                <div className="text-sm font-semibold text-slate-200 group-hover:text-gold-300 transition-colors">
                  {prevSection.title}
                </div>
              </button>
            ) : (
              <div />
            )}

            {nextSection && (
              <button
                onClick={() => selectChapter(nextSection.id)}
                className="p-4 rounded-xl border border-dark-800 hover:border-dark-700 bg-dark-900/60 hover:bg-dark-900 text-right transition-all group sm:col-start-2"
              >
                <div className="text-[10px] uppercase font-mono text-slate-400 mb-1 flex items-center justify-end gap-1">
                  Next Page →
                </div>
                <div className="text-sm font-semibold text-slate-200 group-hover:text-gold-300 transition-colors">
                  {nextSection.title}
                </div>
              </button>
            )}
          </div>
        </main>

        <aside className="hidden xl:block sticky top-[61px] w-64 shrink-0 h-[calc(100vh-61px)] border-l border-dark-800/70 p-4 overflow-y-auto">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold mb-3 flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5 text-gold-400" />
            <span>On This Page</span>
          </div>

          <div className="space-y-1 border-l border-dark-800 pl-2.5">
            {activeSection.interactiveComponent && (
              <button
                onClick={() => scrollToAnchor("interactive-lab-anchor")}
                className="w-full text-left py-1 text-xs font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5"
              >
                <Sparkles className="w-3 h-3 shrink-0" />
                <span>Interactive Simulator</span>
              </button>
            )}
            {diagrams.length > 0 && (
              <button
                onClick={() => scrollToAnchor("architecture-diagrams-anchor")}
                className="w-full text-left py-1 text-xs font-mono text-sky-400 hover:text-sky-300 block truncate"
              >
                Architecture Graphs ({diagrams.length})
              </button>
            )}
            {activeHeadings.map((h) => (
              <button
                key={h.slug}
                onClick={() => scrollToAnchor(h.slug)}
                className={`w-full text-left py-1 transition-colors block truncate ${
                  h.level === 4
                    ? "pl-3 text-[11px] font-mono text-slate-500 hover:text-slate-200"
                    : "text-xs text-slate-300 hover:text-gold-300 font-medium"
                }`}
                title={h.text}
              >
                {h.text}
              </button>
            ))}
          </div>
        </aside>
      </div>

      <footer className="border-t border-dark-800 py-6 px-4 text-center text-xs text-slate-500 font-mono">
        <p>
          Mellangan Systems Architecture Wiki • C++20 / C11 • Vulkan2D • EnTT •
          SDL3
        </p>
        <p className="mt-1 text-[11px] text-slate-600">
          Submodule <code className="text-slate-400">./extern/wiki</code> • 20
          Chapters • 40 Architecture Diagrams • 11 Interactive Simulators
        </p>
      </footer>
    </div>
  );
};
