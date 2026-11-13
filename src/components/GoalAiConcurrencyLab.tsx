import React, { useState, useMemo } from "react";
import {
  Cpu,
  Compass,
  GitBranch,
  Layers,
  Eye,
  ShieldAlert,
  Zap,
} from "lucide-react";

type LabTab = "goalqueue" | "barriers" | "catalog";

interface ArchetypePreset {
  name: string;
  kind: string;
  steps: string[];
  interrupt: string | null;
  gaitType: "flutter" | "ooze" | "scuttle" | "march";
  preferDist: number;
  desc: string;
}

const ARCHETYPES: ArchetypePreset[] = [
  {
    name: "Spider (Stalk & Ambush)",
    kind: "EnemyKind::Spider",
    steps: ["STALK(110)", "CLOSE(40)", "BITE(0.25s, 3.0x)"],
    interrupt: "FALTER(0.30)",
    gaitType: "march",
    preferDist: 110,
    desc: "Circles at 110px while watched (s.seen == true); the instant the player looks away, pops STALK and lunges in with CLOSE -> BITE.",
  },
  {
    name: "Ghost (Sight-Cone Phasing)",
    kind: "EnemyKind::Ghost",
    steps: ["OOZE(base=0.8, pulse=0.4)"],
    interrupt: "HIDE(240) [conceals=true]",
    gaitType: "ooze",
    preferDist: 0,
    desc: "Drifts toward the player with sinusoidal peristaltic pulsing, but preempts with HIDE (backing away at 0.6x speed while translucent) whenever inside the player's 113° sight cone (< 240px).",
  },
  {
    name: "Rat (Leader V-Formation Pack)",
    kind: "EnemyKind::Rat",
    steps: ["PACK(breakOff=90)", "CHARGE(0)"],
    interrupt: "FALTER(0.30)",
    gaitType: "march",
    preferDist: 90,
    desc: "Requests a pack leader via wantsLeader -> Enemy::adopt(), steering to a wing slot (-12px back, ±10px lateral) until within 90px of the player.",
  },
  {
    name: "Scorpion (Rectified Scuttle)",
    kind: "EnemyKind::Scorpion",
    steps: ["SCUTTLE(46, rectified=true)", "NIP(0.15s, 2.6x)"],
    interrupt: "FALTER(0.30)",
    gaitType: "scuttle",
    preferDist: 46,
    desc: "Uses a half-wave rectified sine gait (max(0, sin(4t))) for stop-and-go arachnid bursts before executing a fast 0.15s windup NIP.",
  },
  {
    name: "Necromancer (Summon & Orb Cast)",
    kind: "EnemyKind::Necromancer",
    steps: ["SUMMON_RANGE(190)", "RAISE(0.85s)", "CAST(150..210)"],
    interrupt: "FALTER(0.30)",
    gaitType: "flutter",
    preferDist: 190,
    desc: "Approaches to 190px with weaving gait, channels RAISE for 0.85s to spawn 2 Skeletons, then strafes at 150px setting wantsFire = true.",
  },
  {
    name: "Burrower (Subterranean Ambush)",
    kind: "EnemyKind::Burrower",
    steps: ["BURROW(2.8s, warn=0.75s, surf=2.4s)", "NIP"],
    interrupt: null,
    gaitType: "march",
    preferDist: 30,
    desc: "Sets buried = true (skipping CSR grid & collision), tracks player at 1.35x speed, telegraphs for 0.75s, and erupts for 1.25x damage.",
  },
];

interface GoalDoc {
  name: string;
  file: string;
  category: "Steering" | "Combat" | "Interrupt" | "Specialist";
  signature: string;
  formula: string;
  users: string;
}

