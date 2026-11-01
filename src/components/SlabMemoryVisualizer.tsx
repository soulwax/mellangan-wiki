import React, { useState } from 'react';
import { Database, Plus, Trash2, RotateCcw } from 'lucide-react';

interface Slot {
  id: number;
  entityName?: string;
  type?: 'Player' | 'Enemy' | 'Orb' | 'Projectile' | 'Gem';
  byteSize?: number;
  free: boolean;
  nextFree?: number;
}

const INITIAL_SLOTS: Slot[] = [
  { id: 0, entityName: 'Player', type: 'Player', byteSize: 384, free: false },
  { id: 1, entityName: 'Wolf #12', type: 'Enemy', byteSize: 368, free: false },
  { id: 2, entityName: 'Orb (Staff)', type: 'Orb', byteSize: 144, free: false },
  { id: 3, entityName: 'Slime #04', type: 'Enemy', byteSize: 368, free: false },
  { id: 4, entityName: 'Gem (5 XP)', type: 'Gem', byteSize: 128, free: false },
  { id: 5, entityName: 'Bolt (Flame)', type: 'Projectile', byteSize: 160, free: false },
  { id: 6, free: true, nextFree: 7 },
  { id: 7, free: true, nextFree: 8 },
  { id: 8, free: true, nextFree: 9 },
  { id: 9, free: true, nextFree: 10 },
  { id: 10, free: true, nextFree: 11 },
  { id: 11, free: true, nextFree: -1 },
];

