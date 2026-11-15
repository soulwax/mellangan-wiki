import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Sparkles,
  Check,
  Copy,
  Upload,
  Download,
  Image as ImageIcon,
  FileText,
  Terminal,
  Wrench,
  Layers,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Compass,
  RotateCcw,
  Palette,
  Grid,
  ExternalLink,
  HelpCircle,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Play,
  Filter,
  Sliders,
  Send,
  Eye,
  Trash2,
  GitBranch,
  Plus,
  Radio,
  ArrowRight,
  HardDrive,
  CheckSquare,
  Square,
  FileCode2,
} from "lucide-react";

// --- Types & Interfaces ---

export interface PollOption {
  id: string;
  text: string;
  votes: number;
  description?: string;
  suggestedAction?: {
    taskTitle: string;
    targetFile: string;
    lane: "Build" | "Desk" | "Screen" | "Ship";
    goal: string;
    doneWhen: string;
  };
}

export interface PollQuestion {
  id: string;
  title: string;
  category: "Combat & Items" | "Campaign & Lore" | "Progression" | "World Simulation" | "Accessibility";
  context: string;
  options: PollOption[];
  tags: string[];
  linkedTaskId?: string;
  linkedFile?: string;
}

export interface UserPollResponse {
  selectedOptionId: string;
  comment: string;
  timestamp: string;
}

export interface LiveTaskItem {
  id: string;
  cardId?: string;
  source: "workspace" | "notes-repo";
  section?: string;
  completed: boolean;
  marker: string;
  title: string;
  size?: string;
  lane: string;
  raw: string;
  body: string;
  file: string;
  acceptance: string;
  priority: "High" | "Medium" | "Low";
  owner: string;
  lineNumber: number;
}

export interface ArtSubmissionDraft {
  creator: string;
  title: string;
  category: "Weapon Sprite (16x16)" | "Monster / Foe" | "Biome Tile / Doodad" | "Relic / Charm" | "Hero Portrait" | "Concept Art";
  license: "Zlib (Default)" | "CC0 / Public Domain" | "MIT";
  targetFolder: string;
  description: string;
  imageDataUrl: string;
  imageDimensions: { width: number; height: number } | null;
  canvasPixels: string[]; // 16x16 hex codes
}

// --- Default Data & Curated Design Dilemmas ---

const DEFAULT_POLL_QUESTIONS: PollQuestion[] = [
  {
    id: "poll_weapon_tooltips",
    title: "Unique Weapon Tooltips: Immediate Stats vs. Discovery by Wielding",
    category: "Combat & Items",
    context:
      "Unique weapons (Oathblade, Farsong, Grim Harvest) currently show atmospheric lore in tooltips, but historically skipped the granted attack preview line. Should unique weapon attacks be fully visible upon inspection, or kept mysterious until wielded in battle?",
    tags: ["src/gui/Tooltip.cpp", "TODO item", "UX"],
    linkedTaskId: "ws_task_1",
    linkedFile: "src/gui/Tooltip.cpp",
    options: [
      {
        id: "opt_reveal_all",
        text: "Always reveal granted attack stats, cooldowns, and lore together in all tooltips.",
        votes: 184,
        description: "Maximizes tactical transparency. Players can calculate DPS and synergies without test-equipping.",
        suggestedAction: {
          taskTitle: "Show the granted attack on unique weapon tooltips",
          targetFile: "src/gui/Tooltip.cpp",
          lane: "Build",
          goal: "In src/gui/Tooltip.cpp, show both lore and grants line for Oathblade, Farsong, Grim Harvest.",
          doneWhen: "Equipping a unique weapon makes its granted attack visible in the tooltip and Release build passes.",
        },
      },
      {
        id: "opt_equip_reveal",
        text: "Display flavor lore initially; reveal the granted attack permanently once equipped in hand.",
        votes: 92,
        description: "Preserves the thrilling fantasy of discovering an ancient artifact's true magic upon drawing it.",
        suggestedAction: {
          taskTitle: "Progressive tooltip disclosure: reveal granted attack on first equip",
          targetFile: "src/gui/Tooltip.cpp",
          lane: "Build",
          goal: "Store an equipped bitset for discovered unique weapon grants and unmask stats on first wield.",
          doneWhen: "Tooltip shows mysterious runes until equipped, then permanently displays granted attack stats.",
        },
      },
      {
        id: "opt_name_only",
        text: "Show the granted ability's title (e.g. 'Grants: Cinder Cleave') but leave numerical damage dice hidden.",
        votes: 41,
        description: "Middle-ground: hints at the weapon's nature while rewarding in-game experimentation.",
      },
    ],
  },
  {
    id: "poll_mode_separation",
    title: "Campaign vs. Survival Item Separation: Cross-Mode Unlocks?",
    category: "Progression",
    context:
      "Campaign and Survival currently maintain strict, mode-aware loot pools (25 D&D equipment bases and 15 relics stay in Campaign). Should high-achievement campaign victories or lore codex completions unlock anything in Survival mode?",
    tags: ["src/meta/Content.cpp", "src/test/VendorTest.cpp", "Game Modes"],
    linkedTaskId: "ws_task_2",
    linkedFile: "src/test/VendorTest.cpp",
    options: [
      {
        id: "opt_strict_isolation",
        text: "Strict Isolation: Survival remains an untainted arcade leaderboard experience with identical baseline starts.",
        votes: 215,
        description: "Guarantees competitive integrity for high-score runs and avoids grinding campaign for survival perks.",
        suggestedAction: {
          taskTitle: "Test mode-aware gambling in VendorTest.cpp",
          targetFile: "src/test/VendorTest.cpp",
          lane: "Build",
          goal: "Add deterministic cases ensuring Campaign never yields Survival uniques and vice versa.",
          doneWhen: "Cases exercise at least one unique in each mode across shared and campaign bases, --test passes.",
        },
      },
      {
        id: "opt_cosmetics_only",
        text: "Cosmetics & Palettes: Unlocks hero skin variants, lantern flame hues, or custom footstep sounds.",
        votes: 147,
        description: "Rewards dedicated campaign players visually without skewing gameplay balance.",
      },
      {
        id: "opt_sidegrade_starts",
        text: "Alternative Starter Weapons: Sidegrades that change tactical starting kits without raw numerical power.",
        votes: 68,
        description: "Adds variety to the opening 3 minutes of survival runs.",
      },
    ],
  },
  {
    id: "poll_camp_cooking",
    title: "Camp Cookery & Foraged Stews: Perishable Rations vs. Permanent Buffs",
    category: "Campaign & Lore",
    context:
      "Settlement stewpots and wilderness campfires let heroes cook shared meals with hamlet dwellers for stamina buffs. Should cooked dishes spoil over in-game diurnal day/night cycles, or remain stable permanent inventory rations?",
    tags: ["src/campaign/Cookery.cpp", "Inventory", "Diurnal Cycle"],
    linkedFile: "src/campaign/Cookery.cpp",
    options: [
      {
        id: "opt_non_perishable",
        text: "Non-Perishable: Inventory slots are already tight; meals should never spoil or turn sour.",
        votes: 198,
        description: "Reduces inventory micromanagement and lets players save gourmet delicacies for tough boss delves.",
      },
      {
        id: "opt_slow_decay",
        text: "Rot after 3 in-game days into compost or fishing bait unless stored in a settlement salt-cellar.",
        votes: 112,
        description: "Deepens survival realism and encourages consuming fresh meals before long wilderness expeditions.",
        suggestedAction: {
          taskTitle: "Implement diurnal ration decay and salt cellar storage",
          targetFile: "src/campaign/Cookery.cpp",
          lane: "Build",
          goal: "Track cookDay stamp on food pieces; transform to compost after 3 days unless in cellar container.",
          doneWhen: "Meals spoil after 3 diurnal cycles; salt-cellar prevents spoilage; tests pass.",
        },
      },
      {
        id: "opt_cooling_stew",
        text: "Freshness curve: Piping Hot (+100% effect, Day 1) -> Warm (+50%, Day 2) -> Cold Ration (Base, indefinitely).",
        votes: 85,
        description: "Offers optimal tactical payoff for immediate consumption without feeling punitive if hoarded.",
      },
    ],
  },
  {
    id: "poll_night_shrine",
    title: "Rekindling Shrines in the Wild: Peaceful Daylight Havens vs. Dark Counter-Raids",
    category: "World Simulation",
    context:
      "Lighting stone shrines holds back the dark. In deep Act II mire and Act III caverns, should striking the spark create an instantaneous peaceful refuge, or provoke a desperate counter-assault swarm from the encroaching shadows?",
    tags: ["src/level/Shrine.cpp", "Night Clock", "Combat Director"],
    linkedFile: "src/level/Shrine.cpp",
    options: [
      {
        id: "opt_immediate_haven",
        text: "Instant Haven: The perimeter bursts with sacred light, calming beasts and halting nearby aggression.",
        votes: 156,
        description: "Provides much-needed breathing room and rewards risky dashes through midnight hordes.",
      },
      {
        id: "opt_counter_assault",
        text: "The Spark Attracts Terror: Lighting a shrine triggers an intense 30-second siege before turning safe.",
        votes: 173,
        description: "Creates memorable climax moments where players must defend the flame to claim the checkpoint.",
        suggestedAction: {
          taskTitle: "Shrine kindle wave: 30-second siege counter-assault",
          targetFile: "src/level/Shrine.cpp",
          lane: "Build",
          goal: "Kindling a shrine in Act II/III triggers a timed wave director swarm before sanctifying the area.",
          doneWhen: "Kindling spawns a 30s counter-assault; defeating the raid secures permanent beacon safety.",
        },
      },
      {
        id: "opt_pulse_beacon",
        text: "Radiant Pulse: Shrines pulse a blinding shockwave every 10 seconds, pushing enemies back gradually.",
        votes: 79,
        description: "Blends defense and refuge, allowing kiting around the perimeter.",
      },
    ],
  },
  {
    id: "poll_pacifist_territory",
    title: "Pacifist Stowed-Weapon Infiltration: How Should Guard Factions React?",
    category: "Combat & Items",
    context:
      "Mellangan supports 'No Hand Raised' runs where weapons can be stowed (Key 2). When a stowed hero enters Freeblade or Rootsworn territory, how forgiving should the patrol guards be before drawing steel?",
    tags: ["src/campaign/Standing.cpp", "Key 2 Stow", "Factions"],
    linkedFile: "src/campaign/Standing.cpp",
    options: [
      {
        id: "opt_three_warnings",
        text: "Spoken Warnings: Guards shout three verbal warnings to halt before becoming hostile.",
        votes: 165,
        description: "Intuitive telegraphing that allows honest navigators to turn back without ruining a peaceful run.",
      },
      {
        id: "opt_bribe_parley",
        text: "Immediate Parley Prompt: Guards stop the player with a dialog prompt to pay toll, show charm, or retreat.",
        votes: 142,
        description: "Deepens RPG diplomacy and integrates faction standings with the Splintered Ford caravan mechanics.",
        suggestedAction: {
          taskTitle: "Guard parley prompt on border trespass with stowed weapons",
          targetFile: "src/campaign/Standing.cpp",
          lane: "Build",
          goal: "When crossing faction boundary with Key 2 stowed, prompt for toll payment or parley before aggro.",
          doneWhen: "Entering camp triggers dialog modal; paying toll allows safe passage; tests pass.",
        },
      },
      {
        id: "opt_instant_strike",
        text: "Strict Trespass: Sovereign territory is sacred; crossing marked boundary stones is an act of war.",
        votes: 39,
        description: "Hardcore realism requiring players to stick strictly to public roads and neutral trade paths.",
      },
    ],
  },
];

