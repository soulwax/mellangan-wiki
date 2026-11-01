import React, { useState, useMemo } from "react";
import { WIKI_SECTIONS } from "./data/wikiContent";
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
import {
  Cpu,
  Layers,
  Compass,
  Swords,
  Search,
  Menu,
  X,
  ChevronRight,
  Activity,
  Terminal,
  FileCode2,
  Wrench,
} from "lucide-react";

const CATEGORY_MAP: Record<
  string,
  { label: string; icon: React.ElementType; color: string }
> = {
  core: { label: "Core & Telemetry", icon: Cpu, color: "text-amber-400" },
  graphics: {
    label: "Graphics & Radix",
    icon: Layers,
    color: "text-emerald-400",
  },
  simulation: {
    label: "Memory, CSR & AI",
    icon: Activity,
    color: "text-purple-400",
  },
  world: { label: "World & Atmosphere", icon: Compass, color: "text-sky-400" },
  gameplay: { label: "Arsenal & Combat", icon: Swords, color: "text-rose-400" },
  contribute: {
    label: "Contribute & Tutorials",
    icon: Wrench,
    color: "text-gold-400",
  },
};

export const App: React.FC = () => {
  const [activeSectionId, setActiveSectionId] = useState<string>(
    WIKI_SECTIONS[0].id,
  );
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const filteredSections = useMemo(() => {
    return WIKI_SECTIONS.filter((sec) => {
      const matchesCategory =
        selectedCategory === "all" || sec.category === selectedCategory;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        sec.title.toLowerCase().includes(q) ||
        sec.summary.toLowerCase().includes(q) ||
        sec.content.toLowerCase().includes(q) ||
        sec.sourceFiles.some((f) => f.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  const activeSection = useMemo(() => {
    return (
      WIKI_SECTIONS.find((s) => s.id === activeSectionId) || WIKI_SECTIONS[0]
    );
  }, [activeSectionId]);

  const currentIndex = WIKI_SECTIONS.findIndex(
    (s) => s.id === activeSection.id,
  );
  const prevSection = currentIndex > 0 ? WIKI_SECTIONS[currentIndex - 1] : null;
  const nextSection =
    currentIndex < WIKI_SECTIONS.length - 1
      ? WIKI_SECTIONS[currentIndex + 1]
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

  return (
    <div className="min-h-screen bg-dark-950 text-slate-200 flex flex-col selection:bg-gold-500/30 selection:text-gold-200">
      <header className="sticky top-0 z-40 h-[61px] bg-dark-950/90 backdrop-blur-md border-b border-dark-800 px-4 lg:px-8 flex items-center justify-between gap-4">
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
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-400 to-amber-600 flex items-center justify-center shadow-lg shadow-gold-500/20 font-display font-black text-dark-950 text-lg">
              M
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-sm sm:text-base tracking-wider text-slate-100">
                  MELLANGAN
                </span>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-gold-500/15 text-gold-300 border border-gold-500/30 font-semibold">
                  v0.5.12 Internals
                </span>
              </div>
              <p className="text-[10px] font-mono text-slate-400 hidden sm:block">
                Systems Architecture, Bit-Level Algorithms &amp; Interactive
                Labs
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-1 max-w-lg justify-end">
          <button
            onClick={() => {
              setSelectedCategory("contribute");
              setActiveSectionId("contribute-basics");
            }}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold-500/15 hover:bg-gold-500/25 border border-gold-500/40 text-xs font-mono text-gold-300 font-semibold transition-colors shrink-0"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>How to Contribute</span>
          </button>

          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search algorithms, files, structs..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-dark-900 border border-dark-750 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-gold-500/50 transition-colors"
            />
          </div>

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
            <span className="hidden sm:inline">Repo</span>
          </a>
        </div>
      </header>

      <div className="flex-1 flex max-w-[1720px] w-full mx-auto">
        <aside
          className={`fixed lg:sticky top-[61px] z-30 w-80 h-[calc(100vh-61px)] bg-dark-950/95 lg:bg-transparent border-r border-dark-800/80 p-4 overflow-y-auto transition-transform duration-200 ${
            isMobileMenuOpen
              ? "translate-x-0"
              : "-translate-x-full lg:translate-x-0"
          }`}
        >
          <div className="mb-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2 font-semibold">
              Subsystem Domain
            </div>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setSelectedCategory("all")}
                className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                  selectedCategory === "all"
                    ? "bg-gold-500/20 text-gold-300 border border-gold-500/50"
                    : "bg-dark-900 hover:bg-dark-850 text-slate-400 border border-transparent"
                }`}
              >
                All ({WIKI_SECTIONS.length})
              </button>
              {Object.entries(CATEGORY_MAP).map(([key, item]) => (
                <button
                  key={key}
                  onClick={() => setSelectedCategory(key)}
                  className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                    selectedCategory === key
                      ? "bg-dark-800 text-slate-200 border border-dark-600"
                      : "bg-dark-900/60 hover:bg-dark-850 text-slate-400 border border-transparent"
                  }`}
                >
                  {item.label.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2 font-semibold">
              Architecture Chapters
            </div>
            {filteredSections.map((section) => {
              const isActive = section.id === activeSection.id;
              const catInfo =
                CATEGORY_MAP[section.category] || CATEGORY_MAP.core;
              const Icon = catInfo.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => {
                    setActiveSectionId(section.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all duration-150 flex items-start gap-2.5 ${
                    isActive
                      ? "bg-dark-850 border-gold-500/60 text-slate-100 shadow-md shadow-gold-500/5"
                      : "bg-dark-900/30 hover:bg-dark-900 border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? catInfo.color : "text-slate-500"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium truncate">
                      {section.title}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate mt-0.5 font-mono">
                      {section.summary}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-6 p-3 rounded-lg border border-dark-750 bg-dark-900/70 text-xs">
            <div className="flex items-center gap-1.5 text-gold-400 font-mono font-semibold mb-1.5">
              <Terminal className="w-3.5 h-3.5" />
              <span>Engine Telemetry Matrix</span>
            </div>
            <div className="text-[11px] text-slate-400 space-y-1 font-mono">
              <div>
                Allocator:{" "}
                <span className="text-slate-200">Pool.c (32 Classes, 16B)</span>
              </div>
              <div>
                Spatial:{" "}
                <span className="text-emerald-400">CSR Prefix-Sum Grid</span>
              </div>
              <div>
                Depth Sort:{" "}
                <span className="text-sky-400">3-Pass 12b Radix O(3N)</span>
              </div>
              <div>
                AI Pool:{" "}
                <span className="text-purple-400">4-Barrier Atomic Stride</span>
              </div>
              <div>
                Audio:{" "}
                <span className="text-amber-300">SDL3 32-Voice LRU Stream</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 p-4 lg:p-8 max-w-5xl mx-auto overflow-hidden">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-3">
            <span>Wiki</span>
            <ChevronRight className="w-3 h-3 text-slate-600" />
            <span className="uppercase text-gold-400 font-semibold">
              {CATEGORY_MAP[activeSection.category]?.label}
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
          {activeSection.interactiveComponent === "noise" && <BiomeNoiseMap />}
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

          {diagrams.map((d, idx) => (
            <MermaidChart
              key={`${activeSection.id}-chart-${idx}`}
              id={`${activeSection.id}-${idx}`}
              title={d.title}
              chart={d.chart}
            />
          ))}

          <article className="prose prose-invert prose-sm sm:prose-base max-w-none prose-headings:font-display prose-headings:text-slate-100 prose-headings:font-bold prose-p:text-slate-300 prose-p:leading-relaxed prose-code:text-gold-300 prose-code:bg-dark-900 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:border prose-code:border-dark-750 prose-pre:bg-dark-900 prose-pre:border prose-pre:border-dark-750 prose-a:text-gold-400 hover:prose-a:underline">
            <div
              className="space-y-4"
              dangerouslySetInnerHTML={{
                __html: activeSection.content
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
                    '<h5 class="text-sm font-bold text-emerald-400 mt-4 mb-1.5 font-mono">$1</h5>',
                  )
                  .replace(
                    /### (.*?)\n/g,
                    '<h3 class="text-xl font-bold text-slate-100 mt-6 mb-3 font-display">$1</h3>',
                  )
                  .replace(
                    /#### (.*?)\n/g,
                    '<h4 class="text-base font-bold text-gold-400 mt-4 mb-2">$1</h4>',
                  )
                  .replace(
                    /\*\*(.*?)\*\*/g,
                    '<strong class="text-slate-100 font-semibold">$1</strong>',
                  )
                  .replace(
                    /\*(.*?)\*/g,
                    '<em class="text-slate-300 italic">$1</em>',
                  )
                  .replace(
                    /`([^`\n]+)`/g,
                    '<code class="px-1.5 py-0.5 rounded bg-dark-900 text-gold-300 border border-dark-750 text-xs font-mono">$1</code>',
                  )
                  .replace(
                    /\n\n/g,
                    '<p class="text-slate-300 text-sm leading-relaxed my-3"></p>',
                  ),
              }}
            />
          </article>

          <div className="mt-12 pt-6 border-t border-dark-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {prevSection ? (
              <button
                onClick={() => setActiveSectionId(prevSection.id)}
                className="p-4 rounded-xl border border-dark-800 hover:border-dark-700 bg-dark-900/60 hover:bg-dark-900 text-left transition-all group"
              >
                <div className="text-[10px] uppercase font-mono text-slate-400 mb-1 flex items-center gap-1">
                  ← Previous Chapter
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
                onClick={() => setActiveSectionId(nextSection.id)}
                className="p-4 rounded-xl border border-dark-800 hover:border-dark-700 bg-dark-900/60 hover:bg-dark-900 text-right transition-all group sm:col-start-2"
              >
                <div className="text-[10px] uppercase font-mono text-slate-400 mb-1 flex items-center justify-end gap-1">
                  Next Chapter →
                </div>
                <div className="text-sm font-semibold text-slate-200 group-hover:text-gold-300 transition-colors">
                  {nextSection.title}
                </div>
              </button>
            )}
          </div>
        </main>
      </div>

      <footer className="border-t border-dark-800 py-6 px-4 text-center text-xs text-slate-500 font-mono">
        <p>
          Mellangan Systems Architecture Wiki • C++20 / C11 • Vulkan2D • EnTT •
          SDL3
        </p>
        <p className="mt-1 text-[11px] text-slate-600">
          Submodule <code className="text-slate-400">./extern/wiki</code> • 19
          Chapters • 38 Architecture Diagrams • 10 Interactive Simulators
        </p>
      </footer>
    </div>
  );
};
