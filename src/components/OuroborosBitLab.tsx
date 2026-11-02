import React, { useState, useMemo } from 'react';
import { Cpu, GitCommit, Zap, RotateCcw, ArrowRight, ShieldAlert, Sparkles, Layers, CheckCircle2, ArrowLeft, Play, Info } from 'lucide-react';

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

const CANONICAL_EDGES = [
  { label: '0 (Root)', val: 0, desc: 'Zero: Lowest bit is 0, all serpents confirm even' },
  { label: '1 (Odd Unit)', val: 1, desc: 'Positive unit: LSB is 1, parity bit isolated' },
  { label: '-1 (Neg Unit)', val: -1, desc: "Two's complement: 0xFFFFFFFF, all 32 bits set, odd" },
  { label: '2 (Even Unit)', val: 2, desc: 'Smallest positive even integer' },
  { label: '-2 (Neg Even)', val: -2, desc: "Two's complement: 0xFFFFFFFE, lowest bit is 0" },
  { label: '0x7FFFFFFF', val: 0x7FFFFFFF, desc: 'INT_MAX: 31 set bits, MSB is 0, odd' },
  { label: '0x80000000', val: -2147483648, desc: 'INT_MIN: Only MSB is set, bit 0 is 0, even' },
  { label: '0x55555555', val: 0x55555555, desc: 'Alternating bits (0101...): bit 0 is 1, odd' },
  { label: '0xAAAAAAAA', val: -1431655766, desc: 'Alternating bits (1010...): bit 0 is 0, even' },
  { label: '65536 (2¹⁶)', val: 65536, desc: '16-bit halfword boundary, power of two, even' },
  { label: '255 (2⁸-1)', val: 255, desc: 'Full 8-bit byte set, odd' },
  { label: '256 (2⁸)', val: 256, desc: 'Byte overflow boundary, even' },
];

interface QueueSlot {
  name: string;
  isInterrupt: boolean;
}

