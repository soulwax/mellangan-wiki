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
import { CombatDirectorSimulator } from "./components/CombatDirectorSimulator";
import { GoalAiConcurrencyLab } from "./components/GoalAiConcurrencyLab";
import { LootAffixSimulator } from "./components/LootAffixSimulator";
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
  GitBranch,
  Workflow,
  Link2,
  Check,
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
    key: "ai-concurrency",
    label: "AI, Goals & Concurrency",
    icon: Workflow,
    color: "text-purple-400",
    badgeColor: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    items: [
      {
        id: "workers-concurrency",
        shortTitle: "Atomic Worker Pool & 4-Barrier AI",
      },
      {
        id: "goal-ai",
        shortTitle: "GoalQueue Ringbuffer, Sense & Ouroboros",
      },
      {
        id: "goal-steering-catalog",
        shortTitle: "16 AI Goals, Gaits & Plans[] Catalog",
      },
      {
        id: "spatial-grid",
        shortTitle: "CSR Prefix-Sum Spatial Grid",
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
    label: "Core Engine, Memory & Saves",
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
        id: "persistence-codex-balance",
        shortTitle: "Saves LRU, Codex Unlocks & Balance INI",
      },
      {
        id: "audio-qa",
        shortTitle: "32-Voice LRU Audio Mixer & QA Views",
      },
    ],
  },
  {
    key: "gameplay-ai",
    label: "Combat, Loot, Spawning & Classes",
    icon: Swords,
    color: "text-rose-400",
    badgeColor: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    items: [
      {
        id: "diablo-loot-runrules",
        shortTitle: "Diablo Loot, 30 Affixes & RunRules",
      },
      {
        id: "night-spawner-director",
        shortTitle: "Night Clock, Shrines & Wave Director",
      },
      {
        id: "combat-status-draft",
        shortTitle: "7 Statuses, 0.5s DoT & Bleed Draft",
      },
      {
        id: "weapon-synthesis",
        shortTitle: "15 FormBehaviors, 16 Payloads & Evos",
      },
      {
        id: "classes-encounters",
        shortTitle: "12 Hero Kits, 39 Foes & 20 Traits",
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

function formatInlineMarkdown(text: string): string {
  return text
    .replace(
      /\*\*(.*?)\*\*/g,
      '<strong class="text-slate-100 font-semibold">$1</strong>',
    )
    .replace(/\*(.*?)\*/g, '<em class="text-slate-200 italic">$1</em>')
    .replace(
      /`([^`\n]+)`/g,
      '<code class="px-1.5 py-0.5 rounded-md bg-dark-900/95 text-gold-300 border border-dark-750 text-[12.5px] font-mono">$1</code>',
    );
}

function renderMarkdownToHtml(markdown: string): string {
  const codeBlocks: string[] = [];
  const withPlaceholders = markdown.replace(
    /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g,
    (_m, lang, code) => {
      const escaped = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .trimEnd();
      const label =
        lang === "cpp"
          ? "C++20"
          : lang === "c"
            ? "C11"
            : lang
              ? lang.toUpperCase()
              : "CODE";
      const html = `<div class="my-5 rounded-xl overflow-hidden border border-dark-750 bg-dark-900/95 shadow-md"><div class="px-3.5 py-1.5 bg-dark-950/80 border-b border-dark-800 flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase tracking-wider"><span>${label}</span><span class="text-slate-600">Mellangan Source</span></div><pre class="p-4 overflow-x-auto text-[12.5px] font-mono text-slate-200 leading-[1.65]">${escaped}</pre></div>`;
      const idx = codeBlocks.length;
      codeBlocks.push(html);
      return `\n@@CODE_BLOCK_${idx}@@\n`;
    },
  );

  const lines = withPlaceholders.split("\n");
  const out: string[] = [];
  let inUl = false;
  let inOl = false;
  let paragraphBuf: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuf.length > 0) {
      const joined = formatInlineMarkdown(paragraphBuf.join(" "));
      out.push(`<p>${joined}</p>`);
      paragraphBuf = [];
    }
  };

  const closeLists = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      out.push("</ol>");
      inOl = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      closeLists();
      continue;
    }

    const codeMatch = line.match(/^@@CODE_BLOCK_(\d+)@@$/);
    if (codeMatch) {
      flushParagraph();
      closeLists();
      out.push(codeBlocks[Number(codeMatch[1])]);
      continue;
    }

    if (line === "---") {
      flushParagraph();
      closeLists();
      out.push('<hr class="border-dark-800/90 my-7" />');
      continue;
    }

    if (line.startsWith("##### ")) {
      flushParagraph();
      closeLists();
      const h = line.slice(6).trim();
      out.push(
        `<h5 id="${slugify(h)}" class="scroll-mt-20 text-sm font-bold text-emerald-400 mt-6 mb-2 font-mono">${formatInlineMarkdown(h)}</h5>`,
      );
      continue;
    }

    if (line.startsWith("#### ")) {
      flushParagraph();
      closeLists();
      const h = line.slice(5).trim();
      const slug = slugify(h);
      out.push(
        `<h4 id="${slug}" class="group scroll-mt-20 text-[17px] font-bold text-gold-400 mt-7 mb-2.5 leading-snug flex items-center gap-2"><a href="#${slug}" class="hover:underline">${formatInlineMarkdown(h)}</a><a href="#${slug}" class="opacity-0 group-hover:opacity-100 text-xs font-mono text-slate-500 hover:text-gold-300 transition-opacity" title="Permalink to section">#</a></h4>`,
      );
      continue;
    }

    if (line.startsWith("### ")) {
      flushParagraph();
      closeLists();
      const h = line.slice(4).trim();
      const slug = slugify(h);
      out.push(
        `<h3 id="${slug}" class="group scroll-mt-20 text-xl sm:text-[22px] font-bold text-slate-100 mt-9 mb-3.5 font-display border-b border-dark-800 pb-2 leading-snug flex items-center justify-between gap-2"><a href="#${slug}" class="hover:text-gold-300 transition-colors">${formatInlineMarkdown(h)}</a><a href="#${slug}" class="opacity-0 group-hover:opacity-100 text-sm font-mono text-slate-500 hover:text-gold-300 transition-opacity shrink-0" title="Permalink to section">#</a></h3>`,
      );
      continue;
    }

    const ulMatch = rawLine.match(/^\s*-\s+(.*)$/);
    if (ulMatch) {
      flushParagraph();
      if (inOl) {
        out.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        out.push("<ul>");
        inUl = true;
      }
      out.push(`<li>${formatInlineMarkdown(ulMatch[1].trim())}</li>`);
      continue;
    }

    const olMatch = rawLine.match(/^\s*\d+\.\s+(.*)$/);
    if (olMatch) {
      flushParagraph();
      if (inUl) {
        out.push("</ul>");
        inUl = false;
      }
      if (!inOl) {
        out.push("<ol>");
        inOl = true;
      }
      out.push(`<li>${formatInlineMarkdown(olMatch[1].trim())}</li>`);
      continue;
    }

    // Continuation line inside an active list item
    if ((inUl || inOl) && rawLine.startsWith("   ") && out.length > 0) {
      const prev = out[out.length - 1];
      if (prev.endsWith("</li>")) {
        out[out.length - 1] =
          prev.slice(0, -5) + " " + formatInlineMarkdown(line) + "</li>";
        continue;
      }
    }

    closeLists();
    paragraphBuf.push(line);
  }

  flushParagraph();
  closeLists();
  return out.join("\n");
}

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
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [activeDiagramTab, setActiveDiagramTab] = useState<"all" | number>("all");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    "getting-started": true,
    tutorials: true,
    "ai-concurrency": true,
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

  const selectChapter = (
    id: string,
    e?: React.MouseEvent<HTMLElement>,
  ) => {
    if (
      e &&
      (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
    ) {
      return;
    }
    if (e) {
      e.preventDefault();
    }
    if (
      window.location.pathname !== `/${id}` ||
      window.location.hash !== ""
    ) {
      window.history.pushState({ sectionId: id }, "", `/${id}`);
    }
    setActiveSectionId(id);
    setActiveHash("");
    setActiveDiagramTab("all");
    setIsMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const scrollToAnchor = (
    slug: string,
    e?: React.MouseEvent<HTMLElement>,
  ) => {
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

  const formattedHtml = useMemo(() => {
    return renderMarkdownToHtml(activeSection.content);
  }, [activeSection.content]);

  return (
    <div className="min-h-screen bg-dark-950 text-slate-200 flex flex-col selection:bg-gold-500/30 selection:text-gold-200">
      <header className="sticky top-0 z-40 h-[58px] bg-dark-950/95 backdrop-blur-md border-b border-dark-800 px-4 lg:px-6 flex items-center justify-between gap-4">
        <div className="max-w-[1340px] w-full mx-auto flex items-center justify-between gap-4">
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
            <a
              href="/overview"
              onClick={(e) => selectChapter("overview", e)}
              className="flex items-center gap-2.5 text-left group"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-gold-400 to-amber-600 flex items-center justify-center shadow-lg shadow-gold-500/20 font-display font-black text-dark-950 text-base group-hover:scale-105 transition-transform">
                M
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-sm tracking-wider text-slate-100">
                    MELLANGAN DOCS
                  </span>
                  <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-gold-500/15 text-gold-300 border border-gold-500/30 font-semibold">
                    v0.5.14+
                  </span>
                </div>
              </div>
            </a>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/contribute-basics"
              onClick={(e) => selectChapter("contribute-basics", e)}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gold-500/15 hover:bg-gold-500/25 border border-gold-500/40 text-xs font-mono text-gold-300 font-semibold transition-colors"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Contribute</span>
            </a>

            <a
              href="/diablo-loot-runrules"
              onClick={(e) => selectChapter("diablo-loot-runrules", e)}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-xs font-mono text-amber-300 font-semibold transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>0.5.14+ Loot</span>
            </a>

            <a
              href="/goal-ai"
              onClick={(e) => selectChapter("goal-ai", e)}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/40 text-xs font-mono text-purple-300 font-semibold transition-colors"
            >
              <Workflow className="w-3.5 h-3.5" />
              <span>AI &amp; Goals</span>
            </a>

            <a
              href="/renderer-in-context"
              onClick={(e) => selectChapter("renderer-in-context", e)}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/40 text-xs font-mono text-teal-300 font-semibold transition-colors"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Renderer</span>
            </a>

            <a
              href="/terrain-construction"
              onClick={(e) => selectChapter("terrain-construction", e)}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-xs font-mono text-sky-300 font-semibold transition-colors"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Terrain</span>
            </a>

            <a
              href="/night-spawner-director"
              onClick={(e) => selectChapter("night-spawner-director", e)}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-xs font-mono text-rose-300 font-semibold transition-colors"
            >
              <Swords className="w-3.5 h-3.5" />
              <span>Director</span>
            </a>

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

      <div className="flex-1 flex max-w-[1340px] w-full mx-auto">
        <aside
          className={`fixed lg:sticky top-[58px] z-30 w-72 shrink-0 h-[calc(100vh-58px)] bg-dark-950/98 lg:bg-dark-950/60 border-r border-dark-800/90 flex flex-col transition-transform duration-200 ${
            isMobileMenuOpen
              ? "translate-x-0"
              : "-translate-x-full lg:translate-x-0"
          }`}
        >
          <div className="p-3 border-b border-dark-800/80 bg-dark-950/90 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter 25 chapters, files..."
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

          <nav className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
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
                              href={`/${item.id}`}
                              onClick={(e) => selectChapter(item.id, e)}
                              className={`w-full text-left px-2 py-1.5 rounded-lg text-xs transition-all flex items-center justify-between gap-1.5 ${
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
                            </a>

                            {isActive && activeHeadings.length > 0 && (
                              <div className="ml-3 mt-1 mb-1.5 pl-2 border-l border-gold-500/30 space-y-0.5">
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
                                      scrollToAnchor("interactive-lab-anchor", e)
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

          <div className="p-2.5 border-t border-dark-800/80 bg-dark-950/90 text-[10px] font-mono text-slate-400">
            <div className="flex items-center justify-between text-gold-400 font-semibold mb-1">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3 h-3" />
                <span>Engine Invariants</span>
              </span>
              <span className="text-slate-500">60 Hz DT</span>
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
              <div>
                Pool: <span className="text-slate-200">32 Slabs</span>
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

        <main className="flex-1 min-w-0 px-5 sm:px-8 lg:px-12 py-7">
          <div className="max-w-[680px] mx-auto">
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
                <span className={`uppercase font-semibold shrink-0 ${activeGroup.color}`}>
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

            <div className="border-b border-dark-800 pb-5 mb-6">
              <h1 className="text-2xl sm:text-[28px] leading-tight font-display font-black text-slate-100 tracking-wide mb-2.5">
                {activeSection.title}
              </h1>
              <p className="text-[15px] text-slate-300/90 leading-relaxed mb-4">
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

            <article
              className="wiki-prose"
              onClick={(e) => {
                const target = (e.target as HTMLElement).closest("a");
                if (!target) return;
                const href = target.getAttribute("href") || "";
                if (href.startsWith("#") && href.length > 1) {
                  scrollToAnchor(href.slice(1), e);
                }
              }}
              dangerouslySetInnerHTML={{ __html: formattedHtml }}
            />

            {activeSection.interactiveComponent && (
              <div
                id="interactive-lab-anchor"
                className="scroll-mt-20 mt-10 pt-6 border-t border-dark-800/80"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Interactive Systems Laboratory
                  </span>
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
                {activeSection.interactiveComponent === "director" && (
                  <CombatDirectorSimulator />
                )}
                {activeSection.interactiveComponent === "goalai" && (
                  <GoalAiConcurrencyLab />
                )}
                {activeSection.interactiveComponent === "loot" && (
                  <LootAffixSimulator />
                )}
              </div>
            )}

            {diagrams.length > 0 && (
              <div
                id="architecture-diagrams-anchor"
                className="scroll-mt-20 mt-10 pt-6 border-t border-dark-800/80"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="text-xs font-mono uppercase tracking-wider text-sky-400 font-semibold flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5" />
                    <span>Architecture &amp; Control-Flow Diagrams</span>
                  </div>

                  {diagrams.length > 1 && (
                    <div className="flex items-center gap-1 bg-dark-900 p-1 rounded-lg border border-dark-800 text-[11px] font-mono">
                      <button
                        onClick={() => setActiveDiagramTab("all")}
                        className={`px-2 py-0.5 rounded transition-colors ${
                          activeDiagramTab === "all"
                            ? "bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Stacked ({diagrams.length})
                      </button>
                      {diagrams.map((_d, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActiveDiagramTab(idx)}
                          className={`px-2 py-0.5 rounded transition-colors ${
                            activeDiagramTab === idx
                              ? "bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          Graph {idx + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {diagrams.map((d, idx) => {
                  if (activeDiagramTab !== "all" && activeDiagramTab !== idx) {
                    return null;
                  }
                  return (
                    <MermaidChart
                      key={`${activeSection.id}-chart-${idx}`}
                      id={`${activeSection.id}-${idx}`}
                      title={d.title}
                      chart={d.chart}
                      index={idx}
                      total={diagrams.length}
                    />
                  );
                })}
              </div>
            )}

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

        <aside className="hidden xl:block sticky top-[58px] w-56 shrink-0 h-[calc(100vh-58px)] border-l border-dark-800/70 p-4 overflow-y-auto">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold mb-3 flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5 text-gold-400" />
            <span>On This Page</span>
          </div>

          <div className="space-y-1 border-l border-dark-800 pl-2.5">
            {activeHeadings.map((h) => (
              <a
                key={h.slug}
                href={`/${activeSection.id}#${h.slug}`}
                onClick={(e) => scrollToAnchor(h.slug, e)}
                className={`w-full text-left py-1 transition-colors block truncate ${
                  activeHash === h.slug
                    ? "text-gold-300 font-semibold"
                    : h.level === 4
                      ? "pl-2.5 text-[11px] font-mono text-slate-400 hover:text-slate-200"
                      : "text-xs text-slate-200 hover:text-gold-300 font-medium"
                }`}
                title={h.text}
              >
                {h.text}
              </a>
            ))}
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

      <footer className="border-t border-dark-800 py-6 px-4 text-center text-xs text-slate-500 font-mono">
        <p>
          Mellangan Systems Architecture Wiki • C++20 / C11 • Vulkan2D • EnTT •
          SDL3
        </p>
        <p className="mt-1 text-[11px] text-slate-600">
          Submodule <code className="text-slate-400">./extern/wiki</code> • 25
          Chapters • 50 Architecture Diagrams • 14 Interactive Simulators
        </p>
      </footer>
    </div>
  );
};
