import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Volume2,
  VolumeX,
  Radio,
  Play,
  RotateCcw,
  Sparkles,
  Zap,
  Activity,
  Sliders,
  AlertCircle,
  Flame,
  Swords,
  Footprints,
  Music,
} from "lucide-react";

type LabTab = "mixer" | "spatial" | "eviction";

interface VoiceSlot {
  id: number;
  active: boolean;
  name: string;
  category: "BGM" | "Boss" | "Combat" | "Ambient" | "Footstep";
  priority: number; // 0 (lowest) to 4 (highest)
  age: number; // seconds alive
  volume: number; // 0.0 to 1.0
  distance: number; // in pixels
  stealingFlash: number; // visual blink when stolen
}

const CATEGORY_STYLES: Record<
  VoiceSlot["category"],
  { badge: string; color: string; priority: number }
> = {
  BGM: {
    badge: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    color: "#a855f7",
    priority: 4,
  },
  Boss: {
    badge: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    color: "#f43f5e",
    priority: 3,
  },
  Combat: {
    badge: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    color: "#f59e0b",
    priority: 2,
  },
  Ambient: {
    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    color: "#10b981",
    priority: 1,
  },
  Footstep: {
    badge: "bg-sky-500/20 text-sky-300 border-sky-500/40",
    color: "#38bdf8",
    priority: 0,
  },
};