export const OuroborosBitLab: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'council' | 'dissectors' | 'augury' | 'queue'>('council');
  const [inputVal, setInputVal] = useState<number>(42);
  const [auguryStep, setAuguryStep] = useState<number>(0);
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
    const binaryStr = u.toString(2).padStart(32, '0');

    // SWAR breakdown stages
    const swar1 = (((u >>> 1) & 0x55555555) | ((u & 0x55555555) << 1)) >>> 0;
    const swar2 = (((swar1 >>> 2) & 0x33333333) | ((swar1 & 0x33333333) << 2)) >>> 0;
    const swar3 = (((swar2 >>> 4) & 0x0f0f0f0f) | ((swar2 & 0x0f0f0f0f) << 4)) >>> 0;
    const swar4 = (((swar3 >>> 8) & 0x00ff00ff) | ((swar3 & 0x00ff00ff) << 8)) >>> 0;
    const swar5 = ((swar4 >>> 16) | (swar4 << 16)) >>> 0;
    const mirrorBite = (swar5 >>> 31) === 0;

    // Gray breakdown stages
    const gFold16 = (u ^ (u >>> 16)) >>> 0;
    const gFold8 = (gFold16 ^ (gFold16 >>> 8)) >>> 0;
    const gFold4 = (gFold8 ^ (gFold8 >>> 4)) >>> 0;
    const nibble = gFold4 & 15;
    const f0 = (0x6996 >>> nibble) & 1;
    const f1 = grayFold(u >>> 1);
    const grayBite = (f0 ^ f1) === 0;

    // Bruijn breakdown
    const bruijnV = (u | 0x80000000) >>> 0;
    const isolatedLsb = (bruijnV & ((~bruijnV + 1) >>> 0)) >>> 0;
    const bruijnHash = (Math.imul(isolatedLsb, 0x077cb531) >>> 27) & 31;
    const tz = BRUIJN_SPIRAL[bruijnHash];
    const bruijnBite = tz !== 0;

    // Rebecca breakdown
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

    const isEven = (inputVal % 2 === 0);
    const agreement = pop > 2 ? pop : 4 - pop;

    const addrs = [0x1040, 0x1058, 0x1070, 0x1088];
    const xorNodes = addrs.map((addr, i) => {
      const prev = i > 0 ? addrs[i - 1] : 0;
      const next = i < 3 ? addrs[i + 1] : 0;
      const link = prev ^ next;
      const serpentName = ['Mirror', 'Gray', 'Bruijn', 'Rebecca'][i];
      const vote = [mirrorBite, grayBite, bruijnBite, rebeccaBite][i];
      return { addr, prev, next, link, serpentName, vote };
    });

    return {
      u,
      binaryStr,
      swar1,
      swar2,
      swar3,
      swar4,
      swar5,
      mirrorBite,
      gFold16,
      gFold8,
      gFold4,
      nibble,
      f0,
      f1,
      grayBite,
      bruijnV,
      isolatedLsb,
      bruijnHash,
      tz,
      bruijnBite,
      reb,
      rebeccaBite,
      omens,
      pop,
      agreement,
      isEven,
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

  const activeXorNode = serpentData.xorNodes[auguryStep];

  return (
    <div className="my-6 rounded-2xl border border-dark-700 bg-dark-900/95 p-5 shadow-2xl space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-dark-750 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-400" />
            <h4 className="text-sm font-bold uppercase tracking-wider text-purple-400 font-mono">
              Ouroboros Arcane Bit-Twiddling &amp; Parity Council Lab
            </h4>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Live interactive execution of <code className="text-gold-300">src/other/Ouroboros.hpp</code>: Four CRTP Serpents, XOR-Linked Augury, and Operator <code className="text-gold-300">-&gt;*</code>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <div className="flex items-center gap-1.5 bg-dark-950 px-2.5 py-1.5 rounded-lg border border-dark-750 shadow-inner">
            <span className="text-slate-400">Target n:</span>
            <input
              type="number"
              value={inputVal}
              onChange={(e) => setInputVal(parseInt(e.target.value || '0', 10))}
              className="w-24 bg-dark-900 border border-dark-700 rounded px-2 py-0.5 text-gold-300 font-bold"
            />
          </div>

          <div className="flex gap-1">
            <button
              onClick={() => setInputVal((v) => v + 1)}
              className="px-2.5 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-750 border border-dark-700 text-slate-200 transition-colors"
              title="Increment n"
            >
              n+1
            </button>
            <button
              onClick={() => setInputVal((v) => v - 1)}
              className="px-2.5 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-750 border border-dark-700 text-slate-200 transition-colors"
              title="Decrement n"
            >
              n-1
            </button>
            <button
              onClick={() => setInputVal(0)}
              className="px-2.5 py-1.5 rounded-lg bg-dark-800 hover:bg-dark-750 border border-dark-700 text-slate-200 transition-colors"
              title="Set to Zero"
            >
              Zero
            </button>
          </div>
        </div>
      </div>

      {/* Guided Canonical Edge Cases Presets */}
      <div className="p-3 rounded-xl bg-dark-950 border border-dark-800 space-y-2 font-mono">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="font-semibold text-gold-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Try Canonical C++20 Compile-Time Edge Cases (constexpr int EDGES[]):</span>
          </span>
          <span className="text-slate-500">1-Click Scenarios</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CANONICAL_EDGES.map((edge) => (
            <button
              key={edge.label}
              onClick={() => setInputVal(edge.val)}
              className={`px-2 py-1 rounded text-[10px] border transition-all ${
                inputVal === edge.val
                  ? 'bg-gold-500/20 border-gold-400 text-gold-300 font-bold shadow-sm'
                  : 'bg-dark-900 hover:bg-dark-850 border-dark-750 text-slate-300'
              }`}
              title={edge.desc}
            >
              {edge.label}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs border-b border-dark-800 pb-3">
        <button
          onClick={() => setActiveTab('council')}
          className={`px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
            activeTab === 'council'
              ? 'bg-purple-500/20 border-purple-500/60 text-purple-300 font-bold'
              : 'bg-dark-950 border-dark-750 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>1. The Council &amp; Consensus ({serpentData.pop}/4 Votes)</span>
        </button>
        <button
          onClick={() => setActiveTab('dissectors')}
          className={`px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
            activeTab === 'dissectors'
              ? 'bg-gold-500/20 border-gold-500/60 text-gold-300 font-bold'
              : 'bg-dark-950 border-dark-750 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>2. Serpent Bit Dissectors (SWAR, 0x6996, De Bruijn)</span>
        </button>
        <button
          onClick={() => setActiveTab('augury')}
          className={`px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
            activeTab === 'augury'
              ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 font-bold'
              : 'bg-dark-950 border-dark-750 text-slate-400 hover:text-slate-200'
          }`}
        >
          <GitCommit className="w-3.5 h-3.5" />
          <span>3. Augury XOR-Linked List Traversal</span>
        </button>
        <button
          onClick={() => setActiveTab('queue')}
          className={`px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
            activeTab === 'queue'
              ? 'bg-sky-500/20 border-sky-500/60 text-sky-300 font-bold'
              : 'bg-dark-950 border-dark-750 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>4. GoalQueue Modulo-8 Ringbuffer</span>
        </button>
      </div>

      {/* Tab 1: The Council & Consensus */}
      {activeTab === 'council' && (
        <div className="space-y-5 font-mono text-xs">
          <div className="p-4 rounded-xl bg-dark-950 border border-dark-800 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase text-slate-400 font-semibold">
                Infix Pointer-to-Member Evaluation (Ouroboros::operator-&gt;*)
              </div>
              <div className="text-xl font-bold text-slate-100 mt-1 flex items-center gap-2">
                <span>council-&gt;*{inputVal} =</span>
                <span className={serpentData.isEven ? 'text-emerald-400' : 'text-rose-400'}>
                  {serpentData.isEven ? 'true (EVEN)' : 'false (ODD)'}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-dark-900 border border-dark-750 text-gold-300">
                  omens(n) = 0b{serpentData.omens.toString(2).padStart(4, '0')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[10px] text-slate-400">Consensus Agreement</div>
                <div className="text-base font-bold text-gold-300">
                  {serpentData.agreement} of 4 Unanimous
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/40 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
          </div>

          {/* 32-Bit Binary Visualizer */}
          <div className="p-3.5 rounded-xl bg-dark-950 border border-dark-800 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>32-Bit Binary Value (std::bit_cast&lt;uint32_t&gt;(n)):</span>
              <span className="text-slate-500">Hex: 0x{serpentData.u.toString(16).toUpperCase().padStart(8, '0')}</span>
            </div>
            <div className="flex flex-wrap gap-1 font-mono text-[11px] text-center">
              {serpentData.binaryStr.split('').map((bit, idx) => {
                const bitPos = 31 - idx;
                const isLsb = bitPos === 0;
                const isMsb = bitPos === 31;
                return (
                  <div
                    key={bitPos}
                    className={`flex-1 min-w-[20px] p-1 rounded border text-center transition-all ${
                      isLsb
                        ? 'bg-amber-500/30 border-amber-400 text-amber-200 font-bold scale-105'
                        : isMsb
                        ? 'bg-purple-500/20 border-purple-500/40 text-purple-200'
                        : 'bg-dark-900 border-dark-800 text-slate-300'
                    }`}
                    title={`Bit ${bitPos}${isLsb ? ' (LSB: Parity Bit)' : isMsb ? ' (MSB: Sign Bit)' : ''}`}
                  >
                    <div className="text-[8px] text-slate-500">{bitPos}</div>
                    <div className="font-bold">{bit}</div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 pt-1">
              <span>Bit 31 (MSB)</span>
              <span className="text-amber-300 font-bold">Bit 0 (LSB = {serpentData.u & 1} → {serpentData.isEven ? 'Even' : 'Odd'})</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-dark-950 border border-dark-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-300">1. Mirror</span>
                <span className={serpentData.mirrorBite ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  bite = {serpentData.mirrorBite ? '1 (Even)' : '0 (Odd)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                SWAR 32-bit parallel flip. Inverts bit-order so bit 0 maps to MSB (bit 31).
              </p>
              <div className="p-2 rounded bg-dark-900 border border-dark-800 text-[10px] text-slate-300 font-mono">
                !(flip(n) &gt;&gt; 31) = {serpentData.mirrorBite ? 1 : 0}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-dark-950 border border-dark-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sky-300">2. Gray</span>
                <span className={serpentData.grayBite ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  bite = {serpentData.grayBite ? '1 (Even)' : '0 (Odd)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                XOR nibble-fold down to 4 bits, indexing <code className="text-gold-300">0x6996u</code> parity truth table.
              </p>
              <div className="p-2 rounded bg-dark-900 border border-dark-800 text-[10px] text-slate-300 font-mono">
                !(fold(n) ^ fold(n&gt;&gt;1)) = {serpentData.grayBite ? 1 : 0}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-dark-950 border border-dark-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-300">3. Bruijn</span>
                <span className={serpentData.bruijnBite ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  bite = {serpentData.bruijnBite ? '1 (Even)' : '0 (Odd)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Isolates LSB via <code className="text-gold-300">v &amp; (~v + 1)</code> and hashes into <code className="text-gold-300">0x077CB531u</code> spiral table.
              </p>
              <div className="p-2 rounded bg-dark-900 border border-dark-800 text-[10px] text-slate-300 font-mono">
                SPIRAL[hash] != 0 = {serpentData.bruijnBite ? 1 : 0}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-dark-950 border border-dark-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-purple-300">4. Rebecca</span>
                <span className={serpentData.rebeccaBite ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  bite = {serpentData.rebeccaBite ? '1 (Even)' : '0 (Odd)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Rotates right by 8 bits (<code className="text-gold-300">std::rotr(n, 8)</code>) and checks 256-entry feelings LUT.
              </p>
              <div className="p-2 rounded bg-dark-900 border border-dark-800 text-[10px] text-slate-300 font-mono">
                AN_ARRAY_OF_FEELINGS[b] != 0 = {serpentData.rebeccaBite ? 1 : 0}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Serpent Bit Dissectors */}
      {activeTab === 'dissectors' && (
        <div className="space-y-4 font-mono text-xs">
          <div className="p-4 rounded-xl bg-dark-950 border border-dark-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-amber-300 font-bold text-sm">Mirror: 5-Stage SIMD-Within-A-Register (SWAR) Bit Reversal</span>
              <span className="text-slate-400 text-[11px]">Final flip(n) = 0x{serpentData.swar5.toString(16).toUpperCase().padStart(8, '0')}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-[10px]">
              <div className="p-2 rounded bg-dark-900 border border-dark-800 space-y-1">
                <div className="text-slate-400">1. 1-Bit Pairs (&amp; 0x55555555)</div>
                <div className="text-amber-300 truncate font-bold">0x{serpentData.swar1.toString(16).toUpperCase().padStart(8, '0')}</div>
              </div>
              <div className="p-2 rounded bg-dark-900 border border-dark-800 space-y-1">
                <div className="text-slate-400">2. 2-Bit Dibits (&amp; 0x33333333)</div>
                <div className="text-amber-300 truncate font-bold">0x{serpentData.swar2.toString(16).toUpperCase().padStart(8, '0')}</div>
              </div>
              <div className="p-2 rounded bg-dark-900 border border-dark-800 space-y-1">
                <div className="text-slate-400">3. 4-Bit Nibbles (&amp; 0x0F0F0F0F)</div>
                <div className="text-amber-300 truncate font-bold">0x{serpentData.swar3.toString(16).toUpperCase().padStart(8, '0')}</div>
              </div>
              <div className="p-2 rounded bg-dark-900 border border-dark-800 space-y-1">
                <div className="text-slate-400">4. 8-Bit Bytes (&amp; 0x00FF00FF)</div>
                <div className="text-amber-300 truncate font-bold">0x{serpentData.swar4.toString(16).toUpperCase().padStart(8, '0')}</div>
              </div>
              <div className="p-2 rounded bg-dark-900 border border-dark-800 space-y-1">
                <div className="text-slate-400">5. 16-Bit Swap (&gt;&gt;16 | &lt;&lt;16)</div>
                <div className="text-emerald-300 truncate font-bold">0x{serpentData.swar5.toString(16).toUpperCase().padStart(8, '0')}</div>
              </div>
            </div>
            <div className="text-[11px] text-slate-300 pt-1">
              MSB extract: <code className="text-gold-300">flip(n) &gt;&gt; 31 = {serpentData.swar5 >>> 31}</code> • Inverted: <code className="text-emerald-300">!({serpentData.swar5 >>> 31}) = {serpentData.mirrorBite ? 1 : 0}</code>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-dark-950 border border-dark-800 space-y-2">
              <span className="text-sky-300 font-bold">Gray Parity Cancellation</span>
              <div className="text-[11px] text-slate-400 space-y-1">
                <div>fold(n) = <strong>{serpentData.f0}</strong> (nibble: {serpentData.nibble})</div>
                <div>fold(n &gt;&gt; 1) = <strong>{serpentData.f1}</strong></div>
                <div className="text-emerald-300 font-bold pt-1 border-t border-dark-800">
                  !(f0 ^ f1) = {serpentData.grayBite ? 1 : 0}
                </div>
              </div>
              <p className="text-[10px] text-slate-500">
                Because XOR parity cancels out pairwise, all 31 upper bits vanish, leaving strictly bit 0!
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-dark-950 border border-dark-800 space-y-2">
              <span className="text-emerald-300 font-bold">Bruijn De Bruijn Multiplier</span>
              <div className="text-[11px] text-slate-400 space-y-1">
                <div>Sentinel v = <strong>0x{serpentData.bruijnV.toString(16).toUpperCase()}</strong></div>
                <div>Isolated LSB = <strong>0x{serpentData.isolatedLsb.toString(16).toUpperCase()}</strong></div>
                <div>Hash (LSB*0x077CB531&gt;&gt;27) = <strong>{serpentData.bruijnHash}</strong></div>
                <div className="text-emerald-300 font-bold pt-1 border-t border-dark-800">
                  SPIRAL[{serpentData.bruijnHash}] = {serpentData.tz} ({serpentData.tz !== 0 ? '!= 0' : '== 0'})
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-dark-950 border border-dark-800 space-y-2">
              <span className="text-purple-300 font-bold">Rebecca Affine Galois Map</span>
              <div className="text-[11px] text-slate-400 space-y-1">
                <div>rotr8 &gt;&gt; 24 = <strong>0x{serpentData.reb.byte.toString(16).toUpperCase().padStart(2, '0')}</strong> ({serpentData.reb.byte})</div>
                <div>Formula: 1 ^ (((b*93)^46) &amp; 1)</div>
                <div className="text-emerald-300 font-bold pt-1 border-t border-dark-800">
                  LUT[{serpentData.reb.byte}] = {serpentData.reb.out}
                </div>
              </div>
              <p className="text-[10px] text-slate-500">
                93 is odd (preserves parity in Z₂), 46 is even (identity under XOR), 1^ inverts parity!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Augury XOR-Linked List Traversal with Interactive Stepping */}
      {activeTab === 'augury' && (
        <div className="space-y-4 font-mono text-xs">
          <div className="p-4 rounded-xl bg-dark-950 border border-dark-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-emerald-400 font-bold text-sm">Augury: Self-Traversing XOR-Linked List</span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Compact 24-byte <code className="text-gold-300">Rite</code> nodes storing a single <code className="text-slate-200">link = prev ^ next</code> pointer.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setAuguryStep((s) => Math.max(0, s - 1))}
                  disabled={auguryStep === 0}
                  className="px-2 py-1 rounded bg-dark-850 hover:bg-dark-800 disabled:opacity-30 border border-dark-700 text-slate-300 flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Prev</span>
                </button>
                <span className="text-gold-300 font-bold px-1.5">
                  Node {auguryStep + 1} / 4
                </span>
                <button
                  onClick={() => setAuguryStep((s) => Math.min(3, s + 1))}
                  disabled={auguryStep === 3}
                  className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-30 border border-emerald-500/40 text-emerald-300 font-bold flex items-center gap-1"
                >
                  <span>Next Node</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setAuguryStep(0)}
                  className="px-2 py-1 rounded bg-dark-850 hover:bg-dark-800 border border-dark-700 text-slate-400"
                  title="Reset to first node"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {serpentData.xorNodes.map((node, i) => {
                const isActive = i === auguryStep;
                return (
                  <div
                    key={i}
                    onClick={() => setAuguryStep(i)}
                    className={`p-3 rounded-lg border space-y-1.5 cursor-pointer transition-all ${
                      isActive
                        ? 'bg-emerald-500/15 border-emerald-400 shadow-md shadow-emerald-500/10 scale-102'
                        : 'bg-dark-900 hover:bg-dark-850 border-dark-750'
                    }`}
                  >
                    <div className="flex items-center justify-between text-gold-400 font-bold">
                      <span>rites[{i}] ({node.serpentName})</span>
                      <span className={node.vote ? 'text-emerald-400' : 'text-rose-400'}>
                        {node.vote ? 'EVEN' : 'ODD'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 space-y-0.5">
                      <div>Addr: <strong className="text-slate-300">0x{node.addr.toString(16)}</strong></div>
                      <div>Prev: 0x{node.prev.toString(16)}</div>
                      <div>Next: 0x{node.next.toString(16)}</div>
                    </div>
                    <div className="text-[11px] text-emerald-300 font-bold pt-1 border-t border-dark-800">
                      link: 0x{node.link.toString(16)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Active Node Live XOR Calculation Box */}
            <div className="p-3 rounded-lg bg-dark-900 border border-emerald-500/30 text-[11px] text-slate-300 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Play className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  Active Node: <strong className="text-gold-300">{activeXorNode.serpentName} (rites[{auguryStep}])</strong>
                </span>
              </div>
              <div className="text-emerald-300 font-mono">
                <code>next = link ^ prev = 0x{activeXorNode.link.toString(16)} ^ 0x{activeXorNode.prev.toString(16)} = 0x{activeXorNode.next.toString(16)}</code>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-dark-900/60 border border-dark-800 text-[11px] text-slate-300 space-y-1">
              <span className="text-gold-400 font-bold flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                <span>Why XOR-Linked Lists Validate Compiler Integrity:</span>
              </span>
              <p className="text-slate-400 leading-relaxed">
                Doubly linked lists require 16 bytes of pointer storage per node. XOR-linked lists compress this into a single 64-bit integer (<code className="text-slate-200">link = prev ^ next</code>). Mellangan runs this in <code className="text-slate-200">consultOuroboros()</code> to guarantee that strict aliasing and pointer provenance optimizations in GCC/Clang/MSVC never corrupt bidirectional pointer reconstruction!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: GoalQueue Modulo-8 Ringbuffer */}
      {activeTab === 'queue' && (
        <div className="p-4 rounded-xl bg-dark-950 border border-dark-800 space-y-4 font-mono">
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

          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 pt-1">
            {queueItems.map((slot, idx) => {
              const isHead = size > 0 && idx === head;
              const isTail = size > 0 && idx === ((head + size - 1) & 7);
              return (
                <div
                  key={idx}
                  className={`p-2 rounded-lg border text-center relative transition-all ${
                    isHead
                      ? 'bg-gold-500/20 border-gold-400 text-gold-200 shadow-md shadow-gold-500/10 scale-102'
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

          <div className="space-y-2 pt-2 border-t border-dark-800">
            <div className="text-[10px] uppercase text-slate-500 font-semibold">
              Dispatch Queue Operations
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <button
                onClick={() => pushFrontInterrupt('FALTER (0.3s)')}
                disabled={size >= 8}
                className="flex items-center justify-center gap-1 px-2.5 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 disabled:opacity-40 border border-rose-500/40 text-rose-300 font-bold transition-colors"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>pushFront(FALTER)</span>
              </button>
              <button
                onClick={popGoal}
                disabled={size === 0}
                className="flex items-center justify-center gap-1 px-2.5 py-2 rounded-lg bg-gold-500/20 hover:bg-gold-500/30 disabled:opacity-40 border border-gold-500/40 text-gold-300 font-bold transition-colors"
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
      )}
    </div>
  );
};

