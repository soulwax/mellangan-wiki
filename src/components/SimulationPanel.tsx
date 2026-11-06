import { FileCode2, Sparkles } from "lucide-react";
import type { WikiSection } from "../data/wikiContent";
import { InteractiveLab } from "./InteractiveLab";

interface SimulationPanelProps {
  name?: WikiSection["interactiveComponent"];
  sourceFiles: string[];
}

export function SimulationPanel({ name, sourceFiles }: SimulationPanelProps) {
  if (!name) return null;
  return (
    <div
      id="interactive-lab-anchor"
      className="scroll-mt-20 mt-12 pt-6 border-t border-dark-800/80 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 bg-dark-950/80 border border-dark-800 p-3 rounded-xl font-mono text-xs">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <div>
            <div className="text-emerald-400 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Interactive Systems Laboratory Online</span>
            </div>
            <div className="text-[11px] text-slate-400">
              Manipulate runtime parameters below to observe
              deterministic state transitions, memory layout, and
              engine math.
            </div>
          </div>
        </div>

        {sourceFiles.length > 0 && (
          <a
            href={`https://github.com/soulwax/Mellangan/blob/main/${sourceFiles[0]}`}
            target="_blank"
            rel="noreferrer"
            className="px-2.5 py-1 rounded-lg bg-dark-900 hover:bg-dark-850 border border-dark-750 hover:border-gold-500/40 text-[11px] text-gold-300 transition-colors flex items-center gap-1.5 shrink-0"
          >
            <FileCode2 className="w-3.5 h-3.5 text-gold-400" />
            <span>Inspect {sourceFiles[0]}</span>
          </a>
        )}
      </div>
      <InteractiveLab name={name} />
    </div>
  );
}
