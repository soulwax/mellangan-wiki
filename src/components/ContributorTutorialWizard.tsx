import React, { useState, useMemo } from "react";
import {
  Terminal,
  CheckCircle2,
  Circle,
  Grid,
  Wrench,
  ShieldCheck,
  Sparkles,
  Copy,
  Check,
} from "lucide-react";

interface TutorialStep {
  id: number;
  level: "Basics" | "Workflow" | "Assets" | "Code" | "Verification";
  title: string;
  summary: string;
  commands: string[];
  rules: string[];
  files: string[];
}

const STEPS: TutorialStep[] = [
  {
    id: 1,
    level: "Basics",
    title: "Step 1: Clone with Submodules & Configure Toolchain",
    summary:
      "Mellangan uses CMake 3.21+, a C++20 / C11 compiler (MSVC, Clang, or GCC), and the LunarG Vulkan SDK (which provides slangc for offline SPIR-V shader compilation). SDL3, EnTT, spdlog, stb, and Vulkan2D are vendored as Git submodules.",
    commands: [
      "git clone --recurse-submodules https://github.com/soulwax/Mellangan.git",
      "cd Mellangan && git submodule update --init --recursive",
      "cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug",
      "cmake --build build --config Debug --parallel",
    ],
    rules: [
      "CMake automatically locates C:/VulkanSDK/* on Windows if VULKAN_SDK is unset.",
      "Shaders in res/shaders/*.slang are compiled at build time into SPIR-V (.spv) via slangc.",
      "Treat extern/entt, extern/spdlog, and extern/stb as strictly read-only submodules.",
    ],
    files: ["CMakeLists.txt", ".gitmodules", "src/pch.hpp"],
  },
  {
    id: 2,
    level: "Basics",
    title: "Step 2: House Rules & Coding Style Contract",
    summary:
      'Before touching any source file, internalize Mellangan’s strict house rules from NOTES.md. The codebase follows a compact, pragmatic "C with classes" style inspired by classic Quake and Minecraft internals.',
    commands: [
      "./build/bin/Debug/MellanganApp.exe --test",
      "./build/bin/Debug/MellanganApp.exe --dev",
    ],
    rules: [
      "NO CODE COMMENTS: Never add // or /* */ comments in .cpp, .hpp, .c, or .h files. Document design in NOTES.md, README.md, or CHANGELOG.md.",
      "C-with-Classes Directness: Prefer flat structs, fixed arrays, and direct control flow over deep inheritance or std::function indirections.",
      "Save & Codex Compatibility: Always APPEND new enum values (EnemyKind, BiomeId, HeroId) at the end. Never renumber existing entries.",
      "Keep CHANGELOG.md -> Unreleased updated with every user-facing or architectural change.",
    ],
    files: ["NOTES.md", "CHANGELOG.md", "README.md"],
  },
  {
    id: 3,
    level: "Workflow",
    title: "Step 3: Master the --dev Sandbox & Hotkeys",
    summary:
      "You never need to grind a 15-minute run just to test a late-game weapon evolution, structure, or biome transition. Pass --dev and startup warp flags on the command line to jump directly into your test scenario.",
    commands: [
      './build/bin/Debug/MellanganApp.exe --dev --arm "Ember Lance!,Lionheart Cleave"',
      "./build/bin/Debug/MellanganApp.exe --dev --biome 12 --cliff",
      "./build/bin/Debug/MellanganApp.exe --dev --landmark 2",
    ],
    rules: [
      "F5: Trigger immediate Level-Up card selection.",
      "F6: Advance the diurnal Night clock by +30 seconds.",
      "F7: Toggle God Mode (invulnerability for testing boss patterns).",
      "F8: Toggle World Debug overlay (chunk coords, biome weights, FPS/Prof.c timings).",
      "F9: Teleport to the nearest generated world Structure / Shrine.",
      "F10: Cycle to the next atmospheric Weather Front (Rain, Snow, Storm, Sand).",
    ],
    files: ["src/main.cpp", "src/DevStart.hpp", "src/DevStart.cpp"],
  },
  {
    id: 4,
    level: "Assets",
    title: "Step 4: The 16×16 Pixel Art & Atlas Contract",
    summary:
      "Every sprite in Mellangan is strictly 16×16 pixels packed into an 18×18 cell (with a 1-pixel transparent gutter on all four sides) inside res/atlas.png (432×786, 24 columns per row). Asset generation is 100% deterministic via Python scripts.",
    commands: [
      "python tools/make_assets.py --verify",
      "python tools/make_expansion.py --preview build/atlas_preview.png",
    ],
    rules: [
      "Every gameplay sprite must be 16x16 at 1x native scale with nearest-neighbor sampling.",
      "Reserve cell coordinates in tools/atlas_layout.py and expose constexpr Sprite accessors in src/Atlas.hpp.",
      "Run python tools/make_assets.py --verify to confirm two consecutive runs produce byte-identical RGBA and PNG hashes.",
    ],
    files: [
      "src/Atlas.hpp",
      "tools/atlas_layout.py",
      "tools/make_assets.py",
      "tools/sprite_kit.py",
    ],
  },
  {
    id: 5,
    level: "Code",
    title: "Step 5: Adding Content (Weapons, Enemies, or Biomes)",
    summary:
      "Keep each change focused on its responsible module. New weapons can be added as a single data-driven row in RECIPES (Recipe.cpp) or as a dedicated Upgrade subclass. New enemies combine an EnemyKind entry, a static Plan in Plans.cpp, and an Enemy Type definition.",
    commands: [
      './build/bin/Debug/MellanganApp.exe --test-arsenal-view "Ember Lance"',
      "./build/bin/Debug/MellanganApp.exe --test-combat-view",
      "./build/bin/Debug/MellanganApp.exe --test-biome-view -220 -192 0",
    ],
    rules: [
      "All SpriteObject subclasses automatically use Pool.c via inherited operator new / sized operator delete.",
      "New enemies must be appended at the end of EnemyKind so classic progression and Codex slain indices remain intact.",
      "Monster audio cues must route through Enemy::voice (on-screen only) with a cooldown gap in Sound.cpp to prevent crowd comb-filtering.",
    ],
    files: [
      "src/item/weapon/Recipe.cpp",
      "src/entity/enemy/ai/Plans.cpp",
      "src/level/biome/Biome.cpp",
    ],
  },
  {
    id: 6,
    level: "Verification",
    title: "Step 6: Deterministic Tests, Visual QA & Benchmarks",
    summary:
      '"It compiles" is never a completion gate. Every contribution must pass the Debug assertion test suite (--test), visual QA inspection views, and the --bench frame-time harness before landing.',
    commands: [
      "./build/bin/Debug/MellanganApp.exe --test",
      "./build/bin/Debug/MellanganApp.exe --capture-screenshots",
      "./build/bin/Release/MellanganApp.exe --bench",
    ],
    rules: [
      "Always run --test in Debug mode so C/C++ assert() invariants are active.",
      "Use --test-gui-view, --test-effects-view, and --test-encounter-view to verify visual readability at 1x scale.",
      "Verify --bench does not regress CPU tick or render timings by more than 10%.",
    ],
    files: ["src/test/Test.cpp", "src/test/view/QaViews.cpp", "src/Bench.cpp"],
  },
];

