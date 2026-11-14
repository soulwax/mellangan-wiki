import { useState } from "react";

const SLOT_COUNT = 12;
const initialFree = () => Array.from({ length: SLOT_COUNT }, (_, index) => index);

export function SlabMemoryVisualizer() {
  const [size, setSize] = useState(368);
  const [free, setFree] = useState<number[]>(initialFree);
  const [allocated, setAllocated] = useState<number[]>([]);
  const sizeClass = Math.ceil(Math.max(1, size) / 16);
  const stride = sizeClass * 16;
  const pooled = sizeClass < 96;
  const reset = () => { setFree(initialFree()); setAllocated([]); };
  const allocate = () => {
    if (!free.length) return;
    setAllocated([...allocated, free[0]]);
    setFree(free.slice(1));
  };
  const release = (slot: number) => {
    setAllocated(allocated.filter(id => id !== slot));
    setFree([slot, ...free]);
  };
  const changeSize = (value: number) => { setSize(value); reset(); };

  return (
    <section className="my-5 rounded-2xl border border-dark-750 bg-dark-900/90 p-4 sm:p-5 text-slate-200" aria-labelledby="pool-lab-title">
      <h3 id="pool-lab-title" className="text-lg font-semibold text-purple-300">Pool size classes and free lists</h3>
      <p className="mt-2 text-sm text-slate-400">Explore the normal allocation path. The twelve slots below represent part of one size class, not actual game objects or measured object sizes.</p>
      <label htmlFor="pool-size" className="mt-5 block text-sm">Requested size: <strong>{size} bytes</strong></label>
      <input id="pool-size" type="range" min="1" max="1600" step="1" value={size} onChange={event => changeSize(Number(event.target.value))} className="mt-2 w-full accent-purple-400" />
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3" aria-live="polite">
        <div className="rounded border border-dark-750 p-3">Class <strong>{sizeClass}</strong></div>
        <div className="rounded border border-dark-750 p-3">{pooled ? `Stride ${stride} bytes` : "Direct allocation"}</div>
        <div className="rounded border border-dark-750 p-3">{pooled ? `${Math.floor(65536 / stride)} nodes per slab payload` : "No pool slab"}</div>
      </div>
      {pooled ? (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="button" onClick={allocate} disabled={!free.length} className="rounded border border-purple-500/50 px-3 py-1 text-sm disabled:opacity-40">Allocate</button>
            <button type="button" onClick={reset} className="rounded border border-slate-600 px-3 py-1 text-sm">Reset</button>
            <span className="text-xs text-slate-400">Free-list head: {free.length ? `#${free[0]}` : "empty"}</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {Array.from({ length: SLOT_COUNT }, (_, id) => {
              const used = allocated.includes(id);
              return <button key={id} type="button" disabled={!used} onClick={() => release(id)} className={`rounded border p-2 text-xs ${used ? "border-amber-400 text-amber-200" : "border-slate-700 text-slate-400"}`} aria-label={used ? `Free allocated slot ${id}` : `Slot ${id} is free`}>#{id}<br />{used ? "Free this" : "Available"}</button>;
            })}
          </div>
          <p className="mt-3 text-xs text-slate-400">Allocating pops the head; freeing pushes a slot to the head. The real pool refills an empty class from a new 64 KiB payload.</p>
        </>
      ) : <p className="mt-4 text-sm text-slate-400">Requests larger than 1,520 bytes use malloc instead of a pooled size class.</p>}
      <p className="mt-3 text-xs text-slate-400">If __SANITIZE_ADDRESS__ is defined, Pool.c uses direct allocation for all sizes.</p>
    </section>
  );
}
