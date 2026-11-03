import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Sun,
  Moon,
  CloudRain,
  CloudFog,
  Wind,
  Footprints,
  Sparkles,
  Sliders,
  Play,
  Pause,
  RotateCcw,
  Compass,
} from "lucide-react";

type WeatherPreset = "clear" | "rain" | "fog" | "ash" | "bloodmoon";

interface FootprintStamp {
  x: number;
  y: number;
  angle: number;
  age: number; // 0 to maxAge
  maxAge: number;
  isRight: boolean;
}

interface WeatherParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
  alpha: number;
}

const WEATHER_PRESETS: Record<
  WeatherPreset,
  {
    name: string;
    windX: number;
    windY: number;
    decayMul: number;
    puddleRate: number;
    badge: string;
  }
> = {
  clear: {
    name: "Clear Skies",
    windX: 15,
    windY: 5,
    decayMul: 1.0,
    puddleRate: 0.0,
    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  },
  rain: {
    name: "Pelting Rain",
    windX: 65,
    windY: 180,
    decayMul: 2.5,
    puddleRate: 0.8,
    badge: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  },
  fog: {
    name: "Barrow Mist",
    windX: 8,
    windY: 2,
    decayMul: 0.8,
    puddleRate: 0.1,
    badge: "bg-slate-500/20 text-slate-300 border-slate-500/40",
  },
  ash: {
    name: "Volcanic Ash",
    windX: 85,
    windY: 40,
    decayMul: 1.8,
    puddleRate: 0.0,
    badge: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  },
  bloodmoon: {
    name: "Blood Moon Omen",
    windX: -30,
    windY: 10,
    decayMul: 1.2,
    puddleRate: 0.0,
    badge: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  },
};