export const SlabMemoryVisualizer: React.FC = () => {
  const [slots, setSlots] = useState<Slot[]>(INITIAL_SLOTS);
  const [freeHead, setFreeHead] = useState<number>(6);
  const [allocCount, setAllocCount] = useState<number>(6);
  const [inspectSize, setInspectSize] = useState<number>(368);

  const allocate = (type: 'Enemy' | 'Projectile' | 'Gem') => {
    if (freeHead === -1) return;
    const targetId = freeHead;
    const nextFreeId = slots[targetId].nextFree ?? -1;
    const byteSize = type === 'Enemy' ? 368 : type === 'Projectile' ? 160 : 128;

    setSlots((prev) =>
      prev.map((s) => {
        if (s.id === targetId) {
          return {
            id: targetId,
            entityName: `${type} #${Math.floor(10 + Math.random() * 89)}`,
            type,
            byteSize,
            free: false,
          };
        }
        return s;
      })
    );

    setFreeHead(nextFreeId);
    setAllocCount((c) => c + 1);
  };

  const freeSlot = (id: number) => {
    if (id === 0) return;
    setSlots((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          return {
            id,
            free: true,
            nextFree: freeHead,
          };
        }
        return s;
      })
    );
    setFreeHead(id);
    setAllocCount((c) => Math.max(1, c - 1));
  };

  const resetSlab = () => {
    setSlots(INITIAL_SLOTS);
    setFreeHead(6);
    setAllocCount(6);
  };

  const sizeClass = Math.max(1, (inspectSize + 15) >> 4);
  const slotStride = sizeClass << 4;
  const nodesPer64KBSlab = Math.floor(65536 / slotStride);
  const usesSlab = sizeClass < 32;

  const typeColors: Record<string, string> = {
    Player: '#f6c324',
    Enemy: '#ef4444',
    Orb: '#c084fc',
    Projectile: '#38bdf8',
    Gem: '#10b981',
  };

  return (
    <div className="my-8 rounded-xl border border-dark-700 bg-dark-900/90 overflow-hidden shadow-2xl backdrop-blur-sm">
      <div className="px-5 py-3 bg-dark-850/90 border-b border-dark-700/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-arcane-400" />
          <span className="font-mono text-sm font-semibold text-slate-200">
            Pool.c 32-Class Slab Allocator &amp; Intrusive Free List
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded bg-dark-750 text-slate-400 font-mono">
            GRAIN_SHIFT = 4 (16B)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded bg-dark-800 border border-dark-700 text-xs font-mono text-slate-300">
            Active: <span className="text-gold-400 font-bold">{allocCount}</span> / 12 nodes
          </div>
          <div className="px-2.5 py-1 rounded bg-dark-800 border border-dark-700 text-xs font-mono text-slate-300">
            freeList[c]: <span className="text-arcane-400 font-bold">{freeHead === -1 ? 'NULL (refill)' : `Node #${freeHead}`}</span>
          </div>
          <button
            onClick={resetSlab}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-dark-750 hover:bg-dark-700 border border-dark-600 text-slate-300 font-mono transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="p-4 rounded-xl bg-dark-950 border border-dark-800 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center font-mono text-xs">
          <div className="lg:col-span-5 space-y-2">
            <div className="text-slate-200 font-bold">
              Size-Class Quantizer: <code className="text-gold-300">classOf(size) = (size + 15) &gt;&gt; 4</code>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-400">sizeof(Derived):</span>
              <input
                type="range"
                min={16}
                max={560}
                step={8}
                value={inspectSize}
                onChange={(e) => setInspectSize(Number(e.target.value))}
                className="flex-1 accent-gold-400"
              />
              <span className="text-gold-300 font-bold w-14 text-right">{inspectSize} B</span>
            </div>
          </div>

          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="p-2 rounded bg-dark-900 border border-dark-750">
              <div className="text-[10px] text-slate-500">Size Class c</div>
              <div className="text-sm font-bold text-purple-300 mt-0.5">
                freeList[{sizeClass}]
              </div>
            </div>
            <div className="p-2 rounded bg-dark-900 border border-dark-750">
              <div className="text-[10px] text-slate-500">Aligned Stride</div>
              <div className="text-sm font-bold text-emerald-300 mt-0.5">
                {slotStride} Bytes
              </div>
            </div>
            <div className="p-2 rounded bg-dark-900 border border-dark-750">
              <div className="text-[10px] text-slate-500">Nodes / 64KB Slab</div>
              <div className="text-sm font-bold text-sky-300 mt-0.5">
                {usesSlab ? `${nodesPer64KBSlab} Nodes` : 'Fallback'}
              </div>
            </div>
            <div className="p-2 rounded bg-dark-900 border border-dark-750">
              <div className="text-[10px] text-slate-500">Routing Path</div>
              <div className={`text-sm font-bold mt-0.5 ${usesSlab ? 'text-gold-300' : 'text-rose-400'}`}>
                {usesSlab ? 'O(1) Slab Pool' : 'malloc() >= 512B'}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 font-mono mr-2">Simulate <code className="text-gold-300">pool_alloc(size)</code>:</span>
          <button
            onClick={() => allocate('Enemy')}
            disabled={freeHead === -1}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-red-300 text-xs font-mono transition-all disabled:opacity-30 disabled:pointer-events-none"
          >
            <Plus className="w-3.5 h-3.5" /> new Enemy (368B → Class 23)
          </button>
          <button
            onClick={() => allocate('Projectile')}
            disabled={freeHead === -1}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-950/40 hover:bg-sky-900/60 border border-sky-500/40 text-sky-300 text-xs font-mono transition-all disabled:opacity-30 disabled:pointer-events-none"
          >
            <Plus className="w-3.5 h-3.5" /> new RecipeShot (160B → Class 10)
          </button>
          <button
            onClick={() => allocate('Gem')}
            disabled={freeHead === -1}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 text-xs font-mono transition-all disabled:opacity-30 disabled:pointer-events-none"
          >
            <Plus className="w-3.5 h-3.5" /> new Gem (128B → Class 8)
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {slots.map((slot) => {
            const isHead = slot.id === freeHead;
            const color = slot.type ? typeColors[slot.type] : '#475569';
            return (
              <div
                key={slot.id}
                className={`p-3 rounded-lg border relative transition-all duration-200 flex flex-col justify-between h-28 ${
                  slot.free
                    ? isHead
                      ? 'bg-dark-850/80 border-arcane-500/80 shadow-md shadow-arcane-500/20'
                      : 'bg-dark-900/50 border-dark-750/70 border-dashed text-slate-500'
                    : 'bg-dark-800/90 border-dark-700 shadow-md'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400 font-semibold">Node #{slot.id}</span>
                  {slot.free ? (
                    <span className="text-[10px] text-slate-500 uppercase">FREE</span>
                  ) : (
                    <button
                      onClick={() => freeSlot(slot.id)}
                      title="pool_free(p, sizeof(Derived))"
                      className="text-slate-400 hover:text-red-400 transition-colors p-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {slot.free ? (
                  <div className="text-center py-2">
                    {isHead && (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-arcane-500/20 text-arcane-300 border border-arcane-500/40 mb-1">
                        freeList[c]
                      </span>
                    )}
                    <div className="text-[11px] font-mono text-slate-500">
                      n-&gt;next = {slot.nextFree === -1 ? 'NULL' : `#${slot.nextFree}`}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: color }}
                      ></span>
                      <span className="text-xs font-semibold text-slate-200 truncate">
                        {slot.entityName}
                      </span>
                    </div>
                    <div
                      className="text-[10px] font-mono uppercase tracking-wider"
                      style={{ color }}
                    >
                      {slot.type}
                    </div>
                  </div>
                )}

                <div className="text-[10px] font-mono text-slate-500 border-t border-dark-750/60 pt-1 flex justify-between">
                  <span>{slot.byteSize ? `${slot.byteSize}B` : '0B hdr'}</span>
                  <span>{slot.free ? 'Intrusive' : 'Allocated'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
