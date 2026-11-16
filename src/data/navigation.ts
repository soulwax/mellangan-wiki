import type { ElementType } from "react";
import { Cpu, Layers, Compass, Swords, Terminal, Wrench, BookOpen, Sparkles, Calculator, FileCode2, Workflow, Flame } from "lucide-react";

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
    key: "community-portal",
    label: "Roadmap & Community Hub",
    icon: Compass,
    color: "text-gold-400",
    badgeColor: "bg-gold-500/15 text-gold-300 border-gold-500/30",
    items: [
      {
        id: "plan-and-todo",
        shortTitle: "Master Plan, TODO & Community Poll",
      },
    ],
  },
  {
    key: "showcase",
    label: "Game Showcase",
    icon: Sparkles,
    color: "text-gold-400",
    badgeColor: "bg-gold-500/15 text-gold-300 border-gold-500/30",
    items: [{ id: "gallery", shortTitle: "Gallery: Menus, World & Battles" }],
  },
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
        id: "tutorial-manual-tilemap",
        shortTitle: "Draw, Map & Read a Tilemap",
      },
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
        id: "enemy-mind-model",
        shortTitle: "Enemy Minds & Champion Powers",
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
        id: "particle-physics",
        shortTitle: "Particle Motion, Debris & Collision",
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
      {
        id: "reactive-ground",
        shortTitle: "Reactive Ground, Fire & Spores",
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
        shortTitle: "Spielmathematik, Invarianten und Beweise",
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
      { id: "campaign-quest-flow", shortTitle: "Campaign Quest Flow" },
      { id: "campaign-fact-ledger", shortTitle: "Local Knowledge Ledger" },
      { id: "campaign-cookery", shortTitle: "Cookery & Sharing" },
      { id: "campaign-experience", shortTitle: "Campaign Experience" },
      { id: "campaign-standing", shortTitle: "Faction Standing" },
      { id: "campaign-farming", shortTitle: "Campaign Farming" },
      { id: "gems-and-sockets", shortTitle: "Gems & Sockets" },
      { id: "runes-and-words", shortTitle: "Runes & Rune Words" },
      {
        id: "crafting-workbench",
        shortTitle: "Crafting, Salvage & Schematics",
      },
      {
        id: "diablo-loot-runrules",
        shortTitle: "Item Generation & Run Rules",
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
  {
    key: "vulkan2d",
    label: "Vulkan2D Subsystem (extern/Vulkan2d)",
    icon: Flame,
    color: "text-fuchsia-400 drop-shadow-[0_0_6px_rgba(232,121,249,0.55)]",
    badgeColor:
      "bg-gradient-to-r from-fuchsia-500/25 to-orange-500/25 text-fuchsia-200 border-fuchsia-400/50 shadow-[0_0_8px_rgba(232,121,249,0.25)]",
    items: [
      {
        id: "vk2d-architecture",
        shortTitle: "Renderer Architecture & Frame Lifecycle",
      },
      {
        id: "vk2d-devices-memory",
        shortTitle: "Devices, VMA & Paged DescriptorBuffers",
      },
      {
        id: "vk2d-descriptors-textures",
        shortTitle: "Bindless Texture Array & DescriptorControl",
      },
      {
        id: "vk2d-sprite-batching",
        shortTitle: "Compute Sprite Batching & Instanced Draws",
      },
      {
        id: "vk2d-pipelines-shaders",
        shortTitle: "Pipelines, Blend Modes & Slang Compiler",
      },
      {
        id: "vk2d-targets-cameras",
        shortTitle: "Render Targets, 3 Passes & 10-Camera UBO",
      },
      {
        id: "vk2d-primitives-shadows-gui",
        shortTitle: "Polygons, 2D Shadows, 3D Models & Nuklear",
      },
      {
        id: "vk2d-validation-logging-utils",
        shortTitle: "Validation, Thread-Safe Logger & Utilities",
      },
      {
        id: "vk2d-examples-cookbook",
        shortTitle: "Practical Cookbook & Sample Walkthroughs",
      },
      {
        id: "vk2d-math-matrices",
        shortTitle: "Math.h Matrix Engine & Coordinate Transforms",
      },
      {
        id: "vk2d-api-reference",
        shortTitle: "Complete Public API Reference & Struct Layout",
      },
      {
        id: "vk2d-shaders-glsl-deep-dive",
        shortTitle: "GLSL 450 Shaders, Vertex Layouts & Blobs.h",
      },
      {
        id: "vk2d-nuklear-uthash-internals",
        shortTitle: "Nuklear Vulkan Backend, Font Hash & Uploads",
      },
      {
        id: "vk2d-gpu-architecture-book",
        shortTitle: "Book I: How Modern GPUs Work",
      },
      {
        id: "vk2d-shader-book-fundamentals",
        shortTitle: "Book II: Step-by-Step Shader Guide",
      },
      {
        id: "vk2d-shader-book-advanced-workshop",
        shortTitle: "Book III: Advanced Shaders & Labs",
      },
      {
        id: "vk2d-shader-book-compute-and-shadows",
        shortTitle: "Book IV: Compute, Shadows & Blending",
      },
      {
        id: "vk2d-shader-book-debugging-and-performance",
        shortTitle: "Book V: SDFs, Profiling & Debugging",
      },
      {
        id: "vk2d-shader-book-vertex-pulling-color",
        shortTitle: "Book VI: Vertex Pulling & Color Math",
      },
      {
        id: "vk2d-shader-book-3d-depth-raymarching",
        shortTitle: "Book VII: 3D Depth, Raymarching & Parallax",
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
        title: "Spielmathematik und Invarianten",
        subtitle: "Geometrie, Wahrscheinlichkeit und Wegfindung",
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
        id: "vk2d-architecture",
        title: "Vulkan2D Subsystem",
        subtitle: "3 Command Buffers & Bindless GPU Batching",
        icon: Flame,
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
        id: "plan-and-todo",
        title: "Master Plan & Community Poll",
        subtitle: "Vote on design dilemmas, submit art & analyze logs",
        icon: Compass,
        badge: "POLL",
      },
      {
        id: "diablo-loot-runrules",
        title: "Diablo Loot & Item Affixes",
        subtitle: "Affixes, Run Rules & Rarities",
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


