import React, { useState, useMemo } from 'react';
import { 
  WIKI_SECTIONS, 
  WikiSection 
} from './data/wikiContent';
import { MermaidChart } from './components/MermaidChart';
import { InteractiveGameLoop } from './components/InteractiveGameLoop';
import { SlabMemoryVisualizer } from './components/SlabMemoryVisualizer';
import { BiomeNoiseMap } from './components/BiomeNoiseMap';
import { 
  BookOpen, 
  Cpu, 
  Layers, 
  Compass, 
  Swords, 
  Search, 
  ExternalLink, 
  Menu, 
  X, 
  ChevronRight, 
  Sparkles, 
  Activity, 
  Terminal,
  Code2
} from 'lucide-react';

const CATEGORY_MAP: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  core: { label: 'Core Architecture', icon: Cpu, color: 'text-amber-400' },
  graphics: { label: 'Graphics & Shaders', icon: Layers, color: 'text-emerald-400' },
  simulation: { label: 'Simulation & Memory', icon: Activity, color: 'text-purple-400' },
  world: { label: 'World Generation', icon: Compass, color: 'text-sky-400' },
  gameplay: { label: 'Combat & Arsenal', icon: Swords, color: 'text-rose-400' },
};

export const App: React.FC = () => {
  const [activeSectionId, setActiveSectionId] = useState<string>('overview');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const filteredSections = useMemo(() => {
    return WIKI_SECTIONS.filter((section) => {
      const matchesCategory = selectedCategory === 'all' || section.category === selectedCategory;
      const matchesSearch = 
        section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        section.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        section.content.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  const activeSection = useMemo(() => {
    return WIKI_SECTIONS.find((s) => s.id === activeSectionId) || WIKI_SECTIONS[0];
  }, [activeSectionId]);

  const currentIndex = WIKI_SECTIONS.findIndex((s) => s.id === activeSection.id);
  const prevSection = currentIndex > 0 ? WIKI_SECTIONS[currentIndex - 1] : null;
  const nextSection = currentIndex < WIKI_SECTIONS.length - 1 ? WIKI_SECTIONS[currentIndex + 1] : null;

  return (
    <div className="min-h-screen flex flex-col bg-dark-950 text-slate-200">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-dark-800 bg-dark-950/80 backdrop-blur-md px-4 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
            className="lg:hidden p-2 rounded-lg bg-dark-850 hover:bg-dark-800 text-slate-300"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-3">
            <span className="text-2xl select-none">⚔️</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-black tracking-widest text-lg text-slate-100">MELLANGAN</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-gold-500/20 text-gold-400 border border-gold-500/40">
                  v0.5.12
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 hidden sm:inline-block">
                  WIKI
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">Modern C++20 / Vulkan2D Engine Architecture & Systems Guide</p>
            </div>
          </div>
        </div>

        {/* Global Search Bar */}
        <div className="flex items-center gap-3">
          <div className="relative w-48 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search architecture..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-dark-900 border border-dark-750 text-xs font-mono text-slate-200 focus:outline-none focus:border-gold-500/70 transition-colors"
            />
          </div>

          <a
            href="https://github.com/soulwax/Mellangan"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-850 hover:bg-dark-800 border border-dark-700 text-xs font-mono text-slate-200 transition-colors"
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            <span className="hidden sm:inline">Repo</span>
          </a>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex max-w-[1700px] w-full mx-auto">
        {/* Sidebar */}
        <aside
          className={`fixed lg:sticky top-[61px] z-30 w-72 h-[calc(100vh-61px)] bg-dark-950/95 lg:bg-transparent border-r border-dark-800/80 p-4 overflow-y-auto transition-transform duration-200 ${
            isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          {/* Category Tabs */}
          <div className="mb-4">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2 font-semibold">
              System Domain
            </div>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-gold-500/20 text-gold-300 border border-gold-500/50'
                    : 'bg-dark-900 hover:bg-dark-850 text-slate-400 border border-transparent'
                }`}
              >
                All (8)
              </button>
              {Object.entries(CATEGORY_MAP).map(([key, item]) => (
                <button
                  key={key}
                  onClick={() => setSelectedCategory(key)}
                  className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                    selectedCategory === key
                      ? 'bg-dark-800 text-slate-200 border border-dark-600'
                      : 'bg-dark-900/60 hover:bg-dark-850 text-slate-400 border border-transparent'
                  }`}
                >
                  {item.label.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Section Items */}
          <div className="space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2 font-semibold">
              Documentation Chapters
            </div>
            {filteredSections.map((section) => {
              const isActive = section.id === activeSection.id;
              const catInfo = CATEGORY_MAP[section.category] || CATEGORY_MAP.core;
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
                      ? 'bg-dark-850 border-gold-500/60 text-slate-100 shadow-md shadow-gold-500/5'
                      : 'bg-dark-900/30 hover:bg-dark-900 border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? catInfo.color : 'text-slate-500'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium truncate">{section.title}</div>
                    <div className="text-[10px] text-slate-500 truncate mt-0.5 font-mono">{section.summary}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Submodule Specs Box */}
          <div className="mt-8 p-3 rounded-lg border border-dark-750 bg-dark-900/70 text-xs">
            <div className="flex items-center gap-1.5 text-gold-400 font-mono font-semibold mb-1">
              <Terminal className="w-3.5 h-3.5" />
              <span>Submodule Status</span>
            </div>
            <div className="text-[11px] text-slate-400 space-y-1 font-mono">
              <div>Path: <span className="text-slate-200">extern/wiki</span></div>
              <div>Deploy: <span className="text-emerald-400">Vercel Production</span></div>
              <div>Renderer: <span className="text-slate-200">Vulkan2D 0.8.0</span></div>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 p-4 lg:p-8 max-w-5xl mx-auto overflow-hidden">
          {/* Breadcrumb Header */}
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-4">
            <span>Wiki</span>
            <ChevronRight className="w-3 h-3 text-slate-600" />
            <span className="uppercase text-gold-400 font-semibold">{CATEGORY_MAP[activeSection.category]?.label}</span>
            <ChevronRight className="w-3 h-3 text-slate-600" />
            <span className="text-slate-200 truncate">{activeSection.title}</span>
          </div>

          {/* Chapter Title */}
          <div className="border-b border-dark-800 pb-5 mb-6">
            <h1 className="text-2xl sm:text-3xl font-display font-black text-slate-100 tracking-wide mb-2">
              {activeSection.title}
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed max-w-3xl">
              {activeSection.summary}
            </p>
          </div>

          {/* Interactive Component Injection */}
          {activeSection.interactiveComponent === 'gameloop' && <InteractiveGameLoop />}
          {activeSection.interactiveComponent === 'slab' && <SlabMemoryVisualizer />}
          {activeSection.interactiveComponent === 'noise' && <BiomeNoiseMap />}

          {/* Mermaid Architecture Graph */}
          {activeSection.mermaidChart && (
            <MermaidChart
              id={activeSection.id}
              title={activeSection.mermaidChart.title}
              chart={activeSection.mermaidChart.chart}
            />
          )}

          {/* Main Article Prose */}
          <article className="prose prose-invert prose-sm sm:prose-base max-w-none prose-headings:font-display prose-headings:text-slate-100 prose-headings:font-bold prose-p:text-slate-300 prose-p:leading-relaxed prose-code:text-gold-300 prose-code:bg-dark-900 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:border prose-code:border-dark-750 prose-pre:bg-dark-900 prose-pre:border prose-pre:border-dark-750 prose-a:text-gold-400 hover:prose-a:underline">
            <div 
              className="space-y-4"
              dangerouslySetInnerHTML={{
                __html: activeSection.content
                  .replace(/### (.*?)\n/g, '<h3 class="text-xl font-bold text-slate-100 mt-6 mb-3 font-display">$1</h3>')
                  .replace(/#### (.*?)\n/g, '<h4 class="text-base font-bold text-gold-400 mt-4 mb-2">$1</h4>')
                  .replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-100 font-semibold">$1</strong>')
                  .replace(/\*(.*?)\*/g, '<em class="text-slate-300 italic">$1</em>')
                  .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-dark-900 text-gold-300 border border-dark-750 text-xs font-mono">$1</code>')
                  .replace(/```cpp\n([\s\S]*?)```/g, '<pre class="p-4 my-4 rounded-xl bg-dark-900 border border-dark-750 overflow-x-auto text-xs font-mono text-slate-300 leading-relaxed">$1</pre>')
                  .replace(/```c\n([\s\S]*?)```/g, '<pre class="p-4 my-4 rounded-xl bg-dark-900 border border-dark-750 overflow-x-auto text-xs font-mono text-slate-300 leading-relaxed">$1</pre>')
                  .replace(/\n\n/g, '<p class="text-slate-300 text-sm leading-relaxed my-3"></p>')
              }}
            />
          </article>

          {/* Previous / Next Navigation */}
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
            ) : <div />}

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

      {/* Footer */}
      <footer className="border-t border-dark-800 py-6 px-4 text-center text-xs text-slate-500 font-mono">
        <p>Mellangan Architecture Wiki • Engineered in C++20 with Vulkan2D, EnTT & SDL3</p>
        <p className="mt-1 text-[11px] text-slate-600">Submodule hosted under <code className="text-slate-400">./extern/wiki</code></p>
      </footer>
    </div>
  );
};
