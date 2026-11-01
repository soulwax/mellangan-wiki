import React, { useState } from 'react';
import { Database, Plus, Trash2, RotateCcw, Cpu } from 'lucide-react';

interface Slot {
  id: number;
  entityName?: string;
  type?: 'Player' | 'Enemy' | 'Orb' | 'Projectile' | 'Gem';
  hp?: number;
  free: boolean;
  nextFree?: number;
}

const INITIAL_SLOTS: Slot[] = [
  { id: 0, entityName: 'Player', type: 'Player', hp: 100, free: false },
  { id: 1, entityName: 'Wolf #12', type: 'Enemy', hp: 45, free: false },
  { id: 2, entityName: 'Orb (Staff)', type: 'Orb', hp: 10, free: false },
  { id: 3, entityName: 'Slime #04', type: 'Enemy', hp: 20, free: false },
  { id: 4, entityName: 'Gem (5 XP)', type: 'Gem', hp: 0, free: false },
  { id: 5, entityName: 'Bolt (Flame)', type: 'Projectile', hp: 5, free: false },
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

  const allocate = (type: 'Enemy' | 'Projectile' | 'Gem') => {
    if (freeHead === -1) return;
    const targetId = freeHead;
    const nextFreeId = slots[targetId].nextFree ?? -1;

    setSlots((prev) =>
      prev.map((s) => {
        if (s.id === targetId) {
          return {
            id: targetId,
            entityName: `${type} #${Math.floor(10 + Math.random() * 89)}`,
            type,
            hp: type === 'Enemy' ? 35 : 1,
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
    if (id === 0) return; // protect player
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
            Pool.c Slab Allocator Architecture
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded bg-dark-750 text-slate-400 font-mono">
            Zero Heap Allocations
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded bg-dark-800 border border-dark-700 text-xs font-mono text-slate-300">
            Active: <span className="text-gold-400 font-bold">{allocCount}</span> / 12 slots
          </div>
          <div className="px-2.5 py-1 rounded bg-dark-800 border border-dark-700 text-xs font-mono text-slate-300">
            Free Head: <span className="text-arcane-400 font-bold">{freeHead === -1 ? 'FULL' : `#${freeHead}`}</span>
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

      <div className="p-6">
        <p className="text-sm text-slate-300 mb-4 leading-relaxed">
          Mellangan avoids standard <code className="text-gold-400">malloc</code>/<code className="text-gold-400">free</code> overhead and heap fragmentation during gameplay using a custom 64-byte slab allocator (<code className="text-arcane-400">extern/entt</code> & <code className="text-arcane-400">src/entity/Pool.c</code>). Slots are recycled via an intrusive singly-linked free list with guaranteed <code className="text-emerald-400">O(1)</code> allocation and reclamation.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="text-xs text-slate-400 font-mono mr-2">Simulate Spawn:</span>
          <button
            onClick={() => allocate('Enemy')}
            disabled={freeHead === -1}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-red-300 text-xs font-mono transition-all disabled:opacity-30 disabled:pointer-events-none"
          >
            <Plus className="w-3.5 h-3.5" /> Spawn Enemy (O(1))
          </button>
          <button
            onClick={() => allocate('Projectile')}
            disabled={freeHead === -1}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-950/40 hover:bg-sky-900/60 border border-sky-500/40 text-sky-300 text-xs font-mono transition-all disabled:opacity-30 disabled:pointer-events-none"
          >
            <Plus className="w-3.5 h-3.5" /> Fire Bolt (O(1))
          </button>
          <button
            onClick={() => allocate('Gem')}
            disabled={freeHead === -1}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 text-xs font-mono transition-all disabled:opacity-30 disabled:pointer-events-none"
          >
            <Plus className="w-3.5 h-3.5" /> Drop Gem (O(1))
          </button>
        </div>

        {/* Slab Memory Slots Grid */}
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
                  <span className="text-slate-400 font-semibold">Slot #{slot.id}</span>
                  {slot.free ? (
                    <span className="text-[10px] text-slate-500 uppercase">FREE</span>
                  ) : (
                    <button
                      onClick={() => freeSlot(slot.id)}
                      title="Deallocate entity"
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
                        HEAD
                      </span>
                    )}
                    <div className="text-[11px] font-mono text-slate-500">
                      Next → {slot.nextFree === -1 ? 'NULL' : `#${slot.nextFree}`}
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
                  <span>64 bytes</span>
                  <span>{slot.free ? 'Recycled' : 'Active'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