const BIOME_LIST = [
  "0: Meadow",
  "1: Forest",
  "2: Desert",
  "3: Snow",
  "4: Mire",
  "5: Ashlands",
  "6: Heath",
  "7: Taiga",
  "8: Barrow",
  "9: Jungle",
  "10: Autumn",
  "11: Blossom",
  "12: CrystalFields",
  "13: FungalWood",
  "14: Badlands",
  "15: Savanna",
  "16: SaltFlats",
  "17: Floodplain",
  "18: MoonlitGrove",
  "19: SunkenRuins",
  "20: EmberFen",
  "21: AmberWoods",
  "22: StormSteppe",
  "23: GlassDesert",
  "24: HollowCaverns",
  "25: StarfallBasin",
];

export const ContributorTutorialWizard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"steps" | "cli" | "atlas">(
    "steps",
  );
  const [selectedStep, setSelectedStep] = useState<number>(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([1]);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const [cliMode, setCliMode] = useState<
    "dev" | "test" | "bench" | "biomeView" | "arsenalView"
  >("dev");
  const [armWeapon, setArmWeapon] = useState<string>("Ember Lance!");
  const [biomeId, setBiomeId] = useState<number>(12);
  const [spawnFeature, setSpawnFeature] = useState<string>("--cliff");
  const [giveLootCount, setGiveLootCount] = useState<number>(8);
  const [allyCount, setAllyCount] = useState<number>(4);
  const [viewX, setViewX] = useState<number>(-220);
  const [viewY, setViewY] = useState<number>(-192);
  const [viewSeed, setViewSeed] = useState<number>(0);

  const [atlasCol, setAtlasCol] = useState<number>(14);
  const [atlasRow, setAtlasRow] = useState<number>(34);
  const [isTallTree, setIsTallTree] = useState<boolean>(false);

  const toggleComplete = (id: number) => {
    setCompletedSteps((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const copyText = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedCmd(text);
    setTimeout(() => setCopiedCmd(null), 1500);
  };

  const generatedCommand = useMemo(() => {
    const exe = "./build/bin/Debug/MellanganApp.exe";
    if (cliMode === "test") return `${exe} --test`;
    if (cliMode === "bench") return `${exe} --bench`;
    if (cliMode === "biomeView")
      return `${exe} --test-biome-view ${viewX} ${viewY} ${viewSeed}`;
    if (cliMode === "arsenalView")
      return `${exe} --test-arsenal-view "${armWeapon.replace("!", "")}"`;
    const parts = [exe, "--dev"];
    if (armWeapon.trim()) parts.push(`--arm "${armWeapon.trim()}"`);
    parts.push(`--biome ${biomeId}`);
    if (spawnFeature !== "none") parts.push(spawnFeature);
    if (giveLootCount > 0) parts.push(`--give ${giveLootCount} --loot`);
    if (allyCount > 0) parts.push(`--allies ${allyCount}`);
    return parts.join(" ");
  }, [cliMode, armWeapon, biomeId, spawnFeature, giveLootCount, allyCount, viewX, viewY, viewSeed]);

  const atlasPixelX = atlasCol * 18 + 1;
  const atlasPixelY = atlasRow * 18 + 1;
  const atlasHeight = isTallTree ? 34 : 16;
  const linearCellIndex = atlasRow * 24 + atlasCol;

  const currentStep = STEPS[selectedStep];

  return (
    <div className="my-6 rounded-xl border border-dark-700 bg-dark-900/90 p-5 shadow-xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-dark-750 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-gold-400" />
            <h4 className="text-sm font-bold uppercase tracking-wider text-gold-400 font-mono">
              Interactive Contributor Workbench &amp; Onboarding Guide
            </h4>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Step-by-step walkthrough,{" "}
            <code className="text-gold-300">--dev</code> CLI flag synthesizer,
            and <code className="text-gold-300">18×18</code> Atlas cell
            calculator
          </p>
        </div>

        <div className="flex items-center gap-1.5 font-mono text-xs">
          <button
            onClick={() => setActiveTab("steps")}
            className={`px-3 py-1.5 rounded-lg border transition-colors ${
              activeTab === "steps"
                ? "bg-gold-500/20 border-gold-500/60 text-gold-300 font-bold"
                : "bg-dark-950 border-dark-750 text-slate-400 hover:text-slate-200"
            }`}
          >
            1. Step-by-Step Guide ({completedSteps.length}/{STEPS.length})
          </button>
          <button
            onClick={() => setActiveTab("cli")}
            className={`px-3 py-1.5 rounded-lg border transition-colors ${
              activeTab === "cli"
                ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-300 font-bold"
                : "bg-dark-950 border-dark-750 text-slate-400 hover:text-slate-200"
            }`}
          >
            2. CLI Command Builder
          </button>
          <button
            onClick={() => setActiveTab("atlas")}
            className={`px-3 py-1.5 rounded-lg border transition-colors ${
              activeTab === "atlas"
                ? "bg-purple-500/20 border-purple-500/60 text-purple-300 font-bold"
                : "bg-dark-950 border-dark-750 text-slate-400 hover:text-slate-200"
            }`}
          >
            3. Atlas Cell Calculator
          </button>
        </div>
      </div>

      {activeTab === "steps" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-2">
            {STEPS.map((s, idx) => {
              const isSelected = idx === selectedStep;
              const isDone = completedSteps.includes(s.id);
              return (
                <div
                  key={s.id}
                  onClick={() => setSelectedStep(idx)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                    isSelected
                      ? "bg-dark-800 border-gold-500/60 text-slate-100 shadow-md"
                      : "bg-dark-950/70 hover:bg-dark-900 border-dark-800 text-slate-400"
                  }`}
                >
                  <button
                    onClick={(ev) => {
                      ev.stopPropagation();
                      toggleComplete(s.id);
                    }}
                    className="mt-0.5 text-emerald-400 hover:scale-110 transition-transform"
                    title="Mark step complete"
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-600" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-dark-900 text-gold-400 border border-dark-750">
                        {s.level}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        0{s.id}/0{STEPS.length}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-200 mt-1 leading-snug">
                      {s.title}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="lg:col-span-8 p-5 rounded-xl bg-dark-950 border border-dark-800 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dark-800 pb-3">
                <div>
                  <span className="text-[10px] font-mono uppercase text-gold-400 font-bold">
                    Phase {currentStep.id} • {currentStep.level}
                  </span>
                  <h5 className="text-lg font-bold text-white font-display mt-0.5">
                    {currentStep.title}
                  </h5>
                </div>
                <button
                  onClick={() => toggleComplete(currentStep.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono border flex items-center gap-1.5 transition-colors ${
                    completedSteps.includes(currentStep.id)
                      ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                      : "bg-dark-900 border-dark-700 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    {completedSteps.includes(currentStep.id)
                      ? "Completed"
                      : "Mark Complete"}
                  </span>
                </button>
              </div>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {currentStep.summary}
              </p>

              <div className="space-y-2">
                <div className="text-[11px] font-mono uppercase text-slate-400 font-semibold flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Terminal Commands</span>
                </div>
                <div className="space-y-1.5">
                  {currentStep.commands.map((cmd) => (
                    <div
                      key={cmd}
                      className="p-2.5 rounded-lg bg-dark-900 border border-dark-750 font-mono text-xs text-emerald-300 flex items-center justify-between gap-2"
                    >
                      <code className="overflow-x-auto">{cmd}</code>
                      <button
                        onClick={() => copyText(cmd)}
                        className="p-1 rounded bg-dark-800 hover:bg-dark-750 text-slate-300 shrink-0"
                        title="Copy command"
                      >
                        {copiedCmd === cmd ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-mono uppercase text-slate-400 font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-gold-400" />
                  <span>Key Invariants &amp; Checkpoints</span>
                </div>
                <ul className="space-y-1.5 text-xs text-slate-300 font-mono">
                  {currentStep.rules.map((r, i) => (
                    <li
                      key={i}
                      className="p-2 rounded bg-dark-900/60 border border-dark-800 flex items-start gap-2"
                    >
                      <span className="text-gold-400 font-bold">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pt-3 border-t border-dark-800 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-slate-500">Relevant Files:</span>
                {currentStep.files.map((f) => (
                  <span
                    key={f}
                    className="px-2 py-0.5 rounded bg-dark-900 border border-dark-750 text-gold-300"
                  >
                    {f}
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  disabled={selectedStep === 0}
                  onClick={() => setSelectedStep((s) => Math.max(0, s - 1))}
                  className="px-2.5 py-1 rounded bg-dark-850 hover:bg-dark-800 disabled:opacity-40 border border-dark-700 text-slate-300"
                >
                  ← Prev
                </button>
                <button
                  disabled={selectedStep === STEPS.length - 1}
                  onClick={() =>
                    setSelectedStep((s) => Math.min(STEPS.length - 1, s + 1))
                  }
                  className="px-2.5 py-1 rounded bg-gold-500/20 hover:bg-gold-500/30 disabled:opacity-40 border border-gold-500/40 text-gold-300 font-bold"
                >
                  Next Step →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "cli" && (
        <div className="p-5 rounded-xl bg-dark-950 border border-dark-800 space-y-5 font-mono text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dark-800 pb-3">
            <div>
              <div className="text-emerald-400 font-bold uppercase text-[10px]">
                src/main.cpp &amp; src/DevStart.cpp
              </div>
              <h5 className="text-base font-bold text-white mt-0.5">
                Interactive Runtime &amp; Visual QA Command Synthesizer
              </h5>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: "dev", label: "--dev Sandbox" },
                { id: "test", label: "--test Suite" },
                { id: "bench", label: "--bench Profiler" },
                { id: "biomeView", label: "--test-biome-view" },
                { id: "arsenalView", label: "--test-arsenal-view" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setCliMode(m.id as typeof cliMode)}
                  className={`px-2.5 py-1 rounded border ${
                    cliMode === m.id
                      ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold"
                      : "bg-dark-900 border-dark-750 text-slate-400"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {cliMode === "dev" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">
                  --arm &quot;Weapon,Upgrade!&quot; (! = Evolved)
                </label>
                <input
                  type="text"
                  value={armWeapon}
                  onChange={(e) => setArmWeapon(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-1.5 text-slate-200"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">
                  --biome N (0..25)
                </label>
                <select
                  value={biomeId}
                  onChange={(e) => setBiomeId(Number(e.target.value))}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-1.5 text-slate-200"
                >
                  {BIOME_LIST.map((b, idx) => (
                    <option key={b} value={idx}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">
                  Terrain Warp Flag
                </label>
                <select
                  value={spawnFeature}
                  onChange={(e) => setSpawnFeature(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-1.5 text-slate-200"
                >
                  <option value="--cliff">--cliff (Below nearest cliff)</option>
                  <option value="--ramp">--ramp (Below nearest stairs)</option>
                  <option value="--peak">--peak (On nearest hilltop)</option>
                  <option value="--lake">--lake (At nearest lakeshore)</option>
                  <option value="--landmark 0">
                    --landmark 0 (Ancient Tree)
                  </option>
                  <option value="--landmark 1">
                    --landmark 1 (Fallen Star)
                  </option>
                  <option value="none">None (Default Origin)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">
                  --give N --loot (Random Items in Bag: {giveLootCount})
                </label>
                <input
                  type="range"
                  min={0}
                  max={32}
                  value={giveLootCount}
                  onChange={(e) => setGiveLootCount(Number(e.target.value))}
                  className="w-full accent-gold-400"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">
                  --allies N (Summoned Companion Pack: {allyCount})
                </label>
                <input
                  type="range"
                  min={0}
                  max={12}
                  value={allyCount}
                  onChange={(e) => setAllyCount(Number(e.target.value))}
                  className="w-full accent-emerald-400"
                />
              </div>
            </div>
          )}

          {cliMode === "biomeView" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">
                  Tile X (-1M..1M)
                </label>
                <input
                  type="number"
                  value={viewX}
                  onChange={(e) => setViewX(Number(e.target.value))}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-1.5 text-slate-200"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">
                  Tile Y (-1M..1M)
                </label>
                <input
                  type="number"
                  value={viewY}
                  onChange={(e) => setViewY(Number(e.target.value))}
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-1.5 text-slate-200"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">
                  World Seed
                </label>
                <input
                  type="number"
                  value={viewSeed}
                  onChange={(e) =>
                    setViewSeed(Math.max(0, Number(e.target.value)))
                  }
                  className="w-full bg-dark-900 border border-dark-700 rounded-lg px-3 py-1.5 text-slate-200"
                />
              </div>
            </div>
          )}

          {cliMode === "arsenalView" && (
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">
                Weapon / Recipe Name Filter
              </label>
              <input
                type="text"
                value={armWeapon}
                onChange={(e) => setArmWeapon(e.target.value)}
                className="w-full max-w-md bg-dark-900 border border-dark-700 rounded-lg px-3 py-1.5 text-slate-200"
              />
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-dark-900 border border-emerald-500/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-emerald-300 overflow-x-auto">
              <Sparkles className="w-4 h-4 shrink-0 text-gold-400" />
              <code className="text-xs sm:text-sm font-bold">
                {generatedCommand}
              </code>
            </div>
            <button
              onClick={() => copyText(generatedCommand)}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 flex items-center gap-1.5 shrink-0"
            >
              {copiedCmd === generatedCommand ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy CLI</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {activeTab === "atlas" && (
        <div className="p-5 rounded-xl bg-dark-950 border border-dark-800 space-y-4 font-mono text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dark-800 pb-3">
            <div>
              <div className="text-purple-400 font-bold uppercase text-[10px]">
                src/Atlas.hpp &amp; tools/atlas_layout.py
              </div>
              <h5 className="text-base font-bold text-white mt-0.5">
                18×18 Cell Stride &amp; 1px Gutter Coordinate Calculator
              </h5>
            </div>
            <span className="text-slate-400 text-[11px]">
              Atlas Dimensions: 432 × 786 px (24 Columns × 43 Rows)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-dark-900 border border-dark-800 space-y-2">
              <label className="block text-slate-400">
                Column (0..23):{" "}
                <strong className="text-gold-300">{atlasCol}</strong>
              </label>
              <input
                type="range"
                min={0}
                max={23}
                value={atlasCol}
                onChange={(e) => setAtlasCol(Number(e.target.value))}
                className="w-full accent-gold-400"
              />
            </div>

            <div className="p-3 rounded-lg bg-dark-900 border border-dark-800 space-y-2">
              <label className="block text-slate-400">
                Row (0..42):{" "}
                <strong className="text-purple-300">{atlasRow}</strong>
              </label>
              <input
                type="range"
                min={0}
                max={42}
                value={atlasRow}
                onChange={(e) => setAtlasRow(Number(e.target.value))}
                className="w-full accent-purple-400"
              />
            </div>

            <div className="p-3 rounded-lg bg-dark-900 border border-dark-800 flex flex-col justify-between">
              <span className="text-slate-400">Sprite Cell Span:</span>
              <button
                onClick={() => setIsTallTree((v) => !v)}
                className={`mt-1 px-3 py-1.5 rounded border font-bold transition-colors ${
                  isTallTree
                    ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                    : "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                }`}
              >
                {isTallTree
                  ? "2-Cell Stacked Tree (16×34)"
                  : "Standard 1-Cell Sprite (16×16)"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-lg bg-dark-900 border border-dark-750">
              <div className="text-[10px] text-slate-500">
                Pixel X (col*18 + 1)
              </div>
              <div className="text-base font-bold text-gold-300 mt-0.5">
                {atlasPixelX} px
              </div>
            </div>
            <div className="p-3 rounded-lg bg-dark-900 border border-dark-750">
              <div className="text-[10px] text-slate-500">
                Pixel Y (row*18 + 1)
              </div>
              <div className="text-base font-bold text-purple-300 mt-0.5">
                {atlasPixelY} px
              </div>
            </div>
            <div className="p-3 rounded-lg bg-dark-900 border border-dark-750">
              <div className="text-[10px] text-slate-500">Inner Dimensions</div>
              <div className="text-base font-bold text-emerald-300 mt-0.5">
                16 × {atlasHeight} px
              </div>
            </div>
            <div className="p-3 rounded-lg bg-dark-900 border border-dark-750">
              <div className="text-[10px] text-slate-500">Linear Cell ID</div>
              <div className="text-base font-bold text-sky-300 mt-0.5">
                #{linearCellIndex}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-dark-900 border border-dark-750 text-slate-300 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Grid className="w-4 h-4 text-gold-400" />
              <span>
                C++20 <code className="text-gold-300">src/Atlas.hpp</code>{" "}
                Definition:
              </span>
            </div>
            <code className="text-emerald-300 font-bold">
              {`constexpr Sprite MySprite{${atlasPixelX}, ${atlasPixelY}, 16, ${atlasHeight}};`}
            </code>
          </div>
        </div>
      )}
    </div>
  );
};
