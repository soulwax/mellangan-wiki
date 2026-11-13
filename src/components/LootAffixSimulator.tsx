import { useState } from "react";

// Loot.cpp rolls each rarity threshold independently, in priority order.
export const LootAffixSimulator = () => {
  const [level, setLevel] = useState(40);
  const [magicFind, setMagicFind] = useState(0);
  const scale = 1 + level / 40;
  const diminish = (amount: number, cap: number) => amount * cap / (amount + cap);
  const unique = Math.min(1, scale / 700 * (1 + diminish(magicFind, 250) / 100));
  const rare = Math.min(1, scale / 90 * (1 + diminish(magicFind, 600) / 100));
  const magic = Math.min(1, scale / 7 * (1 + magicFind / 100));
  const afterUnique = 1 - unique;
  const afterRare = afterUnique * (1 - rare);
  const remainder = afterRare * (1 - magic);
  const outcomes = [
    ["Unique", unique],
    ["Rare", afterUnique * rare],
    ["Magic", afterRare * magic],
    ["Superior", remainder / 8],
    ["Normal", remainder * 7 / 8],
  ] as const;

  return (
    <section aria-label="Rarity roll explorer" className="my-6 rounded-xl border border-slate-700 bg-slate-900 p-5">
      <h3 className="text-lg font-semibold">Rarity roll explorer</h3>
      <p className="my-2 text-sm text-slate-300">Adjust item level and magic find to see the initial rarity roll. Each higher rarity gets a separate chance before the next is tried.</p>
      <div className="my-4 grid gap-4 sm:grid-cols-2">
        <label>Item level: {level}<input className="block w-full" type="range" min="1" max="99" value={level} onChange={e => setLevel(Number(e.target.value))} /></label>
        <label>Magic find: {magicFind}%<input className="block w-full" type="range" min="0" max="500" step="5" value={magicFind} onChange={e => setMagicFind(Number(e.target.value))} /></label>
      </div>
      <ul className="space-y-2">
        {outcomes.map(([name, probability]) => <li key={name}>
          <div className="flex justify-between text-sm"><span>{name}</span><span>{(probability * 100).toFixed(2)}%</span></div>
          <div className="h-2 rounded bg-slate-700"><div className="h-2 rounded bg-amber-400" style={{ width: `${probability * 100}%` }} /></div>
        </li>)}
      </ul>
      <p className="mt-4 text-sm text-slate-400">These are initial roll probabilities, not final drop rates. Rarity floors and unique-item eligibility can change the resulting item; this chart does not model the chance of receiving an item.</p>
    </section>
  );
};
