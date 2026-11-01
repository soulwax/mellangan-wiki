import React, { useState, useMemo } from "react";
import { Swords, Sparkles, Flame, Filter } from "lucide-react";

interface RecipeDef {
  name: string;
  owner: string;
  pitch: string;
  unit: string;
  form: string;
  areaForm: boolean;
  payloads: string[];
  damage: number;
  cooldown: number;
  reach: number;
  speed: number;
  count: number;
}

const RECIPES_DATA: RecipeDef[] = [
  {
    name: "Ember Lance",
    owner: "MAGE",
    pitch: "A searing lance pierces and ignites foes",
    unit: "lance",
    form: "Bolt",
    areaForm: false,
    payloads: ["Burn", "Pierce"],
    damage: 14,
    cooldown: 1.6,
    reach: 260,
    speed: 330,
    count: 1,
  },
  {
    name: "Hoarfrost Fan",
    owner: "MAGE",
    pitch: "Fans out ice shards that chill foes",
    unit: "shard",
    form: "Volley",
    areaForm: false,
    payloads: ["Chill"],
    damage: 8,
    cooldown: 1.8,
    reach: 150,
    speed: 260,
    count: 5,
  },
  {
    name: "Arcane Orbit",
    owner: "MAGE",
    pitch: "Arcane orbs circle you and mark foes",
    unit: "orb",
    form: "Orbit",
    areaForm: false,
    payloads: ["Mark"],
    damage: 9,
    cooldown: 4.0,
    reach: 34,
    speed: 3.2,
    count: 2,
  },
  {
    name: "Starfall",
    owner: "MAGE",
    pitch: "Stars crash down on distant foes",
    unit: "star",
    form: "Rain",
    areaForm: false,
    payloads: ["Explode"],
    damage: 26,
    cooldown: 3.2,
    reach: 200,
    speed: 0,
    count: 3,
  },
  {
    name: "Void Rift",
    owner: "MAGE",
    pitch: "A rift drags foes inward and grinds them",
    unit: "rift",
    form: "Field",
    areaForm: true,
    payloads: ["Pull"],
    damage: 5,
    cooldown: 5.0,
    reach: 48,
    speed: 0,
    count: 1,
  },
  {
    name: "Seeker Runes",
    owner: "MAGE",
    pitch: "Runes hunt foes and split on impact",
    unit: "rune",
    form: "Seeker",
    areaForm: false,
    payloads: ["Split"],
    damage: 11,
    cooldown: 2.4,
    reach: 240,
    speed: 150,
    count: 2,
  },
  {
    name: "Flame Ring",
    owner: "MAGE",
    pitch: "A ring of fire bursts outward",
    unit: "ring",
    form: "Nova",
    areaForm: true,
    payloads: ["Burn"],
    damage: 12,
    cooldown: 3.0,
    reach: 90,
    speed: 0,
    count: 1,
  },
  {
    name: "Lionheart Cleave",
    owner: "KNIGHT",
    pitch: "A broad cleave staggers foes before you",
    unit: "sweep",
    form: "Cleave",
    areaForm: true,
    payloads: ["Stagger"],
    damage: 18,
    cooldown: 1.5,
    reach: 52,
    speed: 0,
    count: 1,
  },
  {
    name: "Bastion Shields",
    owner: "KNIGHT",
    pitch: "Iron shields circle you and batter foes back",
    unit: "shield",
    form: "Orbit",
    areaForm: false,
    payloads: ["Stagger"],
    damage: 10,
    cooldown: 4.5,
    reach: 30,
    speed: 2.6,
    count: 2,
  },
  {
    name: "Hawk Talon",
    owner: "RANGER",
    pitch: "A curved blade flies out and wheels back",
    unit: "talon",
    form: "Boomerang",
    areaForm: false,
    payloads: ["Pierce"],
    damage: 14,
    cooldown: 2.0,
    reach: 170,
    speed: 240,
    count: 1,
  },
  {
    name: "Bear Trap",
    owner: "RANGER",
    pitch: "Hidden jaws snap shut and pin foes",
    unit: "trap",
    form: "Trap",
    areaForm: true,
    payloads: ["Stagger"],
    damage: 30,
    cooldown: 2.6,
    reach: 34,
    speed: 0,
    count: 1,
  },
  {
    name: "Caustic Flask",
    owner: "ALCHEMIST",
    pitch: "Lobbed flasks burst into choking poison",
    unit: "flask",
    form: "Lob",
    areaForm: false,
    payloads: ["Poison"],
    damage: 16,
    cooldown: 2.2,
    reach: 200,
    speed: 0,
    count: 1,
  },
  {
    name: "Witchfire Phial",
    owner: "ALCHEMIST",
    pitch: "Phials of witchfire splash, burn and mark",
    unit: "phial",
    form: "Lob",
    areaForm: false,
    payloads: ["Burn", "Mark"],
    damage: 14,
    cooldown: 2.6,
    reach: 200,
    speed: 0,
    count: 2,
  },
  {
    name: "Ball Lightning",
    owner: "STORMCALLER",
    pitch: "Crackling orbs hunt foes and arc onward",
    unit: "orb",
    form: "Seeker",
    areaForm: false,
    payloads: ["Chain"],
    damage: 10,
    cooldown: 2.2,
    reach: 240,
    speed: 140,
    count: 2,
  },
  {
    name: "Arc Lance",
    owner: "STORMCALLER",
    pitch: "A bolt lances a line of foes and leaps on",
    unit: "lance",
    form: "Beam",
    areaForm: true,
    payloads: ["Chain"],
    damage: 16,
    cooldown: 1.8,
    reach: 180,
    speed: 0,
    count: 1,
  },
  {
    name: "Soul Harvest",
    owner: "REAPER",
    pitch: "A wide reaping arc that drinks their life",
    unit: "sweep",
    form: "Cleave",
    areaForm: true,
    payloads: ["Leech"],
    damage: 16,
    cooldown: 1.6,
    reach: 58,
    speed: 0,
    count: 1,
  },
  {
    name: "Bone Wheel",
    owner: "REAPER",
    pitch: "A wheel of bone carves out and back, poisoning",
    unit: "wheel",
    form: "Boomerang",
    areaForm: false,
    payloads: ["Poison"],
    damage: 12,
    cooldown: 2.2,
    reach: 160,
    speed: 220,
    count: 1,
  },
  {
    name: "Lance of Dawn",
    owner: "PRIESTESS",
    pitch: "A ray of dawn sears and marks a line of foes",
    unit: "ray",
    form: "Beam",
    areaForm: true,
    payloads: ["Burn", "Mark"],
    damage: 15,
    cooldown: 2.0,
    reach: 190,
    speed: 0,
    count: 1,
  },
  {
    name: "Seraph Wings",
    owner: "PRIESTESS",
    pitch: "Feathers of light circle you and mend you",
    unit: "feather",
    form: "Orbit",
    areaForm: false,
    payloads: ["Leech"],
    damage: 8,
    cooldown: 4.5,
    reach: 40,
    speed: 2.4,
    count: 3,
  },
  {
    name: "Crescent Cut",
    owner: "DUELIST",
    pitch: "Quick twin arcs that mark foes for the kill",
    unit: "cut",
    form: "Cleave",
    areaForm: true,
    payloads: ["Mark"],
    damage: 12,
    cooldown: 1.2,
    reach: 46,
    speed: 0,
    count: 2,
  },
  {
    name: "Flicker Darts",
    owner: "DUELIST",
    pitch: "Darts seek out foes and pierce through",
    unit: "dart",
    form: "Seeker",
    areaForm: false,
    payloads: ["Pierce"],
    damage: 9,
    cooldown: 1.6,
    reach: 220,
    speed: 200,
    count: 3,
  },
  {
    name: "Thornwhip",
    owner: "WARDEN",
    pitch: "A lashing vine poisons and staggers foes",
    unit: "lash",
    form: "Cleave",
    areaForm: true,
    payloads: ["Poison", "Stagger"],
    damage: 14,
    cooldown: 1.5,
    reach: 60,
    speed: 0,
    count: 1,
  },
  {
    name: "Root Snare",
    owner: "WARDEN",
    pitch: "Seeds sprout roots that seize passing foes",
    unit: "seed",
    form: "Trap",
    areaForm: true,
    payloads: ["Chill", "Poison"],
    damage: 24,
    cooldown: 2.8,
    reach: 40,
    speed: 0,
    count: 2,
  },
  {
    name: "Clockwork Mine",
    owner: "TINKERER",
    pitch: "Mines tick under your feet and blow apart",
    unit: "mine",
    form: "Trap",
    areaForm: true,
    payloads: ["Burn"],
    damage: 34,
    cooldown: 2.4,
    reach: 44,
    speed: 0,
    count: 1,
  },
  {
    name: "Flash Grenade",
    owner: "TINKERER",
    pitch: "A lobbed grenade dazzles and marks foes",
    unit: "grenade",
    form: "Lob",
    areaForm: false,
    payloads: ["Mark", "Stagger"],
    damage: 18,
    cooldown: 2.4,
    reach: 210,
    speed: 0,
    count: 1,
  },
  {
    name: "Prophecy Ray",
    owner: "ORACLE",
    pitch: "Rays of foresight chill and mark foes",
    unit: "ray",
    form: "Beam",
    areaForm: true,
    payloads: ["Mark", "Chill"],
    damage: 13,
    cooldown: 1.8,
    reach: 210,
    speed: 0,
    count: 2,
  },
  {
    name: "Fate Wheel",
    owner: "ORACLE",
    pitch: "Runes of fate circle you and arc to their kin",
    unit: "rune",
    form: "Orbit",
    areaForm: false,
    payloads: ["Chain"],
    damage: 9,
    cooldown: 4.2,
    reach: 38,
    speed: 2.8,
    count: 2,
  },
  {
    name: "Chain Shot",
    owner: "CORSAIR",
    pitch: "Chained shot tears through and staggers foes",
    unit: "shot",
    form: "Bolt",
    areaForm: false,
    payloads: ["Pierce", "Stagger"],
    damage: 20,
    cooldown: 1.9,
    reach: 240,
    speed: 300,
    count: 1,
  },
  {
    name: "Riptide",
    owner: "CORSAIR",
    pitch: "A riptide drags foes in and chills them",
    unit: "tide",
    form: "Field",
    areaForm: true,
    payloads: ["Pull", "Chill"],
    damage: 6,
    cooldown: 5.0,
    reach: 46,
    speed: 0,
    count: 1,
  },
];

