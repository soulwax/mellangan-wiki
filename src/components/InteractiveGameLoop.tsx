import React, { useState, useEffect } from "react";
import { Play, Pause, SkipForward, RefreshCw, Activity } from "lucide-react";

interface Stage {
  id: string;
  profSlot: string;
  name: string;
  subsystem: string;
  desc: string;
  codeTrace: string;
  timeCost: string;
  ms: number;
  color: string;
}

const STAGES: Stage[] = [
  {
    id: "housekeep",
    profSlot: "PROF_HOUSEKEEP (Slot 3)",
    name: "Housekeeping & CSR Grid",
    subsystem: "Level::tick() / Level::buildGrid()",
    desc: "Advances night.tick(), spawner.tick(), explore(), hunt(), climate(), weather(), and rebuilds the Compressed Sparse Row (CSR) prefix-sum spatial grid (cellStart[], cells[]) for O(1) neighbor queries. A second housekeeping interval flushes deferred entity changes after particle processing.",
    codeTrace:
      "night.tick() -> spawner.tick() -> buildGrid() -> events.tick(*this) ... flush()",
    timeCost: "0.28 ms",
    ms: 0.28,
    color: "#38bdf8",
  },
  {
    id: "think",
    profSlot: "PROF_THINK (Slot 0)",
    name: "4-Barrier Parallel AI",
    subsystem: "Workers::shared().run(n, 256, ...)",
    desc: "Dispatches 4 ordered parallel fork-join passes (grain=256) across all worker threads: Barrier 1: think() evaluates Sense & GoalQueue. Barrier 2: move() integrates velocity & Level::collide. Barrier 3: push() reads CSR grid to compute xPush/yPush without mutating positions. Barrier 4: settle() commits xPush/yPush.",
    codeTrace:
      "workers.run(think) -> workers.run(move) -> workers.run(push) -> workers.run(settle)",
    timeCost: "0.82 ms",
    ms: 0.82,
    color: "#a855f7",
  },
  {
    id: "entities",
    profSlot: "PROF_ENTITIES (Slot 1)",
    name: "ECS Owned Entity Tick",
    subsystem: "reg.view<Owned>().each()",
    desc: "Iterates all valid EnTT entities holding an Owned component. Ticks status afflictions (Burn, Chill, Poison, Marked), boss phase enrages, weapon cooldowns (tickKit), projectile kinematics (RecipeShot), and player contact damage.",
    codeTrace:
      "for (auto [id, o] : reg.view<Owned>().each()) if (!o.self->removed) o.self->tick();",
    timeCost: "0.44 ms",
    ms: 0.44,
    color: "#f6c324",
  },
  {
    id: "particles",
    profSlot: "PROF_PARTICLES (Slot 2)",
    name: "Particle Compaction",
    subsystem: "Level::particles[] (In-Place Sweep)",
    desc: "Ticks all active visual effects (Arc, Shockwave, Spark, Drift, BloodDebris, TextParticle) and performs an in-place two-pointer compaction (particles[alive++] = std::move(p)) to reclaim expired particles in a single linear pass.",
    codeTrace:
      "tick live particles -> compact survivors -> resize",
    timeCost: "0.31 ms",
    ms: 0.31,
    color: "#ec4899",
  },
  {
    id: "light",
    profSlot: "PROF_LIGHT (Slot 4)",
    name: "Scatter & LightField",
    subsystem: "Level::renderLight(Screen &s)",
    desc: "Populates bit-packed surfaces[] (water/ice, 2-bit height, ramp flag) and visible props[], then renders additive light glows into the offscreen lightmap texture while registering up to 8 LightField shadow casters with dual-octave Perlin flicker.",
    codeTrace:
      "scatter(s) -> lights.clear() -> player->drawLight(s) -> night.renderLight(s)",
    timeCost: "0.38 ms",
    ms: 0.38,
    color: "#f97316",
  },
  {
    id: "floor",
    profSlot: "PROF_FLOOR (Slot 5)",
    name: "Barycentric Floor & Cliffs",
    subsystem: "Level::renderFloor(Screen &s)",
    desc: "Renders visible 16x16 world tiles with cumulative-alpha barycentric transition blending (FloorPainter::blend), 4-bit cardinal bitmask auto-tiled cliffs (RIM[16]), snow rims, flood pools, and biome ground events.",
    codeTrace:
      "renderFloor(s) -> sky.renderGround(s) -> events.render(s, *this)",
    timeCost: "0.64 ms",
    ms: 0.64,
    color: "#10b981",
  },
  {
    id: "sort",
    profSlot: "PROF_SORT (Slot 6)",
    name: "64-Bit Radix Y-Sort",
    subsystem: "radixSort(keys, keysTmp)",
    desc: "Frustum-culls Owned entities, particles, and props into drawn[], packing 64-bit keys (layer<<56 | orderedBits(y)<<24 | idx). Executes a 3-pass 12-bit LSD Radix Sort (shifts 24, 36, 48; 4096 buckets) for O(N) strict Y-depth ordering.",
    codeTrace:
      "keys.push_back(layer<<56 | orderedBits(y)<<24 | idx) -> radixSort(keys, keysTmp)",
    timeCost: "0.19 ms",
    ms: 0.19,
    color: "#06b6d4",
  },
  {
    id: "draw",
    profSlot: "PROF_DRAW (Slot 7)",
    name: "Reflections, Shadows & Draw",
    subsystem: "Level::render(Screen &s)",
    desc: "Renders planar water reflections (s.mirror), projects directional LightField contact shadows when transitioning to Layer 1, clips submerged swimmers (s.submerge(y - 5)), draws sorted sprites, and composites atmospheric weather.",
    codeTrace:
      "reflect(s) -> lights.cast(...) -> s.submerge(...) -> e->draw(s) -> sky.render(s, air)",
    timeCost: "0.95 ms",
    ms: 0.95,
    color: "#ef4444",
  },
];

