import React, { useState, useMemo } from 'react';
import { Cpu, GitCommit, Zap, RotateCcw, ArrowRight, ShieldAlert } from 'lucide-react';

function swarFlip(v: number): number {
  let u = v >>> 0;
  u = (((u >>> 1) & 0x55555555) | ((u & 0x55555555) << 1)) >>> 0;
  u = (((u >>> 2) & 0x33333333) | ((u & 0x33333333) << 2)) >>> 0;
  u = (((u >>> 4) & 0x0f0f0f0f) | ((u & 0x0f0f0f0f) << 4)) >>> 0;
  u = (((u >>> 8) & 0x00ff00ff) | ((u & 0x00ff00ff) << 8)) >>> 0;
  return ((u >>> 16) | (u << 16)) >>> 0;
}

function grayFold(v: number): number {
  let u = v >>> 0;
  u ^= u >>> 16;
  u ^= u >>> 8;
  u ^= u >>> 4;
  return (0x6996 >>> (u & 15)) & 1;
}

const BRUIJN_SPIRAL = (() => {
  const t = new Array<number>(32).fill(0);
  for (let i = 0; i < 32; i++) {
    const idx = (Math.imul(0x077cb531, 1 << i) >>> 27) & 31;
    t[idx] = i;
  }
  return t;
})();

function bruijnIndex(v: number): number {
  const u = (v | 0x80000000) >>> 0;
  const lsb = (u & ((~u + 1) >>> 0)) >>> 0;
  const hash = (Math.imul(lsb, 0x077cb531) >>> 27) & 31;
  return BRUIJN_SPIRAL[hash];
}

function rebeccaByte(v: number): { byte: number; out: number } {
  const u = v >>> 0;
  const rotr8 = ((u >>> 8) | (u << 24)) >>> 0;
  const b = (rotr8 >>> 24) & 0xff;
  const out = 1 ^ (((b * 0x5d) ^ 0x2e) & 1);
  return { byte: b, out };
}

interface QueueSlot {
  name: string;
  isInterrupt: boolean;
}

