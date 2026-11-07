import type { ElementType } from "react";
import { Cpu, Layers, Compass, Swords, Terminal, Wrench, BookOpen, Sparkles, Calculator, FileCode2, Workflow } from "lucide-react";

interface NavTreeItem {
  id: string;
  shortTitle: string;
}

interface NavTreeGroup {
  key: string;
  label: string;
  icon: ElementType;
  color: string;
  badgeColor: string;
  items: NavTreeItem[];
}

export const NAV_TREE: NavTreeGroup[] = [
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
      {
        id: "tutorial-loot-affixes-allies",
        shortTitle: "Adding Loot Affixes, Allies & Forms",
      },
      {
        id: "tutorial-traits-events-bounties",
        shortTitle: "Adding Traits, Bounties & Field Tests",
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
        shortTitle: "GoalQueue Ringbuffer, Sense & Steering",
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
      {
        id: "intro-playback",
        shortTitle: "Intro Video & Audio Playback",
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
        id: "caves-sundark",
        shortTitle: "Caves, Sundark & Dread",
      },
      {
        id: "weather-sky",
        shortTitle: "Diurnal Cycle, Weather & Footprints",
      },
      {
        id: "biome-events-chart-hud",
        shortTitle: "26 BiomeEvents, RLE Chart & HUD Pins",
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
        id: "menu-language",
        shortTitle: "Menu Text & Language Overrides",
      },
      {
        id: "input-controls",
        shortTitle: "Input, Controls & Rebinding",
      },
      {
        id: "audio-qa",
        shortTitle: "32-Voice LRU Audio Mixer & QA Views",
      },
      {
        id: "ouroboros-deep-dive",
        shortTitle: "How Ouroboros Really Works",
      },
      {
        id: "engine-mathematics",
        shortTitle: "Game Math, Invariants & Proofs",
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
        id: "paper-doll-gear-combat",
        shortTitle: "Paper-Doll Gear, (1-r)² Resist & Procs",
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
        shortTitle: "16 FormBehaviors, Payloads & Summons",
      },
      {
        id: "classes-encounters",
        shortTitle: "12 Hero Kits, 39 Foes & 20 Traits",
      },
      {
        id: "campaign-settlements-delves",
        shortTitle: "Settlements, Sanctuary Seekers & Delves",
      },
      {
        id: "mutations-afflictions",
        shortTitle: "Changelings, Mutations & Afflictions",
      },
    ],
  },
];

interface FeaturedTopic {
  id: string;
  title: string;
  subtitle: string;
  icon: ElementType;
  badge?: string;
}

interface FeaturedTopicGroup {
  groupName: string;
  topics: FeaturedTopic[];
}

export const FEATURED_TOPIC_GROUPS: FeaturedTopicGroup[] = [
  {
    groupName: "Core Engine & Math",
    topics: [
      {
        id: "engine-mathematics",
        title: "Game Math & Invariants",
        subtitle: "Geometry, probability & navigation",
        icon: Calculator,
      },
      {
        id: "ouroboros-deep-dive",
        title: "How Ouroboros Works",
        subtitle: "Bit twiddling & 4 serpents",
        icon: Cpu,
        badge: "LAB",
      },
      {
        id: "renderer-in-context",
        title: "Renderer Architecture",
        subtitle: "Vulkan, LightField & Radix Sort",
        icon: Layers,
        badge: "LAB",
      },
      {
        id: "terrain-construction",
        title: "Terrain Construction",
        subtitle: "7 Procedural Synthesis Stages",
        icon: Compass,
        badge: "LAB",
      },
    ],
  },
  {
    groupName: "AI & World Simulation",
    topics: [
      {
        id: "goal-ai",
        title: "Goal AI & Concurrency",
        subtitle: "Steering, ringbuffer & 4-barrier",
        icon: Workflow,
        badge: "LAB",
      },
      {
        id: "night-spawner-director",
        title: "Wave Director & Shrines",
        subtitle: "Nocturnal pacing & escalation",
        icon: Swords,
        badge: "LAB",
      },
      {
        id: "weather-sky",
        title: "Sky, Weather & Footprints",
        subtitle: "Diurnal cycle & storm particles",
        icon: Sparkles,
        badge: "LAB",
      },
      {
        id: "audio-qa",
        title: "32-Voice Audio Mixer",
        subtitle: "Effect voices, music & ambience",
        icon: Terminal,
      },
    ],
  },
  {
    groupName: "Gameplay & Workshop",
    topics: [
      {
        id: "diablo-loot-runrules",
        title: "Diablo Loot & Item Affixes",
        subtitle: "30 Affixes, RunRules & Rarities",
        icon: Sparkles,
        badge: "LAB",
      },
      {
        id: "campaign-settlements-delves",
        title: "Sanctuary & Delves",
        subtitle: "Seekers, watchtowers & dungeons",
        icon: Compass,
        badge: "LAB",
      },
      {
        id: "tutorial-pixel-shader",
        title: "Pixel Art & Shaders",
        subtitle: "16×16 sprites & Slang kernels",
        icon: FileCode2,
        badge: "LAB",
      },
      {
        id: "contribute-basics",
        title: "Contributor Sandbox",
        subtitle: "Build flags, QA & --dev mode",
        icon: Wrench,
        badge: "LAB",
      },
    ],
  },
];


