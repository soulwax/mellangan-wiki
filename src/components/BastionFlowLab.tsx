import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Shield, Play, Pause, RotateCcw, Compass, Crosshair, Users, Activity, Eye, EyeOff } from "lucide-react";

const GRID_N = 29;
const CX = 14;
const CY = 14;
const W = 6;
const H = 5;
const GAP = 1;

const DX = [1, 1, 0, -1, -1, -1, 0, 1];
const DY = [0, 1, 1, 1, 0, -1, -1, -1];
const R2 = 0.70710678;
const UX = [1, R2, 0, -R2, -1, -R2, 0, R2];
const UY = [0, R2, 1, R2, 0, -R2, -1, -R2];

const SIDE_NAMES = ["North", "East", "South", "West"] as const;
const SIDE_DX = [0, 1, 0, -1];
const SIDE_DY = [-1, 0, 1, 0];

interface Invader {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  deflections: number;
}

export function BastionFlowLab() {
  const [gateSide, setGateSide] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [speed, setSpeed] = useState<number>(2.4);
  const [showVectors, setShowVectors] = useState<boolean>(true);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
  const [showCorridor, setShowCorridor] = useState<boolean>(true);
  const [brushMode, setBrushMode] = useState<"hero" | "wall" | "erase">("hero");

  const [heroPos, setHeroPos] = useState<{ x: number; y: number }>({ x: CX, y: CY });
  const [customWalls, setCustomWalls] = useState<Set<number>>(new Set());
  const [invaders, setInvaders] = useState<Invader[]>(() => {
    return [
      { id: 1, x: 3, y: 3, vx: 0, vy: 0, deflections: 0 },
      { id: 2, x: 25, y: 4, vx: 0, vy: 0, deflections: 0 },
      { id: 3, x: 4, y: 24, vx: 0, vy: 0, deflections: 0 },
      { id: 4, x: 24, y: 24, vx: 0, vy: 0, deflections: 0 },
      { id: 5, x: 14, y: 2, vx: 0, vy: 0, deflections: 0 },
      { id: 6, x: 2, y: 14, vx: 0, vy: 0, deflections: 0 },
    ];
  });
  const [totalDeflections, setTotalDeflections] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const isPerimeterWall = useCallback((x: number, y: number) => {
    const ax = Math.abs(x - CX);
    const ay = Math.abs(y - CY);
    return (ax === W && ay <= H) || (ay === H && ax <= W);
  }, []);

  const isGateOpening = useCallback((x: number, y: number, side: number) => {
    const gx = CX + SIDE_DX[side] * W;
    const gy = CY + SIDE_DY[side] * H;
    return SIDE_DX[side] !== 0
      ? x === gx && Math.abs(y - gy) <= GAP
      : y === gy && Math.abs(x - gx) <= GAP;
  }, []);

  const isInsideBastion = useCallback((x: number, y: number) => {
    return x > CX - W && x < CX + W && y > CY - H && y < CY + H;
  }, []);

  const isInCorridor = useCallback((x: number, y: number, side: number) => {
    const gx = CX + SIDE_DX[side] * W;
    const gy = CY + SIDE_DY[side] * H;
    const nx = SIDE_DX[side];
    const along = nx !== 0 ? y - gy : x - gx;
    const across = nx !== 0 ? x - gx : y - gy;
    return Math.abs(along) < 2.5 && Math.abs(across) < 3.5;
  }, []);

  const flowField = useMemo(() => {
    const dir = new Int8Array(GRID_N * GRID_N).fill(-1);
    const dist = new Int16Array(GRID_N * GRID_N).fill(-1);
    const isWall = new Uint8Array(GRID_N * GRID_N).fill(0);

    for (let y = 0; y < GRID_N; y++) {
      for (let x = 0; x < GRID_N; x++) {
        const idx = y * GRID_N + x;
        if (customWalls.has(idx)) {
          isWall[idx] = 1;
        } else if (isPerimeterWall(x, y)) {
          if (isGateOpening(x, y, gateSide)) {
            isWall[idx] = 0;
          } else {
            isWall[idx] = 1;
          }
        }
      }
    }

    const queue: number[] = [];
    for (let y = 0; y < GRID_N; y++) {
      for (let x = 0; x < GRID_N; x++) {
        if (isPerimeterWall(x, y) && isGateOpening(x, y, gateSide)) {
          const idx = y * GRID_N + x;
          dir[idx] = 8;
          dist[idx] = 0;
          queue.push(idx);
        }
      }
    }

    let head = 0;
    while (head < queue.length) {
      const curr = queue[head++];
      const cx0 = curr % GRID_N;
      const cy0 = Math.floor(curr / GRID_N);
      const currDist = dist[curr];

      for (let k = 0; k < 8; k++) {
        const nx = cx0 + DX[k];
        const ny = cy0 + DY[k];
        if (nx < 0 || nx >= GRID_N || ny < 0 || ny >= GRID_N) continue;
        const nidx = ny * GRID_N + nx;

        if (isWall[nidx] === 1 || dir[nidx] !== -1) continue;

        if (k % 2 === 1) {
          const ortho1 = cy0 * GRID_N + nx;
          const ortho2 = ny * GRID_N + cx0;
          if (isWall[ortho1] === 1 || isWall[ortho2] === 1) continue;
        }

        dir[nidx] = (k + 4) & 7;
        dist[nidx] = currDist + 1;
        queue.push(nidx);
      }
    }

    return { dir, dist, isWall };
  }, [gateSide, customWalls, isPerimeterWall, isGateOpening]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = GRID_N / rect.width;
    const gx = Math.floor((e.clientX - rect.left) * scale);
    const gy = Math.floor((e.clientY - rect.top) * scale);

    if (gx < 0 || gx >= GRID_N || gy < 0 || gy >= GRID_N) return;

    if (brushMode === "hero") {
      setHeroPos({ x: gx, y: gy });
    } else if (brushMode === "wall") {
      const idx = gy * GRID_N + gx;
      if (!isPerimeterWall(gx, gy)) {
        setCustomWalls((prev) => {
          const next = new Set(prev);
          next.add(idx);
          return next;
        });
      }
    } else if (brushMode === "erase") {
      const idx = gy * GRID_N + gx;
      setCustomWalls((prev) => {
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
    }
  };

  const spawnInvader = () => {
    const side = Math.floor(Math.random() * 4);
    let sx = 0;
    let sy = 0;
    if (side === 0) {
      sx = 2 + Math.random() * (GRID_N - 4);
      sy = 1;
    } else if (side === 1) {
      sx = GRID_N - 2;
      sy = 2 + Math.random() * (GRID_N - 4);
    } else if (side === 2) {
      sx = 2 + Math.random() * (GRID_N - 4);
      sy = GRID_N - 2;
    } else {
      sx = 1;
      sy = 2 + Math.random() * (GRID_N - 4);
    }
    setInvaders((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), x: sx, y: sy, vx: 0, vy: 0, deflections: 0 },
    ]);
  };

  const resetSimulation = () => {
    setCustomWalls(new Set());
    setHeroPos({ x: CX, y: CY });
    setInvaders([
      { id: 1, x: 3, y: 3, vx: 0, vy: 0, deflections: 0 },
      { id: 2, x: 25, y: 4, vx: 0, vy: 0, deflections: 0 },
      { id: 3, x: 4, y: 24, vx: 0, vy: 0, deflections: 0 },
      { id: 4, x: 24, y: 24, vx: 0, vy: 0, deflections: 0 },
      { id: 5, x: 14, y: 2, vx: 0, vy: 0, deflections: 0 },
      { id: 6, x: 2, y: 14, vx: 0, vy: 0, deflections: 0 },
    ]);
    setTotalDeflections(0);
  };

  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setInvaders((prev) =>
        prev.map((inv) => {
          const heroIn = isInsideBastion(heroPos.x, heroPos.y);
          const invIn = isInsideBastion(inv.x, inv.y);

          let vx = 0;
          let vy = 0;

          if (heroIn !== invIn) {
            const gx = Math.floor(inv.x);
            const gy = Math.floor(inv.y);
            if (gx >= 0 && gx < GRID_N && gy >= 0 && gy < GRID_N) {
              const d = flowField.dir[gy * GRID_N + gx];
              if (d >= 0 && d < 8) {
                vx = UX[d] * (speed * 0.05);
                vy = UY[d] * (speed * 0.05);
              }
            }
          }

          if (vx === 0 && vy === 0) {
            const dx = heroPos.x - inv.x;
            const dy = heroPos.y - inv.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 0.1) {
              vx = (dx / dist) * (speed * 0.05);
              vy = (dy / dist) * (speed * 0.05);
            }
          }

          let nx = inv.x + vx;
          let ny = inv.y + vy;
          let deflections = inv.deflections;

          const wasIn = isInsideBastion(inv.x, inv.y);
          const nowIn = isInsideBastion(nx, ny);
          const inCorr = isInCorridor(inv.x, inv.y, gateSide) || isInCorridor(nx, ny, gateSide);

          if (wasIn !== nowIn && !inCorr) {
            deflections++;
            setTotalDeflections((c) => c + 1);
            if (!nowIn) {
              nx = Math.max(CX - W + 0.5, Math.min(CX + W - 0.5, nx));
              ny = Math.max(CY - H + 0.5, Math.min(CY + H - 0.5, ny));
            } else {
              const dw = nx - (CX - W);
              const de = CX + W - nx;
              const dn = ny - (CY - H);
              const ds = CY + H - ny;
              const m = Math.min(dw, de, dn, ds);
              if (m === dw) nx = CX - W - 0.5;
              else if (m === de) nx = CX + W + 0.5;
              else if (m === dn) ny = CY - H - 0.5;
              else ny = CY + H + 0.5;
            }
          }

          const cIdx = Math.floor(ny) * GRID_N + Math.floor(nx);
          if (customWalls.has(cIdx)) {
            nx = inv.x;
            ny = inv.y;
            deflections++;
          }

          return { ...inv, x: nx, y: ny, vx, vy, deflections };
        })
      );
    }, 33);

    return () => clearInterval(interval);
  }, [isPlaying, speed, heroPos, gateSide, flowField, customWalls, isInsideBastion, isInCorridor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const cellW = width / GRID_N;
    const cellH = height / GRID_N;

    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#111827";
    ctx.fillRect((CX - W) * cellW, (CY - H) * cellH, W * 2 * cellW, H * 2 * cellH);

    if (showHeatmap) {
      let maxDist = 1;
      for (let i = 0; i < flowField.dist.length; i++) {
        if (flowField.dist[i] > maxDist) maxDist = flowField.dist[i];
      }
      for (let y = 0; y < GRID_N; y++) {
        for (let x = 0; x < GRID_N; x++) {
          const d = flowField.dist[y * GRID_N + x];
          if (d >= 0) {
            const norm = d / maxDist;
            ctx.fillStyle = `rgba(168, 85, 247, ${0.1 + norm * 0.45})`;
            ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
          }
        }
      }
    }

    if (showCorridor) {
      const gx = CX + SIDE_DX[gateSide] * W;
      const gy = CY + SIDE_DY[gateSide] * H;
      ctx.strokeStyle = "rgba(16, 185, 129, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect((gx - 1.5) * cellW, (gy - 1.5) * cellH, 3 * cellW, 3 * cellH);
    }

    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_N; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellW, 0);
      ctx.lineTo(i * cellW, height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * cellH);
      ctx.lineTo(width, i * cellH);
      ctx.stroke();
    }

    for (let y = 0; y < GRID_N; y++) {
      for (let x = 0; x < GRID_N; x++) {
        const idx = y * GRID_N + x;
        if (flowField.isWall[idx] === 1) {
          ctx.fillStyle = customWalls.has(idx) ? "#64748b" : "#334155";
          ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
          ctx.strokeStyle = customWalls.has(idx) ? "#94a3b8" : "#475569";
          ctx.lineWidth = 1;
          ctx.strokeRect(x * cellW + 0.5, y * cellH + 0.5, cellW - 1, cellH - 1);
        } else if (isPerimeterWall(x, y) && isGateOpening(x, y, gateSide)) {
          ctx.fillStyle = "rgba(16, 185, 129, 0.35)";
          ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
        }
      }
    }

    if (showVectors) {
      ctx.strokeStyle = "rgba(56, 189, 248, 0.55)";
      ctx.fillStyle = "rgba(56, 189, 248, 0.75)";
      ctx.lineWidth = 1.2;

      for (let y = 0; y < GRID_N; y++) {
        for (let x = 0; x < GRID_N; x++) {
          const idx = y * GRID_N + x;
          const d = flowField.dir[idx];
          if (d >= 0 && d < 8) {
            const cx = (x + 0.5) * cellW;
            const cy = (y + 0.5) * cellH;
            const len = cellW * 0.42;
            const tox = cx + UX[d] * len;
            const toy = cy + UY[d] * len;

            ctx.beginPath();
            ctx.moveTo(cx - UX[d] * (len * 0.3), cy - UY[d] * (len * 0.3));
            ctx.lineTo(tox, toy);
            ctx.stroke();

            const angle = Math.atan2(UY[d], UX[d]);
            const aLen = 3;
            ctx.beginPath();
            ctx.moveTo(tox, toy);
            ctx.lineTo(tox - aLen * Math.cos(angle - Math.PI / 6), toy - aLen * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(tox - aLen * Math.cos(angle + Math.PI / 6), toy - aLen * Math.sin(angle + Math.PI / 6));
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    }

    for (const inv of invaders) {
      const ix = (inv.x + 0.5) * cellW;
      const iy = (inv.y + 0.5) * cellH;

      ctx.fillStyle = "rgba(239, 68, 68, 0.25)";
      ctx.beginPath();
      ctx.arc(ix, iy, cellW * 0.55, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(ix, iy, cellW * 0.35, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#fca5a5";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ix, iy);
      ctx.lineTo(ix + inv.vx * 15, iy + inv.vy * 15);
      ctx.stroke();
    }

    const hx = (heroPos.x + 0.5) * cellW;
    const hy = (heroPos.y + 0.5) * cellH;

    ctx.fillStyle = "rgba(245, 158, 11, 0.3)";
    ctx.beginPath();
    ctx.arc(hx, hy, cellW * 0.75, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.arc(hx, hy, cellW * 0.45, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }, [flowField, invaders, heroPos, gateSide, showVectors, showHeatmap, showCorridor, customWalls, isPerimeterWall, isGateOpening]);

  const insideCount = invaders.filter((i) => isInsideBastion(i.x, i.y)).length;
  const outsideCount = invaders.length - insideCount;
  const heroInside = isInsideBastion(heroPos.x, heroPos.y);

  return (
    <section
      className="rounded-xl border border-fuchsia-500/30 bg-dark-950 p-4 sm:p-6 text-slate-200 shadow-2xl space-y-5"
      aria-labelledby="bastion-flow-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dark-800 pb-4">
        <div>
          <h3 id="bastion-flow-title" className="text-lg font-bold text-fuchsia-300 flex items-center gap-2">
            <Shield className="w-5 h-5 text-fuchsia-400" />
            <span>Bastion Vector-Field Flow-Defense Lab</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Real-time simulation of Mellangan's <code className="text-fuchsia-300">bastion::raise()</code> 8-directional BFS wavefront, corridor steering &amp; edge deflection.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              isPlaying
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30"
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? "Pause" : "Play"}</span>
          </button>
          <button
            onClick={spawnInvader}
            className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Spawn Foe</span>
          </button>
          <button
            onClick={resetSimulation}
            className="p-1.5 rounded-lg bg-dark-850 hover:bg-dark-800 border border-dark-750 text-slate-300 transition-all"
            title="Reset Simulation"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12 items-start">
        <div className="lg:col-span-8 flex flex-col items-center">
          <div className="relative rounded-xl border border-dark-800 p-1 bg-dark-900 shadow-inner max-w-full overflow-hidden">
            <canvas
              ref={canvasRef}
              width={520}
              height={520}
              onClick={handleCanvasClick}
              className="cursor-crosshair rounded-lg block max-w-full h-auto aspect-square"
            />
          </div>
          <div className="mt-2 text-center text-xs text-slate-400">
            Click canvas to apply brush: <span className="font-semibold text-slate-200 capitalize">{brushMode}</span>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-lg border border-dark-800 bg-dark-900/80 p-3 space-y-2.5">
            <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-gold-400" />
              <span>Gate Orientation (Cardinal)</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {SIDE_NAMES.map((sideName, idx) => (
                <button
                  key={sideName}
                  onClick={() => setGateSide(idx)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium border transition-all ${
                    gateSide === idx
                      ? "bg-fuchsia-500/25 text-fuchsia-200 border-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,0.3)]"
                      : "bg-dark-850 text-slate-400 border-dark-750 hover:border-slate-600 hover:text-slate-200"
                  }`}
                >
                  {sideName} Gate
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-dark-800 bg-dark-900/80 p-3 space-y-2.5">
            <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Crosshair className="w-3.5 h-3.5 text-sky-400" />
              <span>Click Brush Tool</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => setBrushMode("hero")}
                className={`px-2 py-1.5 rounded-md text-xs font-medium border text-center transition-all ${
                  brushMode === "hero"
                    ? "bg-amber-500/25 text-amber-200 border-amber-400"
                    : "bg-dark-850 text-slate-400 border-dark-750 hover:border-slate-600"
                }`}
              >
                Hero
              </button>
              <button
                onClick={() => setBrushMode("wall")}
                className={`px-2 py-1.5 rounded-md text-xs font-medium border text-center transition-all ${
                  brushMode === "wall"
                    ? "bg-slate-600/40 text-slate-200 border-slate-400"
                    : "bg-dark-850 text-slate-400 border-dark-750 hover:border-slate-600"
                }`}
              >
                + Wall
              </button>
              <button
                onClick={() => setBrushMode("erase")}
                className={`px-2 py-1.5 rounded-md text-xs font-medium border text-center transition-all ${
                  brushMode === "erase"
                    ? "bg-rose-500/25 text-rose-200 border-rose-400"
                    : "bg-dark-850 text-slate-400 border-dark-750 hover:border-slate-600"
                }`}
              >
                Erase
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-dark-800 bg-dark-900/80 p-3 space-y-2.5">
            <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-emerald-400" />
              <span>Overlays &amp; Parameters</span>
            </div>
            <div className="space-y-2">
              <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                <span>Vector Flow Arrows</span>
                <input
                  type="checkbox"
                  checked={showVectors}
                  onChange={(e) => setShowVectors(e.target.checked)}
                  className="accent-fuchsia-500 rounded"
                />
              </label>
              <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                <span>Distance Heatmap</span>
                <input
                  type="checkbox"
                  checked={showHeatmap}
                  onChange={(e) => setShowHeatmap(e.target.checked)}
                  className="accent-fuchsia-500 rounded"
                />
              </label>
              <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                <span>Corridor Boundary</span>
                <input
                  type="checkbox"
                  checked={showCorridor}
                  onChange={(e) => setShowCorridor(e.target.checked)}
                  className="accent-fuchsia-500 rounded"
                />
              </label>
              <div className="pt-2">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Invader Speed</span>
                  <span className="font-mono text-slate-200">{speed.toFixed(1)} px/f</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="5.0"
                  step="0.2"
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="w-full accent-fuchsia-500"
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-dark-800 bg-dark-900/80 p-3 space-y-2">
            <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-fuchsia-400" />
              <span>Live Telemetry</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-dark-950 p-2 rounded border border-dark-800">
                <div className="text-slate-500 text-[10px] uppercase">Hero State</div>
                <div className={heroInside ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                  {heroInside ? "Inside Bastion" : "Outside Bastion"}
                </div>
              </div>
              <div className="bg-dark-950 p-2 rounded border border-dark-800">
                <div className="text-slate-500 text-[10px] uppercase">Foes (In / Out)</div>
                <div className="text-slate-200 font-bold">
                  {insideCount} <span className="text-slate-500 font-normal">/</span> {outsideCount}
                </div>
              </div>
              <div className="bg-dark-950 p-2 rounded border border-dark-800">
                <div className="text-slate-500 text-[10px] uppercase">Wall Deflections</div>
                <div className="text-sky-300 font-bold">{totalDeflections}</div>
              </div>
              <div className="bg-dark-950 p-2 rounded border border-dark-800">
                <div className="text-slate-500 text-[10px] uppercase">Active Agents</div>
                <div className="text-fuchsia-300 font-bold">{invaders.length}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-xs text-slate-400 border-t border-dark-800 pt-3 leading-relaxed">
        <strong>Engine Routing Principle:</strong> When the Hero and Invaders are on opposite sides of the perimeter (<code className="text-fuchsia-300">heroIn != invIn</code>), enemies sample the 8-directional BFS field (<code className="text-sky-300">UX[d], UY[d]</code>) to converge through the single gate opening. When on the same side, agents switch to direct pursuit while <code className="text-fuchsia-300">bastion::wall()</code> deflects movement along the perimeter edge unless passing through the gate corridor.
      </div>
    </section>
  );
}
