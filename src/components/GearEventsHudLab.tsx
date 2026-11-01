import React, { useState, useMemo } from "react";
import {
  Shield,
  Sparkles,
  Compass,
  Zap,
  Layers,
  MapPin,
  Swords,
} from "lucide-react";

type LabTab = "gear" | "events" | "hudchart";

interface BiomeEventDef {
  id: number;
  biome: string;
  name: string;
  every: number;
  radius: number;
  boon: boolean;
  cleanse?: boolean;
  charge?: boolean;
  heal?: number;
  push?: number;
  repel?: number;
  strike?: number;
  sting?: number;
  status?: string;
  foeStrike?: number;
  foeStatus?: string;
  raise?: string;
  color: string;
}

const BIOME_EVENTS: BiomeEventDef[] = [
  {
    id: 0,
    biome: "Meadows (0)",
    name: "A WARM BREEZE",
    every: 48,
    radius: 64,
    boon: true,
    heal: 1.5,
    color: "text-amber-300",
  },
  {
    id: 1,
    biome: "Greenwood (1)",
    name: "THE OLD OAKS SHELTER",
    every: 48,
    radius: 64,
    boon: true,
    repel: 150,
    color: "text-emerald-300",
  },
  {
    id: 3,
    biome: "Heath (3)",
    name: "WILDFIRE SPREADS",
    every: 48,
    radius: 64,
    boon: false,
    status: "Burn (3 DPS)",
    foeStatus: "Burn (6 DPS)",
    color: "text-orange-400",
  },
  {
    id: 4,
    biome: "Barrows (4)",
    name: "THE BARROW OPENS",
    every: 48,
    radius: 64,
    boon: false,
    raise: "5× Skeleton",
    color: "text-slate-300",
  },
  {
    id: 6,
    biome: "Blossom Grove (6)",
    name: "PETALS FALL",
    every: 48,
    radius: 64,
    boon: true,
    cleanse: true,
    heal: 1.0,
    color: "text-pink-300",
  },
  {
    id: 11,
    biome: "Ashlands (11)",
    name: "THE GROUND ERUPTS",
    every: 48,
    radius: 48,
    boon: false,
    strike: 16,
    status: "Burn (3 DPS)",
    foeStrike: 50,
    color: "text-rose-400",
  },
  {
    id: 12,
    biome: "Crystal Fields (12)",
    name: "THE CRYSTALS RESONATE",
    every: 48,
    radius: 64,
    boon: true,
    charge: true,
    foeStatus: "Chill (50%)",
    color: "text-purple-300",
  },
  {
    id: 16,
    biome: "Salt Flats (16)",
    name: "SALT CRUST FRACTURES",
    every: 28,
    radius: 64,
    boon: false,
    strike: 8,
    foeStatus: "Chill (40%)",
    color: "text-yellow-200",
  },
  {
    id: 18,
    biome: "Moonlit Grove (18)",
    name: "MOONLIGHT PURIFIES",
    every: 28,
    radius: 64,
    boon: true,
    cleanse: true,
    foeStatus: "Marked (+30%)",
    color: "text-indigo-300",
  },
  {
    id: 22,
    biome: "Storm Steppe (22)",
    name: "THE STORM CHARGES",
    every: 28,
    radius: 64,
    boon: true,
    charge: true,
    foeStatus: "Marked (+30%)",
    color: "text-sky-300",
  },
  {
    id: 25,
    biome: "Starfall Basin (25)",
    name: "A STAR WILL FALL",
    every: 28,
    radius: 42,
    boon: false,
    strike: 14,
    foeStrike: 45,
    color: "text-gold-300",
  },
];

function mix32(n: number): number {
  let x = n >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x = (x ^ (x >>> 15)) >>> 0;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return x >>> 0;
}