const FALLBACK_WORKSPACE_TASKS: LiveTaskItem[] = [
  {
    id: "ws_task_1",
    source: "workspace",
    completed: false,
    marker: " ",
    title: "Show the granted attack on unique weapon tooltips",
    file: "src/gui/Tooltip.cpp",
    lane: "Build",
    raw: "- [ ] **Show the granted attack on unique weapon tooltips.** In `src/gui/Tooltip.cpp`...",
    body: "In src/gui/Tooltip.cpp, unique items show their lore but skip the grants line. Show both for Oathblade, Farsong, Grim Harvest, and any other unique with an item-base grant.",
    acceptance: "Done when equipping a unique weapon makes its granted attack visible in the tooltip and the Release build passes.",
    priority: "High",
    owner: "gui/meta",
    lineNumber: 5,
  },
  {
    id: "ws_task_2",
    source: "workspace",
    completed: false,
    marker: " ",
    title: "Test mode-aware gambling",
    file: "src/test/VendorTest.cpp",
    lane: "Build",
    raw: "- [ ] **Test mode-aware gambling.** Add deterministic cases in `src/test/VendorTest.cpp`...",
    body: "Add deterministic cases in src/test/VendorTest.cpp for gamble(base, rng, campaign): Campaign must never produce a Survival-only unique, and Survival must never produce a Campaign-only unique.",
    acceptance: "Done when the cases exercise at least one unique in each mode and --test passes.",
    priority: "High",
    owner: "test/vendor",
    lineNumber: 7,
  },
  {
    id: "ws_task_3",
    source: "workspace",
    completed: false,
    marker: " ",
    title: "Validate item mode declarations",
    file: "src/meta/Content.cpp",
    lane: "Build",
    raw: "- [ ] **Validate item mode declarations.** In `src/meta/Content.cpp`...",
    body: "In src/meta/Content.cpp, extend contentFaults() so Campaign-only uniques must use Campaign-only bases, Survival-only uniques cannot use Campaign-only bases.",
    acceptance: "Done when bad declarations produce a content fault and Release build and --test pass.",
    priority: "High",
    owner: "core",
    lineNumber: 9,
  },
];

// Color palette for 16x16 pixel art canvas
const MELLANGAN_PALETTE = [
  "#00000000", // Transparent
  "#1b1e24", // Void Slate (dark background)
  "#303640", // Steel Grey
  "#596273", // Slate Accent
  "#f4efe6", // Bone White
  "#e5c07b", // Hearth Gold
  "#d19a66", // Amber Glow
  "#b27c4c", // Leather Brown
  "#e06c75", // Cinder Red / Blood
  "#be555e", // Crimson Shadow
  "#61afef", // Frost Blue
  "#428ac5", // Deep Water
  "#98c379", // Mire Moss
  "#487e50", // Rootsworn Green
  "#c678dd", // Arcane Violet
  "#ae69c4", // Rune Purple
];

// --- Helper Functions ---

function getSessionData<T>(key: string, fallback: T): T {
  if (typeof window === "undefined" || !window.sessionStorage) return fallback;
  try {
    const item = window.sessionStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    console.warn(`Failed reading sessionStorage key ${key}:`, e);
    return fallback;
  }
}

function setSessionData<T>(key: string, value: T): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Failed writing sessionStorage key ${key}:`, e);
  }
}

// --- Main Component ---

export function GameCommunityPortal() {
  const [activeTab, setActiveTab] = useState<"poll" | "roadmap" | "art" | "bridge">("roadmap");

  // --- Real-Time Bridge State ---
  const [bridgeStatus, setBridgeStatus] = useState<"connecting" | "connected" | "offline">("connecting");
  const [bridgeUrl, setBridgeUrl] = useState<string>("http://127.0.0.1:3001/api");
  const [ghUser, setGhUser] = useState<string>("soulwax");
  const [liveWorkspaceTasks, setLiveWorkspaceTasks] = useState<LiveTaskItem[]>(FALLBACK_WORKSPACE_TASKS);
  const [liveNotesCards, setLiveNotesCards] = useState<LiveTaskItem[]>([]);
  const [rawWorkspaceMd, setRawWorkspaceMd] = useState<string>("");
  const [rawNotesMd, setRawNotesMd] = useState<string>("");
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Roadmap view mode: workspace tasks vs notes repo queue vs raw editor
  const [roadmapViewMode, setRoadmapViewMode] = useState<"workspace" | "notes-queue" | "raw">("workspace");

  // Filter & Search
  const [taskCategoryFilter, setTaskCategoryFilter] = useState<string>("All");
  const [taskLaneFilter, setTaskLaneFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // New Task Modal Form
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState<boolean>(false);
  const [newTaskForm, setNewTaskForm] = useState<{
    title: string;
    file: string;
    lane: "Build" | "Desk" | "Screen" | "Ship";
    size: "XS" | "S" | "M" | "L";
    body: string;
    acceptance: string;
    owner: string;
  }>({
    title: "",
    file: "src/",
    lane: "Build",
    size: "S",
    body: "",
    acceptance: "Release build passes and --test passes cleanly.",
    owner: "subagent",
  });

  // --- SessionStorage State ---
  const [pollResponses, setPollResponses] = useState<Record<string, UserPollResponse>>(() =>
    getSessionData("MELLANGAN_POLL_RESPONSES", {})
  );

  const [upvotedTasks, setUpvotedTasks] = useState<Record<string, boolean>>(() =>
    getSessionData("MELLANGAN_UPVOTED_TASKS", {})
  );

  const [artDraft, setArtDraft] = useState<ArtSubmissionDraft>(() =>
    getSessionData("MELLANGAN_ART_DRAFT", {
      creator: "",
      title: "",
      category: "Weapon Sprite (16x16)",
      license: "Zlib (Default)",
      targetFolder: "res/sprites/items/weapons/",
      description: "",
      imageDataUrl: "",
      imageDimensions: null,
      canvasPixels: new Array(256).fill("#00000000"),
    })
  );

  const [activeColor, setActiveColor] = useState<string>(MELLANGAN_PALETTE[5]); // Default Gold
  const [canvasZoom, setCanvasZoom] = useState<number>(12);
  const [extractedPalette, setExtractedPalette] = useState<string[]>([]);

  // Telemetry Log State
  const [telemetryLog, setTelemetryLog] = useState<string>(() =>
    getSessionData(
      "MELLANGAN_TELEMETRY_LOG",
      `[info] Mellangan v0.7.4 (C++20, Vulkan 1.2) build: Release