export const RecipeArsenalExplorer: React.FC = () => {
  const [selectedClass, setSelectedClass] = useState<string>("ALL");
  const [selectedForm, setSelectedForm] = useState<string>("ALL");
  const [selectedRecipeIdx, setSelectedRecipeIdx] = useState<number>(0);
  const [weaponLevel, setWeaponLevel] = useState<number>(5);
  const [isEvolved, setIsEvolved] = useState<boolean>(true);

  const classes = useMemo(
    () => ["ALL", ...Array.from(new Set(RECIPES_DATA.map((r) => r.owner)))],
    [],
  );
  const forms = useMemo(
    () => ["ALL", ...Array.from(new Set(RECIPES_DATA.map((r) => r.form)))],
    [],
  );

  const filteredRecipes = useMemo(() => {
    return RECIPES_DATA.filter(
      (r) =>
        (selectedClass === "ALL" || r.owner === selectedClass) &&
        (selectedForm === "ALL" || r.form === selectedForm),
    );
  }, [selectedClass, selectedForm]);

  const activeRecipe =
    filteredRecipes[selectedRecipeIdx] || filteredRecipes[0] || RECIPES_DATA[0];

  const at = (lvl: number, req: number) => (lvl >= req ? 1 : 0);
  const evoBit = isEvolved ? 1 : 0;

  const computedDamage =
    activeRecipe.damage *
    (1 + 0.5 * (at(weaponLevel, 2) + at(weaponLevel, 5))) *
    (isEvolved ? 1.35 : 1.0);

  const computedCount =
    activeRecipe.count +
    (activeRecipe.areaForm
      ? 0
      : at(weaponLevel, 3) + at(weaponLevel, 5) + evoBit);

  const computedReach =
    activeRecipe.reach *
    (activeRecipe.areaForm
      ? 1 + 0.3 * (at(weaponLevel, 3) + at(weaponLevel, 5)) + 0.25 * evoBit
      : 1);

  const computedCooldown =
    activeRecipe.cooldown * (weaponLevel >= 4 ? 0.75 : 1.0);

  return (
    <div className="my-6 rounded-xl border border-dark-700 bg-dark-900/90 p-5 shadow-xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-dark-750 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-rose-400" />
            <h4 className="text-sm font-bold uppercase tracking-wider text-rose-400 font-mono">
              Combinatorial Weapon Recipe &amp; FormBehavior Matrix
            </h4>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Interactive simulator for all 29{" "}
            <code className="text-gold-300">RECIPES</code> in{" "}
            <code className="text-slate-300">src/item/weapon/Recipe.cpp</code>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <div className="flex items-center gap-1 bg-dark-950 border border-dark-750 rounded-lg px-2 py-1">
            <Filter className="w-3 h-3 text-slate-400" />
            <select
              value={selectedClass}
              onChange={(e) => {
                setSelectedClass(e.target.value);
                setSelectedRecipeIdx(0);
              }}
              className="bg-transparent text-slate-200 focus:outline-none"
            >
              {classes.map((c) => (
                <option key={c} value={c} className="bg-dark-900">
                  {c === "ALL" ? "All 12 Classes" : c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 bg-dark-950 border border-dark-750 rounded-lg px-2 py-1">
            <select
              value={selectedForm}
              onChange={(e) => {
                setSelectedForm(e.target.value);
                setSelectedRecipeIdx(0);
              }}
              className="bg-transparent text-slate-200 focus:outline-none"
            >
              {forms.map((f) => (
                <option key={f} value={f} className="bg-dark-900">
                  {f === "ALL" ? "All Forms (15 FormBehaviors)" : `Form::${f}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 max-h-[320px] overflow-y-auto space-y-1.5 pr-1">
          {filteredRecipes.map((r, idx) => {
            const isSelected = r.name === activeRecipe.name;
            return (
              <button
                key={r.name}
                onClick={() => setSelectedRecipeIdx(idx)}
                className={`w-full text-left p-2.5 rounded-lg border font-mono text-xs transition-all flex items-center justify-between ${
                  isSelected
                    ? "bg-dark-800 border-gold-500/60 text-slate-100 shadow-md"
                    : "bg-dark-950/60 hover:bg-dark-900 border-dark-800 text-slate-400"
                }`}
              >
                <div>
                  <div className="font-bold text-slate-200">{r.name}</div>
                  <div className="text-[10px] text-slate-500">
                    {r.owner} • Form::{r.form}
                  </div>
                </div>
                <div className="flex gap-1">
                  {r.payloads.map((p) => (
                    <span
                      key={p}
                      className="px-1.5 py-0.5 rounded bg-dark-900 border border-dark-700 text-[9px] text-gold-300"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        <div className="lg:col-span-7 p-4 rounded-xl bg-dark-950 border border-dark-800 flex flex-col justify-between space-y-4 font-mono">
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-dark-800 pb-3">
              <div>
                <div className="text-[10px] text-gold-400 uppercase font-bold">
                  {activeRecipe.owner} SIGNATURE ARSENAL
                </div>
                <h5 className="text-lg font-bold text-white font-display">
                  {activeRecipe.name}
                </h5>
                <p className="text-xs text-slate-400 font-sans mt-0.5">
                  {activeRecipe.pitch}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="px-2 py-0.5 rounded bg-purple-500/15 border border-purple-500/40 text-purple-300 text-xs font-bold">
                  Form::{activeRecipe.form}
                </span>
                <span className="text-[10px] text-slate-500">
                  {activeRecipe.areaForm
                    ? "Area Scaling (+30% radius)"
                    : `Count Scaling (+1 ${activeRecipe.unit})`}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 bg-dark-900 p-3 rounded-lg border border-dark-800 text-xs">
              <div className="flex items-center gap-3 flex-1">
                <span className="text-slate-400">
                  Upgrade Level:{" "}
                  <strong className="text-gold-300">Lv.{weaponLevel}</strong>
                </span>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={weaponLevel}
                  onChange={(e) => setWeaponLevel(Number(e.target.value))}
                  className="flex-1 accent-gold-400"
                />
              </div>
              <button
                onClick={() => setIsEvolved((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-bold transition-colors ${
                  isEvolved
                    ? "bg-amber-500/20 border-amber-400 text-amber-300"
                    : "bg-dark-950 border-dark-700 text-slate-500"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isEvolved ? "Evolved (Reforged)" : "Base Tier"}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
              <div className="p-2.5 rounded-lg bg-dark-900 border border-dark-800">
                <div className="text-[10px] text-slate-500">Damage / Hit</div>
                <div className="text-base font-bold text-rose-400 mt-0.5">
                  {computedDamage.toFixed(1)}
                </div>
                <div className="text-[9px] text-slate-500">
                  Base: {activeRecipe.damage}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-dark-900 border border-dark-800">
                <div className="text-[10px] text-slate-500">Cooldown</div>
                <div className="text-base font-bold text-sky-400 mt-0.5">
                  {computedCooldown.toFixed(2)}s
                </div>
                <div className="text-[9px] text-slate-500">
                  Base: {activeRecipe.cooldown}s
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-dark-900 border border-dark-800">
                <div className="text-[10px] text-slate-500">Reach / Radius</div>
                <div className="text-base font-bold text-emerald-400 mt-0.5">
                  {computedReach.toFixed(0)} px
                </div>
                <div className="text-[9px] text-slate-500">
                  Base: {activeRecipe.reach} px
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-dark-900 border border-dark-800">
                <div className="text-[10px] text-slate-500">
                  Projectiles / Units
                </div>
                <div className="text-base font-bold text-gold-400 mt-0.5">
                  {computedCount} × {activeRecipe.unit}
                </div>
                <div className="text-[9px] text-slate-500">
                  Base: {activeRecipe.count}
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-dark-900/80 border border-dark-800 text-[11px] space-y-1.5">
            <div className="text-slate-300 font-bold flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>
                Bitmask Payload Afflictions (
                <code className="text-gold-300">
                  RecipeShot::hit &amp; strike
                </code>
                )
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeRecipe.payloads.map((p) => (
                <div
                  key={p}
                  className="px-2 py-1 rounded bg-dark-950 border border-dark-750 text-slate-300"
                >
                  <strong className="text-gold-300">pay::{p}</strong>:{" "}
                  {p === "Burn" && "2.0s Burn (25% dmg/sec)"}
                  {p === "Chill" && "1.2s Chill (30% slow)"}
                  {p === "Poison" && "3.0s Poison (20% dmg/sec)"}
                  {p === "Mark" && "2.5s Marked (+15% vulnerability)"}
                  {p === "Stagger" && "0.5s Heavy Chill (65%) + 120 knockback"}
                  {p === "Pierce" && "hitsLeft = 3 penetrations"}
                  {p === "Explode" && "blast(24px, 50% AoE damage)"}
                  {p === "Chain" && "chain() arcs to nearest foe within 90px"}
                  {p === "Split" && "forks into 2 child shots at ±1.2 rad"}
                  {p === "Pull" &&
                    "negative knockback (-70.0f inward attraction)"}
                  {p === "Leech" && "restores min(2.0, 4% dmg) HP to wielder"}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
