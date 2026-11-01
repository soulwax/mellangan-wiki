import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipForward, Cpu, Layers, Eye, RefreshCw } from 'lucide-react';

interface Stage {
  id: string;
  name: string;
  subsystem: string;
  desc: string;
  timeCost: string;
  color: string;
}

const STAGES: Stage[] = [
  {
    id: 'input',
    name: 'SDL3 Event Polling',
    subsystem: 'Input / Window',
    desc: 'Pumps SDL_PollEvent, updates keyboard & mouse state vectors, evaluates click/held/released triggers.',
    timeCost: '0.12 ms',
    color: '#38bdf8',
  },
  {
    id: 'fixed-tick',
    name: 'Fixed Timestep Loop',
    subsystem: 'Game::tick()',
    desc: 'Accumulates frame delta time, executing fixed 1/60s ticks (DT = 0.016s). Synchronizes night timers & omens.',
    timeCost: '0.45 ms',
    color: '#f6c324',
  },
  {
    id: 'workers',
    name: 'Worker Thread Pool',
    subsystem: 'Workers.hpp (AI / GOAP)',
    desc: 'Dispatches multi-threaded steering and goal evaluation across CPU cores. Parallel pathing & hazard aversion.',
    timeCost: '0.85 ms',
    color: '#a855f7',
  },
  {
    id: 'ecs-collision',
    name: 'Slab / Spatial Collision',
    subsystem: 'Pool.c & Level::collide',
    desc: 'Resolves entity bounding boxes, gem magnet attraction, projectile impacts and player hitboxes without heap allocs.',
    timeCost: '0.62 ms',
    color: '#ef4444',
  },
  {
    id: 'vulkan-pass',
    name: 'Vulkan2D Render Pass',
    subsystem: 'VK2D Pipeline & Shaders',
    desc: 'Binds screenTarget texture, uploads dynamic lights, batches instanced atlas sprites, applies flash & post SPV shaders.',
    timeCost: '1.40 ms',
    color: '#10b981',
  },
  {
    id: 'present',
    name: 'Swapchain Presentation',
    subsystem: 'vk2dRendererPresent',
    desc: 'Submits command buffers, handles Vulkan semaphore synchronization, and presents frame to the display.',
    timeCost: '0.30 ms',
    color: '#ec4899',
  },
];

export const InteractiveGameLoop: React.FC = () => {
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [fps, setFps] = useState<number>(60);
  const [frameCounter, setFrameCounter] = useState<number>(1420);

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
    }, 700);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const activeStage = STAGES[currentStageIndex];

  return (
    <div className="my-8 rounded-xl border border-dark-700 bg-dark-900/90 overflow-hidden shadow-2xl backdrop-blur-sm">
      <div className="px-5 py-3 bg-dark-850/90 border-b border-dark-700/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-mono text-sm font-semibold text-slate-200">Interactive Frame Pipeline Simulator</span>
          <span className="text-[11px] px-2 py-0.5 rounded bg-dark-750 text-slate-400 font-mono">60 Hz Target</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-dark-800 border border-dark-700 text-xs font-mono text-gold-400">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Frame #{frameCounter}</span>
          </div>
          <div className="px-2.5 py-1 rounded bg-dark-800 border border-dark-700 text-xs font-mono text-emerald-400">
            {fps} FPS
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
        {/* Pipeline Bar */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-6">
          {STAGES.map((stage, idx) => {
            const isActive = idx === currentStageIndex;
            return (
              <button
                key={stage.id}
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentStageIndex(idx);
                }}
                className={`relative p-3 rounded-lg border text-left transition-all duration-200 flex flex-col justify-between ${
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
                <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 mb-1">
                  Step 0{idx + 1}
                </div>
                <div className="text-xs font-semibold text-slate-200 truncate">{stage.name}</div>
                <div
                  className="text-[11px] font-mono mt-2"
                  style={{ color: isActive ? stage.color : '#94a3b8' }}
                >
                  {stage.timeCost}
                </div>
              </button>
            );
          })}
        </div>

        {/* Detailed Stage Card */}
        <div
          className="p-5 rounded-xl border bg-dark-850/90 relative overflow-hidden"
          style={{ borderColor: `${activeStage.color}40` }}
        >
          <div
            className="absolute top-0 left-0 h-1 w-full"
            style={{ backgroundColor: activeStage.color }}
          ></div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: `${activeStage.color}20`,
                    color: activeStage.color,
                  }}
                >
                  {activeStage.subsystem}
                </span>
                <span className="text-xs text-slate-400 font-mono">Stage 0{currentStageIndex + 1} of 06</span>
              </div>
              <h4 className="text-lg font-bold text-slate-100 mt-1">{activeStage.name}</h4>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase text-slate-500 font-mono">Simulated Frame Budget</div>
              <div className="text-xl font-bold font-mono" style={{ color: activeStage.color }}>
                {activeStage.timeCost}{' '}
                <span className="text-xs font-normal text-slate-400">/ 16.6 ms</span>
              </div>
            </div>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{activeStage.desc}</p>
        </div>
      </div>
    </div>
  );
};

