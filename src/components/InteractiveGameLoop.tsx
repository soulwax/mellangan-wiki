import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipForward, RefreshCw, Activity } from 'lucide-react';

interface Stage {
  id: string;
  profSlot: string;
  name: string;
  subsystem: string;
  desc: string;
  codeTrace: string;
  timeCost: string;
  color: string;
}

const STAGES: Stage[] = [
  {
    id: 'housekeep',
    profSlot: 'PROF_HOUSEKEEP (Slot 3)',
    name: 'Housekeeping & CSR Grid Build',
    subsystem: 'Level::tick() / Level::buildGrid()',
    desc: 'Advances night.tick(), spawner.tick(), explore(), hunt(), climate(), weather(), and rebuilds the Compressed Sparse Row (CSR) prefix-sum spatial grid (cellStart[], cells[]) for O(1) neighbor queries. Flushes dead entities and emplaces pending Owned entities at frame end.',
    codeTrace: 'night.tick() -> spawner.tick() -> buildGrid() -> events.tick(*this) ... flush()',
    timeCost: '0.28 ms',
    color: '#38bdf8',
  },
  {
    id: 'think',
    profSlot: 'PROF_THINK (Slot 0)',
    name: '4-Barrier Parallel Enemy AI',
    subsystem: 'Workers::shared().run(n, 256, ...)',
    desc: 'Dispatches 4 sequential lock-free parallel fork-join passes (grain=256) across all worker threads: Barrier 1: think() evaluates Sense & GoalQueue. Barrier 2: move() integrates velocity & Level::collide. Barrier 3: push() reads CSR grid to compute xPush/yPush without mutating positions. Barrier 4: settle() commits xPush/yPush.',
    codeTrace: 'workers.run(think) -> workers.run(move) -> workers.run(push) -> workers.run(settle)',
    timeCost: '0.82 ms',
    color: '#a855f7',
  },
  {
    id: 'entities',
    profSlot: 'PROF_ENTITIES (Slot 1)',
    name: 'ECS Owned Entity Tick',
    subsystem: 'reg.view<Owned>().each()',
    desc: 'Iterates all valid EnTT entities holding an Owned component. Ticks status afflictions (Burn, Chill, Poison, Marked), boss phase enrages, weapon cooldowns (tickKit), projectile kinematics (RecipeShot), and player contact damage.',
    codeTrace: 'for (auto [id, o] : reg.view<Owned>().each()) if (!o.self->removed) o.self->tick();',
    timeCost: '0.44 ms',
    color: '#f6c324',
  },
  {
    id: 'particles',
    profSlot: 'PROF_PARTICLES (Slot 2)',
    name: 'Particle & Debris Compaction',
    subsystem: 'Level::particles[] (In-Place Sweep)',
    desc: 'Ticks all active visual effects (Arc, Shockwave, Spark, Drift, BloodDebris, TextParticle) and performs an in-place two-pointer compaction (particles[alive++] = std::move(p)) to reclaim expired particles in a single linear pass.',
    codeTrace: 'for (auto &p : particles) if (!p->removed) particles[alive++] = std::move(p);',
    timeCost: '0.31 ms',
    color: '#ec4899',
  },
  {
    id: 'light',
    profSlot: 'PROF_LIGHT (Slot 4)',
    name: 'Scatter & Dynamic LightField',
    subsystem: 'Level::renderLight(Screen &s)',
    desc: 'Populates bit-packed surfaces[] (water/ice, 2-bit height, ramp flag) and visible props[], then renders additive light glows into the offscreen lightmap texture while registering up to 64 LightField shadow casters with dual-octave Perlin flicker.',
    codeTrace: 'scatter(s) -> lights.clear() -> player->drawLight(s) -> night.renderLight(s)',
    timeCost: '0.38 ms',
    color: '#f97316',
  },
  {
    id: 'floor',
    profSlot: 'PROF_FLOOR (Slot 5)',
    name: 'Barycentric Floor & 4-Bit Cliffs',
    subsystem: 'Level::renderFloor(Screen &s)',
    desc: 'Renders visible 16x16 world tiles with 3-biome barycentric transition blending (GroundBlend), 4-bit cardinal bitmask auto-tiled cliffs (mask = N | S<<1 | W<<2 | E<<3), snow rims, flood pools, and biome ground events.',
    codeTrace: 'renderFloor(s) -> sky.renderGround(s) -> events.render(s, *this)',
    timeCost: '0.64 ms',
    color: '#10b981',
  },
  {
    id: 'sort',
    profSlot: 'PROF_SORT (Slot 6)',
    name: '64-Bit Key Pack & 3-Pass Radix Sort',
    subsystem: 'radixSort(keys, keysTmp)',
    desc: 'Frustum-culls Owned entities, particles, and props into drawn[], packing 64-bit keys (layer<<56 | orderedBits(y)<<24 | idx). Executes a 3-pass 12-bit LSD Radix Sort (shifts 24, 36, 48; 4096 buckets) for O(N) strict Y-depth ordering.',
    codeTrace: 'keys.push_back(layer<<56 | orderedBits(y)<<24 | idx) -> radixSort(keys, keysTmp)',
    timeCost: '0.19 ms',
    color: '#06b6d4',
  },
  {
    id: 'draw',
    profSlot: 'PROF_DRAW (Slot 7)',
    name: 'Planar Reflections, Shadows & Draw',
    subsystem: 'Level::render(Screen &s)',
    desc: 'Renders planar water reflections (s.mirror), projects directional LightField contact shadows when transitioning to Layer 1, clips submerged swimmers (s.submerge(y - 5)), draws sorted sprites, and composites atmospheric weather.',
    codeTrace: 'reflect(s) -> lights.cast(...) -> s.submerge(...) -> e->draw(s) -> sky.render(s, air)',
    timeCost: '0.95 ms',
    color: '#ef4444',
  },
];