export const OuroborosBitLab: React.FC = () => {
  const [inputVal, setInputVal] = useState<number>(42);
  const [queueItems, setQueueItems] = useState<(QueueSlot | null)[]>([
    { name: 'HOWL', isInterrupt: false },
    { name: 'FLANK', isInterrupt: false },
    { name: 'BITE', isInterrupt: false },
    null,
    null,
    null,
    null,
    null,
  ]);
  const [head, setHead] = useState<number>(0);
  const [size, setSize] = useState<number>(3);

  const serpentData = useMemo(() => {
    const u = inputVal >>> 0;
    const flipped = swarFlip(u);
    const mirrorBite = (flipped >>> 31) === 0;

    const f0 = grayFold(u);
    const f1 = grayFold(u >>> 1);
    const grayBite = (f0 ^ f1) === 0;

    const tz = bruijnIndex(u);
    const bruijnBite = tz !== 0;

    const reb = rebeccaByte(u);
    const rebeccaBite = reb.out !== 0;

    const omens =
      (mirrorBite ? 1 : 0) |
      ((grayBite ? 1 : 0) << 1) |
      ((bruijnBite ? 1 : 0) << 2) |
      ((rebeccaBite ? 1 : 0) << 3);

    const pop =
      (mirrorBite ? 1 : 0) +
      (grayBite ? 1 : 0) +
      (bruijnBite ? 1 : 0) +
      (rebeccaBite ? 1 : 0);

    const addrs = [0x1040, 0x1058, 0x1070, 0x1088];
    const xorNodes = addrs.map((addr, i) => {
      const prev = i > 0 ? addrs[i - 1] : 0;
      const next = i < 3 ? addrs[i + 1] : 0;
      const link = prev ^ next;
      return { addr, prev, next, link };
    });

    return {
      u,
      flipped,
      mirrorBite,
      f0,
      f1,
      grayBite,
      tz,
      bruijnBite,
      reb,
      rebeccaBite,
      omens,
      pop,
      xorNodes,
    };
  }, [inputVal]);

  const pushBackGoal = (name: string) => {
    if (size >= 8) return;
    const targetIdx = (head + size) & 7;
    const next = [...queueItems];
    next[targetIdx] = { name, isInterrupt: false };
    setQueueItems(next);
    setSize(size + 1);
  };

  const pushFrontInterrupt = (name: string) => {
    if (size >= 8) return;
    const newHead = (head + 7) & 7;
    const next = [...queueItems];
    next[newHead] = { name, isInterrupt: true };
    setQueueItems(next);
    setHead(newHead);
    setSize(size + 1);
  };

  const popGoal = () => {
    if (size === 0) return;
    const next = [...queueItems];
    next[head] = null;
    setQueueItems(next);
    setHead((head + 1) & 7);
    setSize(size - 1);
  };

  const resetQueue = () => {
    setQueueItems([
      { name: 'HOWL', isInterrupt: false },
      { name: 'FLANK', isInterrupt: false },
      { name: 'BITE', isInterrupt: false },
      null,
      null,
      null,
      null,
      null,
    ]);
    setHead(0);
    setSize(3);
  };

  return (
    <div className="my-6 rounded-xl border border-dark-700 bg-dark-900/90 p-5 shadow-xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-dark-750 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-400" />
            <h4 className="text-sm font-bold uppercase tracking-wider text-purple-400 font-mono">
              Ouroboros Bit-Twiddling &amp; GoalQueue Ringbuffer Lab
            </h4>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Live execution of <code className="text-gold-300">src/other/Ouroboros.hpp</code> (4 Serpents + XOR-Linked List) &amp; <code className="text-gold-300">src/entity/enemy/ai/Goal.hpp</code>
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-slate-400">Test Integer n:</span>
          <input
            type="number"
            value={inputVal}
            onChange={(e) => setInputVal( parseInt(e.target.value || '0', 10) )}
            className="w-28 bg-dark-950 border border-dark-700 rounded-lg px-2.5 py-1 text-gold-300 font-bold"
          />
          <button
            onClick={() => setInputVal((v) => v + 1)}
            className="px-2.5 py-1 rounded-lg bg-dark-800 hover:bg-dark-750 border border-dark-650 text-slate-200"
          >
            n + 1
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-4">
          <div className="text-xs font-mono font-bold text-slate-200 flex items-center justify-between">
            <span>The Four Serpents of <code className="text-purple-300">Charlotte&lt;Self&gt;</code> (CRTP Compile-Time Consensus)</span>
            <span className={`px-2 py-0.5 rounded border ${serpentData.pop > 2 ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' : 'bg-rose-500/20 border-rose-500/50 text-rose-300'}`}>
              o-&gt;*n = {serpentData.pop > 2 ? 'true (EVEN)' : 'false (ODD)'} (popcount={serpentData.pop})
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
            <div className="p-3 rounded-xl bg-dark-950 border border-dark-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-300">1. Mirror (SWAR 32b Flip)</span>
                <span className={serpentData.mirrorBite ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  bite = {serpentData.mirrorBite ? '1' : '0'}
                </span>
              </div>
              <div className="text-[10px] text-slate-400">
                Masks: <code className="text-slate-300">0x55555555</code>, <code className="text-slate-300">0x33333333</code>, <code className="text-slate-300">0x0F0F0F0F</code>
              </div>
              <div className="text-[10px] bg-dark-900 p-1.5 rounded border border-dark-800 text-slate-300">
                flip(n) = 0x{serpentData.flipped.toString(16).toUpperCase().padStart(8, '0')} • MSB = {serpentData.flipped >>> 31}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-dark-950 border border-dark-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sky-300">2. Gray (XOR Nibble Parity)</span>
                <span className={serpentData.grayBite ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  bite = {serpentData.grayBite ? '1' : '0'}
                </span>
              </div>
              <div className="text-[10px] text-slate-400">
                Truth Table Constant: <code className="text-slate-300">0x6996u &gt;&gt; (v &amp; 15) &amp; 1</code>
              </div>
              <div className="text-[10px] bg-dark-900 p-1.5 rounded border border-dark-800 text-slate-300">
                fold(n)={serpentData.f0} ^ fold(n&gt;&gt;1)={serpentData.f1} → !(f0 ^ f1)
              </div>
            </div>

            <div className="p-3 rounded-xl bg-dark-950 border border-dark-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-300">3. Bruijn (0x077CB531u Spiral)</span>
                <span className={serpentData.bruijnBite ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  bite = {serpentData.bruijnBite ? '1' : '0'}
                </span>
              </div>
              <div className="text-[10px] text-slate-400">
                Isolates LSB via <code className="text-slate-300">(v &amp; (~v + 1)) * 0x077CB531u &gt;&gt; 27</code>
              </div>
              <div className="text-[10px] bg-dark-900 p-1.5 rounded border border-dark-800 text-slate-300">
                Trailing Zero Count (SPIRAL) = {serpentData.tz} ({serpentData.tz !== 0 ? '!= 0' : '== 0'})
              </div>
            </div>

            <div className="p-3 rounded-xl bg-dark-950 border border-dark-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-purple-300">4. Rebecca (rotr8 LUT[256])</span>
                <span className={serpentData.rebeccaBite ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  bite = {serpentData.rebeccaBite ? '1' : '0'}
                </span>
              </div>
              <div className="text-[10px] text-slate-400">
                <code className="text-slate-300">AN_ARRAY_OF_FEELINGS[std::rotr(n, 8) &gt;&gt; 24]</code>
              </div>
              <div className="text-[10px] bg-dark-900 p-1.5 rounded border border-dark-800 text-slate-300">
                Low Byte = 0x{serpentData.reb.byte.toString(16).toUpperCase().padStart(2, '0')} → LUT = {serpentData.reb.out}
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-dark-950 border border-dark-800 font-mono text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <GitCommit className="w-3.5 h-3.5 text-gold-400" />
                <span><code className="text-gold-300">Augury</code> XOR-Linked List Traversal (<code className="text-slate-300">next = r-&gt;link ^ prev</code>)</span>
              </span>
              <span className="text-[10px] text-slate-400">Type-Erased Thunk Dispatch</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {serpentData.xorNodes.map((node, i) => (
                <div key={i} className="p-2 rounded bg-dark-900 border border-dark-750 text-[10px] space-y-0.5">
                  <div className="text-gold-400 font-bold">rites[{i}] @ 0x{node.addr.toString(16)}</div>
                  <div className="text-slate-400">prev: 0x{node.prev.toString(16)}</div>
                  <div className="text-slate-400">next: 0x{node.next.toString(16)}</div>
                  <div className="text-emerald-300 font-bold pt-0.5 border-t border-dark-800">
                    link: 0x{node.link.toString(16)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 p-4 rounded-xl bg-dark-950 border border-dark-800 flex flex-col justify-between space-y-4 font-mono">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>8-Slot Bitwise <code className="text-gold-300">GoalQueue</code> Ringbuffer</span>
              </div>
              <button
                onClick={resetQueue}
                className="p-1 rounded bg-dark-850 hover:bg-dark-800 text-slate-400 border border-dark-700"
                title="Reset Queue"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="text-[11px] text-slate-400">
              Bitwise modulo-8 indexing (<code className="text-slate-200">&amp; 7</code>) enables zero-branch ring wrapping and $O(1)$ <code className="text-rose-300">pushFront()</code> interrupt preemption via <code className="text-rose-300">head = (head + 7) &amp; 7</code>.
            </div>

            <div className="grid grid-cols-4 gap-2 pt-1">
              {queueItems.map((slot, idx) => {
                const isHead = size > 0 && idx === head;
                const isTail = size > 0 && idx === ((head + size - 1) & 7);
                return (
                  <div
                    key={idx}
                    className={`p-2 rounded-lg border text-center relative transition-all ${
                      isHead
                        ? 'bg-gold-500/20 border-gold-400 text-gold-200 shadow-md shadow-gold-500/10'
                        : slot
                        ? slot.isInterrupt
                          ? 'bg-rose-500/15 border-rose-500/50 text-rose-200'
                          : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                        : 'bg-dark-900/50 border-dark-800 text-slate-600'
                    }`}
                  >
                    <div className="flex justify-between text-[9px] opacity-75">
                      <span>[{idx}]</span>
                      {isHead && <span className="text-gold-400 font-bold">HEAD</span>}
                      {!isHead && isTail && <span className="text-emerald-400">TAIL</span>}
                    </div>
                    <div className="text-xs font-bold mt-1 truncate">
                      {slot ? slot.name : 'nullptr'}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-2.5 rounded bg-dark-900 border border-dark-800 text-[11px] flex justify-between text-slate-300">
              <span>head = <strong className="text-gold-400">{head}</strong></span>
              <span>size = <strong className="text-emerald-400">{size}</strong> / 8</span>
              <span>front() = <strong className="text-white">{size > 0 && queueItems[head] ? queueItems[head]?.name : 'nullptr'}</strong></span>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-dark-800">
            <div className="text-[10px] uppercase text-slate-500 font-semibold">
              Dispatch Queue Operations
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => pushFrontInterrupt('FALTER (0.3s)')}
                disabled={size >= 8}
                className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 disabled:opacity-40 border border-rose-500/40 text-rose-300 font-bold transition-colors"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>pushFront(FALTER)</span>
              </button>
              <button
                onClick={popGoal}
                disabled={size === 0}
                className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-gold-500/20 hover:bg-gold-500/30 disabled:opacity-40 border border-gold-500/40 text-gold-300 font-bold transition-colors"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>pop() GoalDone</span>
              </button>
              <button
                onClick={() => pushBackGoal('APPROACH')}
                disabled={size >= 8}
                className="px-2.5 py-1.5 rounded-lg bg-dark-850 hover:bg-dark-800 disabled:opacity-40 border border-dark-700 text-slate-200 transition-colors"
              >
                + push(APPROACH)
              </button>
              <button
                onClick={() => pushBackGoal('CLEAVE')}
                disabled={size >= 8}
                className="px-2.5 py-1.5 rounded-lg bg-dark-850 hover:bg-dark-800 disabled:opacity-40 border border-dark-700 text-slate-200 transition-colors"
              >
                + push(CLEAVE)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