const GOAL_DOCS: GoalDoc[] = [
  {
    name: "Approach",
    file: "ai/Approach.cpp",
    category: "Steering",
    signature: "Approach(double stop, Gait gait)",
    formula:
      "v = speed * (base + pulse * wave); spread = ((seed>>3 & 7) - 3.5) * 0.14 * clamp((dist-50)/160, 0, 1)",
    users:
      "Bat (FLUTTER), Slime (OOZE), Scorpion (SCUTTLE), Demon/Knight (MARCH), Cyclops (LUMBER)",
  },
  {
    name: "Melee",
    file: "ai/Melee.cpp",
    category: "Combat",
    signature: "Melee(float windup, float lunge, double speed, float cd)",
    formula:
      "start(): xMark=xn, yMark=yn. t < windup: v = -8 (tell = t/windup). t < windup+lunge: v = speed * mul",
    users:
      "NIP (Rat/Scorpion), BITE (Wolf/Spider), CLEAVE (Demon/Knight), SLAM (Cyclops/Treant), GORE (Boar)",
  },
  {
    name: "Flank",
    file: "ai/Flank.cpp",
    category: "Steering",
    signature: "Flank(double prefer = 65)",
    formula:
      "radial = clamp((dist - prefer) * 1.6, -spd, spd); tangent = side * spd * 0.95",
    users: "Wolf, Alpha, DustVulture, PitFighter, Cutthroat",
  },
  {
    name: "Follow",
    file: "ai/Follow.cpp",
    category: "Steering",
    signature: "Follow(double breakOff = 90)",
    formula:
      "If !lead: wantsLeader = true. Else target = lead - yn*10*side - xn*12 (V-formation wing)",
    users: "Rat (PACK -> CHARGE)",
  },
  {
    name: "Stalk",
    file: "ai/Stalk.cpp",
    category: "Steering",
    signature: "Stalk(double range = 110)",
    formula:
      "Done if (!s.seen && dist < range * 1.6) || goalTime > 7s; orbits at 0.7x tangential speed",
    users: "Spider (STALK -> CLOSE -> BITE)",
  },
  {
    name: "Hide",
    file: "ai/Hide.cpp",
    category: "Interrupt",
    signature: "Hide(double range = 240)",
    formula:
      "urgent(): aware && s.seen && dist < range. Retreats at -0.6x speed while conceals() == true",
    users: "Ghost interrupt",
  },
  {
    name: "Falter",
    file: "ai/Falter.cpp",
    category: "Interrupt",
    signature: "Falter(float below = 0.3f)",
    formula:
      "urgent(): !faltered && hp < maxHp * 0.3 && dist < 160. Retreats 1.1s at -0.9x speed + weave",
    users: "19 monster plans (Rat, Scorpion, Spider, Cultist, Demon, Knight, Wolf...)",
  },
  {
    name: "Ranged",
    file: "ai/Ranged.cpp",
    category: "Combat",
    signature: "Ranged(double prefer = 150, double range = 210)",
    formula:
      "Strafes at cos(3t)*28; if cd <= 0 && dist < range: sets wantsFire = true (handled in Enemy::act)",
    users: "Cultist, Necromancer",
  },
  {
    name: "LookOut",
    file: "ai/LookOut.cpp",
    category: "Steering",
    signature: "LookOut(double sight)",
    formula:
      "Wanders at 0.3x speed along random (xMark, yMark) every 1.5..2.5s until dist < sight sets aware=true",
    users: "Slime (WATCH 260), Knight & Deserter (GUARD 220)",
  },
  {
    name: "Howl",
    file: "ai/Howl.cpp",
    category: "Specialist",
    signature: "Howl(float windup = 0.6f, float cd = 7.5f)",
    formula:
      "After 0.6s windup: sets frenzy = 6.0s (+35% speed) on self & all Wolves within 240px (+3 spawns if boss)",
    users: "Alpha Wolf (HOWL -> FLANK -> BITE)",
  },
  {
    name: "Burrow",
    file: "ai/Burrow.cpp",
    category: "Specialist",
    signature: "Burrow(float travel=2.8f, float warn=0.75f, float surf=2.4f)",
    formula:
      "buried=true (skips CSR grid & collision), tracks at 1.35x speed, warns 0.75s, erupts in 28px radius",
    users: "Burrower (BURROW -> NIP)",
  },
  {
    name: "Raise",
    file: "ai/Raise.cpp",
    category: "Specialist",
    signature: "Raise(float windup = 0.85f, float cd = 5.5f)",
    formula:
      "Channels 0.85s (tell = goalTime/windup), spawns 2 Skeletons (4 if boss) at r = 20..62px",
    users: "Necromancer (SUMMON_RANGE -> RAISE -> CAST)",
  },
  {
    name: "Mend",
    file: "ai/Mend.cpp",
    category: "Specialist",
    signature: "Mend(float range = 150, float seconds = 4)",
    formula:
      "Scans CSR gather(150px) for ally with lowest hp/maxHp < 0.90; escorts within 40px",
    users: "GoblinShaman (MEND -> CASTING_RANGE)",
  },
  {
    name: "Circle",
    file: "ai/Circle.cpp",
    category: "Steering",
    signature: "Circle(double radius = 60, float seconds = 2.5f)",
    formula:
      "Orbits at full speed v with radial spring clamp((dist - radius) * 2.0, -v, v) for 2.5s",
    users: "MothWisp (HOVER -> ORBIT -> DIVE)",
  },
  {
    name: "Lurk",
    file: "ai/Lurk.cpp",
    category: "Specialist",
    signature: "Lurk(double wake = 46)",
    formula:
      "Remains buried=true (disguised as chest) until s.dist < 46px; erupts with frenzy = 1.5s",
    users: "Mimic (LURK -> CHARGE -> BITE)",
  },
  {
    name: "Escape",
    file: "ai/Escape.cpp",
    category: "Specialist",
    signature: "Escape(float duration = 10.0f)",
    formula:
      "Flees at -xn*spd + weave; slows to 0.35x during final 2s (tell = (age-8)/2) then despawns in gold burst",
    users: "Thief (Treasure Goblin)",
  },
];