[info] Vulkan device: Intel(R) Iris(R) Xe Graphics (Driver 31.0.101.4575)
[info] World seed: 0xDEADBEEF42 | Hero slot: 1 (Knight, Level 14)
[info] Slab Pool: 64 KiB slab payload allocated, 1520B class hit-rate 99.4%
[info] Spatial grid: 550 mobs indexed in 0.42 ms, 4 worker threads active
[info] 60 fps steady, frametime p99: 4.1 ms`
    )
  );

  // Launcher Config Flags
  const [launcherFlags, setLauncherFlags] = useState<{
    devMode: boolean;
    seed: string;
    hero: number;
    benchGate: boolean;
    giveLevel: number;
    warpBiome: string;
    godMode: boolean;
  }>(() =>
    getSessionData("MELLANGAN_LAUNCHER_FLAGS", {
      devMode: true,
      seed: "0x7F4A9",
      hero: 1,
      benchGate: false,
      giveLevel: 10,
      warpBiome: "mire",
      godMode: false,
    })
  );

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // --- Real-Time Bridge Fetching & SSE Connection ---

  const fetchBridgeTodos = async (url: string) => {
    try {
      const res = await fetch(`${url}/todos`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.ok) {
        setLiveWorkspaceTasks(json.workspace || []);
        setLiveNotesCards(json.notesRepo || []);
        setRawWorkspaceMd(json.rawWorkspace || "");
        setRawNotesMd(json.rawNotes || "");
        setBridgeStatus("connected");
        setLastSyncTime(new Date().toLocaleTimeString());
        return true;
      }
    } catch {
      // Fallback
    }
    return false;
  };

  useEffect(() => {
    let sse: EventSource | null = null;
    let isMounted = true;

    async function initBridge() {
      const candidates = ["http://127.0.0.1:3001/api", "/api", "http://localhost:3001/api"];
      let active: string | null = null;

      for (const candidate of candidates) {
        const ok = await fetchBridgeTodos(candidate);
        if (ok) {
          active = candidate;
          setBridgeUrl(candidate);
          break;
        }
      }

      if (!active) {
        if (isMounted) {
          setBridgeStatus("offline");
          setLiveWorkspaceTasks(FALLBACK_WORKSPACE_TASKS);
        }
        return;
      }

      try {
        const statusRes = await fetch(`${active}/status`);
        if (statusRes.ok) {
          const statusJson = await statusRes.json();
          if (statusJson.ghUser) setGhUser(statusJson.ghUser);
        }
      } catch {
        // Ignored
      }

      try {
        sse = new EventSource(`${active}/events`);
        sse.addEventListener("todo-change", (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            if (data?.todos) {
              setLiveWorkspaceTasks(data.todos.workspace || []);
              setLiveNotesCards(data.todos.notesRepo || []);
              setLastSyncTime(new Date().toLocaleTimeString());
              showFlash(`Real-time update received: ${data.source}`);
            }
          } catch (err) {
            console.warn("SSE parse error:", err);
          }
        });

        sse.onopen = () => {
          if (isMounted) setBridgeStatus("connected");
        };

        sse.onerror = () => {
          // Auto reconnect
        };
      } catch (err) {
        console.warn("SSE connection error:", err);
      }
    }

    initBridge();

    return () => {
      isMounted = false;
      if (sse) sse.close();
    };
  }, []);

  // Sync state to sessionStorage
  useEffect(() => {
    setSessionData("MELLANGAN_POLL_RESPONSES", pollResponses);
  }, [pollResponses]);

  useEffect(() => {
    setSessionData("MELLANGAN_UPVOTED_TASKS", upvotedTasks);
  }, [upvotedTasks]);

  useEffect(() => {
    setSessionData("MELLANGAN_ART_DRAFT", artDraft);
  }, [artDraft]);

  useEffect(() => {
    setSessionData("MELLANGAN_TELEMETRY_LOG", telemetryLog);
  }, [telemetryLog]);

  useEffect(() => {
    setSessionData("MELLANGAN_LAUNCHER_FLAGS", launcherFlags);
  }, [launcherFlags]);

  const copyToClipboard = (text: string, id: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2200);
    }
  };

  const showFlash = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3200);
  };

  // --- Real-Time CRUD Operations ---

  const handleToggleTaskStatus = async (taskId: string, currentCompleted: boolean) => {
    const nextCompleted = !currentCompleted;

    if (taskId.startsWith("ws_")) {
      setLiveWorkspaceTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, completed: nextCompleted, marker: nextCompleted ? "x" : " " } : t))
      );
    } else {
      setLiveNotesCards((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, completed: nextCompleted, marker: nextCompleted ? "x" : " " } : t))
      );
    }

    if (bridgeStatus === "connected") {
      try {
        const res = await fetch(`${bridgeUrl}/todos/${taskId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: nextCompleted }),
        });
        if (res.ok) {
          showFlash(`Saved: Task ${nextCompleted ? "completed [x]" : "opened [ ]"}`);
          return;
        }
      } catch (e) {
        console.warn("Failed sending task update to bridge:", e);
      }
    }

    showFlash(`Updated locally in session (Bridge offline)`);
  };

  const handleCreateTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskForm.title.trim()) return;

    if (bridgeStatus === "connected") {
      try {
        const res = await fetch(`${bridgeUrl}/todos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newTaskForm),
        });
        if (res.ok) {
          showFlash(`Task created and appended to TODO.md!`);
          setIsNewTaskModalOpen(false);
          setNewTaskForm({
            title: "",
            file: "src/",
            lane: "Build",
            size: "S",
            body: "",
            acceptance: "Release build passes and --test passes cleanly.",
            owner: "subagent",
          });
          fetchBridgeTodos(bridgeUrl);
          return;
        }
      } catch (err) {
        console.warn("Failed creating task via bridge:", err);
      }
    }

    const newTask: LiveTaskItem = {
      id: `ws_task_${Date.now()}`,
      source: "workspace",
      completed: false,
      marker: " ",
      title: newTaskForm.title,
      file: newTaskForm.file,
      lane: newTaskForm.lane,
      raw: `- [ ] **${newTaskForm.title}.** In \`${newTaskForm.file}\`, ${newTaskForm.body}`,
      body: newTaskForm.body,
      acceptance: newTaskForm.acceptance,
      priority: newTaskForm.size === "L" ? "High" : newTaskForm.size === "M" ? "Medium" : "Low",
      owner: newTaskForm.owner,
      lineNumber: liveWorkspaceTasks.length + 1,
    };

    setLiveWorkspaceTasks((prev) => [...prev, newTask]);
    setIsNewTaskModalOpen(false);
    showFlash("Task added to session (Bridge offline)");
  };

  const handleGitSync = async (action: "push" | "pull") => {
    if (bridgeStatus !== "connected") {
      showFlash("Bridge is offline. Cannot sync git.");
      return;
    }

    try {
      showFlash(`Executing git ${action} on private repo...`);
      const res = await fetch(`${bridgeUrl}/git/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, message: "docs(todo): sync tasks via Mellangan Web Portal" }),
      });
      const data = await res.json();
      if (data.ok) {
        showFlash(`Git ${action} succeeded on soulwax/mellangan-notes!`);
        fetchBridgeTodos(bridgeUrl);
      } else {
        showFlash(`Git sync failed: ${data.error || "Unknown error"}`);
      }
    } catch (err) {
      showFlash(`Error connecting to git sync: ${String(err)}`);
    }
  };

  const handlePromotePollToTask = (q: PollQuestion, opt: PollOption) => {
    const action = opt.suggestedAction;
    setNewTaskForm({
      title: action?.taskTitle || `${q.title}: ${opt.text.slice(0, 50)}`,
      file: action?.targetFile || q.linkedFile || "src/",
      lane: action?.lane || "Build",
      size: "S",
      body: action?.goal || `Community RFC consensus: ${opt.text}`,
      acceptance: action?.doneWhen || "Implementation complete and --test passes cleanly.",
      owner: "subagent",
    });
    setIsNewTaskModalOpen(true);
    setActiveTab("roadmap");
    showFlash("Promoted RFC option to task card! Ready to review and submit.");
  };

  // --- Handlers: Poll Voting ---
  const handleVote = (questionId: string, optionId: string) => {
    setPollResponses((prev) => ({
      ...prev,
      [questionId]: {
        selectedOptionId: optionId,
        comment: prev[questionId]?.comment || "",
        timestamp: new Date().toISOString(),
      },
    }));
    showFlash("Vote recorded in sessionStorage!");
  };

  const handleCommentChange = (questionId: string, comment: string) => {
    setPollResponses((prev) => ({
      ...prev,
      [questionId]: {
        selectedOptionId: prev[questionId]?.selectedOptionId || "",
        comment,
        timestamp: new Date().toISOString(),
      },
    }));
  };

  const exportPollResults = () => {
    const lines: string[] = [
      "# Mellangan Community RFC & Design Poll Feedback",
      `*Generated on: ${new Date().toLocaleString()}*`,
      `*Source: mel.bluesix.dev Community Portal*`,
      "",
      "---",
      "",
    ];

    DEFAULT_POLL_QUESTIONS.forEach((q, idx) => {
      const resp = pollResponses[q.id];
      const selectedOption = q.options.find((o) => o.id === resp?.selectedOptionId);
      lines.push(`### ${idx + 1}. ${q.title}`);
      lines.push(`**Subsystem Context:** ${q.context}`);
      if (q.linkedFile) lines.push(`**Linked Engine Code:** \`${q.linkedFile}\``);
      lines.push("");
      lines.push(`- **Selected Choice:** ${selectedOption ? `✅ ${selectedOption.text}` : "*No choice selected*"}`);
      if (resp?.comment) {
        lines.push(`- **Player Feedback / Rationale:** "${resp.comment.trim()}"`);
      }
      lines.push("");
    });

    const exportText = lines.join("\n");
    copyToClipboard(exportText, "poll_export");
    showFlash("Poll responses copied to clipboard as Markdown! Ready for GitHub Discussions.");
  };

  const displayedTasks = useMemo(() => {
    const list = roadmapViewMode === "workspace" ? liveWorkspaceTasks : liveNotesCards;
    return list.filter((t) => {
      if (taskLaneFilter !== "All" && t.lane !== taskLaneFilter) return false;
      if (taskCategoryFilter !== "All" && (t.section || "") !== taskCategoryFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(query);
        const matchesFile = t.file?.toLowerCase().includes(query);
        const matchesBody = t.body?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesFile && !matchesBody) return false;
      }
      return true;
    });
  }, [roadmapViewMode, liveWorkspaceTasks, liveNotesCards, taskLaneFilter, taskCategoryFilter, searchQuery]);

  // --- Handlers: Artwork & Pixel Studio ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const resultUrl = loadEvent.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, img.width, img.height).data;
          const colorSet = new Set<string>();
          for (let i = 0; i < imgData.length; i += 4) {
            const a = imgData[i + 3];
            if (a > 20) {
              const hex = `#${((1 << 24) + (imgData[i] << 16) + (imgData[i + 1] << 8) + imgData[i + 2])
                .toString(16)
                .slice(1)}`;
              colorSet.add(hex.toUpperCase());
            }
          }
          setExtractedPalette(Array.from(colorSet).slice(0, 24));
        }

        setArtDraft((prev) => ({
          ...prev,
          imageDataUrl: resultUrl,
          imageDimensions: { width: img.width, height: img.height },
        }));
        showFlash(`Loaded sprite: ${img.width}×${img.height} pixels!`);
      };
      img.src = resultUrl;
    };
    reader.readAsDataURL(file);
  };

  const handlePixelClick = (index: number) => {
    setArtDraft((prev) => {
      const nextPixels = [...prev.canvasPixels];
      nextPixels[index] = activeColor;
      return { ...prev, canvasPixels: nextPixels };
    });
  };

  const clearPixelCanvas = () => {
    setArtDraft((prev) => ({
      ...prev,
      canvasPixels: new Array(256).fill("#00000000"),
    }));
    showFlash("Canvas cleared");
  };

  const bakeCanvasToImage = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, 16, 16);
    artDraft.canvasPixels.forEach((color, i) => {
      if (color !== "#00000000") {
        ctx.fillStyle = color;
        const x = i % 16;
        const y = Math.floor(i / 16);
        ctx.fillRect(x, y, 1, 1);
      }
    });

    const dataUrl = canvas.toDataURL("image/png");
    setArtDraft((prev) => ({
      ...prev,
      imageDataUrl: dataUrl,
      imageDimensions: { width: 16, height: 16 },
    }));
    showFlash("Canvas baked to 16×16 sprite preview!");
  };

  const generateArtPrMarkdown = () => {
    const md = [
      `# Community Asset Submission: ${artDraft.title || "Untitled Sprite"}`,
      `**Creator / Handle:** ${artDraft.creator || "Anonymous Contributor"}`,
      `**Category:** ${artDraft.category}`,
      `**Target Path in Repo:** \`${artDraft.targetFolder}${artDraft.title.toLowerCase().replace(/[^a-z0-9]/g, "_") || "asset"}.png\``,
      `**Declared License:** ${artDraft.license}`,
      artDraft.imageDimensions
        ? `**Sprite Dimensions:** ${artDraft.imageDimensions.width}×${artDraft.imageDimensions.height} px`
        : "**Dimensions:** 16×16 px",
      "",
      "## Description & In-Game Context",
      artDraft.description || "Custom sprite contributed via mel.bluesix.dev Community Portal.",
      "",
      "## Integration Checklist for Maintainers",
      "- [ ] Sprite placed in designated `res/` folder.",
      "- [ ] Registered in `tools/make_assets.py` atlas generator if packed into main texture.",
      "- [ ] Item/entity definition added to `src/meta/Content.cpp`.",
      "- [ ] Clean Release build & `build/bin/MellanganApp.exe --test` pass verification.",
    ].join("\n");

    copyToClipboard(md, "art_pr_copy");
    showFlash("Asset submission manifest copied to clipboard!");
  };

  const generatedCommandLine = useMemo(() => {
    const parts = ["MellanganApp.exe"];
    if (launcherFlags.devMode) parts.push("--dev");
    if (launcherFlags.benchGate) parts.push("--bench-gate");
    if (launcherFlags.seed) parts.push(`--seed ${launcherFlags.seed}`);
    if (launcherFlags.hero) parts.push(`--hero ${launcherFlags.hero}`);
    if (launcherFlags.giveLevel > 0) parts.push(`--give ${launcherFlags.giveLevel}`);
    if (launcherFlags.warpBiome) parts.push(`--warp ${launcherFlags.warpBiome}`);
    if (launcherFlags.godMode) parts.push("--god");
    return parts.join(" ");
  }, [launcherFlags]);

  const telemetryDiagnostics = useMemo(() => {
    const log = telemetryLog;
    const items: { label: string; value: string; status: "good" | "warn" | "info"; link?: string }[] = [];

    const versionMatch = log.match(/v\d+\.\d+\.\d+/);
    if (versionMatch) {
      items.push({ label: "Engine Version", value: versionMatch[0], status: "good" });
    }

    if (/vulkan/i.test(log)) {
      items.push({
        label: "Renderer",
        value: "Vulkan 1.2 Core",
        status: "good",
        link: "renderer-in-context",
      });
    }

    if (/slab/i.test(log)) {
      items.push({
        label: "Memory Allocator",
        value: "Slab Pool Active (Pool.c)",
        status: "good",
        link: "memory-slab",
      });
    }

    const fpsMatch = log.match(/(\d+)\s*fps/i);
    if (fpsMatch) {
      const fps = parseInt(fpsMatch[1], 10);
      items.push({
        label: "Frame Rate",
        value: `${fps} FPS`,
        status: fps >= 55 ? "good" : "warn",
        link: "overview",
      });
    }

    const seedMatch = log.match(/seed[:\s]+(0x[0-9a-fA-F]+|\d+)/i);
    if (seedMatch) {
      items.push({ label: "World Seed", value: seedMatch[1], status: "info" });
    }

    return items;
  }, [telemetryLog]);

  return (
    <section
      aria-labelledby="portal-hub-title"
      className="my-8 rounded-2xl border border-dark-800 bg-dark-950 p-4 sm:p-6 shadow-2xl space-y-6"
    >
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-dark-850 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-gold-500/15 border border-gold-500/30 text-gold-300 font-mono text-xs uppercase tracking-wider font-semibold">
              Community Hub & Dispatch Bridge
            </span>

            {/* Real-Time Bridge Status Pill */}
            {bridgeStatus === "connected" ? (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center gap-1.5 shadow-sm">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Live Bridge Connected · gh: {ghUser}</span>
                {lastSyncTime && <span className="text-slate-400 text-[10px]">({lastSyncTime})</span>}
              </span>
            ) : bridgeStatus === "connecting" ? (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-mono flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                <span>Connecting to local bridge...</span>
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-slate-500"></span>
                <span>Bridge Offline (SessionStorage Mode)</span>
              </span>
            )}
          </div>

          <h2 id="portal-hub-title" className="text-xl sm:text-2xl font-bold text-slate-100 mt-2 flex items-center gap-2">
            <Compass className="w-6 h-6 text-gold-400" />
            <span>Mellangan Plan, TODO & Community Portal</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            Live real-time CRUD interface connecting the web with <code className="text-slate-300 bg-dark-900 px-1 py-0.5 rounded">TODO.md</code> and the private <code className="text-slate-300 bg-dark-900 px-1 py-0.5 rounded">soulwax/mellangan-notes</code> repository.
            Vote in open design polls, promote RFCs into real tasks, inspect living dispatch queues, and submit pixel art.
          </p>
        </div>

        {/* Global Actions */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
          {statusMessage && (
            <div className="text-xs font-medium text-emerald-300 bg-emerald-950/70 border border-emerald-700/60 px-3 py-1.5 rounded-lg animate-fade-in flex items-center gap-1.5 shadow">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>{statusMessage}</span>
            </div>
          )}

          {bridgeStatus === "connected" && (
            <button
              onClick={() => handleGitSync("pull")}
              title="Git pull latest changes from private notes repo"
              className="px-3 py-1.5 rounded-lg bg-dark-900 hover:bg-dark-850 border border-dark-750 text-xs text-gold-300 hover:text-gold-200 transition-colors flex items-center gap-1.5 font-mono"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Pull Repo</span>
            </button>
          )}

          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                window.sessionStorage.clear();
                setPollResponses({});
                setUpvotedTasks({});
                showFlash("SessionStorage cleared to defaults!");
              }
            }}
            title="Reset locally stored poll answers and drafts"
            className="px-3 py-1.5 rounded-lg bg-dark-900 hover:bg-dark-850 border border-dark-750 text-xs text-slate-400 hover:text-rose-300 transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-dark-800 pb-3">
        <button
          onClick={() => setActiveTab("roadmap")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            activeTab === "roadmap"
              ? "bg-gold-500 text-dark-950 font-bold shadow-lg shadow-gold-500/20"
              : "bg-dark-900 text-slate-300 hover:bg-dark-850 hover:text-gold-300 border border-dark-800"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Real-Time Plan & Living TODO</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-mono ${
              activeTab === "roadmap" ? "bg-dark-950 text-gold-300" : "bg-dark-800 text-slate-400"
            }`}
          >
            {liveWorkspaceTasks.length + (liveNotesCards.length > 0 ? ` / ${liveNotesCards.length}` : "")}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("poll")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            activeTab === "poll"
              ? "bg-gold-500 text-dark-950 font-bold shadow-lg shadow-gold-500/20"
              : "bg-dark-900 text-slate-300 hover:bg-dark-850 hover:text-gold-300 border border-dark-800"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Open Design Polls & RFCs</span>
          <span
            className={`text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === "poll" ? "bg-dark-950 text-gold-300" : "bg-dark-800 text-slate-400"
            }`}
          >
            {Object.keys(pollResponses).length}/{DEFAULT_POLL_QUESTIONS.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("art")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            activeTab === "art"
              ? "bg-gold-500 text-dark-950 font-bold shadow-lg shadow-gold-500/20"
              : "bg-dark-900 text-slate-300 hover:bg-dark-850 hover:text-gold-300 border border-dark-800"
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>Submit Artwork & Pixel Studio</span>
          {artDraft.imageDataUrl && <span className="w-2 h-2 rounded-full bg-emerald-400"></span>}
        </button>

        <button
          onClick={() => setActiveTab("bridge")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            activeTab === "bridge"
              ? "bg-gold-500 text-dark-950 font-bold shadow-lg shadow-gold-500/20"
              : "bg-dark-900 text-slate-300 hover:bg-dark-850 hover:text-gold-300 border border-dark-800"
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>Engine Telemetry & Launcher</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: REAL-TIME PLAN & LIVING TODO (CRUD & BRIDGE)            */}
      {/* ============================================================== */}
      {activeTab === "roadmap" && (
        <div className="space-y-6">
          {/* Sub-view switcher & Action bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-dark-900/70 p-4 rounded-xl border border-dark-800">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">View Source:</span>
              <button
                onClick={() => setRoadmapViewMode("workspace")}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-1.5 ${
                  roadmapViewMode === "workspace"
                    ? "bg-gold-500 text-dark-950 font-bold shadow-md shadow-gold-500/20"
                    : "bg-dark-950 text-slate-300 hover:text-gold-300 border border-dark-800"
                }`}
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>Workspace TODO.md ({liveWorkspaceTasks.length})</span>
              </button>

              <button
                onClick={() => setRoadmapViewMode("notes-queue")}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-1.5 ${
                  roadmapViewMode === "notes-queue"
                    ? "bg-gold-500 text-dark-950 font-bold shadow-md shadow-gold-500/20"
                    : "bg-dark-950 text-slate-300 hover:text-gold-300 border border-dark-800"
                }`}
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>Notes Dispatch Queue ({liveNotesCards.length})</span>
              </button>

              <button
                onClick={() => setRoadmapViewMode("raw")}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-1.5 ${
                  roadmapViewMode === "raw"
                    ? "bg-gold-500 text-dark-950 font-bold"
                    : "bg-dark-950 text-slate-300 hover:text-gold-300 border border-dark-800"
                }`}
              >
                <FileCode2 className="w-3.5 h-3.5" />
                <span>Raw Markdown</span>
              </button>
            </div>

            {/* Create Task & Git Push Button */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsNewTaskModalOpen(true)}
                className="px-3.5 py-1.5 rounded-lg bg-gold-500 hover:bg-gold-400 text-dark-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-gold-500/10"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Add Task Card</span>
              </button>

              {bridgeStatus === "connected" && (
                <button
                  onClick={() => handleGitSync("push")}
                  title="Commit changes and push to soulwax/mellangan-notes via gh"
                  className="px-3 py-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 text-xs font-mono flex items-center gap-1.5 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Push to GitHub</span>
                </button>
              )}
            </div>
          </div>

          {/* New Task Creation Modal */}
          {isNewTaskModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-dark-950/80 backdrop-blur-sm animate-fade-in">
              <div className="bg-dark-900 border border-dark-750 rounded-2xl max-w-xl w-full p-5 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between border-b border-dark-800 pb-3">
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-gold-400" />
                    <span>Create New Task / Dispatch Card</span>
                  </h3>
                  <button
                    onClick={() => setIsNewTaskModalOpen(false)}
                    className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 rounded bg-dark-950"
                  >
                    ✕ Close
                  </button>
                </div>

                <form onSubmit={handleCreateTaskSubmit} className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-300 font-medium">Task Title
                      <input
                        type="text"
                        required
                        placeholder="e.g. Show the granted attack on unique weapon tooltips"
                        value={newTaskForm.title}
                        onChange={(e) => setNewTaskForm({ ...newTaskForm, title: e.target.value })}
                        className="mt-1 block w-full rounded-lg bg-dark-950 border border-dark-800 px-3 py-2 text-slate-200 text-xs focus:border-gold-500 focus:outline-none"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-slate-300 font-medium">Target File / Owns
                        <input
                          type="text"
                          required
                          placeholder="e.g. src/gui/Tooltip.cpp"
                          value={newTaskForm.file}
                          onChange={(e) => setNewTaskForm({ ...newTaskForm, file: e.target.value })}
                          className="mt-1 block w-full rounded-lg bg-dark-950 border border-dark-800 px-3 py-2 text-slate-200 text-xs font-mono focus:border-gold-500 focus:outline-none"
                        />
                      </label>
                    </div>

                    <div>
                      <label className="text-slate-300 font-medium">Lane
                        <select
                          value={newTaskForm.lane}
                          onChange={(e) =>
                            setNewTaskForm({
                              ...newTaskForm,
                              lane: e.target.value as "Build" | "Desk" | "Screen" | "Ship",
                            })
                          }
                          className="mt-1 block w-full rounded-lg bg-dark-950 border border-dark-800 px-3 py-2 text-slate-200 text-xs focus:border-gold-500 focus:outline-none"
                        >
                          <option>Build</option>
                          <option>Desk</option>
                          <option>Screen</option>
                          <option>Ship</option>
                        </select>
                      </label>
                    </div>

                    <div>
                      <label className="text-slate-300 font-medium">Size Class
                        <select
                          value={newTaskForm.size}
                          onChange={(e) =>
                            setNewTaskForm({
                              ...newTaskForm,
                              size: e.target.value as "XS" | "S" | "M" | "L",
                            })
                          }
                          className="mt-1 block w-full rounded-lg bg-dark-950 border border-dark-800 px-3 py-2 text-slate-200 text-xs focus:border-gold-500 focus:outline-none"
                        >
                          <option>XS</option>
                          <option>S</option>
                          <option>M</option>
                          <option>L</option>
                        </select>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-300 font-medium">Goal / Description
                      <textarea
                        rows={2}
                        placeholder="One or two sentences: the player-visible result."
                        value={newTaskForm.body}
                        onChange={(e) => setNewTaskForm({ ...newTaskForm, body: e.target.value })}
                        className="mt-1 block w-full rounded-lg bg-dark-950 border border-dark-800 p-2.5 text-slate-200 text-xs focus:border-gold-500 focus:outline-none"
                      />
                    </label>
                  </div>

                  <div>
                    <label className="text-slate-300 font-medium">Done When (Acceptance Criteria)
                      <textarea
                        rows={2}
                        placeholder="Testable assertions; Release build and --test pass."
                        value={newTaskForm.acceptance}
                        onChange={(e) => setNewTaskForm({ ...newTaskForm, acceptance: e.target.value })}
                        className="mt-1 block w-full rounded-lg bg-dark-950 border border-dark-800 p-2.5 text-slate-200 text-xs focus:border-gold-500 focus:outline-none"
                      />
                    </label>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-dark-800">
                    <button
                      type="button"
                      onClick={() => setIsNewTaskModalOpen(false)}
                      className="px-3.5 py-1.5 rounded-lg bg-dark-950 border border-dark-800 text-slate-400 hover:text-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-gold-500 hover:bg-gold-400 text-dark-950 font-bold transition-colors"
                    >
                      Save & Append to TODO.md
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Raw Markdown View */}
          {roadmapViewMode === "raw" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Displaying raw markdown from {roadmapViewMode === "raw" ? "Workspace TODO.md" : "Notes repo"}</span>
                <button
                  onClick={() => copyToClipboard(rawWorkspaceMd, "raw_md_copy")}
                  className="px-2.5 py-1 rounded bg-dark-900 border border-dark-800 text-gold-300 flex items-center gap-1 font-mono"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy Markdown</span>
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-dark-900 border border-dark-800 font-mono text-xs text-slate-300 overflow-x-auto max-h-[500px] leading-relaxed select-text">
                {rawWorkspaceMd || "# Workspace TODO.md is empty"}
              </pre>
            </div>
          ) : (
            <>
              {/* Filter & Search Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dark-800 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-400 font-medium">Lane:</span>
                  {["All", "Build", "Desk", "Screen", "Ship"].map((lane) => (
                    <button
                      key={lane}
                      onClick={() => setTaskLaneFilter(lane)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-colors ${
                        taskLaneFilter === lane
                          ? "bg-gold-500 text-dark-950 font-bold"
                          : "bg-dark-900 text-slate-300 hover:bg-dark-850 border border-dark-800"
                      }`}
                    >
                      {lane}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Search tasks, files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-dark-950 border border-dark-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-gold-500/60 w-44 sm:w-56"
                  />
                  <div className="text-xs text-slate-400">
                    <span className="text-gold-400 font-bold">{displayedTasks.length}</span> cards
                  </div>
                </div>
              </div>

              {/* Task Cards Grid */}
              <div className="grid gap-3">
                {displayedTasks.length === 0 ? (
                  <div className="p-8 text-center rounded-xl border border-dashed border-dark-800 bg-dark-900/40 text-slate-400 text-sm">
                    No matching task cards found for the selected filter.
                  </div>
                ) : (
                  displayedTasks.map((task) => {
                    const isUpvoted = !!upvotedTasks[task.id];

                    return (
                      <div
                        key={task.id}
                        className={`rounded-xl border p-4 transition-all space-y-3 ${
                          task.completed
                            ? "border-emerald-900/60 bg-emerald-950/10 text-slate-400"
                            : "border-dark-800 bg-dark-900/80 hover:border-dark-700"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex items-start gap-3">
                            {/* Real-time Toggle Checkbox */}
                            <button
                              onClick={() => handleToggleTaskStatus(task.id, task.completed)}
                              title={task.completed ? "Mark open [ ]" : "Mark completed [x] (writes to disk in real time)"}
                              className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-all ${
                                task.completed
                                  ? "bg-emerald-500 border-emerald-400 text-dark-950"
                                  : "bg-dark-950 border-dark-700 hover:border-gold-400 text-transparent"
                              }`}
                            >
                              <Check className={`w-3.5 h-3.5 stroke-[3] ${task.completed ? "opacity-100" : "opacity-0"}`} />
                            </button>

                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                                    task.lane === "Build"
                                      ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                      : task.lane === "Desk"
                                      ? "bg-purple-500/15 text-purple-300 border border-purple-500/30"
                                      : task.lane === "Ship"
                                      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                                      : "bg-slate-800 text-slate-400 border border-slate-700"
                                  }`}
                                >
                                  {task.lane}
                                </span>

                                {task.size && (
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-dark-950 border border-dark-800 text-slate-300">
                                    {task.size}
                                  </span>
                                )}

                                {task.file && (
                                  <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                                    <FileCode2 className="w-3 h-3 text-gold-400" />
                                    <span>{task.file}</span>
                                  </span>
                                )}

                                {task.completed && (
                                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800">
                                    DONE [x]
                                  </span>
                                )}
                              </div>

                              <h4
                                className={`text-base font-bold ${
                                  task.completed ? "line-through text-slate-400" : "text-slate-100"
                                }`}
                              >
                                {task.title}
                              </h4>
                            </div>
                          </div>

                          {/* Upvote Button */}
                          <button
                            onClick={() => {
                              setUpvotedTasks((prev) => {
                                const next = !prev[task.id];
                                showFlash(next ? "Prioritized in session!" : "Priority removed");
                                return { ...prev, [task.id]: next };
                              });
                            }}
                            className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-medium flex items-center gap-1.5 transition-all ${
                              isUpvoted
                                ? "bg-gold-500/20 border-gold-500 text-gold-300"
                                : "bg-dark-950 border-dark-800 text-slate-400 hover:border-dark-700 hover:text-slate-200"
                            }`}
                          >
                            <Sparkles className={`w-3.5 h-3.5 ${isUpvoted ? "text-gold-400" : "text-slate-500"}`} />
                            <span>{isUpvoted ? "Prioritized" : "Upvote"}</span>
                          </button>
                        </div>

                        {task.body && (
                          <p className="text-xs text-slate-300 leading-relaxed pl-8">{task.body}</p>
                        )}

                        {task.acceptance && (
                          <div className="ml-8 rounded-lg bg-dark-950/80 border border-dark-850 p-2 text-xs space-y-0.5">
                            <span className="text-gold-400 font-semibold text-[11px]">Done when:</span>
                            <p className="text-slate-300 italic text-[11px]">{task.acceptance}</p>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1 pl-8">
                          <div>
                            Owner: <span className="font-mono text-slate-300">{task.owner}</span>
                          </div>
                          <div>
                            Priority: <span className="text-gold-400 font-semibold">{task.priority}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: OPEN DESIGN POLLS & RFCS (TIED TO TODO TASKS)           */}
      {/* ============================================================== */}
      {activeTab === "poll" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-dark-900/60 p-4 rounded-xl border border-dark-800">
            <div>
              <h3 className="text-base font-bold text-gold-300 flex items-center gap-2">
                <span>Active Community Balance Dilemmas</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Cast your vote on core mechanics. Every RFC is linked directly to a TODO task and engine source file.
                Promote winning consensus options directly into the engineering dispatch queue!
              </p>
            </div>
            <button
              onClick={exportPollResults}
              className="px-3.5 py-2 rounded-lg bg-dark-850 hover:bg-dark-800 border border-gold-500/40 text-gold-300 hover:text-gold-200 text-xs font-medium flex items-center gap-2 transition-all self-start sm:self-auto"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Export RFC Proposal (.md)</span>
            </button>
          </div>

          <div className="grid gap-6">
            {DEFAULT_POLL_QUESTIONS.map((q, qIndex) => {
              const userResp = pollResponses[q.id];
              const totalVotes = q.options.reduce((sum, o) => sum + o.votes, 0) + (userResp?.selectedOptionId ? 1 : 0);

              return (
                <div
                  key={q.id}
                  className="rounded-xl border border-dark-800 bg-dark-900/90 p-5 space-y-4 hover:border-dark-700 transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-dark-800 text-slate-300">
                        RFC #{qIndex + 1}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-dark-800/80 text-gold-400 font-medium">
                        {q.category}
                      </span>
                      {q.linkedFile && (
                        <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded flex items-center gap-1">
                          <FileCode2 className="w-3 h-3" />
                          <span>{q.linkedFile}</span>
                        </span>
                      )}
                    </div>

                    {userResp?.selectedOptionId && (
                      <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Voted</span>
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className="text-lg font-bold text-slate-100">{q.title}</h4>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">{q.context}</p>
                  </div>

                  {/* Options List */}
                  <div className="space-y-2.5 pt-2">
                    {q.options.map((opt) => {
                      const isSelected = userResp?.selectedOptionId === opt.id;
                      const optVoteCount = opt.votes + (isSelected ? 1 : 0);
                      const percentage = Math.round((optVoteCount / totalVotes) * 100);

                      return (
                        <div
                          key={opt.id}
                          className={`group relative overflow-hidden rounded-xl border p-3.5 transition-all ${
                            isSelected
                              ? "border-gold-500 bg-gold-950/20 text-slate-100 ring-1 ring-gold-500/30"
                              : "border-dark-800 bg-dark-950/70 hover:border-dark-700 hover:bg-dark-950 text-slate-200"
                          }`}
                        >
                          <div
                            className={`absolute top-0 bottom-0 left-0 transition-all duration-500 pointer-events-none ${
                              isSelected ? "bg-gold-500/15" : "bg-dark-800/40 group-hover:bg-dark-800/60"
                            }`}
                            style={{ width: `${percentage}%` }}
                          />

                          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div
                              onClick={() => handleVote(q.id, opt.id)}
                              className="flex items-start gap-3 cursor-pointer flex-1"
                            >
                              <div
                                className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center transition-all shrink-0 ${
                                  isSelected
                                    ? "border-gold-400 bg-gold-500 text-dark-950"
                                    : "border-dark-600 bg-dark-900 group-hover:border-gold-400/60"
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <div>
                                <div className="text-sm font-semibold">{opt.text}</div>
                                {opt.description && (
                                  <div className="text-xs text-slate-400 mt-0.5">{opt.description}</div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                              {opt.suggestedAction && (
                                <button
                                  onClick={() => handlePromotePollToTask(q, opt)}
                                  title="Promote this consensus option directly into a TODO dispatch card"
                                  className="px-2.5 py-1 rounded bg-dark-900 hover:bg-gold-500 hover:text-dark-950 border border-dark-750 text-[11px] text-gold-300 font-mono flex items-center gap-1 transition-all"
                                >
                                  <ArrowRight className="w-3 h-3" />
                                  <span>Promote to TODO</span>
                                </button>
                              )}

                              <div className="text-right">
                                <span className="text-sm font-mono font-bold text-gold-400">{percentage}%</span>
                                <div className="text-[10px] text-slate-500 font-mono">{optVoteCount} votes</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Player feedback comment box */}
                  <div className="pt-2 border-t border-dark-850 space-y-1.5">
                    <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-gold-400" />
                      <span>Your Reasoning or Alternative Proposal (saved in sessionStorage):</span>
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Explain your preferred balance nuance or suggest a compromise..."
                      value={userResp?.comment || ""}
                      onChange={(e) => handleCommentChange(q.id, e.target.value)}
                      className="w-full rounded-lg bg-dark-950 border border-dark-800 p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-gold-500/60"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: ARTWORK SUBMISSION & PIXEL STUDIO                       */}
      {/* ============================================================== */}
      {activeTab === "art" && (
        <div className="space-y-6">
          <div className="bg-dark-900/60 p-4 rounded-xl border border-dark-800">
            <h3 className="text-base font-bold text-gold-300 flex items-center gap-2">
              <Palette className="w-4 h-4 text-gold-400" />
              <span>Asset Submission & In-Browser Pixel Studio</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Contribute 16×16 weapons, relics, monster sprites, or biome tiles. Upload an existing sprite file or paint
              directly in the mini canvas below. Generates a PR-ready manifest bundle and saves drafts in sessionStorage.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-4">
              <div className="rounded-xl border border-dark-800 bg-dark-900 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Interactive 16×16 Pixel Canvas
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={clearPixelCanvas}
                      className="px-2 py-1 rounded bg-dark-950 hover:bg-dark-850 border border-dark-800 text-[11px] text-slate-400 hover:text-rose-300 transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear</span>
                    </button>
                    <button
                      onClick={bakeCanvasToImage}
                      className="px-2.5 py-1 rounded bg-gold-500 hover:bg-gold-400 text-dark-950 font-bold text-[11px] transition-colors flex items-center gap-1"
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                      <span>Use as Sprite</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-dark-950 border border-dark-850">
                  <span className="text-[11px] text-slate-400 mr-1">Palette:</span>
                  {MELLANGAN_PALETTE.map((color, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveColor(color)}
                      style={{
                        backgroundColor: color === "#00000000" ? "#1e2229" : color,
                        backgroundImage:
                          color === "#00000000"
                            ? "linear-gradient(45deg, #303640 25%, transparent 25%), linear-gradient(-45deg, #303640 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #303640 75%), linear-gradient(-45deg, transparent 75%, #303640 75%)"
                            : "none",
                        backgroundSize: "6px 6px",
                      }}
                      className={`w-5 h-5 rounded transition-transform ${
                        activeColor === color ? "scale-125 ring-2 ring-gold-400 z-10" : "hover:scale-110"
                      }`}
                      title={color === "#00000000" ? "Eraser / Transparent" : color}
                    />
                  ))}
                </div>

                <div className="flex justify-center p-4 bg-dark-950 rounded-xl border border-dark-850">
                  <div
                    className="grid grid-cols-16 border border-dark-750 bg-dark-900 shadow-xl"
                    style={{
                      width: `${16 * canvasZoom}px`,
                      height: `${16 * canvasZoom}px`,
                      gridTemplateColumns: `repeat(16, ${canvasZoom}px)`,
                      backgroundImage:
                        "linear-gradient(45deg, #252a32 25%, transparent 25%), linear-gradient(-45deg, #252a32 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #252a32 75%), linear-gradient(-45deg, transparent 75%, #252a32 75%)",
                      backgroundSize: "8px 8px",
                    }}
                  >
                    {artDraft.canvasPixels.map((color, idx) => (
                      <div
                        key={idx}
                        onClick={() => handlePixelClick(idx)}
                        style={{
                          backgroundColor: color,
                          width: `${canvasZoom}px`,
                          height: `${canvasZoom}px`,
                        }}
                        className="border border-dark-800/40 hover:border-gold-400 cursor-crosshair transition-colors"
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Zoom: {canvasZoom}px</span>
                  <input
                    type="range"
                    min="8"
                    max="20"
                    step="2"
                    value={canvasZoom}
                    onChange={(e) => setCanvasZoom(Number(e.target.value))}
                    className="accent-gold-500 w-32"
                  />
                </div>

                <div className="pt-2 border-t border-dark-800">
                  <label className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-dark-700 hover:border-gold-500/50 bg-dark-950 cursor-pointer transition-colors">
                    <Upload className="w-5 h-5 text-gold-400 mb-1" />
                    <span className="text-xs font-semibold text-slate-200">Upload existing PNG / WebP Sprite</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Recommended: 16×16, 24×24, 32×32 pixel art</span>
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-xl border border-dark-800 bg-dark-900 p-4 space-y-3.5">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  Asset Details & Submission
                </span>

                {artDraft.imageDataUrl && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-dark-950 border border-dark-800">
                    <div
                      className="w-14 h-14 rounded border border-dark-750 flex items-center justify-center bg-dark-900 overflow-hidden"
                      style={{
                        backgroundImage:
                          "linear-gradient(45deg, #2a2e37 25%, transparent 25%), linear-gradient(-45deg, #2a2e37 25%, transparent 25%)",
                        backgroundSize: "6px 6px",
                      }}
                    >
                      <img
                        src={artDraft.imageDataUrl}
                        alt="Sprite Preview"
                        style={{ imageRendering: "pixelated" }}
                        className="max-w-full max-h-full"
                      />
                    </div>
                    <div className="text-xs space-y-0.5">
                      <div className="font-bold text-gold-300">{artDraft.title || "Untitled Sprite"}</div>
                      <div className="text-slate-400 text-[11px]">
                        {artDraft.imageDimensions
                          ? `${artDraft.imageDimensions.width}×${artDraft.imageDimensions.height} px`
                          : "16×16 px"}
                      </div>
                      <a
                        href={artDraft.imageDataUrl}
                        download={`${artDraft.title.toLowerCase().replace(/[^a-z0-9]/g, "_") || "sprite"}.png`}
                        className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1 font-mono"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download PNG</span>
                      </a>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs text-slate-300">Creator Name / Discord Handle
                    <input
                      type="text"
                      placeholder="e.g. soulwax#1234 or your GitHub"
                      value={artDraft.creator}
                      onChange={(e) => setArtDraft({ ...artDraft, creator: e.target.value })}
                      className="mt-1 block w-full rounded-lg bg-dark-950 border border-dark-800 px-3 py-1.5 text-xs text-slate-200"
                    />
                  </label>

                  <label className="text-xs text-slate-300">Asset Title
                    <input
                      type="text"
                      placeholder="e.g. Cinder Pike or Hearth Broth"
                      value={artDraft.title}
                      onChange={(e) => setArtDraft({ ...artDraft, title: e.target.value })}
                      className="mt-1 block w-full rounded-lg bg-dark-950 border border-dark-800 px-3 py-1.5 text-xs text-slate-200"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-slate-300">Category
                      <select
                        value={artDraft.category}
                        onChange={(e) =>
                          setArtDraft({
                            ...artDraft,
                            category: e.target.value as ArtSubmissionDraft["category"],
                          })
                        }
                        className="mt-1 block w-full rounded-lg bg-dark-950 border border-dark-800 px-2 py-1.5 text-xs text-slate-200"
                      >
                        <option>Weapon Sprite (16x16)</option>
                        <option>Monster / Foe</option>
                        <option>Biome Tile / Doodad</option>
                        <option>Relic / Charm</option>
                        <option>Hero Portrait</option>
                        <option>Concept Art</option>
                      </select>
                    </label>

                    <label className="text-xs text-slate-300">License
                      <select
                        value={artDraft.license}
                        onChange={(e) =>
                          setArtDraft({
                            ...artDraft,
                            license: e.target.value as ArtSubmissionDraft["license"],
                          })
                        }
                        className="mt-1 block w-full rounded-lg bg-dark-950 border border-dark-800 px-2 py-1.5 text-xs text-slate-200"
                      >
                        <option>Zlib (Default)</option>
                        <option>CC0 / Public Domain</option>
                        <option>MIT</option>
                      </select>
                    </label>
                  </div>

                  <label className="text-xs text-slate-300">Lore & Intended In-Game Function
                    <textarea
                      rows={2}
                      placeholder="Describe which biome, weapon grant, or enemy this sprite is intended for..."
                      value={artDraft.description}
                      onChange={(e) => setArtDraft({ ...artDraft, description: e.target.value })}
                      className="mt-1 block w-full rounded-lg bg-dark-950 border border-dark-800 p-2 text-xs text-slate-200"
                    />
                  </label>
                </div>

                <button
                  onClick={generateArtPrMarkdown}
                  className="w-full py-2.5 rounded-xl bg-gold-500 hover:bg-gold-400 text-dark-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-gold-500/10"
                >
                  <Send className="w-4 h-4" />
                  <span>Generate PR Submission Markdown</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: GAME & TELEMETRY BRIDGE                                 */}
      {/* ============================================================== */}
      {activeTab === "bridge" && (
        <div className="space-y-6">
          <div className="bg-dark-900/60 p-4 rounded-xl border border-dark-800">
            <h3 className="text-base font-bold text-gold-300 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-gold-400" />
              <span>Engine Telemetry & Command Line Bridge</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Direct connection between your local game executable and wiki documentation. Configure development flags,
              analyze runtime logs, and inspect engine hotkeys.
            </p>
          </div>

          <div className="rounded-xl border border-dark-800 bg-dark-900 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-gold-400" />
                <span>Launch Flag Builder</span>
              </span>
              <button
                onClick={() => copyToClipboard(generatedCommandLine, "cli_copy")}
                className="px-2.5 py-1 rounded bg-dark-950 hover:bg-dark-850 border border-dark-800 text-xs text-gold-300 flex items-center gap-1 font-mono"
              >
                {copiedId === "cli_copy" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy Command</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <label className="flex items-center gap-2 p-2 rounded-lg bg-dark-950 border border-dark-850 cursor-pointer">
                <input
                  type="checkbox"
                  checked={launcherFlags.devMode}
                  onChange={(e) => setLauncherFlags({ ...launcherFlags, devMode: e.target.checked })}
                  className="accent-gold-500"
                />
                <span className="text-slate-200 font-mono">--dev</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg bg-dark-950 border border-dark-850 cursor-pointer">
                <input
                  type="checkbox"
                  checked={launcherFlags.benchGate}
                  onChange={(e) => setLauncherFlags({ ...launcherFlags, benchGate: e.target.checked })}
                  className="accent-gold-500"
                />
                <span className="text-slate-200 font-mono">--bench-gate</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg bg-dark-950 border border-dark-850 cursor-pointer">
                <input
                  type="checkbox"
                  checked={launcherFlags.godMode}
                  onChange={(e) => setLauncherFlags({ ...launcherFlags, godMode: e.target.checked })}
                  className="accent-gold-500"
                />
                <span className="text-slate-200 font-mono">--god</span>
              </label>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 text-xs">Warp Biome:</span>
                <select
                  value={launcherFlags.warpBiome}
                  onChange={(e) => setLauncherFlags({ ...launcherFlags, warpBiome: e.target.value })}
                  className="bg-dark-950 border border-dark-850 rounded px-2 py-1 text-xs text-slate-200"
                >
                  <option value="mire">Mire</option>
                  <option value="dread">Dread</option>
                  <option value="caves">Caves</option>
                  <option value="sundark">Sundark</option>
                  <option value="grove">Grove</option>
                </select>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-dark-950 border border-dark-800 font-mono text-xs text-gold-400 break-all select-all">
              $ ./{generatedCommandLine}
            </div>
          </div>

          <div className="rounded-xl border border-dark-800 bg-dark-900 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-gold-400" />
                <span>Mellangan.log Live Diagnostic Parser</span>
              </span>
              <span className="text-[11px] text-slate-400">Paste terminal output or mellangan.log</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {telemetryDiagnostics.map((diag, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-950 border border-dark-800 text-xs"
                >
                  <span className="text-slate-400">{diag.label}:</span>
                  <span className="font-bold text-slate-200">{diag.value}</span>
                  {diag.link && (
                    <a
                      href={`/${diag.link}`}
                      className="text-gold-400 hover:underline flex items-center gap-0.5 text-[11px]"
                    >
                      <span>Wiki</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>

            <textarea
              rows={4}
              value={telemetryLog}
              onChange={(e) => setTelemetryLog(e.target.value)}
              className="w-full rounded-lg bg-dark-950 border border-dark-800 p-3 font-mono text-xs text-slate-300 focus:outline-none focus:border-gold-500/60"
            />
          </div>

          <div className="rounded-xl border border-dark-800 bg-dark-900 p-4 space-y-3">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider block">
              In-Engine Diagnostic Hotkeys
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2 rounded bg-dark-950 border border-dark-850">
                <kbd className="px-1.5 py-0.5 rounded bg-dark-800 text-gold-300 font-mono font-bold mr-1.5">F3</kbd>
                <span className="text-slate-300">Hardware Telemetry (Prof.c)</span>
              </div>
              <div className="p-2 rounded bg-dark-950 border border-dark-850">
                <kbd className="px-1.5 py-0.5 rounded bg-dark-800 text-gold-300 font-mono font-bold mr-1.5">F8</kbd>
                <span className="text-slate-300">WorldDebug Inspector</span>
              </div>
              <div className="p-2 rounded bg-dark-950 border border-dark-850">
                <kbd className="px-1.5 py-0.5 rounded bg-dark-800 text-gold-300 font-mono font-bold mr-1.5">2</kbd>
                <span className="text-slate-300">Stow Weapons (Pacifist)</span>
              </div>
              <div className="p-2 rounded bg-dark-950 border border-dark-850">
                <kbd className="px-1.5 py-0.5 rounded bg-dark-800 text-gold-300 font-mono font-bold mr-1.5">5-8</kbd>
                <span className="text-slate-300">Cast D20 Arts Spells</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
