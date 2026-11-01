import React, { useState, useMemo } from "react";
import {
  Flame,
  Clock,
  Swords,
  ShieldAlert,
  Sparkles,
  Dices,
} from "lucide-react";

type SimTab = "director" | "status" | "draft";

interface PortentDef {
  name: string;
  rate: number;
  hp: number;
  xp: number;
  color: string;
  desc: string;
}

const PORTENTS: PortentDef[] = [
  {
    name: "Still Night",
    rate: 1.0,
    hp: 1.0,
    xp: 1.0,
    color: "text-slate-300",
    desc: "Baseline nocturnal cadence; no omen modifiers active.",
  },
  {
    name: "Blood Moon",
    rate: 0.82,
    hp: 1.25,
    xp: 1.35,
    color: "text-rose-400",
    desc: "Faster trickle spawns (+22%), +25% monster HP, +35% XP drops.",
  },
  {
    name: "Swarming Dark",
    rate: 0.72,
    hp: 0.85,
    xp: 1.15,
    color: "text-amber-400",
    desc: "Relentless fodder density (-28% interval) with slightly lower monster HP.",
  },
  {
    name: "Iron Fog",
    rate: 1.1,
    hp: 1.4,
    xp: 1.3,
    color: "text-sky-400",
    desc: "Slower trickle cadence, but heavily armored enemies (+40% HP).",
  },
];

const WAVE_DEFS = [
  { name: "Bat Swarm", kind: "Bat", scale: 1.3, minTime: 0 },
  { name: "Wolf Pack", kind: "Wolf", scale: 1.0, minTime: 60 },
  { name: "Bone March", kind: "Skeleton", scale: 1.0, minTime: 150 },
  { name: "Grave Tide", kind: "Zombie", scale: 0.85, minTime: 240 },
  { name: "Covenant Host", kind: "Cultist", scale: 0.65, minTime: 360 },
  { name: "Golem Siege", kind: "Golem", scale: 0.35, minTime: 480 },
];

const UNLOCK_TIMELINE = [
  { name: "Bat / Zombie", unlockAt: 0 },
  { name: "Skeleton /Goblin", unlockAt: 35 },
  { name: "Wolf / Spore", unlockAt: 75 },
  { name: "Wasp / Imp", unlockAt: 130 },
  { name: "Ghost / Cultist", unlockAt: 210 },
  { name: "Gargoyle / Wraith", unlockAt: 310 },
  { name: "Golem / Banshee", unlockAt: 430 },
  { name: "Lich / Elder", unlockAt: 560 },
];