export const AudioMixerVoiceStealingLab: React.FC = () => {
  const [activeTab, setActiveTab] = useState<LabTab>("mixer");
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
  const [masterVolume, setMasterVolume] = useState<number>(0.5);
  const [listenerDistFalloff, setListenerDistFalloff] = useState<number>(140);
  const [stolenEventsLog, setStolenEventsLog] = useState<string[]>([
    "32-Voice LRU Audio Mixer Initialized.",
  ]);

  // 32 Voice Slots table
  const [voices, setVoices] = useState<VoiceSlot[]>(() =>
    Array.from({ length: 32 }, (_, i) => ({
      id: i,
      active: i === 0, // Slot 0 has BGM by default
      name: i === 0 ? "BGM: Mellangan Theme" : "Empty",
      category: i === 0 ? "BGM" : "Footstep",
      priority: i === 0 ? 4 : 0,
      age: i === 0 ? 12.0 : 0,
      volume: i === 0 ? 0.8 : 0,
      distance: 0,
      stealingFlash: 0,
    }))
  );

  const audioCtxRef = useRef<AudioContext | null>(null);

  // Play synthesized web audio tone if enabled
  const playSynthTone = useCallback(
    (freq: number, type: OscillatorType, dur: number, vol: number) => {
      if (!audioEnabled) return;
      try {
        if (!audioCtxRef.current) {
          const AudioContextClass =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext;
          audioCtxRef.current = new AudioContextClass();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === "suspended") {
          ctx.resume();
        }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(vol * masterVolume * 0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          ctx.currentTime + dur
        );
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + dur);
      } catch {
        // audio context handling
      }
    },
    [audioEnabled, masterVolume]
  );

  // Trigger a sound event using LRU Voice-Stealing
  const triggerSound = useCallback(
    (
      name: string,
      category: VoiceSlot["category"],
      distance: number = 0,
      baseFreq: number = 440
    ) => {
      setVoices((prevVoices) => {
        const next = prevVoices.map((v) => ({ ...v }));

        // Calculate attenuated volume: 1.0 / (1.0 + (d / R)^2)
        const falloffFactor = 1.0 / (1.0 + Math.pow(distance / listenerDistFalloff, 2));
        const effectiveVol = Math.max(0.05, Math.min(1.0, falloffFactor));

        // 1. Look for an empty/inactive slot
        let chosenIndex = next.findIndex((v) => !v.active);

        // 2. If all 32 voices occupied, execute LRU Voice Stealing!
        if (chosenIndex === -1) {
          // Find lowest priority tier
          let minPriority = 99;
          next.forEach((v) => {
            if (v.priority < minPriority) minPriority = v.priority;
          });

          // Check if new sound has strictly higher or equal priority than candidates
          const targetPriority = CATEGORY_STYLES[category].priority;
          if (targetPriority < minPriority) {
            // Cannot preempt: dropped due to priority
            setStolenEventsLog((log) => [
              `[DROPPED] "${name}" (Priority ${targetPriority}) rejected: all 32 voices higher priority.`,
              ...log.slice(0, 18),
            ]);
            return next;
          }

          // In the lowest priority tier, find the OLDEST or QUIETEST voice (Mellangan LRU rule)
          let oldestAge = -1;
          next.forEach((v, idx) => {
            if (v.priority === minPriority && v.age > oldestAge) {
              oldestAge = v.age;
              chosenIndex = idx;
            }
          });

          const victim = next[chosenIndex];
          setStolenEventsLog((log) => [
            `[VOICE STOLEN] Slot #${chosenIndex} ("${victim.name}", Age ${victim.age.toFixed(
              1
            )}s) preempted for "${name}"!`,
            ...log.slice(0, 18),
          ]);
        }

        // Assign to slot
        next[chosenIndex] = {
          id: chosenIndex,
          active: true,
          name,
          category,
          priority: CATEGORY_STYLES[category].priority,
          age: 0,
          volume: effectiveVol,
          distance,
          stealingFlash: 1.0,
        };

        // Synthesize audio
        const oscType: OscillatorType =
          category === "BGM"
            ? "sine"
            : category === "Boss"
            ? "sawtooth"
            : category === "Combat"
            ? "triangle"
            : "square";
        playSynthTone(baseFreq, oscType, 0.35, effectiveVol);

        return next;
      });
    },
    [listenerDistFalloff, playSynthTone]
  );

  // Spam bursts of sounds
  const spamCombatBurst = () => {
    const sfx = [
      { name: "Arrow Whistle", cat: "Combat" as const, dist: 30, freq: 880 },
      { name: "Sword Slash", cat: "Combat" as const, dist: 15, freq: 320 },
      { name: "Shield Block", cat: "Combat" as const, dist: 10, freq: 240 },
      { name: "Wolf Growl", cat: "Combat" as const, dist: 80, freq: 160 },
      { name: "Sparks Clang", cat: "Combat" as const, dist: 25, freq: 950 },
      { name: "Crit Impact", cat: "Combat" as const, dist: 40, freq: 520 },
    ];
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        const item = sfx[Math.floor(Math.random() * sfx.length)];
        triggerSound(
          item.name,
          item.cat,
          item.dist + Math.random() * 60,
          item.freq + Math.random() * 80 - 40
        );
      }, i * 35);
    }
  };

  const spamMobSwarmBurst = () => {
    for (let i = 0; i < 16; i++) {
      setTimeout(() => {
        triggerSound(
          `Swarm Screech #${i + 1}`,
          "Footstep",
          50 + Math.random() * 120,
          180 + Math.random() * 400
        );
      }, i * 25);
    }
  };

  const triggerBossSmash = () => {
    triggerSound("BOSS: Terra Quake", "Boss", 20, 110);
    setTimeout(() => {
      triggerSound("BOSS: Roar Stun", "Boss", 30, 95);
    }, 120);
  };

  // Aging loop
  useEffect(() => {
    const timer = setInterval(() => {
      setVoices((prev) =>
        prev.map((v) => {
          if (!v.active) return v;
          const newAge = v.age + 0.1;
          const flash = Math.max(0, v.stealingFlash - 0.15);

          // Natural voice decay (SFX finish after 1.8s - 3.5s, BGM stays indefinitely)
          const maxDur =
            v.category === "BGM"
              ? 9999
              : v.category === "Boss"
              ? 3.8
              : v.category === "Combat"
              ? 2.2
              : 1.4;
          if (newAge > maxDur) {
            return {
              ...v,
              active: false,
              name: "Empty",
              age: 0,
              volume: 0,
              stealingFlash: 0,
            };
          }
          return { ...v, age: newAge, stealingFlash: flash };
        })
      );
    }, 100);
    return () => clearInterval(timer);
  }, []);

  const activeCount = voices.filter((v) => v.active).length;

  return (
    <div className="my-8 rounded-2xl border border-dark-750 bg-[#0c0a14] shadow-2xl overflow-hidden font-sans">
      {/* Header Banner */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-950/40 via-dark-900 to-dark-950 border-b border-dark-750 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-inner">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              32-Voice LRU Audio Mixer &amp; Polyphonic Stealing Lab
              <span className="px-2 py-0.5 text-[10px] uppercase font-mono tracking-wider rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                Chapter 11 Audio QA
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Interactive polyphony visualizer for Mellangan's zero-allocation
              32-voice audio buffer, distance falloff &amp; priority eviction.
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 bg-dark-950/80 p-1 rounded-xl border border-dark-800">
          <button
            type="button"
            onClick={() => setActiveTab("mixer")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "mixer"
                ? "bg-purple-500 text-dark-950 font-bold shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            32-Slot Matrix
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("spatial")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "spatial"
                ? "bg-purple-500 text-dark-950 font-bold shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Distance Falloff
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("eviction")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "eviction"
                ? "bg-purple-500 text-dark-950 font-bold shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Eviction Hierarchy
          </button>
        </div>
      </div>

      {activeTab === "mixer" && (
        <div className="p-4 sm:p-6 space-y-5">
          {/* Status & Volume Controls */}
          <div className="p-3 rounded-xl bg-dark-900 border border-dark-750 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setAudioEnabled((a) => !a)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono border flex items-center gap-2 transition-all ${
                  audioEnabled
                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                    : "bg-dark-850 border-dark-700 text-slate-400 hover:text-slate-200"
                }`}
              >
                {audioEnabled ? (
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <VolumeX className="w-4 h-4 text-slate-500" />
                )}
                Synthesizer: {audioEnabled ? "ENABLED (Live Audio)" : "MUTED"}
              </button>

              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <span>Vol:</span>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={masterVolume}
                  onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
                  className="w-20 accent-purple-400"
                />
                <span>{Math.round(masterVolume * 100)}%</span>
              </div>
            </div>

            <div className="flex items-center gap-3 font-mono text-xs">
              <span className="text-slate-400">Active Polyphony:</span>
              <span
                className={`px-2.5 py-0.5 rounded font-bold border ${
                  activeCount >= 32
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse"
                    : activeCount >= 24
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                }`}
              >
                {activeCount} / 32 CHANNELS
              </span>
            </div>
          </div>

          {/* Sound Action Triggers */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              type="button"
              onClick={spamCombatBurst}
              className="p-3 rounded-xl bg-dark-850 hover:bg-dark-800 border border-dark-700 hover:border-amber-500/50 text-xs font-mono text-slate-200 flex items-center justify-center gap-2 transition-all shadow"
            >
              <Swords className="w-4 h-4 text-amber-400" />
              Combat Clang (8 Voices)
            </button>
            <button
              type="button"
              onClick={spamMobSwarmBurst}
              className="p-3 rounded-xl bg-dark-850 hover:bg-dark-800 border border-dark-700 hover:border-sky-500/50 text-xs font-mono text-slate-200 flex items-center justify-center gap-2 transition-all shadow"
            >
              <Footprints className="w-4 h-4 text-sky-400" />
              Swarm Screech (16 Voices)
            </button>
            <button
              type="button"
              onClick={triggerBossSmash}
              className="p-3 rounded-xl bg-dark-850 hover:bg-dark-800 border border-dark-700 hover:border-rose-500/50 text-xs font-mono text-slate-200 flex items-center justify-center gap-2 transition-all shadow"
            >
              <Flame className="w-4 h-4 text-rose-400" />
              Boss Shockwave (Priority 3)
            </button>
            <button
              type="button"
              onClick={() => {
                setVoices((prev) =>
                  prev.map((v, i) =>
                    i === 0
                      ? v
                      : {
                          ...v,
                          active: false,
                          name: "Empty",
                          age: 0,
                          volume: 0,
                          stealingFlash: 0,
                        }
                  )
                );
                setStolenEventsLog(["Cleared channels."]);
              }}
              className="p-3 rounded-xl bg-dark-850 hover:bg-dark-800 border border-dark-700 text-xs font-mono text-slate-300 flex items-center justify-center gap-2 transition-all"
            >
              <RotateCcw className="w-4 h-4 text-slate-400" />
              Flush Audio Buffer
            </button>
          </div>

          {/* 32 Channel Slots Matrix */}
          <div>
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
              <span>Hardware Voice Buffer (Slots #0 - #31)</span>
              <span>Gold flash = LRU Voice Preempted &amp; Stolen</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
              {voices.map((slot) => {
                const style = CATEGORY_STYLES[slot.category];
                const isFlash = slot.stealingFlash > 0;
                return (
                  <div
                    key={slot.id}
                    className={`p-2 rounded-xl border transition-all flex flex-col justify-between h-20 ${
                      isFlash
                        ? "bg-amber-500/30 border-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.5)] scale-[1.02]"
                        : slot.active
                        ? "bg-dark-900 border-dark-700"
                        : "bg-dark-950/60 border-dark-850 opacity-45"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-slate-500 font-bold">
                        #{slot.id.toString().padStart(2, "0")}
                      </span>
                      {slot.active && (
                        <span
                          className={`px-1 py-0.2 rounded text-[9px] border ${style.badge}`}
                        >
                          P{slot.priority}
                        </span>
                      )}
                    </div>

                    <div className="my-1">
                      <div className="text-[11px] font-mono text-slate-200 truncate font-semibold">
                        {slot.name}
                      </div>
                      {slot.active && (
                        <div className="text-[9px] font-mono text-slate-400">
                          {slot.age.toFixed(1)}s alive
                        </div>
                      )}
                    </div>

                    {/* Mini VU Volume Bar */}
                    <div className="w-full h-1.5 rounded-full bg-dark-950 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-100"
                        style={{
                          width: `${slot.active ? slot.volume * 100 : 0}%`,
                          backgroundColor: style.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Real-time Stealing Log */}
          <div className="p-3 rounded-xl bg-dark-950 border border-dark-800 space-y-1.5">
            <div className="text-xs font-mono text-amber-400 font-bold flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              LRU Voice Stealing Telemetry Log:
            </div>
            <div className="max-h-24 overflow-y-auto space-y-1 font-mono text-[11px] text-slate-300">
              {stolenEventsLog.map((log, idx) => (
                <div
                  key={idx}
                  className={
                    log.includes("[VOICE STOLEN]")
                      ? "text-amber-300 font-semibold"
                      : log.includes("[DROPPED]")
                      ? "text-rose-400"
                      : "text-slate-400"
                  }
                >
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "spatial" && (
        <div className="p-4 sm:p-6 space-y-6">
          <div className="p-4 rounded-xl bg-dark-900 border border-dark-850">
            <h4 className="text-sm font-bold text-slate-100 mb-2">
              Quadratic Distance Attenuation Invariant
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Mellangan avoids expensive square roots in hot audio mixing loops
              by applying rational quadratic falloff over distance $d$ relative
              to reference hearing radius $R$:
            </p>
            <div className="p-3 rounded-lg bg-dark-950 border border-dark-800 text-xs font-mono text-emerald-400">
              A(d) = \frac&#123;1.0&#125;&#123;1.0 + (d / R)^2&#125;
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-3 rounded-xl bg-dark-900 border border-dark-800">
              <span className="text-slate-400 block mb-1">Point Blank (d = 0):</span>
              <span className="text-sky-300 font-bold text-sm">1.0 (100% Vol)</span>
            </div>
            <div className="p-3 rounded-xl bg-dark-900 border border-dark-800">
              <span className="text-slate-400 block mb-1">Half-Radius (d = R):</span>
              <span className="text-amber-300 font-bold text-sm">0.5 (50% Vol)</span>
            </div>
            <div className="p-3 rounded-xl bg-dark-900 border border-dark-800">
              <span className="text-slate-400 block mb-1">Far Flank (d = 2R):</span>
              <span className="text-purple-300 font-bold text-sm">0.2 (20% Vol)</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === "eviction" && (
        <div className="p-4 sm:p-6 space-y-6">
          <div className="p-4 rounded-xl bg-dark-900 border border-dark-800">
            <h4 className="text-sm font-bold text-slate-100 mb-3">
              Mellangan Audio Priority Tiers
            </h4>
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-dark-950 border border-purple-500/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                  <strong className="text-purple-300">Priority 4: BGM Stream</strong>
                </div>
                <span className="text-slate-400 font-mono">NEVER PREEMPTED</span>
              </div>
              <div className="p-3 rounded-lg bg-dark-950 border border-rose-500/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                  <strong className="text-rose-300">Priority 3: Boss Omens &amp; Stingers</strong>
                </div>
                <span className="text-slate-400 font-mono">Preempts P0-P2</span>
              </div>
              <div className="p-3 rounded-lg bg-dark-950 border border-amber-500/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <strong className="text-amber-300">Priority 2: Combat Hits &amp; Weapons</strong>
                </div>
                <span className="text-slate-400 font-mono">Preempts P0-P1</span>
              </div>
              <div className="p-3 rounded-lg bg-dark-950 border border-emerald-500/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <strong className="text-emerald-300">Priority 1: Environmental Ambient</strong>
                </div>
                <span className="text-slate-400 font-mono">Preempts P0</span>
              </div>
              <div className="p-3 rounded-lg bg-dark-950 border border-sky-500/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                  <strong className="text-sky-300">Priority 0: Footsteps &amp; Micro Sparks</strong>
                </div>
                <span className="text-amber-300 font-mono font-bold">First to be stolen</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

