import React, { useState, useMemo } from "react";
import {
  Sparkles,
  Dices,
  ShieldAlert,
  Coins,
  Compass,
  Sliders,
  Flame,
} from "lucide-react";

interface AffixTierData {
  name: string;
  qlvl: number;
  lo: number;
  hi: number;
}

interface AffixFamilyData {
  key: string;
  prefix: boolean;
  slots: string[];
  statLabel: string;
  unit: string;
  classOnly?: boolean;
  tiers: AffixTierData[];
}

const SAMPLE_BASES = [
  {
    key: "ember_lance",
    name: "Ember Lance",
    slot: "Weapon",
    qlvl: 1,
    weight: 10,
    implicit: "+12% Fire Damage",
  },
  {
    key: "lionheart_cleave",
    name: "Lionheart Greatsword",
    slot: "Weapon",
    qlvl: 6,
    weight: 9,
    implicit: "+15% Cleave Area",
  },
  {
    key: "hawk_talon",
    name: "Hawk Talon Recurve",
    slot: "Weapon",
    qlvl: 8,
    weight: 9,
    implicit: "+18% Projectile Speed",
  },
  {
    key: "thornwhip",
    name: "Bramble Thornwhip",
    slot: "Weapon",
    qlvl: 10,
    weight: 8,
    implicit: "+50% Tip Crack Damage",
  },
  {
    key: "runed_tome",
    name: "Runed Grimoire",
    slot: "Offhand",
    qlvl: 4,
    weight: 10,
    implicit: "+8% Skill Haste",
  },
  {
    key: "aegis_buckler",
    name: "Tower Aegis",
    slot: "Offhand",
    qlvl: 12,
    weight: 8,
    implicit: "+12% Block Chance",
  },
  {
    key: "warden_brigandine",
    name: "Brigandine Coat",
    slot: "Armour",
    qlvl: 5,
    weight: 10,
    implicit: "+3 Armour",
  },
  {
    key: "night_carapace",
    name: "Obsidian Carapace",
    slot: "Armour",
    qlvl: 16,
    weight: 7,
    implicit: "+6 Armour, +15% Fire Resist",
  },
  {
    key: "moon_idol",
    name: "Crescent Moon Idol",
    slot: "Charm",
    qlvl: 3,
    weight: 10,
    implicit: "+10% Magic Find",
  },
  {
    key: "lodestone_seal",
    name: "Lodestone Seal",
    slot: "Charm",
    qlvl: 10,
    weight: 8,
    implicit: "+20 Pickup Reach",
  },
];

const TIER_NAMES = ["Worn", "Standard", "Elite"];
const TIER_LEVEL = [0, 18, 36];