export const InteractiveGameLoop: React.FC = () => {
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [fps, setFps] = useState<number>(60);
  const [frameCounter, setFrameCounter] = useState<number>(4096);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentStageIndex((prev) => {
        const next = (prev + 1) % STAGES.length;
        if (next === 0) {
          setFrameCounter((f) => f + 1);
          setFps(Math.floor(59 + Math.random() * 3));
        }
        return next;
      });
    }, 850);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const activeStage = STAGES[currentStageIndex];

  return (
    <div className="my-8 rounded-xl border border-dark-700 bg-dark-900/90 overflow-hidden shadow-2xl backdrop-blur-sm">
      <div className="px-5 py-3 bg-dark-850/90 border-b border-dark-700/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-mono text-sm font-semibold text-slate-200">
            8-Slot Hardware Telemetry Simulator (<code className="text-gold-300">src/Prof.c</code>)
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded bg-dark-750 text-slate-400 font-mono">
            SDL_GetPerformanceCounter()
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-dark-800 border border-dark-700 text-xs font-mono text-gold-400">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Tick #{frameCounter}</span>
          </div>
          <div className="px-2.5 py-1 rounded bg-dark-800 border border-dark-700 text-xs font-mono text-emerald-400">
            {fps} FPS (DT=16.6ms)
          </div>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1 px-3 py-1 rounded bg-dark-750 hover:bg-dark-700 border border-dark-600 text-slate-200 font-mono transition-colors"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>
          <button
            onClick={() => {
              setIsPlaying(false);
              setCurrentStageIndex((prev) => (prev + 1) % STAGES.length);
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-dark-750 hover:bg-dark-700 border border-dark-600 text-slate-300 font-mono transition-colors"
          >
            <SkipForward className="w-3.5 h-3.5" />
            <span>Step</span>
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-6">
          {STAGES.map((stage, idx) => {
            const isActive = idx === currentStageIndex;
            return (
              <button
                key={stage.id}
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentStageIndex(idx);
                }}
                className={`relative p-2.5 rounded-lg border text-left transition-all duration-200 flex flex-col justify-between ${
                  isActive
                    ? 'bg-dark-800/90 shadow-lg'
                    : 'bg-dark-850/60 hover:bg-dark-800/50 border-dark-700/60 opacity-75'
                }`}
                style={{
                  borderColor: isActive ? stage.color : undefined,
                  boxShadow: isActive ? `0 0 16px -2px ${stage.color}33` : undefined,
                }}
              >
                {isActive && (
                  <span
                    className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  ></span>
                )}
                <div className="text-[9px] uppercase font-mono tracking-wider text-slate-400 mb-1 truncate">
                  {stage.id}
                </div>
                <div className="text-[11px] font-semibold text-slate-200 line-clamp-2 leading-tight">
                  {stage.name}
                </div>
                <div
                  className="text-[10px] font-mono mt-2 font-bold"
                  style={{ color: isActive ? stage.color : '#94a3b8' }}
                >
                  {stage.timeCost}
                </div>
              </button>
            );
          })}
        </div>

        <div
          className="p-5 rounded-xl border bg-dark-850/90 relative overflow-hidden space-y-3"
          style={{ borderColor: `${activeStage.color}40` }}
        >
          <div
            className="absolute top-0 left-0 h-1 w-full"
            style={{ backgroundColor: activeStage.color }}
          ></div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                <span className="text-xs text-slate-300 font-mono">{activeStage.subsystem}</span>
              </div>
              <h4 className="text-lg font-bold text-slate-100 mt-1">{activeStage.name}</h4>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase text-slate-500 font-mono">Measured CPU Time</div>
              <div className="text-xl font-bold font-mono" style={{ color: activeStage.color }}>
                {activeStage.timeCost}{' '}
                <span className="text-xs font-normal text-slate-400">/ 16.67 ms</span>
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{activeStage.desc}</p>
          <div className="p-2.5 rounded-lg bg-dark-950 border border-dark-800 font-mono text-xs text-gold-300 flex items-center gap-2 overflow-x-auto">
            <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <code>{activeStage.codeTrace}</code>
          </div>
        </div>
      </div>
    </div>
  );
};
