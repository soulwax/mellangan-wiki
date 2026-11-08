import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Calculator,
  Binary,
  Eye,
  Flame,
  Sparkles,
  Shield,
  RotateCcw,
  Sliders,
  Check,
  ChevronRight,
  TrendingDown,
} from "lucide-react";

type MathTab = "resistance" | "attenuation" | "sightcone" | "magicfind" | "orderedbits";

export const EngineMathLab: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MathTab>("resistance");

  // Tab 1: Resistance (1-r)^2
  const [resistancePct, setResistancePct] = useState<number>(50);
  const [baseDotDamage, setBaseDotDamage] = useState<number>(100);

  // Tab 2: LightField contact-shadow falloff
  const [attenDistance, setAttenDistance] = useState<number>(120);
  const [attenRadius, setAttenRadius] = useState<number>(160);

  // Tab 3: Sight Cone
  const [entityAngleDeg, setEntityAngleDeg] = useState<number>(0);
  const [targetX, setTargetX] = useState<number>(180);
  const [targetY, setTargetY] = useState<number>(40);

  // Tab 4: Magic Find
  const [rawMf, setRawMf] = useState<number>(180);

  // Tab 5: orderedBits
  const [testFloat, setTestFloat] = useState<number>(-42.5);

  // Canvas ref for sight-cone interactive demo
  const sightConeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Tab 1 Calculations
  const r = resistancePct / 100;
  const linearDamageTaken = baseDotDamage * (1 - r);
  const quadraticDamageTaken = baseDotDamage * Math.pow(1 - r, 2);
  const linearMitigationPct = r * 100;
  const quadraticMitigationPct = (1 - Math.pow(1 - r, 2)) * 100;

  // Tab 2 Calculations
  const attenRatio = attenDistance / attenRadius;
  const attenFactor = attenDistance < 6 || attenDistance > attenRadius
    ? 0
    : 1 - attenRatio;
  const attenPct = attenFactor * 100;

  // Tab 3 Calculations
  const sightConeCanvasCenter = { x: 220, y: 150 };
  const dx = targetX - sightConeCanvasCenter.x;
  const dy = targetY - sightConeCanvasCenter.y;
  const dist = Math.hypot(dx, dy);
  const facingRad = (entityAngleDeg * Math.PI) / 180;
  const fx = Math.cos(facingRad);
  const fy = Math.sin(facingRad);
  // The canvas shows the quarry at its centre and the enemy at the clicked point.
  // One canvas pixel represents 300 / 210 world pixels.
  const worldDist = dist * (300 / 210);
  const dotProduct = dist > 0.001 ? (fx * dx + fy * dy) / dist : 0;
  const angleRad = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
  const angleDeg = (angleRad * 180) / Math.PI;
  const COS_HALF_FOV = 0.55;
  const HALF_FOV_DEG = (Math.acos(COS_HALF_FOV) * 180) / Math.PI;
  const isTargetVisible = dotProduct > COS_HALF_FOV && worldDist < 300;

  // Tab 4 Calculations
  const MF_FACTOR = 250;
  const effectiveMf = (rawMf * MF_FACTOR) / (rawMf + MF_FACTOR);

  // Tab 5 Calculations: IEEE 754 float to orderedBits
  const floatAnalysis = useMemo(() => {
    const buffer = new ArrayBuffer(4);
    const f32View = new Float32Array(buffer);
    const u32View = new Uint32Array(buffer);
    const i32View = new Int32Array(buffer);

    f32View[0] = testFloat;
    const rawBits = u32View[0];
    const signBit = (rawBits >>> 31) & 1;
    const exponentBits = (rawBits >>> 23) & 0xff;
    const mantissaBits = rawBits & 0x7fffff;

    // Mellangan formula: u ^ (int32_t(u) >> 31 | 0x80000000u)
    const arithShift = i32View[0] >> 31;
    const mask = (arithShift | 0x80000000) >>> 0;
    const ordered = (rawBits ^ mask) >>> 0;

    const toBin32 = (n: number) => n.toString(2).padStart(32, "0");
    const toHex32 = (n: number) => "0x" + n.toString(16).toUpperCase().padStart(8, "0");

    return {
      rawBits,
      rawBitsHex: toHex32(rawBits),
      rawBitsBin: toBin32(rawBits),
      signBit,
      exponentBits,
      mantissaBits,
      arithShiftHex: toHex32(arithShift >>> 0),
      maskHex: toHex32(mask),
      orderedBits: ordered,
      orderedBitsHex: toHex32(ordered),
      orderedBitsBin: toBin32(ordered),
    };
  }, [testFloat]);

  // Render Sight Cone Canvas
  useEffect(() => {
    if (activeTab !== "sightcone") return;
    const canvas = sightConeCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    const cx = sightConeCanvasCenter.x;
    const cy = sightConeCanvasCenter.y;
    const range = 210;
    const halfFovRad = (HALF_FOV_DEG * Math.PI) / 180;

    // Draw vision cone arc
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, range, facingRad - halfFovRad, facingRad + halfFovRad);
    ctx.closePath();
    ctx.fillStyle = isTargetVisible
      ? "rgba(16, 185, 129, 0.15)"
      : "rgba(245, 158, 11, 0.10)";
    ctx.fill();
    ctx.strokeStyle = isTargetVisible
      ? "rgba(16, 185, 129, 0.6)"
      : "rgba(245, 158, 11, 0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Line from entity to target
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(targetX, targetY);
    ctx.strokeStyle = isTargetVisible
      ? "rgba(52, 211, 153, 0.8)"
      : "rgba(239, 68, 68, 0.7)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.restore();

    // Draw Entity (Center)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(facingRad);

    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();

    // Direction arrow pointer
    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(4, -5);
    ctx.lineTo(4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 10px monospace";
    ctx.fillText("QUARRY", cx - 23, cy + 25);

    // Draw Target
    ctx.save();
    ctx.fillStyle = isTargetVisible ? "#10b981" : "#ef4444";
    ctx.beginPath();
    ctx.arc(targetX, targetY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Target label
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "bold 10px monospace";
    ctx.fillText(
      isTargetVisible ? "IN AIM" : "OUT OF AIM",
      targetX + 12,
      targetY + 4
    );
    ctx.fillText("ENEMY", targetX + 12, targetY + 18);
    ctx.restore();
  }, [activeTab, entityAngleDeg, targetX, targetY, facingRad, isTargetVisible]);

  const handleSightCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) * e.currentTarget.width / rect.width);
    const y = Math.round((e.clientY - rect.top) * e.currentTarget.height / rect.height);
    setTargetX(x);
    setTargetY(y);
  };

  return (
    <div className="my-8 rounded-2xl border border-dark-750 bg-[#0c0a14] shadow-2xl overflow-hidden font-sans">
      {/* Header Banner */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-purple-950/40 via-dark-900 to-dark-950 border-b border-dark-750 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-inner">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              Game Mathematics &amp; Proof Workbench
              <span className="px-2 py-0.5 text-[10px] uppercase font-mono tracking-wider rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 font-semibold">
                Interactive Lab
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Interactive testbed for Mellangan&apos;s exact mathematical invariants, attenuation equations &amp; bit twiddles.
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1 bg-dark-950/80 p-1 rounded-xl border border-dark-800 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab("resistance")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTab === "resistance"
                ? "bg-purple-600 text-white font-bold shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            (1-r)² Resist
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("attenuation")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTab === "attenuation"
                ? "bg-purple-600 text-white font-bold shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            Shadow Falloff
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("sightcone")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTab === "sightcone"
                ? "bg-purple-600 text-white font-bold shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Quarry Aim Cone
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("magicfind")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTab === "magicfind"
                ? "bg-purple-600 text-white font-bold shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Diminishing MF
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("orderedbits")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTab === "orderedbits"
                ? "bg-purple-600 text-white font-bold shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Binary className="w-3.5 h-3.5" />
            orderedBits(f)
          </button>
        </div>
      </div>

      {/* Tab 1: Quadratic Resistance */}
      {activeTab === "resistance" && (
        <div className="p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 rounded-xl bg-dark-900 border border-dark-800 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">
                    Resistance Rating (r):
                  </label>
                  <span className="text-sm font-mono font-bold text-purple-400">
                    {resistancePct}% (r = {r.toFixed(2)})
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={75}
                  value={resistancePct}
                  onChange={(e) => setResistancePct(Number(e.target.value))}
                  className="w-full accent-purple-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>0% (No armor)</span>
                  <span>50% (Hardened)</span>
                  <span>75% (Hard Cap)</span>
                </div>

                <div className="pt-2 border-t border-dark-800 flex items-center justify-between">
                  <label className="text-xs text-slate-400">
                    Base Incoming DoT Damage:
                  </label>
                  <input
                    type="number"
                    value={baseDotDamage}
                    onChange={(e) => setBaseDotDamage(Math.max(1, Number(e.target.value)))}
                    className="w-20 px-2 py-1 text-xs font-mono rounded bg-dark-950 border border-dark-750 text-slate-200 text-right"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 text-xs text-slate-300 leading-relaxed space-y-2">
                <div className="font-bold text-purple-300 flex items-center gap-1.5">
                  <Shield className="w-4 h-4" />
                  Why Quadratic Mitigation Exists:
                </div>
                <p>
                  In <code>Status.cpp</code>, resistance <code>r</code> attenuates{" "}
                  <strong>DPS</strong> by <code>(1 - r)</code> and also diminishes{" "}
                  <strong>Duration</strong> by <code>(1 - r)</code>.
                </p>
                <p className="font-mono text-[11px] text-amber-300">
                  Total DoT = Base × (1 - r) × (1 - r) = Base × (1 - r)²
                </p>
                <p>
                  At the 75% hard resistance cap, the hero takes only{" "}
                  <code>(0.25)² = 0.0625</code> (6.25%) of raw burn/poison damage, achieving{" "}
                  <strong>93.75% effective mitigation</strong>!
                </p>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-dark-900 border border-dark-800">
                  <span className="text-xs text-slate-400 block mb-1">
                    Linear Scaling (Naive):
                  </span>
                  <div className="text-xl font-mono font-bold text-slate-200">
                    {linearDamageTaken.toFixed(1)} dmg
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    Mitigates: {linearMitigationPct.toFixed(1)}%
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-500/50">
                  <span className="text-xs text-purple-300 font-semibold block mb-1">
                    Mellangan (1 - r)² Scaling:
                  </span>
                  <div className="text-xl font-mono font-bold text-purple-300">
                    {quadraticDamageTaken.toFixed(1)} dmg
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400 font-bold">
                    Effective: {quadraticMitigationPct.toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Graphical Visualizer */}
              <div className="p-4 rounded-xl bg-[#090710] border border-dark-800">
                <div className="text-xs font-mono text-slate-400 mb-3 flex items-center justify-between">
                  <span>Damage Multiplier Curve vs Resistance r ∈ [0.0, 0.75]</span>
                  <span className="text-purple-400 font-bold">Current r = {r.toFixed(2)}</span>
                </div>
                <div className="h-40 flex items-end gap-1.5 pt-4 pb-2 border-b border-dark-750 px-2">
                  {[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.75].map((val) => {
                    const quad = Math.pow(1 - val, 2);
                    const isSelected = Math.abs(val - r) < 0.05;
                    return (
                      <div
                        key={val}
                        className="flex-1 flex flex-col items-center gap-1.5 group cursor-pointer"
                        onClick={() => setResistancePct(Math.round(val * 100))}
                      >
                        <div className="text-[10px] font-mono text-slate-500 group-hover:text-purple-300">
                          {(quad * 100).toFixed(0)}%
                        </div>
                        <div
                          className={`w-full rounded-t transition-all ${
                            isSelected
                              ? "bg-purple-500 shadow-lg shadow-purple-500/50"
                              : "bg-dark-750 group-hover:bg-purple-800"
                          }`}
                          style={{ height: `${quad * 110}px` }}
                        />
                        <div className="text-[9px] font-mono text-slate-400">
                          {(val * 100).toFixed(0)}%
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-2">
                  <span>← 0% Resist (Full Damage)</span>
                  <span>75% Resist (Cap: 6.25% Damage) →</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: LightField contact-shadow falloff */}
      {activeTab === "attenuation" && (
        <div className="p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 rounded-xl bg-dark-900 border border-dark-800 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">
                    Caster to Object Distance (d):
                  </label>
                  <span className="text-sm font-mono font-bold text-amber-400">
                    {attenDistance} px
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={400}
                  value={attenDistance}
                  onChange={(e) => setAttenDistance(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />

                <div className="flex items-center justify-between pt-2 border-t border-dark-800">
                  <label className="text-xs font-bold text-slate-300">
                    Caster Reach (R):
                  </label>
                  <span className="text-sm font-mono font-bold text-sky-400">
                    {attenRadius} px
                  </span>
                </div>
                <input
                  type="range"
                  min={40}
                  max={300}
                  value={attenRadius}
                  onChange={(e) => setAttenRadius(Number(e.target.value))}
                  className="w-full accent-sky-500 cursor-pointer"
                />

                <div className="pt-2 text-xs font-mono text-slate-400 space-y-1">
                  <div>
                    d / R Ratio: <strong className="text-slate-200">{attenRatio.toFixed(2)}</strong>
                  </div>
                  <div>
                    Shadow Falloff f(d):{" "}
                    <strong className="text-amber-400">{attenFactor.toFixed(4)}</strong>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-slate-300 leading-relaxed space-y-2">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <Flame className="w-4 h-4" />
                  Contact shadow in LightField.cpp:
                </div>
                <p>
                  A caster contributes only when the object lies between 6 pixels and its
                  reach. Within that interval, the shadow fades linearly with distance:
                </p>
                <div className="p-2 rounded bg-dark-950 font-mono text-xs text-amber-300 text-center">
                  f(d) = 1 - d / R; alpha = clamp(1.5 × strength × f, 0, 1)
                </div>
                <p>
                  The displayed bar shows falloff before strength and alpha clamping. The
                  very near region is skipped, and the shadow ends at reach.
                </p>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-4">
              <div className="p-4 rounded-xl bg-dark-900 border border-dark-800 space-y-3">
                <div className="text-xs font-mono text-slate-400">
                  Contact Shadow Falloff at d = {attenDistance} px:
                </div>
                <div className="w-full h-6 rounded-full bg-dark-950 border border-dark-750 overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 transition-all"
                    style={{ width: `${Math.min(100, attenPct)}%` }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-[11px] font-mono font-bold text-slate-900 drop-shadow">
                    {attenPct.toFixed(1)}% Falloff Remaining
                  </span>
                </div>
              </div>

              {/* Radial Canvas Visualization */}
              <div className="p-4 rounded-xl bg-[#090710] border border-dark-800 flex flex-col items-center">
                <div className="text-xs font-mono text-slate-400 mb-2 w-full flex justify-between">
                  <span>Caster Reach and Object Distance</span>
                  <span className="text-sky-400">R = {attenRadius} px</span>
                </div>
                <div className="relative w-full max-w-[340px] h-[220px] rounded-lg bg-black border border-dark-750 flex items-center justify-center overflow-hidden">
                  {/* Caster reach, shown at 0.4 canvas px per world px */}
                  <div
                    className="absolute rounded-full border border-sky-400/80 pointer-events-none"
                    style={{
                      width: `${attenRadius * 0.8}px`,
                      height: `${attenRadius * 0.8}px`,
                    }}
                  />
                  {/* Center emitter glow */}
                  <div
                    className="w-8 h-8 rounded-full bg-amber-400 blur-sm flex items-center justify-center shadow-lg shadow-amber-500/80"
                  />
                  {/* Object casting the shadow */}
                  <div
                    className="absolute w-4 h-4 rounded-full bg-emerald-400 border border-white transition-all shadow"
                    style={{
                      transform: `translate(${attenDistance * 0.4}px, 0)`,
                    }}
                  />
                </div>
                <div className="text-[10px] font-mono text-slate-500 mt-2 text-center">
                  Circle: caster reach R. Green dot: object at distance d. Canvas scale: 0.4 px per world pixel.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Sight Cone Dot Product */}
      {activeTab === "sightcone" && (
        <div className="p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 rounded-xl bg-dark-900 border border-dark-800 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">
                    Quarry Aim Angle (θ):
                  </label>
                  <span className="text-sm font-mono font-bold text-sky-400">
                    {entityAngleDeg}°
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={entityAngleDeg}
                  onChange={(e) => setEntityAngleDeg(Number(e.target.value))}
                  className="w-full accent-sky-500 cursor-pointer"
                />

                <div className="pt-2 border-t border-dark-800 text-xs font-mono space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Dot Product (u · v):</span>
                    <strong className={dotProduct > COS_HALF_FOV ? "text-emerald-400" : "text-rose-400"}>
                      {dotProduct.toFixed(3)}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Angle Between:</span>
                    <strong className="text-slate-200">{angleDeg.toFixed(1)}°</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Threshold cos(56.6°):</span>
                    <strong className="text-amber-400">&gt; {COS_HALF_FOV.toFixed(3)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Enemy Distance:</span>
                    <strong className="text-slate-200">{worldDist.toFixed(1)} world px (&lt; 300)</strong>
                  </div>
                </div>

                <div
                  className={`p-3 rounded-lg border text-center font-mono text-xs font-bold ${
                    isTargetVisible
                      ? "bg-emerald-950/40 border-emerald-500 text-emerald-300"
                      : "bg-rose-950/40 border-rose-500 text-rose-300"
                  }`}
                >
                  {isTargetVisible
                    ? "✓ ENEMY IN QUARRY'S AIM CONE"
                    : "✗ ENEMY OUTSIDE AIM OR RANGE"}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-dark-900 border border-dark-800 text-xs text-slate-300 leading-relaxed space-y-2">
                <div className="font-bold text-sky-300 flex items-center gap-1.5">
                  <Eye className="w-4 h-4" />
                  Quarry aim test in Enemy.cpp:
                </div>
                <p>
                  The enemy tests whether it lies in front of its quarry. This canvas puts the quarry
                  at the centre and the enemy at the clicked point. The game first leads the quarry&apos;s
                  position, then takes a dot product with the quarry&apos;s aim:
                </p>
                <div className="p-2 rounded bg-dark-950 font-mono text-[11px] text-sky-300 text-center">
                  quarryAim · directionToEnemy &gt; 0.55; distance &lt; 300
                </div>
                <p>
                  The canvas isolates the cone test; it does not simulate the velocity lead.
                </p>
              </div>
            </div>

            <div className="lg:col-span-7 flex flex-col items-center">
              <div className="relative rounded-xl border border-dark-750 overflow-hidden bg-black shadow-inner">
                <canvas
                  ref={sightConeCanvasRef}
                  width={440}
                  height={300}
                  onClick={handleSightCanvasClick}
                  className="cursor-crosshair block w-full max-w-[440px] h-auto"
                />
              </div>
              <span className="text-[10px] font-mono text-slate-500 mt-2">
                Click anywhere on the radar canvas to reposition the target quarry.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Diminishing Returns Magic Find */}
      {activeTab === "magicfind" && (
        <div className="p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 rounded-xl bg-dark-900 border border-dark-800 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">
                    Gear Raw Magic Find (MF):
                  </label>
                  <span className="text-sm font-mono font-bold text-amber-400">
                    +{rawMf}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={800}
                  value={rawMf}
                  onChange={(e) => setRawMf(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>0% (Standard)</span>
                  <span>250% (Break-even)</span>
                  <span>800% (High Endgame)</span>
                </div>

                <div className="pt-3 border-t border-dark-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Asymptotic Cap Factor C:</span>
                    <strong className="text-slate-200">250.0</strong>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Effective Affix Multiplier:</span>
                    <strong className="text-amber-400 font-bold">
                      +{effectiveMf.toFixed(1)}%
                    </strong>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-slate-300 leading-relaxed space-y-2">
                <div className="font-bold text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  Hyperbolic Diminishing Returns:
                </div>
                <p>
                  To prevent high-tier affix stacking from trivializing rare/unique drop tables,
                  Mellangan passes gear MF through the hyperbolic transform:
                </p>
                <div className="p-2 rounded bg-dark-950 font-mono text-xs text-amber-300 text-center">
                  Effective MF = (MF × 250) / (MF + 250)
                </div>
                <p>
                  At 250% raw MF, the hero gets exactly 125% effective MF. Beyond 500%, the curve
                  flattens asymptotically toward the hard theoretical ceiling of 250%.
                </p>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-4">
              <div className="p-4 rounded-xl bg-[#090710] border border-dark-800">
                <div className="text-xs font-mono text-slate-400 mb-3 flex items-center justify-between">
                  <span>Effective MF Curve vs Raw MF ∈ [0, 800]%</span>
                  <span className="text-amber-400 font-bold">
                    Raw: +{rawMf}% → Eff: +{effectiveMf.toFixed(1)}%
                  </span>
                </div>

                <div className="h-44 flex items-end gap-1.5 pt-4 pb-2 border-b border-dark-750 px-2">
                  {[0, 50, 100, 150, 200, 250, 350, 500, 650, 800].map((val) => {
                    const eff = (val * 250) / (val + 250);
                    const isSelected = Math.abs(val - rawMf) < 40;
                    return (
                      <div
                        key={val}
                        className="flex-1 flex flex-col items-center gap-1.5 group cursor-pointer"
                        onClick={() => setRawMf(val)}
                      >
                        <div className="text-[10px] font-mono text-slate-400 group-hover:text-amber-300">
                          +{eff.toFixed(0)}%
                        </div>
                        <div
                          className={`w-full rounded-t transition-all ${
                            isSelected
                              ? "bg-amber-400 shadow-lg shadow-amber-500/50"
                              : "bg-dark-750 group-hover:bg-amber-700"
                          }`}
                          style={{ height: `${(eff / 250) * 120}px` }}
                        />
                        <div className="text-[9px] font-mono text-slate-500">
                          {val}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-2">
                  <span>0% Raw MF</span>
                  <span className="text-amber-400 font-semibold">Theoretical Max: +250%</span>
                  <span>800% Raw MF</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: orderedBits float inspector */}
      {activeTab === "orderedbits" && (
        <div className="p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-4">
              <div className="p-4 rounded-xl bg-dark-900 border border-dark-800 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">
                    Input Floating-Point Coordinate (f):
                  </label>
                  <span className="text-sm font-mono font-bold text-teal-400">
                    {testFloat.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={-100}
                    max={100}
                    step={0.5}
                    value={testFloat}
                    onChange={(e) => setTestFloat(Number(e.target.value))}
                    className="flex-1 accent-teal-500 cursor-pointer"
                  />
                  <input
                    type="number"
                    step={0.5}
                    value={testFloat}
                    onChange={(e) => setTestFloat(Number(e.target.value))}
                    className="w-20 px-2 py-1 text-xs font-mono rounded bg-dark-950 border border-dark-750 text-slate-200 text-right"
                  />
                </div>

                {/* Preset quick test chips */}
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-dark-800">
                  {[-100, -42.5, -0.0, 0.0, 1.0, 42.5, 100].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTestFloat(preset)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                        Object.is(testFloat, preset)
                          ? "bg-teal-500/20 text-teal-300 border-teal-500/50"
                          : "bg-dark-950 text-slate-400 border-dark-800 hover:text-slate-200"
                      }`}
                    >
                      {Object.is(preset, -0.0) ? "-0.0" : preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-teal-950/20 border border-teal-500/30 text-xs text-slate-300 leading-relaxed space-y-2">
                <div className="font-bold text-teal-300 flex items-center gap-1.5">
                  <Binary className="w-4 h-4" />
                  The IEEE 754 Monotonicity Proof:
                </div>
                <p>
                  Because negative floats have sign bit <code>1</code> and inverted magnitude, standard
                  radix sort cannot sort raw float bits directly.
                </p>
                <div className="p-2 rounded bg-dark-950 font-mono text-[11px] text-teal-300">
                  mask = (int32_t(u) &gt;&gt; 31) | 0x80000000u
                  <br />
                  ordered = u ^ mask
                </div>
                <p>
                  Positive floats flip bit 31 only, mapping <code>[0, +inf)</code> to{" "}
                  <code>[0x80000000, 0xFFFFFFFF]</code>. Negative floats invert all 32 bits,
                  mapping <code>(-inf, -0]</code> monotonically to <code>[0, 0x7FFFFFFF]</code>!
                </p>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-3 font-mono text-xs">
              <div className="p-3.5 rounded-xl bg-dark-900 border border-dark-800 space-y-1">
                <div className="text-slate-500 text-[11px]">1. Raw IEEE 754 Floating-Point Bits (u):</div>
                <div className="text-slate-200 flex items-center justify-between">
                  <span className="font-bold text-slate-100">{floatAnalysis.rawBitsHex}</span>
                  <span className="text-[10px] text-slate-400">
                    Sign: {floatAnalysis.signBit} | Exp: {floatAnalysis.exponentBits}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 break-all">
                  {floatAnalysis.rawBitsBin}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-dark-900 border border-dark-800 space-y-1">
                <div className="text-slate-500 text-[11px]">2. Arithmetic Shift Mask ((int32(u) &gt;&gt; 31) | 0x80000000):</div>
                <div className="text-amber-300 font-bold flex items-center justify-between">
                  <span>{floatAnalysis.maskHex}</span>
                  <span className="text-[10px] text-slate-400">
                    {testFloat >= 0 ? "Flipping Sign Bit 31 Only" : "Inverting All 32 Bits"}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-teal-950/40 border border-teal-500/50 space-y-1">
                <div className="text-teal-300 font-semibold text-[11px]">
                  3. Resulting Monotonic Key orderedBits(f):
                </div>
                <div className="text-teal-200 font-bold flex items-center justify-between text-sm">
                  <span>{floatAnalysis.orderedBitsHex}</span>
                  <span className="text-xs text-emerald-400">
                    Decimal: {floatAnalysis.orderedBits}
                  </span>
                </div>
                <div className="text-[10px] text-teal-400/80 break-all">
                  {floatAnalysis.orderedBitsBin}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#090710] border border-dark-800 text-[11px] text-slate-400">
                Notice: as <code>f</code> increases from <code>-100</code> to <code>+100</code>,{" "}
                <code>orderedBits(f)</code> strictly and monotonically increases as an unsigned integer,
                allowing 3 passes of 12-bit Radix Sort with zero float comparisons!
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