const AFFIX_POOL: AffixFamilyData[] = [
  {
    key: "damage",
    prefix: true,
    slots: ["Weapon"],
    statLabel: "weapon damage",
    unit: "%",
    tiers: [
      { name: "Sharp", qlvl: 1, lo: 6, hi: 10 },
      { name: "Fine", qlvl: 12, lo: 12, hi: 18 },
      { name: "Cruel", qlvl: 24, lo: 20, hi: 30 },
      { name: "Savage", qlvl: 36, lo: 32, hi: 48 },
      { name: "Merciless", qlvl: 48, lo: 50, hi: 70 },
    ],
  },
  {
    key: "burn",
    prefix: true,
    slots: ["Weapon", "Offhand"],
    statLabel: "chance to burn",
    unit: "%",
    tiers: [
      { name: "Smoldering", qlvl: 1, lo: 8, hi: 12 },
      { name: "Fiery", qlvl: 12, lo: 13, hi: 19 },
      { name: "Searing", qlvl: 24, lo: 20, hi: 26 },
      { name: "Blazing", qlvl: 36, lo: 27, hi: 34 },
      { name: "Infernal", qlvl: 48, lo: 35, hi: 45 },
    ],
  },
  {
    key: "bleed",
    prefix: true,
    slots: ["Weapon"],
    statLabel: "chance to bleed",
    unit: "%",
    tiers: [
      { name: "Jagged", qlvl: 1, lo: 8, hi: 12 },
      { name: "Serrated", qlvl: 12, lo: 13, hi: 19 },
      { name: "Rending", qlvl: 24, lo: 20, hi: 26 },
      { name: "Flaying", qlvl: 36, lo: 27, hi: 34 },
      { name: "Butchering", qlvl: 48, lo: 35, hi: 45 },
    ],
  },
  {
    key: "crit",
    prefix: true,
    slots: ["Weapon", "Charm"],
    statLabel: "critical chance",
    unit: "%",
    tiers: [
      { name: "Keen", qlvl: 1, lo: 1, hi: 2 },
      { name: "Precise", qlvl: 12, lo: 3, hi: 4 },
      { name: "Deadly", qlvl: 24, lo: 5, hi: 6 },
      { name: "Lethal", qlvl: 36, lo: 7, hi: 8 },
      { name: "Fatal", qlvl: 48, lo: 9, hi: 11 },
    ],
  },
  {
    key: "life",
    prefix: true,
    slots: ["Armour", "Charm"],
    statLabel: "maximum life",
    unit: "",
    tiers: [
      { name: "Hale", qlvl: 1, lo: 8, hi: 12 },
      { name: "Vital", qlvl: 12, lo: 16, hi: 24 },
      { name: "Robust", qlvl: 24, lo: 30, hi: 40 },
      { name: "Mighty", qlvl: 36, lo: 45, hi: 55 },
      { name: "Titan's", qlvl: 48, lo: 60, hi: 80 },
    ],
  },
  {
    key: "fortune",
    prefix: true,
    slots: ["Weapon", "Offhand", "Armour", "Charm"],
    statLabel: "magic find",
    unit: "%",
    tiers: [
      { name: "Lucky", qlvl: 1, lo: 6, hi: 10 },
      { name: "Charmed", qlvl: 12, lo: 12, hi: 18 },
      { name: "Blessed", qlvl: 24, lo: 20, hi: 30 },
      { name: "Fated", qlvl: 36, lo: 30, hi: 40 },
      { name: "Divine", qlvl: 48, lo: 42, hi: 58 },
    ],
  },
  {
    key: "haste",
    prefix: false,
    slots: ["Weapon", "Offhand", "Charm"],
    statLabel: "attack & cast haste",
    unit: "%",
    tiers: [
      { name: "of Haste", qlvl: 1, lo: 3, hi: 5 },
      { name: "of Celerity", qlvl: 12, lo: 6, hi: 8 },
      { name: "of Alacrity", qlvl: 24, lo: 9, hi: 11 },
      { name: "of Swiftness", qlvl: 36, lo: 12, hi: 15 },
      { name: "of Quickening", qlvl: 48, lo: 16, hi: 20 },
    ],
  },
  {
    key: "speed",
    prefix: false,
    slots: ["Armour", "Charm"],
    statLabel: "movement speed",
    unit: "%",
    tiers: [
      { name: "of the Fox", qlvl: 1, lo: 2, hi: 4 },
      { name: "of the Hare", qlvl: 12, lo: 4, hi: 6 },
      { name: "of the Stag", qlvl: 24, lo: 7, hi: 9 },
      { name: "of the Wind", qlvl: 36, lo: 10, hi: 12 },
      { name: "of the Gale", qlvl: 48, lo: 13, hi: 17 },
    ],
  },
  {
    key: "slaying",
    prefix: false,
    slots: ["Weapon"],
    statLabel: "damage vs elites",
    unit: "%",
    tiers: [
      { name: "of Slaying", qlvl: 1, lo: 6, hi: 10 },
      { name: "of the Hunt", qlvl: 24, lo: 12, hi: 16 },
      { name: "of the Executioner", qlvl: 48, lo: 19, hi: 25 },
    ],
  },
  {
    key: "night",
    prefix: false,
    slots: ["Weapon", "Charm"],
    statLabel: "damage at night",
    unit: "%",
    tiers: [
      { name: "of Dusk", qlvl: 1, lo: 4, hi: 6 },
      { name: "of Midnight", qlvl: 24, lo: 8, hi: 12 },
      { name: "of the Long Night", qlvl: 48, lo: 13, hi: 17 },
    ],
  },
  {
    key: "thorns",
    prefix: false,
    slots: ["Armour"],
    statLabel: "thorns damage",
    unit: "",
    tiers: [
      { name: "of Thorns", qlvl: 1, lo: 4, hi: 6 },
      { name: "of Spikes", qlvl: 16, lo: 8, hi: 12 },
      { name: "of Brambles", qlvl: 32, lo: 15, hi: 21 },
      { name: "of Razors", qlvl: 48, lo: 26, hi: 34 },
    ],
  },
];