export const CombatDirectorSimulator: React.FC = () => {
  const [tab, setTab] = useState<SimTab>("director");

  // Tab 1: Night Clock & Spawner Director state
  const [timeSec, setTimeSec] = useState<number>(320);
  const [portentIdx, setPortentIdx] = useState<number>(1);
  const [shrinesLit, setShrinesLit] = useState<number>(1);
  const [difficultyScale, setDifficultyScale] = useState<number>(1.0);

  // Tab 2: Status Tick & Cap state
  const [burnPower, setBurnPower] = useState<number>(14);
  const [poisonPower, setPoisonPower] = useState<number>(9);
  const [durationSec, setDurationSec] = useState<number>(3.3);
  const [chillRaw, setChillRaw] = useState<number>(0.45);
  const [markedRaw, setMarkedRaw] = useState<number>(0.6);

  // Tab 3: LevelUpMenu Weighted Draft state
  const [playerLevel, setPlayerLevel] = useState<number>(6);
  const [isTreasure, setIsTreasure] = useState<boolean>(false);
  const [canEvolve, setCanEvolve] = useState<boolean>(true);
  const [classTalentsLeft, setClassTalentsLeft] = useState<number>(2);
  const [affinityItemsLeft, setAffinityItemsLeft] = useState<number>(3);
  const [commonItemsLeft, setCommonItemsLeft] = useState<number>(10);

  const directorStats = useMemo(() => {
    const duration = 900; // 15:00 run
    const left = Math.max(0, duration - timeSec);
    const d = Math.max(0, Math.min(1, 1 - left / 150));
    const daylight = d * d;

    const p = PORTENTS[portentIdx];
    const spawnInterval = 2.1;
    const spawnRamp = 0.0022;
    const spawnFloor = 0.42;
    const rawInterval = Math.max(
      spawnFloor,
      spawnInterval - timeSec * spawnRamp,
    );
    const interval = (rawInterval * p.rate) / difficultyScale;
    const batchSize = 1 + Math.floor(timeSec / 75);

    const waveNumber = Math.floor(timeSec / 60);
    const eligibleWaves = WAVE_DEFS.filter((w) => timeSec >= w.minTime);
    const currentWave =
      eligibleWaves[eligibleWaves.length - 1] || WAVE_DEFS[0];
    const hordeCount = Math.min(
      48,
      Math.max(
        6,
        Math.round((10 + waveNumber * 3.2) * currentWave.scale * difficultyScale),
      ),
    );

    const unlocked = UNLOCK_TIMELINE.filter((u) => timeSec >= u.unlockAt);
    const strongest = unlocked[unlocked.length - 1]?.name || "Bat";
    const shrineRingCount = 8 + 3 * shrinesLit;

    return {
      left,
      daylight,
      interval,
      batchSize,
      waveNumber,
      currentWave,
      hordeCount,
      unlockedCount: unlocked.length,
      strongest,
      shrineRingCount,
    };
  }, [timeSec, portentIdx, shrinesLit, difficultyScale]);

  const statusStats = useMemo(() => {
    const clampedDur = Math.min(60, Math.max(0.5, durationSec));
    const fullHalfSecTicks = Math.floor(clampedDur / 0.5);
    const remainderSec = +(clampedDur - fullHalfSecTicks * 0.5).toFixed(2);
    const combinedDps = burnPower + poisonPower;
    const perHalfTickDmg = combinedDps * 0.5;
    const remainderDmg = combinedDps * remainderSec;
    const chillClamped = Math.min(0.65, chillRaw);
    const markedClamped = Math.min(1.0, markedRaw);
    const moveMult = 1 - chillClamped;
    const incomingMult = 1 + markedClamped;
    const totalDoTDmg =
      (fullHalfSecTicks * perHalfTickDmg + remainderDmg) * incomingMult;

    return {
      fullHalfSecTicks,
      remainderSec,
      perHalfTickDmg,
      remainderDmg,
      chillClamped,
      markedClamped,
      moveMult,
      incomingMult,
      totalDoTDmg,
    };
  }, [burnPower, poisonPower, durationSec, chillRaw, markedRaw]);

  const draftStats = useMemo(() => {
    const wClass = classTalentsLeft * 3;
    const wAffinity = affinityItemsLeft * 2;
    const wCommon = commonItemsLeft * 1;
    const totalWeight = Math.max(1, wClass + wAffinity + wCommon);

    const pClassFirst = (wClass / totalWeight) * 100;
    const pAffinityFirst = (wAffinity / totalWeight) * 100;
    const pCommonFirst = (wCommon / totalWeight) * 100;

    let fourthCardLabel = "None (3 Standard Cards)";
    let fourthCardChance = "28% combined trigger";
    if (isTreasure && canEvolve) {
      fourthCardLabel = "Weapon Evolution Slot (evolveSlot)";
      fourthCardChance = "100% Guaranteed (Treasure + Recipe Ready)";
    } else if (isTreasure) {
      fourthCardLabel = "Relic Offering (pickRelic)";
      fourthCardChance = "100% Guaranteed (Treasure Fallback)";
    } else if (playerLevel >= 4) {
      fourthCardLabel = "Active Class Skill (25%) or Relic (3%)";
      fourthCardChance = "lvl >= 4 skill roll + 3% wild relic roll";
    }

    return {
      totalWeight,
      pClassFirst,
      pAffinityFirst,
      pCommonFirst,
      fourthCardLabel,
      fourthCardChance,
    };
  }, [
    playerLevel,
    isTreasure,
    canEvolve,
    classTalentsLeft,
    affinityItemsLeft,
    commonItemsLeft,
  ]);

  const formatClock = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="my-6 rounded-2xl border border-dark-750 bg-dark-900/90 overflow-hidden shadow-xl">
      <div className="px-4 py-3 bg-dark-950/90 border-b border-dark-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-gold-400" />
          <span className="font-display font-bold text-xs sm:text-sm tracking-wide text-slate-100">
            Interactive Pacing, Status Tick &amp; Weighted Draft Simulator
          </span>
        </div>

        <div className="flex items-center gap-1 bg-dark-900 p-1 rounded-lg border border-dark-800">
          <button
            onClick={() => setTab("director")}
            className={`px-2.5 py-1 rounded text-xs font-mono transition-colors flex items-center gap-1.5 ${
              tab === "director"
                ? "bg-gold-500/20 text-gold-300 border border-gold-500/40 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Night &amp; Spawner</span>
          </button>
          <button
            onClick={() => setTab("status")}
            className={`px-2.5 py-1 rounded text-xs font-mono transition-colors flex items-center gap-1.5 ${
              tab === "status"
                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>0.5s Status Ticks</span>
          </button>
          <button
            onClick={() => setTab("draft")}
            className={`px-2.5 py-1 rounded text-xs font-mono transition-colors flex items-center gap-1.5 ${
              tab === "draft"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Dices className="w-3.5 h-3.5" />
            <span>Weighted Draft</span>
          </button>
        </div>
      </div>

      {tab === "director" && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl bg-dark-950/70 border border-dark-800 space-y-3">
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-400">
                    Run Clock (<code>level.time</code>)
                  </span>
                  <span className="text-gold-300 font-semibold">
                    {formatClock(timeSec)} / 15:00 ({timeSec}s)
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={900}
                  step={5}
                  value={timeSec}
                  onChange={(e) => setTimeSec(Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-400">
                    Kindled Shrines (<code>night.lit</code>)
                  </span>
                  <span className="text-emerald-300 font-semibold">
                    {shrinesLit} / 3 Lit
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={3}
                  step={1}
                  value={shrinesLit}
                  onChange={(e) => setShrinesLit(Number(e.target.value))}
                  className="w-full accent-emerald-400"
                />
              </div>

              <div>
                <div className="text-xs font-mono text-slate-400 mb-1.5">
                  Nocturnal Omen (<code>night.portent()</code>)
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {PORTENTS.map((p, idx) => (
                    <button
                      key={p.name}
                      onClick={() => setPortentIdx(idx)}
                      className={`px-2.5 py-1.5 rounded-lg border text-left text-xs font-mono transition-all ${
                        portentIdx === idx
                          ? "bg-dark-850 border-gold-500/50 text-slate-100"
                          : "bg-dark-900/50 border-dark-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <div className={`font-semibold ${p.color}`}>{p.name}</div>
                      <div className="text-[10px] text-slate-500">
                        rate ×{p.rate} • hp ×{p.hp}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-400">
                    Difficulty Pace Multiplier
                  </span>
                  <span className="text-sky-300 font-semibold">
                    ×{difficultyScale.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.75}
                  max={1.5}
                  step={0.05}
                  value={difficultyScale}
                  onChange={(e) => setDifficultyScale(Number(e.target.value))}
                  className="w-full accent-sky-400"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-dark-950/70 border border-dark-800 flex flex-col justify-between space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-2.5 rounded-lg bg-dark-900 border border-dark-800">
                  <div className="text-[10px] font-mono uppercase text-slate-400">
                    Trickle Cadence
                  </div>
                  <div className="text-base font-mono font-bold text-gold-300 mt-0.5">
                    {directorStats.interval.toFixed(2)}s
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    Batch: {directorStats.batchSize} foes / ring
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-dark-900 border border-dark-800">
                  <div className="text-[10px] font-mono uppercase text-slate-400">
                    Dawn Daylight (d²)
                  </div>
                  <div className="text-base font-mono font-bold text-amber-300 mt-0.5">
                    {(directorStats.daylight * 100).toFixed(1)}%
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    {directorStats.left <= 150
                      ? "Sunrise quadratic ramp!"
                      : `Begins in ${directorStats.left - 150}s`}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-dark-900 border border-dark-800">
                  <div className="text-[10px] font-mono uppercase text-slate-400">
                    Active Horde Wave
                  </div>
                  <div className="text-sm font-mono font-bold text-rose-300 mt-0.5 truncate">
                    {directorStats.currentWave.name}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    {directorStats.hordeCount}× {directorStats.currentWave.kind}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-dark-900 border border-dark-800">
                  <div className="text-[10px] font-mono uppercase text-slate-400">
                    Shrine Retaliation
                  </div>
                  <div className="text-sm font-mono font-bold text-emerald-300 mt-0.5">
                    {directorStats.shrineRingCount} Guard Ring
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 truncate">
                    Tier: {directorStats.strongest}
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-dark-900/90 border border-dark-800 text-xs font-mono text-slate-300 leading-relaxed">
                <span className="text-gold-300 font-semibold">
                  Spawner::pick() Mix:
                </span>{" "}
                1.5% <code>Thief</code> (if t &gt; 70s) →{" "}
                <code>b.localChance</code> Biome Specialist →{" "}
                <code>b.strongChance</code> Top-2 Unlocked (
                {directorStats.strongest}) → Common Pool (
                {directorStats.unlockedCount} tiers unlocked).
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "status" && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl bg-dark-950/70 border border-dark-800 space-y-3">
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-400">
                    Burn Power (<code>StatusKind::Burn</code>)
                  </span>
                  <span className="text-amber-300 font-semibold">
                    {burnPower} DPS
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={40}
                  step={1}
                  value={burnPower}
                  onChange={(e) => setBurnPower(Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-400">
                    Poison Power (<code>StatusKind::Poison</code>)
                  </span>
                  <span className="text-emerald-300 font-semibold">
                    {poisonPower} DPS
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={40}
                  step={1}
                  value={poisonPower}
                  onChange={(e) => setPoisonPower(Number(e.target.value))}
                  className="w-full accent-emerald-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-400">
                    Affliction Duration (clamped ≤ 60s)
                  </span>
                  <span className="text-slate-200 font-semibold">
                    {durationSec.toFixed(1)}s
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={10}
                  step={0.1}
                  value={durationSec}
                  onChange={(e) => setDurationSec(Number(e.target.value))}
                  className="w-full accent-gold-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex justify-between text-[11px] font-mono mb-1">
                    <span className="text-sky-300">Chill Input</span>
                    <span>{(chillRaw * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={0.9}
                    step={0.05}
                    value={chillRaw}
                    onChange={(e) => setChillRaw(Number(e.target.value))}
                    className="w-full accent-sky-400"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] font-mono mb-1">
                    <span className="text-rose-300">Marked Input</span>
                    <span>{(markedRaw * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1.3}
                    step={0.05}
                    value={markedRaw}
                    onChange={(e) => setMarkedRaw(Number(e.target.value))}
                    className="w-full accent-rose-400"
                  />
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-dark-950/70 border border-dark-800 flex flex-col justify-between space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-2.5 rounded-lg bg-dark-900 border border-dark-800">
                  <div className="text-[10px] font-mono uppercase text-slate-400">
                    Discrete 0.5s Ticks
                  </div>
                  <div className="text-base font-mono font-bold text-amber-300 mt-0.5">
                    {statusStats.fullHalfSecTicks} ×{" "}
                    {statusStats.perHalfTickDmg.toFixed(1)}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    Fires when <code>elapsed &gt;= 0.5f</code>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-dark-900 border border-dark-800">
                  <div className="text-[10px] font-mono uppercase text-slate-400">
                    Expiry Remainder Tick
                  </div>
                  <div className="text-base font-mono font-bold text-emerald-300 mt-0.5">
                    +{statusStats.remainderDmg.toFixed(1)} dmg
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    Tail: {statusStats.remainderSec}s × power
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-dark-900 border border-dark-800">
                  <div className="text-[10px] font-mono uppercase text-slate-400">
                    Movement (Chill ≤ 65%)
                  </div>
                  <div className="text-base font-mono font-bold text-sky-300 mt-0.5">
                    {(statusStats.moveMult * 100).toFixed(0)}% Speed
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    Clamped: {(statusStats.chillClamped * 100).toFixed(0)}%
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-dark-900 border border-dark-800">
                  <div className="text-[10px] font-mono uppercase text-slate-400">
                    Incoming (Marked ≤ 100%)
                  </div>
                  <div className="text-base font-mono font-bold text-rose-300 mt-0.5">
                    ×{statusStats.incomingMult.toFixed(2)} Dmg
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    Total DoT: {statusStats.totalDoTDmg.toFixed(1)}
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-dark-900/90 border border-dark-800 text-xs font-mono text-slate-300 leading-relaxed">
                <span className="text-rose-300 font-semibold">
                  No Lost Fractional Damage:
                </span>{" "}
                When <code>e.time &lt;= 0</code>,{" "}
                <code>StatusEffects::tick</code> flushes{" "}
                <code>damage(e.power * e.elapsed, e.source)</code> before
                clearing the slot.
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "draft" && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl bg-dark-950/70 border border-dark-800 space-y-3">
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-400">
                    Class Talents Eligible (<code>u-&gt;owner</code> = 3×)
                  </span>
                  <span className="text-gold-300 font-semibold">
                    {classTalentsLeft} items (wt {classTalentsLeft * 3})
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={4}
                  step={1}
                  value={classTalentsLeft}
                  onChange={(e) => setClassTalentsLeft(Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-400">
                    Hero Affinity Pool (<code>hero-&gt;favours</code> = 2×)
                  </span>
                  <span className="text-emerald-300 font-semibold">
                    {affinityItemsLeft} items (wt {affinityItemsLeft * 2})
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={6}
                  step={1}
                  value={affinityItemsLeft}
                  onChange={(e) => setAffinityItemsLeft(Number(e.target.value))}
                  className="w-full accent-emerald-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-400">
                    General Pool Eligible (1× weight)
                  </span>
                  <span className="text-sky-300 font-semibold">
                    {commonItemsLeft} items (wt {commonItemsLeft})
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={20}
                  step={1}
                  value={commonItemsLeft}
                  onChange={(e) => setCommonItemsLeft(Number(e.target.value))}
                  className="w-full accent-sky-400"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  onClick={() => setIsTreasure(!isTreasure)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-colors ${
                    isTreasure
                      ? "bg-gold-500/20 border-gold-500/50 text-gold-300 font-semibold"
                      : "bg-dark-900 border-dark-800 text-slate-400"
                  }`}
                >
                  Treasure Chest: {isTreasure ? "YES" : "NO"}
                </button>
                <button
                  onClick={() => setCanEvolve(!canEvolve)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-colors ${
                    canEvolve
                      ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-semibold"
                      : "bg-dark-900 border-dark-800 text-slate-400"
                  }`}
                >
                  Evolution Ready: {canEvolve ? "YES" : "NO"}
                </button>
                <button
                  onClick={() =>
                    setPlayerLevel((l) => (l >= 4 ? 2 : 6))
                  }
                  className="px-2.5 py-1 rounded-lg text-xs font-mono border bg-dark-900 border-dark-800 text-slate-300"
                >
                  Player Lvl: {playerLevel}
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-dark-950/70 border border-dark-800 flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="text-xs font-mono text-slate-400">
                  1st Card Draw Share (Total Pool Weight:{" "}
                  <span className="text-slate-200 font-semibold">
                    {draftStats.totalWeight}
                  </span>
                  )
                </div>

                <div className="space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-gold-300">Class Talent (3×)</span>
                    <span>{draftStats.pClassFirst.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-dark-850 overflow-hidden">
                    <div
                      className="h-full bg-amber-400"
                      style={{ width: `${draftStats.pClassFirst}%` }}
                    />
                  </div>

                  <div className="flex justify-between">
                    <span className="text-emerald-300">Hero Affinity (2×)</span>
                    <span>{draftStats.pAffinityFirst.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-dark-850 overflow-hidden">
                    <div
                      className="h-full bg-emerald-400"
                      style={{ width: `${draftStats.pAffinityFirst}%` }}
                    />
                  </div>

                  <div className="flex justify-between">
                    <span className="text-sky-300">General Upgrade (1×)</span>
                    <span>{draftStats.pCommonFirst.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-dark-850 overflow-hidden">
                    <div
                      className="h-full bg-sky-400"
                      style={{ width: `${draftStats.pCommonFirst}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-dark-900 border border-dark-800">
                <div className="text-[10px] font-mono uppercase text-slate-400 flex items-center gap-1">
                  <Swords className="w-3 h-3 text-gold-400" />
                  <span>Bonus 4th Card Slot Resolution</span>
                </div>
                <div className="text-xs font-mono font-bold text-gold-300 mt-1">
                  {draftStats.fourthCardLabel}
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                  {draftStats.fourthCardChance}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