export const SkyWeatherFootprintsLab: React.FC = () => {
  const [hour, setHour] = useState<number>(14.5); // 14:30 afternoon
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [weather, setWeather] = useState<WeatherPreset>("rain");
  const [timeScale, setTimeScale] = useState<number>(0.5);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const footprintsRef = useRef<FootprintStamp[]>([]);
  const particlesRef = useRef<WeatherParticle[]>([]);
  const heroRef = useRef<{
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    stepCycle: number;
    lastStepX: number;
    lastStepY: number;
    isRight: boolean;
  }>({
    x: 300,
    y: 190,
    targetX: 300,
    targetY: 190,
    stepCycle: 0,
    lastStepX: 300,
    lastStepY: 190,
    isRight: false,
  });

  // Calculate Diurnal Color Grading
  const getSkyColor = (h: number) => {
    // 0 = Midnight, 6 = Dawn, 12 = Noon, 18 = Dusk, 24 = Midnight
    if (h >= 5 && h < 8) {
      // Dawn: Rose peach & gold
      return {
        top: "#381e36",
        mid: "#783548",
        ground: "#23261f",
        light: "#fed7aa",
        ambient: 0.65,
        phase: "Dawn",
      };
    } else if (h >= 8 && h < 17) {
      // Day: Emerald & Azure
      return {
        top: "#1e3a5f",
        mid: "#2b5375",
        ground: "#1b2d20",
        light: "#fef08a",
        ambient: 1.0,
        phase: "Daylight",
      };
    } else if (h >= 17 && h < 20) {
      // Dusk: Amber violet
      return {
        top: "#2a183d",
        mid: "#602447",
        ground: "#1a1e1b",
        light: "#f97316",
        ambient: 0.6,
        phase: "Dusk",
      };
    } else {
      // Night: Deep nocturnal indigo
      return {
        top: "#06060d",
        mid: "#0d0e1c",
        ground: "#090d0b",
        light: "#93c5fd",
        ambient: 0.25,
        phase: "Night",
      };
    }
  };

  const skyInfo = getSkyColor(hour);

  // Initialize weather particles
  useEffect(() => {
    const arr: WeatherParticle[] = [];
    for (let i = 0; i < 90; i++) {
      arr.push({
        x: Math.random() * 600,
        y: Math.random() * 360,
        vx: 0,
        vy: 0,
        len: 8 + Math.random() * 12,
        alpha: 0.3 + Math.random() * 0.5,
      });
    }
    particlesRef.current = arr;
  }, []);

  // Handle canvas click to walk hero & stamp footprints
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    heroRef.current.targetX = (e.clientX - rect.left) * scaleX;
    heroRef.current.targetY = (e.clientY - rect.top) * scaleY;
  };

  // Main Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      // Diurnal Clock Progression
      if (isPlaying) {
        setHour((h) => (h + dt * timeScale) % 24);
      }

      // Hero Movement & Footstep Stamping
      const hero = heroRef.current;
      const dx = hero.targetX - hero.x;
      const dy = hero.targetY - hero.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 3) {
        const speed = 75;
        const vx = (dx / dist) * speed;
        const vy = (dy / dist) * speed;
        hero.x += vx * dt;
        hero.y += vy * dt;

        // Check step stride distance (Mellangan stride = 14 px)
        const stepDist = Math.hypot(
          hero.x - hero.lastStepX,
          hero.y - hero.lastStepY
        );
        if (stepDist >= 14) {
          hero.lastStepX = hero.x;
          hero.lastStepY = hero.y;
          hero.isRight = !hero.isRight;

          // Perpendicular offset for human gait
          const angle = Math.atan2(dy, dx);
          const perpAngle = angle + (hero.isRight ? Math.PI / 2 : -Math.PI / 2);
          const footX = hero.x + Math.cos(perpAngle) * 3.5;
          const footY = hero.y + Math.sin(perpAngle) * 3.5;

          // Stamp into circular ringbuffer (max 128 stamps)
          footprintsRef.current.push({
            x: footX,
            y: footY,
            angle,
            age: 0,
            maxAge: 10.0,
            isRight: hero.isRight,
          });
          if (footprintsRef.current.length > 128) {
            footprintsRef.current.shift();
          }
        }
      }

      // Age and erode footprints
      const wPreset = WEATHER_PRESETS[weather];
      footprintsRef.current = footprintsRef.current.filter((fp) => {
        fp.age += dt * wPreset.decayMul;
        return fp.age < fp.maxAge;
      });

      // Update weather particles
      particlesRef.current.forEach((pt) => {
        pt.x += (wPreset.windX + (Math.random() - 0.5) * 10) * dt;
        pt.y += (wPreset.windY + (Math.random() - 0.5) * 10) * dt;
        if (pt.x > canvas.width) pt.x = 0;
        if (pt.x < 0) pt.x = canvas.width;
        if (pt.y > canvas.height) pt.y = 0;
        if (pt.y < 0) pt.y = canvas.height;
      });

      // ==========================================
      // RENDER CANVAS (600x360)
      // ==========================================
      const curSky = getSkyColor(hour);

      // Sky & Ground Gradient
      const groundGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      groundGrad.addColorStop(0, curSky.top);
      groundGrad.addColorStop(0.35, curSky.mid);
      groundGrad.addColorStop(0.36, curSky.ground);
      groundGrad.addColorStop(1, "#070b09");
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Celestial Sun / Moon Arc
      const sunAngle = ((hour - 6) / 24) * Math.PI * 2;
      const sunX = canvas.width / 2 + Math.cos(sunAngle) * 260;
      const sunY = 120 + Math.sin(sunAngle) * 85;

      if (hour >= 6 && hour <= 18) {
        // Sun
        const sunGlow = ctx.createRadialGradient(
          sunX,
          sunY,
          4,
          sunX,
          sunY,
          38
        );
        sunGlow.addColorStop(0, "rgba(254, 240, 138, 0.95)");
        sunGlow.addColorStop(0.4, "rgba(251, 191, 36, 0.4)");
        sunGlow.addColorStop(1, "rgba(251, 191, 36, 0)");
        ctx.fillStyle = sunGlow;
        ctx.beginPath();
        ctx.arc(sunX, sunY, 38, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#fef08a";
        ctx.beginPath();
        ctx.arc(sunX, sunY, 10, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Moon (Opposite side)
        const moonAngle = sunAngle + Math.PI;
        const moonX = canvas.width / 2 + Math.cos(moonAngle) * 260;
        const moonY = 120 + Math.sin(moonAngle) * 85;

        const moonGlow = ctx.createRadialGradient(
          moonX,
          moonY,
          4,
          moonX,
          moonY,
          32
        );
        moonGlow.addColorStop(
          0,
          weather === "bloodmoon"
            ? "rgba(244, 63, 94, 0.9)"
            : "rgba(191, 219, 254, 0.85)"
        );
        moonGlow.addColorStop(
          1,
          weather === "bloodmoon"
            ? "rgba(244, 63, 94, 0)"
            : "rgba(191, 219, 254, 0)"
        );
        ctx.fillStyle = moonGlow;
        ctx.beginPath();
        ctx.arc(moonX, moonY, 32, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = weather === "bloodmoon" ? "#f43f5e" : "#e0f2fe";
        ctx.beginPath();
        ctx.arc(moonX, moonY, 8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Horizon line
      ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 130);
      ctx.lineTo(canvas.width, 130);
      ctx.stroke();

      // Draw Footprints
      footprintsRef.current.forEach((fp) => {
        const remaining = 1.0 - fp.age / fp.maxAge;
        ctx.save();
        ctx.translate(fp.x, fp.y);
        ctx.rotate(fp.angle);

        ctx.globalAlpha = remaining * 0.75;
        ctx.fillStyle =
          weather === "rain"
            ? "rgba(15, 23, 42, 0.8)"
            : "rgba(30, 41, 59, 0.65)";

        // Boot print oval
        ctx.beginPath();
        ctx.ellipse(0, 0, 3.5, 1.8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Heel indent
        ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
        ctx.beginPath();
        ctx.arc(-2, 0, 1.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      });

      // Hero Character
      const heroX = hero.x;
      const heroY = hero.y;

      // Shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.beginPath();
      ctx.ellipse(heroX, heroY + 2, 8, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.arc(heroX, heroY - 8, 7, 0, Math.PI * 2);
      ctx.fill();

      // Lantern light
      if (curSky.ambient < 0.7) {
        const lanternGlow = ctx.createRadialGradient(
          heroX,
          heroY - 6,
          4,
          heroX,
          heroY - 6,
          55
        );
        lanternGlow.addColorStop(0, "rgba(251, 191, 36, 0.5)");
        lanternGlow.addColorStop(1, "rgba(251, 191, 36, 0)");
        ctx.fillStyle = lanternGlow;
        ctx.beginPath();
        ctx.arc(heroX, heroY - 6, 55, 0, Math.PI * 2);
        ctx.fill();
      }

      // Weather Particles Rendering
      ctx.save();
      if (weather === "rain") {
        ctx.strokeStyle = "rgba(186, 230, 253, 0.65)";
        ctx.lineWidth = 1.2;
        particlesRef.current.forEach((pt) => {
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y);
          ctx.lineTo(pt.x + wPreset.windX * 0.05, pt.y + pt.len);
          ctx.stroke();
        });
      } else if (weather === "ash") {
        particlesRef.current.forEach((pt) => {
          ctx.fillStyle =
            Math.random() > 0.3
              ? "rgba(251, 146, 60, 0.75)"
              : "rgba(148, 163, 184, 0.5)";
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 1.8, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (weather === "fog") {
        ctx.fillStyle = "rgba(203, 213, 225, 0.08)";
        particlesRef.current.slice(0, 40).forEach((pt) => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 28, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      ctx.restore();

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [hour, isPlaying, weather, timeScale]);

  const formatClock = (h: number) => {
    const hours = Math.floor(h);
    const mins = Math.floor((h % 1) * 60);
    return `${hours.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <div className="my-8 rounded-2xl border border-dark-750 bg-[#0c0a14] shadow-2xl overflow-hidden font-sans">
      {/* Header Banner */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-sky-950/40 via-dark-900 to-dark-950 border-b border-dark-750 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-300 shadow-inner">
            <Footprints className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              Diurnal Sky, Weather Fronts &amp; Dynamic Footprint Lab
              <span className="px-2 py-0.5 text-[10px] uppercase font-mono tracking-wider rounded bg-sky-500/20 text-sky-300 border border-sky-500/40">
                Chapter 08 Sky.cpp
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Interactive 24-hour sun/moon celestial arc, color grading
              interpolation, weather particles &amp; circular footprint
              ringbuffer erosion.
            </p>
          </div>
        </div>

        {/* Clock readout */}
        <div className="px-3 py-1.5 rounded-xl bg-dark-950 border border-dark-800 flex items-center gap-2 text-xs font-mono">
          {hour >= 6 && hour <= 18 ? (
            <Sun className="w-4 h-4 text-amber-400 animate-spin-slow" />
          ) : (
            <Moon className="w-4 h-4 text-sky-400" />
          )}
          <span className="text-slate-200 font-bold">{formatClock(hour)}</span>
          <span className="text-slate-500">({skyInfo.phase})</span>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-5">
        {/* Scrubbable Clock & Weather Bar */}
        <div className="p-3.5 rounded-xl bg-dark-900 border border-dark-750 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-300">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsPlaying((p) => !p)}
                className="px-2.5 py-1 rounded-lg bg-dark-800 hover:bg-dark-750 border border-dark-700 text-slate-200 flex items-center gap-1.5 transition-all"
              >
                {isPlaying ? (
                  <Pause className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Play className="w-3.5 h-3.5 text-emerald-400" />
                )}
                {isPlaying ? "Pause Clock" : "Resume"}
              </button>
              <span>Clock Speed:</span>
              <input
                type="range"
                min="0.1"
                max="2.5"
                step="0.1"
                value={timeScale}
                onChange={(e) => setTimeScale(parseFloat(e.target.value))}
                className="w-20 accent-sky-400"
              />
              <span>{timeScale.toFixed(1)}x</span>
            </div>

            <div className="flex items-center gap-1.5">
              {(
                [
                  "clear",
                  "rain",
                  "fog",
                  "ash",
                  "bloodmoon",
                ] as WeatherPreset[]
              ).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setWeather(preset)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all capitalize border ${
                    weather === preset
                      ? WEATHER_PRESETS[preset].badge
                      : "bg-dark-950 border-dark-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* 24-Hour Slider */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-slate-400">00:00</span>
            <input
              type="range"
              min="0"
              max="24"
              step="0.05"
              value={hour}
              onChange={(e) => {
                setHour(parseFloat(e.target.value));
                setIsPlaying(false);
              }}
              className="flex-1 accent-sky-400 h-2 bg-dark-950 rounded-lg cursor-pointer"
            />
            <span className="text-xs font-mono text-slate-400">24:00</span>
          </div>
        </div>

        {/* Canvas Display */}
        <div className="relative rounded-xl border border-dark-750 overflow-hidden bg-black shadow-inner flex justify-center">
          <canvas
            ref={canvasRef}
            width={600}
            height={360}
            onClick={handleCanvasClick}
            className="cursor-crosshair block w-full max-w-[600px] h-[360px]"
          />

          <div className="absolute top-3 left-3 flex flex-col gap-1 text-[11px] font-mono pointer-events-none">
            <span className="px-2 py-0.5 rounded bg-dark-950/80 border border-dark-750 text-slate-300">
              Click canvas to walk &amp; stamp muddy boot prints
            </span>
            <span className="px-2 py-0.5 rounded bg-dark-950/80 border border-dark-750 text-sky-400">
              Active Footprints: {footprintsRef.current.length} / 128 buffer slots
            </span>
          </div>
        </div>

        {/* Invariant Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
          <div className="p-3.5 rounded-xl bg-dark-900 border border-dark-800">
            <span className="text-slate-500 block mb-1">
              Ambient Light Coefficient:
            </span>
            <span className="text-emerald-400 font-bold text-sm">
              {(skyInfo.ambient * 100).toFixed(0)}% Luminance
            </span>
          </div>
          <div className="p-3.5 rounded-xl bg-dark-900 border border-dark-800">
            <span className="text-slate-500 block mb-1">
              Weather Erosion Multiplier:
            </span>
            <span className="text-sky-400 font-bold text-sm">
              {WEATHER_PRESETS[weather].decayMul}x Footprint Decay
            </span>
          </div>
          <div className="p-3.5 rounded-xl bg-dark-900 border border-dark-800">
            <span className="text-slate-500 block mb-1">
              Wind Vector Force:
            </span>
            <span className="text-amber-400 font-bold text-sm">
              ({WEATHER_PRESETS[weather].windX}, {WEATHER_PRESETS[weather].windY}) px/s
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