const AI_GUIDED_SCENARIOS = [
  {
    name: "Ghost Sight-Cone Preemption",
    badge: "113° Cone Phasing",
    desc: "Player looks directly at Ghost inside 113° sight cone; triggers pushFront(HIDE) preemption.",
  },
  {
    name: "Spider Unseen Lunge",
    badge: "Ambush Popping",
    desc: "Player looks away (aim · n = -0.40); watched STALK completes immediately and pops CLOSE -> BITE.",
  },
  {
    name: "Low-HP Falter Interrupt",
    badge: "pushFront(FALTER)",
    desc: "Enemy drops below 30% HP near player; preempts plan with 1.1s weave retreat at -0.9x speed.",
  },
  {
    name: "4-Barrier Worker Step-Through",
    badge: "Zero Data Race",
    desc: "Step through the 4 worker barriers to verify disjoint read-write memory separation.",
  },
];

export const GoalAiConcurrencyLab: React.FC = () => {
  const [tab, setTab] = useState<LabTab>("goalqueue");
  const [selectedScenarioIdx, setSelectedScenarioIdx] = useState<number | null>(0);

  // Tab 1: GoalQueue & Sense state
  const [presetIdx, setPresetIdx] = useState<number>(1); // Ghost
  const [dist, setDist] = useState<number>(180);
  const [aimDot, setAimDot] = useState<number>(0.85); // -(p.xAim*xn + p.yAim*yn) > 0.55
  const [hpPct, setHpPct] = useState<number>(100);
  const [seedLane, setSeedLane] = useState<number>(6);
  const [headIdx, setHeadIdx] = useState<number>(1);

  // Tab 2: 4-Barrier Concurrency state
  const [enemyCount, setEnemyCount] = useState<number>(920);
  const [threadCount, setThreadCount] = useState<number>(4);
  const [barrierIdx, setBarrierIdx] = useState<number>(0);
  const [farRatio, setFarRatio] = useState<number>(55);

  // Tab 3: Goal catalog filter
  const [catFilter, setCatFilter] = useState<string>("All");

  const preset = ARCHETYPES[presetIdx];

  const senseAndQueue = useMemo(() => {
    const seen = dist < 300 && aimDot > 0.55;
    const falterUrgent =
      preset.interrupt?.startsWith("FALTER") && hpPct < 30 && dist < 160;
    const hideUrgent =
      preset.interrupt?.startsWith("HIDE") && seen && dist < 240;
    const preempted = Boolean(falterUrgent || hideUrgent);

    const spreadRad =
      (seedLane - 3.5) * 0.14 * Math.max(0, Math.min(1, (dist - 50) / 160));
    const spreadDeg = (spreadRad * 180) / Math.PI;

    // Build 8-slot ringbuffer view
    const slots: { idx: number; label: string; role: "front" | "queued" | "empty" | "preempt" }[] =
      Array.from({ length: 8 }, (_, i) => ({
        idx: i,
        label: "NULL",
        role: "empty",
      }));

    const activeHead = preempted ? (headIdx + 7) & 7 : headIdx & 7;
    if (preempted && preset.interrupt) {
      slots[activeHead] = {
        idx: activeHead,
        label: preset.interrupt.split(" ")[0],
        role: "preempt",
      };
    }

    preset.steps.forEach((step, i) => {
      const pos = (headIdx + i) & 7;
      slots[pos] = {
        idx: pos,
        label: step,
        role: !preempted && i === 0 ? "front" : "queued",
      };
    });

    const size = preset.steps.length + (preempted ? 1 : 0);

    return {
      seen,
      preempted,
      activeHead,
      size,
      spreadDeg,
      slots,
    };
  }, [preset, dist, aimDot, hpPct, seedLane, headIdx]);

  const concurrencyStats = useMemo(() => {
    const chunk = 256;
    const fastPath = threadCount <= 1 || enemyCount <= chunk;
    const totalChunks = Math.ceil(enemyCount / chunk);
    const chunks: {
      id: number;
      begin: number;
      end: number;
      worker: string;
      color: string;
    }[] = [];

    const workerColors = [
      "bg-gold-500/25 border-gold-500/50 text-gold-300",
      "bg-sky-500/25 border-sky-500/50 text-sky-300",
      "bg-purple-500/25 border-purple-500/50 text-purple-300",
      "bg-emerald-500/25 border-emerald-500/50 text-emerald-300",
      "bg-rose-500/25 border-rose-500/50 text-rose-300",
      "bg-amber-500/25 border-amber-500/50 text-amber-300",
      "bg-teal-500/25 border-teal-500/50 text-teal-300",
      "bg-indigo-500/25 border-indigo-500/50 text-indigo-300",
    ];

    for (let c = 0; c < totalChunks; c++) {
      const begin = c * chunk;
      const end = Math.min(enemyCount, begin + chunk);
      const wIdx = fastPath ? 0 : c % threadCount;
      const workerName =
        wIdx === 0 ? "Main Thread (work())" : `Worker #${wIdx}`;
      chunks.push({
        id: c,
        begin,
        end,
        worker: workerName,
        color: workerColors[wIdx % workerColors.length],
      });
    }

    const farCount = Math.round((enemyCount * farRatio) / 100);
    const skippedPush = Math.round(farCount * 0.5);

    const barriers = [
      {
        title: "Barrier 1: pass<&Enemy::think>",
        reads: "Player (x, y, xa, ya, xAim, yAim), Leader (x, y)",
        writes: "Private: goals, goalTime, cooldown, xWant, yWant, seed, wantsFire, wantsLeader",
        invariant:
          "Never mutates e.x / e.y or EnTT registry; uses per-enemy Xorshift32 e.roll() for thread safety.",
      },
      {
        title: "Barrier 2: pass<&Enemy::move>",
        reads: "Private xWant, yWant, status, traits, read-only surfaces[]",
        writes: "Private: e.x, e.y, e.xa, e.ya (knockback exp(-9*DT)), facing, >560px tether",
        invariant:
          "Safe to write e.x / e.y here because no thread reads neighbor Enemy positions during move().",
      },
      {
        title: "Barrier 3: pass<&Enemy::push>",
        reads: "Read-only CSR Grid (cellStart[], cells[]) & neighbor (o.x, o.y, o.radius)",
        writes: "Private: e.xPush, e.yPush ONLY (e.x and e.y are strictly read-only!)",
        invariant: `Distant enemies (>260px) skip push() on alternating ticks via ((uintptr_t(this)>>5) + ticks) & 1 — saving ${skippedPush} CSR queries this frame!`,
      },
      {
        title: "Barrier 4: pass<&Enemy::settle>",
        reads: "Private e.xPush, e.yPush, read-only solids[]",
        writes: "Commits e.x += xPush, e.y += yPush + level->collide(x, y, radius)",
        invariant:
          "Completes soft-body crowd separation with zero read-write races across worker threads.",
      },
      {
        title: "Main Thread Serial: Enemy::tick() -> act()",
        reads: "wantsLeader, wantsFire, status, boss phase thresholds",
        writes: "Enemy::adopt() leader assignment, level->add<Orb>(), Sound::orb.play()",
        invariant:
          "Executes after PROF_THINK barriers complete so leader adoption and audio/entity spawns are deterministic.",
      },
    ];

    return {
      fastPath,
      totalChunks,
      chunks,
      skippedPush,
      activeBarrier: barriers[barrierIdx],
      barriers,
    };
  }, [enemyCount, threadCount, barrierIdx, farRatio]);

  const filteredGoals = useMemo(() => {
    if (catFilter === "All") return GOAL_DOCS;
    return GOAL_DOCS.filter((g) => g.category === catFilter);
  }, [catFilter]);

  return (
    <div className="my-5 rounded-2xl border border-dark-750 bg-dark-900/90 overflow-hidden shadow-xl">
      <div className="px-4 py-3 bg-dark-950/90 border-b border-dark-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-gold-400" />
          <span className="font-display font-bold text-xs sm:text-sm tracking-wide text-slate-100">
            GoalQueue Ringbuffer, Sight-Cone &amp; 4-Barrier Concurrency Lab
          </span>
        </div>

        <div className="flex items-center gap-1 bg-dark-900 p-1 rounded-lg border border-dark-800 text-xs font-mono">
          <button
            onClick={() => setTab("goalqueue")}
            className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 ${
              tab === "goalqueue"
                ? "bg-gold-500/20 text-gold-300 border border-gold-500/40 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>GoalQueue &amp; Sense</span>
          </button>
          <button
            onClick={() => setTab("barriers")}
            className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 ${
              tab === "barriers"
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>4-Barrier Workers</span>
          </button>
          <button
            onClick={() => setTab("catalog")}
            className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 ${
              tab === "catalog"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>16 Goals Reference</span>
          </button>
        </div>
      </div>

      {/* 1-Click Guided Scenarios Bar */}
      <div className="px-4 py-3 bg-dark-950/60 border-b border-dark-800">
        <div className="flex items-center justify-between text-xs font-mono mb-2">
          <span className="text-slate-400 font-semibold flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-gold-400" />
            <span>Guided AI &amp; Concurrency Scenarios:</span>
          </span>
          <span className="text-[11px] text-slate-500">
            Click to observe goal preemption &amp; atomic barriers
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 font-mono">
          {AI_GUIDED_SCENARIOS.map((sc, idx) => {
            const isSelected = selectedScenarioIdx === idx;
            return (
              <button
                key={sc.name}
                onClick={() => {
                  setSelectedScenarioIdx(idx);
                  if (idx === 0) {
                    setTab("goalqueue");
                    setPresetIdx(1); // Ghost
                    setDist(180);
                    setAimDot(0.85);
                    setHpPct(100);
                  } else if (idx === 1) {
                    setTab("goalqueue");
                    setPresetIdx(0); // Spider
                    setDist(110);
                    setAimDot(-0.40);
                    setHpPct(100);
                  } else if (idx === 2) {
                    setTab("goalqueue");
                    setPresetIdx(3); // Scorpion
                    setDist(95);
                    setAimDot(0.60);
                    setHpPct(20);
                  } else if (idx === 3) {
                    setTab("barriers");
                    setBarrierIdx(0);
                  }
                }}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  isSelected
                    ? "bg-purple-500/15 border-purple-500/60 text-purple-200 shadow-md shadow-purple-950/30 ring-1 ring-purple-500/30"
                    : "bg-dark-950/70 border-dark-800 text-slate-300 hover:border-dark-700 hover:text-slate-100"
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span>{sc.name}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-dark-900 border border-dark-750 text-purple-300 uppercase">
                    {sc.badge}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 leading-tight">
                  {sc.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {tab === "goalqueue" && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {ARCHETYPES.map((a, idx) => (
              <button
                key={a.name}
                onClick={() => setPresetIdx(idx)}
                className={`p-2 rounded-xl border text-left font-mono text-xs transition-all ${
                  presetIdx === idx
                    ? "bg-dark-850 border-gold-500/50 text-gold-300 font-semibold"
                    : "bg-dark-950/60 border-dark-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                <div className="truncate">{a.name}</div>
                <div className="text-[10px] text-slate-500 truncate">
                  {a.kind}
                </div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl bg-dark-950/70 border border-dark-800 space-y-3 font-mono text-xs">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">
                    Lead Distance (<code>s.dist</code>)
                  </span>
                  <span className="text-gold-300 font-semibold">{dist} px</span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={320}
                  step={5}
                  value={dist}
                  onChange={(e) => setDist(Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5 text-sky-400" />
                    <span>
                      Sight Alignment (<code>-(aim · n)</code>)
                    </span>
                  </span>
                  <span
                    className={`font-semibold ${
                      senseAndQueue.seen ? "text-emerald-300" : "text-slate-400"
                    }`}
                  >
                    {aimDot.toFixed(2)} ({senseAndQueue.seen ? "SEEN" : "UNSEEN"}
                    )
                  </span>
                </div>
                <input
                  type="range"
                  min={-1.0}
                  max={1.0}
                  step={0.05}
                  value={aimDot}
                  onChange={(e) => setAimDot(Number(e.target.value))}
                  className="w-full accent-sky-400"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">
                    Enemy HP (<code>FALTER &lt; 30%</code>)
                  </span>
                  <span
                    className={`font-semibold ${
                      hpPct < 30 ? "text-rose-400" : "text-emerald-300"
                    }`}
                  >
                    {hpPct}% HP
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={hpPct}
                  onChange={(e) => setHpPct(Number(e.target.value))}
                  className="w-full accent-rose-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Seed Lane (0..7)</span>
                    <span className="text-purple-300">
                      {senseAndQueue.spreadDeg >= 0 ? "+" : ""}
                      {senseAndQueue.spreadDeg.toFixed(1)}°
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={7}
                    step={1}
                    value={seedLane}
                    onChange={(e) => setSeedLane(Number(e.target.value))}
                    className="w-full accent-purple-400"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Ring Head (0..7)</span>
                    <span className="text-gold-300">
                      head={senseAndQueue.activeHead}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={7}
                    step={1}
                    value={headIdx}
                    onChange={(e) => setHeadIdx(Number(e.target.value))}
                    className="w-full accent-amber-400"
                  />
                </div>
              </div>

              {/* 113° Sight-Cone Radar */}
              <div className="pt-2 border-t border-dark-800">
                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                  <span className="text-sky-300 font-semibold flex items-center gap-1">
                    <Eye className="w-3 h-3 text-sky-400" />
                    <span>113° Player Vision Cone Radar (cos 56.5° = 0.55)</span>
                  </span>
                  <span
                    className={`font-bold ${
                      senseAndQueue.seen
                        ? "text-emerald-400"
                        : "text-slate-500"
                    }`}
                  >
                    {senseAndQueue.seen ? "IN CONE (s.seen)" : "BLIND SPOT"}
                  </span>
                </div>
                <svg
                  viewBox="0 0 240 110"
                  className="w-full h-24 bg-dark-950 rounded border border-dark-800 overflow-hidden"
                >
                  {/* 113-degree cone arc (r=60, center=(50,55)) */}
                  <path
                    d="M 50 55 L 83.1 5 A 60 60 0 0 1 83.1 105 Z"
                    fill={senseAndQueue.seen ? "#10b981" : "#64748b"}
                    fillOpacity={senseAndQueue.seen ? 0.2 : 0.08}
                    stroke={senseAndQueue.seen ? "#10b981" : "#475569"}
                    strokeWidth="1.5"
                  />
                  {/* Outer circle perimeter guideline */}
                  <circle
                    cx="50"
                    cy="55"
                    r="60"
                    fill="none"
                    stroke="#334155"
                    strokeWidth="1"
                    strokeDasharray="2 3"
                  />
                  {/* Center Player */}
                  <circle cx="50" cy="55" r="4" fill="#38bdf8" />
                  <line
                    x1="50"
                    y1="55"
                    x2="70"
                    y2="55"
                    stroke="#38bdf8"
                    strokeWidth="2"
                  />
                  <text
                    x="20"
                    y="58"
                    fill="#38bdf8"
                    fontSize="7"
                    fontFamily="monospace"
                  >
                    Player
                  </text>

                  {/* Enemy Position in local radar coords */}
                  {(() => {
                    const rEnemy = Math.min(
                      65,
                      Math.max(15, (dist / 320) * 60),
                    );
                    const ySign = seedLane >= 4 ? 1 : -1;
                    const sinVal = Math.sqrt(
                      Math.max(0, 1 - aimDot * aimDot),
                    );
                    const ex = 50 + rEnemy * aimDot;
                    const ey = 55 + rEnemy * sinVal * ySign;
                    return (
                      <g>
                        <line
                          x1="50"
                          y1="55"
                          x2={ex}
                          y2={ey}
                          stroke="#64748b"
                          strokeWidth="1"
                          strokeDasharray="2 2"
                        />
                        <circle
                          cx={ex}
                          cy={ey}
                          r="4"
                          fill={senseAndQueue.seen ? "#10b981" : "#f59e0b"}
                          stroke="#000"
                          strokeWidth="1"
                        />
                        <text
                          x={ex + 6}
                          y={ey + 3}
                          fill={senseAndQueue.seen ? "#34d399" : "#fbbf24"}
                          fontSize="7"
                          fontWeight="bold"
                          fontFamily="monospace"
                        >
                          {preset.name.split(" ")[0]} ({dist}px)
                        </text>
                      </g>
                    );
                  })()}
                </svg>
                <div className="flex justify-between text-[9px] text-slate-500 mt-1">
                  <span>Aim Alignment: {aimDot.toFixed(2)}</span>
                  <span>
                    Condition:{" "}
                    <code className="text-emerald-300">
                      dist&lt;300 &amp;&amp; aimDot&gt;0.55
                    </code>
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-dark-950/70 border border-dark-800 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs font-mono mb-2">
                  <span className="text-slate-300 font-semibold">
                    8-Slot <code>GoalQueue</code> Ring (<code>&amp; 7</code>)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    head={senseAndQueue.activeHead} • size={senseAndQueue.size}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5 font-mono">
                  {senseAndQueue.slots.map((s) => (
                    <div
                      key={s.idx}
                      className={`p-2 rounded-lg border text-center transition-all ${
                        s.role === "preempt"
                          ? "bg-rose-500/20 border-rose-500/60 text-rose-200 shadow-sm"
                          : s.role === "front"
                            ? "bg-gold-500/20 border-gold-500/60 text-gold-200 shadow-sm"
                            : s.role === "queued"
                              ? "bg-dark-850 border-sky-500/40 text-sky-300"
                              : "bg-dark-900/40 border-dark-800 text-slate-600"
                      }`}
                    >
                      <div className="text-[9px] uppercase flex items-center justify-between">
                        <span>[{s.idx}]</span>
                        {s.idx === senseAndQueue.activeHead && (
                          <span className="text-gold-300 font-bold">HEAD</span>
                        )}
                      </div>
                      <div className="text-[10px] font-semibold truncate mt-0.5">
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-dark-900 border border-dark-800 text-xs font-mono space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Interrupt State:</span>
                  {senseAndQueue.preempted ? (
                    <span className="text-rose-400 font-semibold flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      pushFront({preset.interrupt?.split(" ")[0]}) Active!
                    </span>
                  ) : (
                    <span className="text-emerald-400">
                      Normal Plan Execution
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed pt-1">
                  {preset.desc}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "barriers" && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
            <div className="p-3 rounded-xl bg-dark-950/70 border border-dark-800">
              <div className="flex justify-between mb-1">
                <span className="text-slate-400">Active Enemies (N)</span>
                <span className="text-gold-300 font-bold">{enemyCount}</span>
              </div>
              <input
                type="range"
                min={64}
                max={2048}
                step={64}
                value={enemyCount}
                onChange={(e) => setEnemyCount(Number(e.target.value))}
                className="w-full accent-amber-400"
              />
              <div className="text-[10px] text-slate-500 mt-1">
                {concurrencyStats.fastPath
                  ? "N <= 256: Fast-Path Inline (0 locks!)"
                  : `${concurrencyStats.totalChunks} chunks of 256 via compare-exchange on next`}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-dark-950/70 border border-dark-800">
              <div className="flex justify-between mb-1">
                <span className="text-slate-400">Total Threads</span>
                <span className="text-purple-300 font-bold">
                  {threadCount} ({threadCount - 1} workers + main)
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={8}
                step={1}
                value={threadCount}
                onChange={(e) => setThreadCount(Number(e.target.value))}
                className="w-full accent-purple-400"
              />
              <div className="text-[10px] text-slate-500 mt-1">
                Main thread calls <code>work()</code> alongside workers
              </div>
            </div>

            <div className="p-3 rounded-xl bg-dark-950/70 border border-dark-800">
              <div className="flex justify-between mb-1">
                <span className="text-slate-400">Distant (&gt;260px)</span>
                <span className="text-emerald-300 font-bold">{farRatio}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={90}
                step={5}
                value={farRatio}
                onChange={(e) => setFarRatio(Number(e.target.value))}
                className="w-full accent-emerald-400"
              />
              <div className="text-[10px] text-slate-500 mt-1">
                Half-rate skips: {concurrencyStats.skippedPush} foes/tick
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-mono text-slate-400 flex items-center justify-between">
              <span>
                Atomic Stride Distribution (
                <code>compare_exchange(next, next + 256)</code>)
              </span>
              <span className="text-[11px] text-slate-500">
                Grain = 256 Enemies / Chunk
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono text-[11px]">
              {concurrencyStats.chunks.map((c) => (
                <div
                  key={c.id}
                  className={`p-2 rounded-lg border ${c.color}`}
                >
                  <div className="flex justify-between text-[10px] opacity-80">
                    <span>Chunk #{c.id}</span>
                    <span>
                      [{c.begin}..{c.end})
                    </span>
                  </div>
                  <div className="font-semibold truncate mt-0.5">
                    {c.worker}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {/* Frame Step-Through Controller */}
            <div className="p-3 rounded-xl bg-dark-950/90 border border-dark-800 flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
              <div className="flex items-center gap-2">
                <span className="text-purple-300 font-semibold flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>60 Hz Frame Concurrency Step-Through:</span>
                </span>
                <span className="text-[11px] text-slate-400">
                  Step {barrierIdx + 1} of 5
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setBarrierIdx(0)}
                  className="px-2 py-1 rounded bg-dark-900 border border-dark-750 text-slate-300 hover:text-slate-100 text-[11px] transition-colors"
                >
                  ⏮ Reset
                </button>
                <button
                  onClick={() => setBarrierIdx((prev) => (prev + 1) % 5)}
                  className="px-3 py-1 rounded bg-purple-500/20 border border-purple-500/50 text-purple-200 hover:bg-purple-500/30 text-[11px] font-semibold transition-colors flex items-center gap-1"
                >
                  <span>▶ Step Next Barrier</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 font-mono text-xs">
              {concurrencyStats.barriers.map((b, idx) => (
                <button
                  key={b.title}
                  onClick={() => setBarrierIdx(idx)}
                  className={`px-2.5 py-1.5 rounded-lg border transition-all ${
                    barrierIdx === idx
                      ? "bg-purple-500/20 border-purple-500/60 text-purple-200 font-semibold"
                      : "bg-dark-950/60 border-dark-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {idx < 4 ? `Barrier ${idx + 1}` : "Serial Act"}
                </button>
              ))}
            </div>

            <div className="p-3.5 rounded-xl bg-dark-950/90 border border-dark-800 font-mono text-xs space-y-2">
              <div className="text-sm font-bold text-gold-300 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-gold-400" />
                <span>{concurrencyStats.activeBarrier.title}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg bg-dark-900 border border-dark-800">
                  <div className="text-[10px] uppercase text-sky-400 mb-0.5">
                    Shared Memory Reads (Read-Only)
                  </div>
                  <div className="text-slate-200">
                    {concurrencyStats.activeBarrier.reads}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-dark-900 border border-dark-800">
                  <div className="text-[10px] uppercase text-emerald-400 mb-0.5">
                    Thread-Private Writes (Disjoint)
                  </div>
                  <div className="text-slate-200">
                    {concurrencyStats.activeBarrier.writes}
                  </div>
                </div>
              </div>
              <div className="text-[11px] text-slate-300 pt-1">
                <span className="text-purple-300 font-semibold">
                  Race-Freedom Invariant:
                </span>{" "}
                {concurrencyStats.activeBarrier.invariant}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "catalog" && (
        <div className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
            <span className="text-slate-400">
              Filter 16 Stateless <code>Goal</code> Primitives:
            </span>
            <div className="flex flex-wrap gap-1">
              {["All", "Steering", "Combat", "Interrupt", "Specialist"].map(
                (cat) => (
                  <button
                    key={cat}
                    onClick={() => setCatFilter(cat)}
                    className={`px-2.5 py-1 rounded-lg border transition-colors ${
                      catFilter === cat
                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-semibold"
                        : "bg-dark-950 border-dark-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {cat}
                  </button>
                ),
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
            {filteredGoals.map((g) => (
              <div
                key={g.name}
                className="p-3 rounded-xl bg-dark-950/80 border border-dark-800 font-mono text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-gold-300 text-sm">
                    {g.name}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-dark-900 border border-dark-750 text-slate-400">
                    {g.file}
                  </span>
                </div>
                <div className="text-[11px] text-sky-300 truncate">
                  {g.signature}
                </div>
                <div className="p-1.5 rounded bg-dark-900 border border-dark-850 text-[11px] text-slate-200 overflow-x-auto">
                  <code>{g.formula}</code>
                </div>
                <div className="text-[10px] text-slate-400">
                  <span className="text-emerald-400">Used by:</span> {g.users}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