const CURSES = [
  { name: "Frail", text: "-10% max health" },
  { name: "Leaden", text: "-5% movement speed" },
  { name: "Hunted", text: "foes deal 5% more damage to you" },
  { name: "Bleeding", text: "lose 1 health per second" },
  { name: "Dimmed", text: "-20% light radius" },
];

const RARE_FIRST = [
  "Dusk",
  "Ember",
  "Hollow",
  "Grave",
  "Moon",
  "Ash",
  "Storm",
  "Rune",
  "Blood",
  "Dread",
  "Thorn",
  "Wraith",
];
const RARE_SECOND: Record<string, string[]> = {
  Weapon: ["Fang", "Bite", "Edge", "Thorn", "Brand", "Talon"],
  Offhand: ["Ward", "Tome", "Eye", "Sigil", "Bulwark", "Aegis"],
  Armour: ["Shroud", "Hide", "Mantle", "Carapace", "Guard", "Plate"],
  Charm: ["Eye", "Heart", "Tear", "Knot", "Seal", "Idol"],
};

interface TreasureClassDef {
  source: string;
  picks: number;
  none: number;
  gold: number;
  potion: number;
  material: number;
  item: number;
  floor: string;
  floored: number;
}

const TREASURE_CLASSES: TreasureClassDef[] = [
  {
    source: "Swarm",
    picks: 1,
    none: 92,
    gold: 4,
    potion: 2,
    material: 1,
    item: 1,
    floor: "Normal",
    floored: 0,
  },
  {
    source: "Line",
    picks: 1,
    none: 80,
    gold: 9,
    potion: 5,
    material: 3,
    item: 3,
    floor: "Normal",
    floored: 0,
  },
  {
    source: "Brute",
    picks: 2,
    none: 60,
    gold: 15,
    potion: 8,
    material: 7,
    item: 10,
    floor: "Normal",
    floored: 0,
  },
  {
    source: "Elite",
    picks: 2,
    none: 30,
    gold: 25,
    potion: 10,
    material: 10,
    item: 25,
    floor: "Normal",
    floored: 0,
  },
  {
    source: "Champion",
    picks: 2,
    none: 0,
    gold: 30,
    potion: 10,
    material: 10,
    item: 50,
    floor: "Magic",
    floored: 1,
  },
  {
    source: "Boss",
    picks: 4,
    none: 0,
    gold: 15,
    potion: 10,
    material: 10,
    item: 65,
    floor: "Rare",
    floored: 2,
  },
  {
    source: "Chest",
    picks: 3,
    none: 10,
    gold: 30,
    potion: 20,
    material: 15,
    item: 25,
    floor: "Normal",
    floored: 0,
  },
  {
    source: "Mimic",
    picks: 3,
    none: 0,
    gold: 40,
    potion: 0,
    material: 0,
    item: 60,
    floor: "Magic",
    floored: 1,
  },
];