const TOTAL_ACTIVE_MS = STAGES.reduce((acc, s) => acc + s.ms, 0);

export const InteractiveGameLoop: React.FC = () => {
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [frameCounter, setFrameCounter] = useState<number>(4096);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentStageIndex((prev) => {
        const next = (prev + 1) % STAGES.length;
        if (next === 0) {
          setFrameCounter((f) => f + 1);
        }
        return next;
      });
    }, 950);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const activeStage = STAGES[currentStageIndex];

  return (
    <div className="my-5 rounded-2xl border border-dark-750 bg-dark-900/90 overflow-hidden shadow-xl">
      <div className="px-4 py-3 bg-dark-950/90 border-b border-dark-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono font-semibold text-slate-200">
            Illustrative Profiler Stages (<code className="text-gold-300">src/Prof.c</code>)
          </span>
        </div>

        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-dark-900 border border-dark-750 text-gold-400">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>#{frameCounter}</span>
          </div>
          <div className="px-2 py-1 rounded bg-dark-900 border border-dark-750 text-emerald-400">
            Example: {TOTAL_ACTIVE_MS.toFixed(2)} ms active
          </div>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-dark-850 hover:bg-dark-800 border border-dark-700 text-slate-200 transition-colors"
          >
            {isPlaying ? (
              <Pause className="w-3 h-3 text-amber-400" />
            ) : (
              <Play className="w-3 h-3 text-emerald-400" />
            )}
            <span>{isPlaying ? "Pause" : "Play"}</span>
          </button>
          <button
            onClick={() => {
              setIsPlaying(false);
              setCurrentStageIndex((prev) => (prev + 1) % STAGES.length);
            }}
            className="flex items-center gap-1 px-2 py-1 rounded bg-dark-850 hover:bg-dark-800 border border-dark-700 text-slate-300 transition-colors"
          >
            <SkipForward className="w-3 h-3" />
            <span>Step</span>
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Illustrative CPU breakdown (not live measurements)</span>
            <span className="text-emerald-400">Example timings</span>
          </div>
          <div className="h-3 w-full rounded-lg bg-dark-950 border border-dark-800 overflow-hidden flex p-0.5 gap-0.5">
            {STAGES.map((stage, idx) => {
              const widthPct = (stage.ms / TOTAL_ACTIVE_MS) * 100;
              const isActive = idx === currentStageIndex;
              return (
                <button
                  key={stage.id}
                  onClick={() => {
                    setIsPlaying(false);
                    setCurrentStageIndex(idx);
                  }}
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: stage.color,
                    opacity: isActive ? 1 : 0.45,
                  }}
                  className="h-full first:rounded-l last:rounded-r transition-opacity hover:opacity-90"
                  title={`${stage.name}: ${stage.timeCost}`}
                />
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {STAGES.map((stage, idx) => {
            const isActive = idx === currentStageIndex;
            return (
              <button
                key={stage.id}
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentStageIndex(idx);
                }}
                className={`relative p-2.5 rounded-xl border text-left transition-all duration-150 flex flex-col justify-between ${
                  isActive
                    ? "bg-dark-850 shadow-md"
                    : "bg-dark-950/60 hover:bg-dark-850/60 border-dark-800 opacity-80"
                }`}
                style={{
                  borderColor: isActive ? stage.color : undefined,
                }}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 truncate">
                    {idx + 1}. {stage.id}
                  </span>
                  <span
                    className="text-[10px] font-mono font-bold shrink-0"
                    style={{ color: isActive ? stage.color : "#94a3b8" }}
                  >
                    {stage.timeCost}
                  </span>
                </div>
                <div className="text-xs font-semibold text-slate-200 truncate">
                  {stage.name}
                </div>
              </button>
            );
          })}
        </div>

        <div
          className="p-4 rounded-xl border bg-dark-950/80 relative overflow-hidden space-y-2.5"
          style={{ borderColor: `${activeStage.color}50` }}
        >
          <div
            className="absolute top-0 left-0 h-0.5 w-full"
            style={{ backgroundColor: activeStage.color }}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: `${activeStage.color}20`,
                    color: activeStage.color,
                  }}
                >
                  {activeStage.profSlot}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {activeStage.subsystem}
                </span>
              </div>
              <h4 className="text-base font-bold text-slate-100 mt-1">
                {activeStage.name}
              </h4>
            </div>
            <div className="text-right font-mono">
              <div
                className="text-lg font-bold"
                style={{ color: activeStage.color }}
              >
                {activeStage.timeCost}{" "}
                <span className="text-xs font-normal text-slate-500">
                  ({((activeStage.ms / TOTAL_ACTIVE_MS) * 100).toFixed(1)}% CPU)
                </span>
              </div>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {activeStage.desc}
          </p>

          <div className="p-2.5 rounded-lg bg-dark-900 border border-dark-800 font-mono text-xs text-gold-300 flex items-center gap-2 overflow-x-auto">
            <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <code className="whitespace-nowrap">{activeStage.codeTrace}</code>
          </div>
        </div>
      </div>
    </div>
  );
};
