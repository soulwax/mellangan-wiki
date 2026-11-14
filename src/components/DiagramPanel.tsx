import { lazy, Suspense } from "react";
import { GitBranch } from "lucide-react";
import type { MermaidDiagramDef } from "../data/wikiContent";

const MermaidChart = lazy(() => import("./MermaidChart").then(m => ({ default: m.MermaidChart })));

interface DiagramPanelProps {
  sectionId: string;
  diagrams: MermaidDiagramDef[];
  activeDiagramTab: "all" | number;
  setActiveDiagramTab: (tab: "all" | number) => void;
}

export function DiagramPanel({ sectionId, diagrams, activeDiagramTab, setActiveDiagramTab }: DiagramPanelProps) {
  return (
    diagrams.length > 0 && (
              <div
                id="architecture-diagrams-anchor"
                className="scroll-mt-20 mt-10 pt-6 border-t border-dark-800/80"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="text-xs font-mono uppercase tracking-wider text-sky-400 font-semibold flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5" />
                    <span>Architecture &amp; Control-Flow Diagrams</span>
                  </div>

                  {diagrams.length > 1 && (
                    <div className="flex flex-wrap items-center gap-1 bg-dark-900 p-1 rounded-lg border border-dark-800 text-[11px] font-mono">
                      <button
                        onClick={() => setActiveDiagramTab("all")}
                        aria-pressed={activeDiagramTab === "all"}
                        className={`px-2 py-0.5 rounded transition-colors ${
                          activeDiagramTab === "all"
                            ? "bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        Stacked ({diagrams.length})
                      </button>
                      {diagrams.map((_d, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActiveDiagramTab(idx)}
                          aria-pressed={activeDiagramTab === idx}
                          className={`px-2 py-0.5 rounded transition-colors ${
                            activeDiagramTab === idx
                              ? "bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold"
                              : "text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          Graph {idx + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {diagrams.map((d, idx) => {
                  if (activeDiagramTab !== "all" && activeDiagramTab !== idx) {
                    return null;
                  }
                  return (
                    <Suspense key={`${sectionId}-chart-${idx}`} fallback={<p role="status" className="text-sm text-slate-400">Loading diagram...</p>}>
                    <MermaidChart
                      id={`${sectionId}-${idx}`}
                      title={d.title}
                      chart={d.chart}
                      index={idx}
                      total={diagrams.length}
                    />
                    </Suspense>
                  );
                })}
              </div>
            )
  );
}