function diminish(mf: number, k: number): number {
  return (mf * k) / (mf + k);
}

function xorshift(seed: number): () => number {
  let s = seed | 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

export const LootAffixSimulator: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"forge" | "treasure" | "forms">(
    "forge",
  );
  const [ilvl, setIlvl] = useState<number>(38);
  const [magicFind, setMagicFind] = useState<number>(180);
  const [forceRarity, setForceRarity] = useState<"Auto" | "Magic" | "Rare">(
    "Rare",
  );
  const [forceNightTouched, setForceNightTouched] = useState<boolean>(true);
  const [seed, setSeed] = useState<number>(0x5eed14);
  const [selectedSource, setSelectedSource] = useState<number>(5); // Boss
  const [isNight, setIsNight] = useState<boolean>(true);

  const odds = useMemo(() => {
    const scale = 1 + ilvl / 40;
    const unique = Math.min(1, (scale / 700) * (1 + diminish(magicFind, 250) / 100));
    const rare = Math.min(1, (scale / 90) * (1 + diminish(magicFind, 600) / 100));
    const magic = Math.min(1, (scale / 7) * (1 + magicFind / 100));
    return { unique, rare, magic };
  }, [ilvl, magicFind]);

  const rolledItem = useMemo(() => {
    const rand = xorshift(seed);
    // Pick base + tier weighted by qlvl + TIER_LEVEL[t] <= ilvl
    const candidates: { baseIdx: number; tier: number; w: number }[] = [];
    for (let b = 0; b < SAMPLE_BASES.length; b++) {
      for (let t = 0; t < 3; t++) {
        const q = SAMPLE_BASES[b].qlvl + TIER_LEVEL[t];
        if (q <= ilvl) {
          const w = SAMPLE_BASES[b].weight * (ilvl - q <= 10 ? 3 : 1);
          candidates.push({ baseIdx: b, tier: t, w });
        }
      }
    }
    const chosen =
      candidates[Math.floor(rand() * candidates.length)] || {
        baseIdx: 0,
        tier: 0,
        w: 1,
      };
    const base = SAMPLE_BASES[chosen.baseIdx];

    let rarity: "Normal" | "Magic" | "Rare" = "Normal";
    if (forceRarity !== "Auto") {
      rarity = forceRarity;
    } else {
      const u = rand();
      if (u < odds.rare) rarity = "Rare";
      else if (u < odds.magic) rarity = "Magic";
      else rarity = "Normal";
    }

    const wantAffixes =
      rarity === "Rare" ? 3 + Math.floor(rand() * 3) : rarity === "Magic" ? 2 : 0;

    const pickedAffixes: {
      family: AffixFamilyData;
      tierIdx: number;
      value: number;
      boosted?: boolean;
    }[] = [];

    for (let tries = 0; tries < 24 && pickedAffixes.length < wantAffixes; tries++) {
      const wantPrefix =
        pickedAffixes.filter((a) => a.family.prefix).length < 3 &&
        (pickedAffixes.filter((a) => !a.family.prefix).length >= 3 ||
          rand() < 0.5);

      const eligible: { family: AffixFamilyData; tierIdx: number }[] = [];
      for (const fam of AFFIX_POOL) {
        if (fam.prefix !== wantPrefix) continue;
        if (!fam.slots.includes(base.slot)) continue;
        if (pickedAffixes.some((p) => p.family.key === fam.key)) continue;
        for (let ti = 0; ti < fam.tiers.length; ti++) {
          if (fam.tiers[ti].qlvl <= ilvl) {
            eligible.push({ family: fam, tierIdx: ti });
          }
        }
      }
      if (eligible.length === 0) continue;
      const pick = eligible[Math.floor(rand() * eligible.length)];
      const td = pick.family.tiers[pick.tierIdx];
      const val = Math.round(td.lo + rand() * (td.hi - td.lo));
      pickedAffixes.push({
        family: pick.family,
        tierIdx: pick.tierIdx,
        value: val,
      });
    }

    let curse: { name: string; text: string } | null = null;
    if (forceNightTouched && pickedAffixes.length > 0) {
      const idx = Math.floor(rand() * pickedAffixes.length);
      const target = pickedAffixes[idx];
      target.tierIdx = Math.min(
        target.family.tiers.length - 1,
        target.tierIdx + 2,
      );
      const td = target.family.tiers[target.tierIdx];
      target.value = Math.round(td.lo + rand() * (td.hi - td.lo));
      target.boosted = true;
      curse = CURSES[Math.floor(rand() * CURSES.length)];
    }

    const baseName = `${TIER_NAMES[chosen.tier]} ${base.name}`;
    let fullName = baseName;
    if (rarity === "Rare") {
      const w1 = RARE_FIRST[Math.floor(rand() * RARE_FIRST.length)];
      const words2 = RARE_SECOND[base.slot] || RARE_SECOND.Weapon;
      const w2 = words2[Math.floor(rand() * words2.length)];
      fullName = `${w1} ${w2}`;
    } else if (rarity === "Magic") {
      const pre = pickedAffixes.find((a) => a.family.prefix);
      const suf = pickedAffixes.find((a) => !a.family.prefix);
      fullName = [
        pre ? pre.family.tiers[pre.tierIdx].name : null,
        baseName,
        suf ? suf.family.tiers[suf.tierIdx].name : null,
      ]
        .filter(Boolean)
        .join(" ");
    }

    const saveLine = [
      base.key,
      chosen.tier,
      ilvl,
      rarity.toLowerCase(),
      `0x${seed.toString(16).toUpperCase()}`,
      curse ? curse.name.toLowerCase() : "none",
      ...pickedAffixes.map(
        (a) => `${a.family.key}:T${a.tierIdx + 1}=${a.value}`,
      ),
    ].join(" ");

    return {
      base,
      tier: chosen.tier,
      baseName,
      fullName,
      rarity,
      affixes: pickedAffixes,
      curse,
      saveLine,
    };
  }, [ilvl, odds, forceRarity, forceNightTouched, seed]);

  const tc = TREASURE_CLASSES[selectedSource];
  const itemWeight = tc.item * (isNight ? 2 : 1);
  const totalWeight = tc.none + tc.gold + tc.potion + tc.material + itemWeight;

  return (
    <div className="my-6 rounded-2xl border border-dark-750 bg-dark-900/95 shadow-xl overflow-hidden">
      <div className="px-4 py-3 bg-dark-950/90 border-b border-dark-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-300">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-display font-bold tracking-wider uppercase text-slate-100">
              v0.5.14+ Loot, Affix, Form &amp; RunRules Lab
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              src/item/loot/* • src/entity/pickup/ItemDrop.cpp •
              src/item/weapon/form/Shape.cpp
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-dark-900 p-1 rounded-xl border border-dark-800 text-xs font-mono">
          <button
            onClick={() => setActiveTab("forge")}
            className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === "forge"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Dices className="w-3.5 h-3.5" />
            <span>Item &amp; Affix Roller</span>
          </button>
          <button
            onClick={() => setActiveTab("treasure")}
            className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === "treasure"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Treasure Classes</span>
          </button>
          <button
            onClick={() => setActiveTab("forms")}
            className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === "forms"
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 font-semibold"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>15 Forms &amp; 20 Traits</span>
          </button>
        </div>
      </div>

      {activeTab === "forge" && (
        <div className="p-4 sm:p-5 space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5 rounded-xl border border-dark-800 bg-dark-950/60 p-4 space-y-3.5">
              <div className="text-xs font-mono uppercase tracking-wider text-amber-300 font-semibold flex items-center justify-between">
                <span>rollItem(ilvl, magicFind, night)</span>
                <button
                  onClick={() =>
                    setSeed((prev) => ((prev * 1664525 + 1013904223) >>> 0) | 1)
                  }
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-[11px] font-mono flex items-center gap-1 transition-colors"
                >
                  <Dices className="w-3.5 h-3.5" />
                  <span>Reroll Seed</span>
                </button>
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-400">Item Level (ilvl)</span>
                  <span className="text-amber-300 font-bold">{ilvl}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={60}
                  value={ilvl}
                  onChange={(e) => setIlvl(Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>1 (Worn)</span>
                  <span>18+ (Standard)</span>
                  <span>36+ (Elite)</span>
                  <span>48+ (Tier V Affixes)</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-400">Magic Find (MF%)</span>
                  <span className="text-emerald-300 font-bold">
                    +{magicFind}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={500}
                  step={10}
                  value={magicFind}
                  onChange={(e) => setMagicFind(Number(e.target.value))}
                  className="w-full accent-emerald-400"
                />
                <div className="text-[11px] font-mono text-slate-400 mt-1">
                  Diminishing MF:{" "}
                  <code className="text-emerald-300">
                    Rare +{diminish(magicFind, 600).toFixed(0)}%
                  </code>{" "}
                  •{" "}
                  <code className="text-amber-300">
                    Unique +{diminish(magicFind, 250).toFixed(0)}%
                  </code>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-1">
                  {(["Auto", "Magic", "Rare"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setForceRarity(r)}
                      className={`px-2 py-1 rounded text-[11px] font-mono border transition-colors ${
                        forceRarity === r
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold"
                          : "bg-dark-900 text-slate-400 border-dark-800"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setForceNightTouched(!forceNightTouched)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-colors flex items-center gap-1.5 ${
                    forceNightTouched
                      ? "bg-purple-500/20 text-purple-300 border-purple-500/40 font-semibold"
                      : "bg-dark-900 text-slate-400 border-dark-800"
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Night-Touched (touch())</span>
                </button>
              </div>

              <div className="pt-2 border-t border-dark-800 grid grid-cols-3 gap-2 text-center font-mono text-[11px]">
                <div className="p-2 rounded-lg bg-dark-900 border border-dark-800">
                  <div className="text-slate-400 text-[10px]">Magic Odds</div>
                  <div className="text-sky-300 font-bold">
                    {(odds.magic * 100).toFixed(1)}%
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-dark-900 border border-dark-800">
                  <div className="text-slate-400 text-[10px]">Rare Odds</div>
                  <div className="text-amber-300 font-bold">
                    {(odds.rare * 100).toFixed(2)}%
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-dark-900 border border-dark-800">
                  <div className="text-slate-400 text-[10px]">6-Affix Rare</div>
                  <div className="text-rose-300 font-bold">
                    {(odds.unique * 100).toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 rounded-xl border border-dark-800 bg-dark-950/80 p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-start justify-between gap-2 border-b border-dark-800 pb-3">
                  <div>
                    <div
                      className={`text-lg font-display font-black tracking-wide ${
                        rolledItem.curse
                          ? "text-purple-300"
                          : rolledItem.rarity === "Rare"
                            ? "text-amber-300"
                            : "text-sky-300"
                      }`}
                    >
                      {rolledItem.fullName}
                    </div>
                    <div className="text-xs font-mono text-slate-400">
                      {rolledItem.baseName} • Slot:{" "}
                      <span className="text-slate-200">
                        {rolledItem.base.slot}
                      </span>{" "}
                      • ilvl {ilvl} (qlvl{" "}
                      {rolledItem.base.qlvl + TIER_LEVEL[rolledItem.tier]})
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {rolledItem.curse && (
                      <span className="px-2 py-0.5 rounded bg-purple-500/20 border border-purple-500/40 text-[10px] font-mono uppercase text-purple-300 font-bold">
                        Night-Touched
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded bg-dark-900 border border-dark-750 text-[10px] font-mono uppercase text-amber-300">
                      {rolledItem.rarity}
                    </span>
                  </div>
                </div>

                <div className="py-2.5 border-b border-dark-850 text-xs font-mono text-emerald-300">
                  Implicit: {rolledItem.base.implicit}
                </div>

                <div className="py-2.5 space-y-1.5">
                  {rolledItem.affixes.map((a, idx) => {
                    const td = a.family.tiers[a.tierIdx];
                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between text-xs font-mono px-2.5 py-1 rounded-lg border ${
                          a.boosted
                            ? "bg-purple-500/15 border-purple-500/40 text-purple-200"
                            : "bg-dark-900/70 border-dark-800 text-slate-200"
                        }`}
                      >
                        <div>
                          <span className="font-semibold text-gold-300">
                            +{a.value}
                            {a.family.unit}
                          </span>{" "}
                          {a.family.statLabel}
                          {a.boosted && (
                            <span className="ml-2 text-[10px] text-purple-300 uppercase">
                              [+2 Tier Night Boost]
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {a.family.prefix ? "Prefix" : "Suffix"} • {td.name}{" "}
                          (T{a.tierIdx + 1}, qlvl {td.qlvl})
                        </div>
                      </div>
                    );
                  })}
                </div>

                {rolledItem.curse && (
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs font-mono text-rose-300 flex items-center justify-between">
                    <span>
                      <strong>Curse — {rolledItem.curse.name}:</strong>{" "}
                      {rolledItem.curse.text}
                    </span>
                    <span className="text-[10px] uppercase text-rose-400">
                      CURSES[curse]
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-dark-850">
                <div className="text-[10px] font-mono uppercase text-slate-500 mb-1">
                  Item::save() Serialization Line
                </div>
                <code className="block p-2 rounded bg-dark-900 border border-dark-800 text-[11px] font-mono text-amber-200 overflow-x-auto">
                  {rolledItem.saveLine}
                </code>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "treasure" && (
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {TREASURE_CLASSES.map((t, i) => (
                <button
                  key={t.source}
                  onClick={() => setSelectedSource(i)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-colors ${
                    selectedSource === i
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold"
                      : "bg-dark-950 text-slate-400 border-dark-800 hover:text-slate-200"
                  }`}
                >
                  Source::{t.source}
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsNight(!isNight)}
              className={`px-3 py-1 rounded-lg text-xs font-mono border transition-colors ${
                isNight
                  ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40 font-semibold"
                  : "bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold"
              }`}
            >
              {isNight
                ? "Night Active (2× Item Weight)"
                : "Dawn / Day (1× Item Weight)"}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 font-mono text-xs">
            <div className="p-3 rounded-xl bg-dark-950/70 border border-dark-800">
              <div className="text-slate-400 text-[10px] uppercase">
                Random Picks
              </div>
              <div className="text-lg font-bold text-slate-100">
                {tc.picks} picks
              </div>
              <div className="text-[11px] text-slate-400">
                Total pool weight: {totalWeight}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-dark-950/70 border border-dark-800">
              <div className="text-slate-400 text-[10px] uppercase">
                Guaranteed Floor
              </div>
              <div className="text-lg font-bold text-amber-300">
                {tc.floored} × {tc.floor}+
              </div>
              <div className="text-[11px] text-slate-400">
                Added before random picks
              </div>
            </div>
            <div className="p-3 rounded-xl bg-dark-950/70 border border-dark-800">
              <div className="text-slate-400 text-[10px] uppercase">
                Item Roll Probability
              </div>
              <div className="text-lg font-bold text-emerald-300">
                {((itemWeight / totalWeight) * 100).toFixed(1)}% / pick
              </div>
              <div className="text-[11px] text-slate-400">
                Weight: {itemWeight} / {totalWeight}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-dark-950/70 border border-dark-800">
              <div className="text-slate-400 text-[10px] uppercase">
                Gold / Potion / Mat
              </div>
              <div className="text-sm font-bold text-gold-300 mt-1">
                {((tc.gold / totalWeight) * 100).toFixed(0)}% /{" "}
                {((tc.potion / totalWeight) * 100).toFixed(0)}% /{" "}
                {((tc.material / totalWeight) * 100).toFixed(0)}%
              </div>
              <div className="text-[11px] text-slate-400">
                None: {((tc.none / totalWeight) * 100).toFixed(0)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "forms" && (
        <div className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-dark-800 bg-dark-950/70 p-3.5 space-y-2">
              <div className="text-xs font-mono uppercase tracking-wider text-purple-300 font-semibold">
                New Weapon Forms (src/item/weapon/form/*)
              </div>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="p-2 rounded bg-dark-900 border border-dark-800">
                  <span className="text-gold-300 font-bold">WhipForm:</span>{" "}
                  8-segment sine-sway line (`CRACK = 0.08s`); deals{" "}
                  <code className="text-emerald-300">1.5×</code> damage on the
                  outer 25% tip (`b &gt; reach * 0.75`).
                </div>
                <div className="p-2 rounded bg-dark-900 border border-dark-800">
                  <span className="text-gold-300 font-bold">WallForm:</span>{" "}
                  Spawns barrier segments at `48 + 22*i` px that physically push
                  enemies out (`e.x += s.dx * push`) and pulse damage every
                  `0.5s`.
                </div>
                <div className="p-2 rounded bg-dark-900 border border-dark-800">
                  <span className="text-gold-300 font-bold">SpiralForm:</span>{" "}
                  Archimedean spiral trajectory (`a = tx + age * 3.0`, `r =
                  speed * 0.8 * age`) with tangential hit vectors.
                </div>
                <div className="p-2 rounded bg-dark-900 border border-dark-800">
                  <span className="text-gold-300 font-bold">
                    Cleave / Boomerang / Lob / Trap / Beam:
                  </span>{" "}
                  8 class-kit forms powering the 22 new class weapons and 29
                  evolutions.
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-dark-800 bg-dark-950/70 p-3.5 space-y-2">
              <div className="text-xs font-mono uppercase tracking-wider text-rose-300 font-semibold">
                7 Statuses, 16 Payloads &amp; 20 Champion Traits
              </div>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="p-2 rounded bg-dark-900 border border-dark-800">
                  <span className="text-rose-300 font-bold">
                    New Statuses (Status.hpp):
                  </span>{" "}
                  <code>Bleed</code> (stacks additively,{" "}
                  <code className="text-amber-300">1.6×</code> damage while
                  moving), <code>Weaken</code> (up to -50% outgoing damage),{" "}
                  <code>Fear</code> (foes flee).
                </div>
                <div className="p-2 rounded bg-dark-900 border border-dark-800">
                  <span className="text-emerald-300 font-bold">
                    New Payloads (Recipe.hpp):
                  </span>{" "}
                  <code>Leech</code>, <code>Chain</code>, <code>Stagger</code>,{" "}
                  <code>Bleed</code>, <code>Weaken</code>, <code>Fear</code>,{" "}
                  <code>Shatter</code> (+bonus vs Chilled),{" "}
                  <code>Execute</code> (slays low-HP non-bosses).
                </div>
                <div className="p-2 rounded bg-dark-900 border border-dark-800">
                  <span className="text-sky-300 font-bold">
                    20 Elite/Champion Traits (Trait.hpp):
                  </span>{" "}
                  Added <code>Thorned</code>, <code>Regenerating</code>,{" "}
                  <code>Blinking</code>, <code>Phasing</code>,{" "}
                  <code>Brooding</code>, <code>Gravitic</code>,{" "}
                  <code>Cursed</code>, <code>Silencing</code>,{" "}
                  <code>Fire/Cold/StormEnchanted</code>, <code>StoneSkin</code>,{" "}
                  <code>Multishot</code>, <code>AuraBearer</code>.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