export const GearEventsHudLab: React.FC = () => {
  const [tab, setTab] = useState<LabTab>("gear");

  // Tab 1: Paper-Doll Gear Reversibility & Enemy::hurt / Resistance Math
  const [baseWeaponDmg, setBaseWeaponDmg] = useState<number>(28);
  const [highGround, setHighGround] = useState<boolean>(true);
  const [heroEdge, setHeroEdge] = useState<number>(2.2); // 1.8 default, 2.2 Corsair, 2.5 Duelist
  const [bossBonus, setBossBonus] = useState<number>(22);
  const [eliteBonus, setEliteBonus] = useState<number>(18);
  const [nightBonus, setNightBonus] = useState<number>(14);
  const [draftedWeaponLvl, setDraftedWeaponLvl] = useState<number>(1);
  const [equippedTier, setEquippedTier] = useState<number>(2); // 0=Worn(Lv1), 1=Standard(Lv2), 2=Elite(Lv3)
  const [resistPct, setResistPct] = useState<number>(60);

  // Tab 2: BiomeEvents::schedule() deterministic hash
  const [eventIdx, setEventIdx] = useState<number>(6);
  const [worldSeed, setWorldSeed] = useState<number>(1337);
  const [epoch, setEpoch] = useState<number>(2);
  const [regionX, setRegionX] = useState<number>(1);
  const [regionY, setRegionY] = useState<number>(-1);

  // Tab 3: Hud::edge() Ray Clipping, Hud::lootLabels() Stacker & Chart::draw() RLE
  const [targetDx, setTargetDx] = useState<number>(340);
  const [targetDy, setTargetDy] = useState<number>(-220);
  const [bossBarActive, setBossBarActive] = useState<boolean>(true);
  const [clusterCount, setClusterCount] = useState<number>(5);

  const gearStats = useMemo(() => {
    const elevMult = highGround ? 1.15 : 1.0;
    const catMult = 1 + (bossBonus + eliteBonus + nightBonus) / 100;
    const nonCritHit = baseWeaponDmg * elevMult * catMult;
    const critHit = nonCritHit * heroEdge;

    // Player::wear / Player::shed gearLevels[slot] math
    const targetGrantLvl = equippedTier + 1; // tier 0->1, 1->2, 2->3
    const wornLvl = Math.min(5, Math.max(draftedWeaponLvl, targetGrantLvl));
    const gearLevelsDelta = Math.max(0, wornLvl - draftedWeaponLvl);
    const shedRestoredLvl = Math.max(0, wornLvl - gearLevelsDelta);

    // Status::apply() quadratic DoT resistance math
    const r = Math.min(0.75, Math.max(0, resistPct / 100));
    const powerScale = 1 - r;
    const durationScale = 1 - r;
    const totalDoTScale = powerScale * durationScale;
    const effectiveMitigationPct = (1 - totalDoTScale) * 100;

    return {
      elevMult,
      catMult,
      nonCritHit,
      critHit,
      targetGrantLvl,
      wornLvl,
      gearLevelsDelta,
      shedRestoredLvl,
      r,
      powerScale,
      durationScale,
      totalDoTScale,
      effectiveMitigationPct,
    };
  }, [
    baseWeaponDmg,
    highGround,
    heroEdge,
    bossBonus,
    eliteBonus,
    nightBonus,
    draftedWeaponLvl,
    equippedTier,
    resistPct,
  ]);

  const scheduleStats = useMemo(() => {
    const def = BIOME_EVENTS[eventIdx];
    const seedInput =
      (worldSeed ^
        Math.imul(def.id, 0x9e3779b1) ^
        Math.imul(epoch, 0x85ebca6b) ^
        Math.imul(regionX, 0xc2b2ae35) ^
        Math.imul(regionY, 0x27d4eb2f)) >>>
      0;
    const h = mix32(seedInput);
    const begins =
      epoch * def.every + 8 + (h % Math.max(1, def.every - 17));
    const ends = begins + 5;
    const warnAt = begins - 3;
    const offsetX = ((h >>> 8) & 63) - 31;
    const offsetY = ((h >>> 16) & 63) - 31;
    const centerX = (regionX * 20 + 10) * 16 + offsetX;
    const centerY = (regionY * 20 + 10) * 16 + offsetY;
    const angleRad = ((h >>> 24) * (Math.PI * 2)) / 256;
    const angleDeg = (angleRad * 180) / Math.PI;
    const dx = Math.cos(angleRad);
    const dy = Math.sin(angleRad);

    return {
      def,
      hHex: "0x" + h.toString(16).toUpperCase().padStart(8, "0"),
      warnAt,
      begins,
      ends,
      centerX,
      centerY,
      offsetX,
      offsetY,
      angleDeg,
      dx,
      dy,
    };
  }, [eventIdx, worldSeed, epoch, regionX, regionY]);

  const hudAndChartStats = useMemo(() => {
    // Virtual viewport 480x270 at u=1, k=1
    const vw = 480;
    const vh = 270;
    const xm = vw * 0.5;
    const ym = vh * 0.5;
    const xh = vw * 0.5 - 18;
    const topMargin = 84;
    const bottomMargin = bossBarActive ? 46 : 18;
    const yh = vh * 0.5 - (targetDy < 0 ? topMargin : bottomMargin);

    const fitX = targetDx !== 0 ? xh / Math.abs(targetDx) : 1e9;
    const fitY = targetDy !== 0 ? yh / Math.abs(targetDy) : 1e9;
    const fit = Math.min(1.0, fitX, fitY);
    const offscreen = fit < 1.0;
    const pinX = xm + targetDx * fit;
    const pinY = ym + targetDy * fit;
    const dd = Math.max(1, Math.hypot(targetDx, targetDy));
    const nx = targetDx / dd;
    const ny = targetDy / dd;
    const clampedEdge =
      !offscreen
        ? "Inside Viewport (No Edge Pin)"
        : fitX < fitY
          ? targetDx > 0
            ? "Right Edge (xh = 222px)"
            : "Left Edge (-xh = -222px)"
          : targetDy < 0
            ? "Top Safe Edge (84u Dawn/Omen Header Margin)"
            : bossBarActive
              ? "Bottom Safe Edge (46u Boss Bar Margin)"
              : "Bottom Edge (18u Standard Margin)";

    // Simulate Hud::lootLabels() 12-iteration vertical AABB sweep
    const baseY = 180;
    const labelH = 18;
    const u = 1;
    const sampleNames = [
      { text: "Dusk Fang [Rare]", color: "text-amber-300 border-amber-500/40" },
      { text: "Night-Touched Tower Aegis", color: "text-purple-300 border-purple-500/40" },
      { text: "Searing Ember Lance of Haste", color: "text-sky-300 border-sky-500/40" },
      { text: "42 gold", color: "text-gold-300 border-gold-500/30" },
      { text: "material", color: "text-slate-300 border-slate-600/40" },
      { text: "Divine Moon Idol of Quickening", color: "text-sky-300 border-sky-500/40" },
    ];
    const stackedLabels: { text: string; color: string; rawY: number; finalY: number; shifts: number }[] = [];
    for (let i = 0; i < clusterCount; i++) {
      const rawY = baseY - (i % 2) * 4;
      let y = rawY;
      let shifts = 0;
      for (let tries = 0; tries < 12; tries++) {
        const hit = stackedLabels.find(
          (o) => y < o.finalY + labelH && o.finalY < y + labelH,
        );
        if (!hit) break;
        y = hit.finalY - labelH - u;
        shifts++;
      }
      stackedLabels.push({
        text: sampleNames[i % sampleNames.length].text,
        color: sampleNames[i % sampleNames.length].color,
        rawY,
        finalY: y,
        shifts,
      });
    }

    return {
      xh,
      yh,
      fit,
      offscreen,
      pinX,
      pinY,
      nx,
      ny,
      clampedEdge,
      stackedLabels,
    };
  }, [targetDx, targetDy, bossBarActive, clusterCount]);

  return (
    <div className="my-6 rounded-2xl border border-dark-750 bg-dark-900/90 overflow-hidden shadow-xl">
      <div className="px-4 py-3 bg-dark-950/90 border-b border-dark-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-gold-400" />
          <span className="font-display font-bold text-xs sm:text-sm tracking-wide text-slate-100">
            Paper-Doll Gear Math, Regional BiomeEvents &amp; HUD/Chart Geometry Lab
          </span>
        </div>

        <div className="flex items-center gap-1 bg-dark-900 p-1 rounded-lg border border-dark-800 text-xs font-mono">
          <button
            onClick={() => setTab("gear")}
            className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 ${
              tab === "gear"
                ? "bg-gold-500/20 text-gold-300 border border-gold-500/40 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Gear &amp; (1-r)² Resist</span>
          </button>
          <button
            onClick={() => setTab("events")}
            className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 ${
              tab === "events"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>26 BiomeEvents</span>
          </button>
          <button
            onClick={() => setTab("hudchart")}
            className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 ${
              tab === "hudchart"
                ? "bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>HUD Pins &amp; Loot Stack</span>
          </button>
        </div>
      </div>

      {tab === "gear" && (
        <div className="p-4 space-y-4 font-mono text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl bg-dark-950/70 border border-dark-800 space-y-3">
              <div className="text-gold-300 font-semibold flex items-center gap-1.5">
                <Swords className="w-3.5 h-3.5" />
                <span>Enemy::hurt() Multiplier &amp; Gear Grant Controls</span>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Base Weapon Hit</span>
                  <span className="text-slate-100 font-bold">{baseWeaponDmg} dmg</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={80}
                  step={2}
                  value={baseWeaponDmg}
                  onChange={(e) => setBaseWeaponDmg(Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setHighGround((h) => !h)}
                  className={`px-2.5 py-1 rounded-lg border transition-colors ${
                    highGround
                      ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-semibold"
                      : "bg-dark-900 border-dark-800 text-slate-400"
                  }`}
                >
                  High Ground (+15%): {highGround ? "YES" : "NO"}
                </button>
                <button
                  onClick={() =>
                    setHeroEdge((e) => (e === 1.8 ? 2.2 : e === 2.2 ? 2.5 : 1.8))
                  }
                  className="px-2.5 py-1 rounded-lg border bg-dark-900 border-dark-750 text-purple-300"
                >
                  Hero Crit Edge: ×{heroEdge.toFixed(1)}
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>Boss%</span>
                    <span className="text-gold-300">+{bossBonus}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    step={2}
                    value={bossBonus}
                    onChange={(e) => setBossBonus(Number(e.target.value))}
                    className="w-full accent-amber-400"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>Elite%</span>
                    <span className="text-rose-300">+{eliteBonus}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    step={2}
                    value={eliteBonus}
                    onChange={(e) => setEliteBonus(Number(e.target.value))}
                    className="w-full accent-rose-400"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>Night%</span>
                    <span className="text-sky-300">+{nightBonus}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    step={2}
                    value={nightBonus}
                    onChange={(e) => setNightBonus(Number(e.target.value))}
                    className="w-full accent-sky-400"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-dark-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    Status Resist (<code>status.resist[i]</code> ≤ 75%)
                  </span>
                  <span className="text-sky-300 font-bold">{resistPct}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={90}
                  step={5}
                  value={resistPct}
                  onChange={(e) => setResistPct(Number(e.target.value))}
                  className="w-full accent-sky-400"
                />
              </div>

              <div className="pt-2 border-t border-dark-800 grid grid-cols-2 gap-2">
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>Drafted Upgrade Lvl</span>
                    <span className="text-emerald-300">Lv.{draftedWeaponLvl}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    step={1}
                    value={draftedWeaponLvl}
                    onChange={(e) => setDraftedWeaponLvl(Number(e.target.value))}
                    className="w-full accent-emerald-400"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                    <span>Equipped Item Tier</span>
                    <span className="text-gold-300">
                      Tier {equippedTier} (Grants Lv.{equippedTier + 1})
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={2}
                    step={1}
                    value={equippedTier}
                    onChange={(e) => setEquippedTier(Number(e.target.value))}
                    className="w-full accent-amber-400"
                  />
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-dark-950/70 border border-dark-800 flex flex-col justify-between space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-2.5 rounded-lg bg-dark-900 border border-dark-800">
                  <div className="text-[10px] uppercase text-slate-400">
                    Non-Crit / Crit Hit
                  </div>
                  <div className="text-sm font-bold text-gold-300 mt-0.5">
                    {gearStats.nonCritHit.toFixed(1)} /{" "}
                    <span className="text-rose-300">
                      {gearStats.critHit.toFixed(1)}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Elev ×{gearStats.elevMult.toFixed(2)} • Bonus ×
                    {gearStats.catMult.toFixed(2)}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-dark-900 border border-dark-800">
                  <div className="text-[10px] uppercase text-slate-400">
                    Quadratic (1-r)² DoT Scale
                  </div>
                  <div className="text-sm font-bold text-sky-300 mt-0.5">
                    {(gearStats.totalDoTScale * 100).toFixed(2)}% Dmg Taken
                  </div>
                  <div className="text-[10px] text-emerald-400">
                    {gearStats.effectiveMitigationPct.toFixed(2)}% Total DoT Mitigated!
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-dark-900 border border-dark-800 col-span-2">
                  <div className="text-[10px] uppercase text-purple-300 mb-1">
                    Reversible <code>Player::wear</code> / <code>Player::shed</code>{" "}
                    (<code>gearLevels[slot]</code>)
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-1.5 rounded bg-dark-950 border border-dark-800">
                      <div className="text-[10px] text-slate-500">Before Wear</div>
                      <div className="text-slate-200 font-bold">
                        Lv.{draftedWeaponLvl}
                      </div>
                    </div>
                    <div className="p-1.5 rounded bg-dark-950 border border-gold-500/40">
                      <div className="text-[10px] text-gold-400">
                        While Worn (Δ=+{gearStats.gearLevelsDelta})
                      </div>
                      <div className="text-gold-300 font-bold">
                        Lv.{gearStats.wornLvl}
                      </div>
                    </div>
                    <div className="p-1.5 rounded bg-dark-950 border border-emerald-500/40">
                      <div className="text-[10px] text-emerald-400">After Shed</div>
                      <div className="text-emerald-300 font-bold">
                        Lv.{gearStats.shedRestoredLvl} (Exact!)
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-dark-900/90 border border-dark-800 text-[11px] text-slate-300 leading-relaxed">
                <span className="text-sky-300 font-semibold">
                  Why Resistances Scale Quadratically on DoTs:
                </span>{" "}
                In <code>Status::apply()</code>,{" "}
                <code>r = clamp(resist[i], 0, 0.75)</code> multiplies{" "}
                <strong>both</strong> <code>power *= (1 - r)</code> (
                {(gearStats.powerScale * 100).toFixed(0)}%) and{" "}
                <code>duration *= (1 - r)</code> (
                {(gearStats.durationScale * 100).toFixed(0)}%), so total DoT
                damage scales by <code>(1 - r)²</code>!
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "events" && (
        <div className="p-4 space-y-4 font-mono text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl bg-dark-950/70 border border-dark-800 space-y-3">
              <div>
                <div className="text-slate-400 mb-1.5">
                  Select Regional Event (<code>EVENTS[BIOME_COUNT]</code>)
                </div>
                <select
                  value={eventIdx}
                  onChange={(e) => setEventIdx(Number(e.target.value))}
                  className="w-full p-2 rounded-lg bg-dark-900 border border-dark-750 text-slate-100"
                >
                  {BIOME_EVENTS.map((ev, idx) => (
                    <option key={ev.id} value={idx} className="bg-dark-900">
                      {ev.biome}: {ev.name} ({ev.boon ? "BOON" : "HAZARD"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">World Seed</span>
                    <span className="text-gold-300">{worldSeed}</span>
                  </div>
                  <input
                    type="range"
                    min={100}
                    max={9999}
                    step={17}
                    value={worldSeed}
                    onChange={(e) => setWorldSeed(Number(e.target.value))}
                    className="w-full accent-amber-400"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Epoch Index</span>
                    <span className="text-purple-300">epoch = {epoch}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={12}
                    step={1}
                    value={epoch}
                    onChange={(e) => setEpoch(Number(e.target.value))}
                    className="w-full accent-purple-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Region rx</span>
                    <span className="text-sky-300">{regionX}</span>
                  </div>
                  <input
                    type="range"
                    min={-4}
                    max={4}
                    step={1}
                    value={regionX}
                    onChange={(e) => setRegionX(Number(e.target.value))}
                    className="w-full accent-sky-400"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Region ry</span>
                    <span className="text-sky-300">{regionY}</span>
                  </div>
                  <input
                    type="range"
                    min={-4}
                    max={4}
                    step={1}
                    value={regionY}
                    onChange={(e) => setRegionY(Number(e.target.value))}
                    className="w-full accent-sky-400"
                  />
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-dark-950/70 border border-dark-800 flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-dark-800 pb-2">
                  <div>
                    <div className={`font-bold text-sm ${scheduleStats.def.color}`}>
                      {scheduleStats.def.name}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Banner: &quot;{scheduleStats.def.name} -{" "}
                      {scheduleStats.def.boon ? "STEP INSIDE" : "MOVE TO SAFETY"}
                      &quot;
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-dark-900 border border-dark-750 text-[10px] text-slate-300">
                    mix(h) = {scheduleStats.hHex}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded bg-dark-900 border border-dark-800">
                    <div className="text-[10px] text-slate-400">
                      Telegraph / Active Window
                    </div>
                    <div className="text-gold-300 font-bold mt-0.5">
                      Warn @ {scheduleStats.warnAt}s → [{scheduleStats.begins}s..
                      {scheduleStats.ends}s]
                    </div>
                    <div className="text-[10px] text-slate-500">
                      every={scheduleStats.def.every}s • radius=
                      {scheduleStats.def.radius}px
                    </div>
                  </div>

                  <div className="p-2 rounded bg-dark-900 border border-dark-800">
                    <div className="text-[10px] text-slate-400">
                      World Center &amp; Drift Vector
                    </div>
                    <div className="text-sky-300 font-bold mt-0.5">
                      ({scheduleStats.centerX}, {scheduleStats.centerY}) px
                    </div>
                    <div className="text-[10px] text-slate-500">
                      θ={scheduleStats.angleDeg.toFixed(0)}° (dx=
                      {scheduleStats.dx.toFixed(2)}, dy=
                      {scheduleStats.dy.toFixed(2)})
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-dark-900/90 border border-dark-800 text-[11px] text-slate-300 space-y-1">
                <div className="text-emerald-300 font-semibold">
                  Active 0.5s Pulse &amp; Continuous Sway Mechanics:
                </div>
                <div>
                  •{" "}
                  {scheduleStats.def.boon
                    ? "Boon Sanctuary Circle"
                    : "Hazard Circle (+1 level.handicaps on first touch)"}
                  {scheduleStats.def.heal
                    ? ` • Heals +${scheduleStats.def.heal} HP / 0.5s`
                    : ""}
                  {scheduleStats.def.cleanse
                    ? " • Cleanses Burn & Poison"
                    : ""}
                  {scheduleStats.def.charge
                    ? " • 3× Skill Cooldown Recharge (skillTime -= 2*DT)"
                    : ""}
                  {scheduleStats.def.repel
                    ? ` • Repels Enemies Outward (${scheduleStats.def.repel} px/s²)`
                    : ""}
                  {scheduleStats.def.strike
                    ? ` • First-Pulse Strike: ${scheduleStats.def.strike} dmg`
                    : ""}
                  {scheduleStats.def.status
                    ? ` • Player Status: ${scheduleStats.def.status}`
                    : ""}
                  {scheduleStats.def.foeStrike
                    ? ` • Foe Strike: ${scheduleStats.def.foeStrike} dmg`
                    : ""}
                  {scheduleStats.def.foeStatus
                    ? ` • Foe Status: ${scheduleStats.def.foeStatus}`
                    : ""}
                  {scheduleStats.def.raise
                    ? ` • Spawns ${scheduleStats.def.raise} Ring`
                    : ""}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "hudchart" && (
        <div className="p-4 space-y-4 font-mono text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl bg-dark-950/70 border border-dark-800 space-y-3">
              <div className="text-sky-300 font-semibold flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                <span>Hud::edge(wx, wy, Pin) Asymmetric Ray-Box Clipper</span>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Target Offset xd (px)</span>
                  <span className="text-gold-300">{targetDx} px</span>
                </div>
                <input
                  type="range"
                  min={-500}
                  max={500}
                  step={10}
                  value={targetDx}
                  onChange={(e) => setTargetDx(Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Target Offset yd (px)</span>
                  <span className="text-gold-300">{targetDy} px</span>
                </div>
                <input
                  type="range"
                  min={-400}
                  max={400}
                  step={10}
                  value={targetDy}
                  onChange={(e) => setTargetDy(Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => setBossBarActive((b) => !b)}
                  className={`px-2.5 py-1 rounded-lg border ${
                    bossBarActive
                      ? "bg-rose-500/20 border-rose-500/50 text-rose-300 font-semibold"
                      : "bg-dark-900 border-dark-800 text-slate-400"
                  }`}
                >
                  Boss Bar Active (Bottom Margin = {bossBarActive ? "46u" : "18u"})
                </button>
              </div>

              <div className="p-2.5 rounded-lg bg-dark-900 border border-dark-800 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Ray Scale Factor (fit):</span>
                  <span className="text-emerald-300 font-bold">
                    fit = {hudAndChartStats.fit.toFixed(3)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Clamped Pin (x, y):</span>
                  <span className="text-gold-300 font-bold">
                    ({hudAndChartStats.pinX.toFixed(1)},{" "}
                    {hudAndChartStats.pinY.toFixed(1)})
                  </span>
                </div>
                <div className="text-[10px] text-sky-300 pt-0.5">
                  Boundary: {hudAndChartStats.clampedEdge}
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-dark-950/70 border border-dark-800 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-purple-300 font-semibold flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Hud::lootLabels() 12-Pass Vertical Stacker</span>
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Drops: {clusterCount}
                  </span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={6}
                  step={1}
                  value={clusterCount}
                  onChange={(e) => setClusterCount(Number(e.target.value))}
                  className="w-full accent-purple-400 mb-2"
                />

                <div className="space-y-1">
                  {[...hudAndChartStats.stackedLabels]
                    .sort((a, b) => a.finalY - b.finalY)
                    .map((lbl, idx) => (
                      <div
                        key={idx}
                        className={`px-2.5 py-1 rounded bg-dark-900/90 border flex items-center justify-between text-[11px] ${lbl.color}`}
                      >
                        <span className="truncate font-semibold">{lbl.text}</span>
                        <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                          y={lbl.finalY}px ({lbl.shifts} shifts)
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-dark-900/90 border border-dark-800 text-[11px] text-slate-300 leading-relaxed">
                <span className="text-gold-300 font-semibold">
                  Bottom-Up AABB Sweep:
                </span>{" "}
                <code>Hud::lootLabels()</code> sorts visible tags by{" "}
                <code>a.y &gt; b.y</code> and shifts overlapping tags upward via{" "}
                <code>t.y = hit-&gt;y - t.h - u</code> (up to 12 tries).
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
