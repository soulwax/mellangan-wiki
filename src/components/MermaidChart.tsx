import React, { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Code2,
  GitBranch,
  MoveHorizontal,
} from "lucide-react";

interface MermaidChartProps {
  chart: string;
  id?: string;
  title?: string;
  index?: number;
  total?: number;
}

export const MermaidChart: React.FC<MermaidChartProps> = ({
  chart,
  id,
  title,
  index,
  total,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(100);
  const [fitWidth, setFitWidth] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showSource, setShowSource] = useState<boolean>(false);
  const [intrinsicWidth, setIntrinsicWidth] = useState<number>(680);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      flowchart: {
        htmlLabels: true,
        curve: "basis",
        nodeSpacing: 32,
        rankSpacing: 42,
        padding: 14,
        useMaxWidth: false,
      },
      sequence: {
        mirrorActors: false,
        messageMargin: 30,
        boxMargin: 10,
        useMaxWidth: false,
      },
      themeVariables: {
        darkMode: true,
        background: "#0c0a13",
        mainBkg: "#181524",
        nodeBorder: "#f6c324",
        clusterBkg: "#110e1a",
        clusterBorder: "#6366f1",
        lineColor: "#eab308",
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: "12.5px",
        textColor: "#f1f5f9",
        titleColor: "#f6c324",
        edgeLabelBackground: "#14111f",
        actorBkg: "#181524",
        actorBorder: "#f6c324",
        actorTextColor: "#f1f5f9",
        actorLineColor: "#8b5cf6",
        signalColor: "#facc15",
        signalTextColor: "#f1f5f9",
      },
      securityLevel: "loose",
    });

    const uniqueId =
      (id ? id.replace(/[^a-zA-Z0-9_-]/g, "-") : "mermaid") +
      "-" +
      Math.random().toString(36).substring(2, 7);

    mermaid
      .render(uniqueId, chart.trim())
      .then(({ svg: renderedSvg }) => {
        // Inspect viewBox to detect wide horizontal graphs
        const vbMatch = renderedSvg.match(
          /viewBox="[-0-9.]+\s+[-0-9.]+\s+([0-9.]+)\s+([0-9.]+)"/,
        );
        if (vbMatch) {
          const w = parseFloat(vbMatch[1]);
          if (!Number.isNaN(w) && w > 0) {
            setIntrinsicWidth(Math.round(w));
            // Automatically disable cramped shrink-to-fit when a graph is very wide (> 980px)
            setFitWidth(w <= 980);
          }
        }
        setSvg(renderedSvg);
        setError(null);
      })
      .catch((err) => {
        console.error("Mermaid render error:", err);
        setError(String(err));
      });
  }, [chart, id]);

  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFullscreen]);

  if (error) {
    return (
      <div className="p-4 my-4 bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-300 font-mono">
        <div className="font-bold text-red-400 mb-1">Diagram Render Error</div>
        <div>{error}</div>
      </div>
    );
  }

  const effectiveWidth = fitWidth
    ? `${zoom}%`
    : `${Math.round((intrinsicWidth * zoom) / 100)}px`;

  const renderToolbar = (inModal: boolean) => (
    <div className="px-3.5 py-2.5 bg-dark-950/90 border-b border-dark-800 flex flex-wrap items-center justify-between gap-2 text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-2 h-2 rounded-full bg-gold-400 shadow-sm shadow-gold-400/50 shrink-0" />
        {typeof index === "number" && typeof total === "number" && (
          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 shrink-0">
            Graph {index + 1}/{total}
          </span>
        )}
        <span className="font-mono font-semibold text-gold-300 truncate">
          {title || "Architecture Flow"}
        </span>
      </div>

      <div className="flex items-center gap-1 shrink-0 font-mono text-[11px]">
        <button
          onClick={() => setFitWidth(!fitWidth)}
          className={`px-2 py-1 rounded border transition-colors flex items-center gap-1 ${
            !fitWidth
              ? "bg-sky-500/15 border-sky-500/40 text-sky-300"
              : "bg-dark-900 border-dark-750 text-slate-400 hover:text-slate-200"
          }`}
          title="Toggle between fitting column width and native 1:1 SVG width"
        >
          <MoveHorizontal className="w-3 h-3" />
          <span>{fitWidth ? "Fit" : "1:1"}</span>
        </button>

        <button
          onClick={() => setZoom((z) => Math.max(60, z - 20))}
          className="p-1 rounded bg-dark-900 hover:bg-dark-800 border border-dark-750 text-slate-300 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <span className="px-1.5 text-slate-400 min-w-[42px] text-center">
          {zoom}%
        </span>

        <button
          onClick={() => setZoom((z) => Math.min(220, z + 20))}
          className="p-1 rounded bg-dark-900 hover:bg-dark-800 border border-dark-750 text-slate-300 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        {zoom !== 100 && (
          <button
            onClick={() => setZoom(100)}
            className="p-1 rounded bg-dark-900 hover:bg-dark-800 border border-dark-750 text-slate-400 hover:text-slate-200 transition-colors"
            title="Reset Zoom"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        )}

        <button
          onClick={() => setShowSource(!showSource)}
          className={`p-1 rounded border transition-colors ${
            showSource
              ? "bg-gold-500/20 border-gold-500/40 text-gold-300"
              : "bg-dark-900 border-dark-750 text-slate-400 hover:text-slate-200"
          }`}
          title="Inspect Mermaid Graph DSL"
        >
          <Code2 className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => setIsFullscreen(!inModal)}
          className="flex items-center gap-1 px-2 py-1 rounded bg-dark-850 hover:bg-dark-800 border border-dark-700 text-slate-200 transition-colors"
          title={inModal ? "Close Fullscreen (Esc)" : "Expand Fullscreen"}
        >
          {inModal ? (
            <>
              <Minimize2 className="w-3.5 h-3.5 text-gold-400" />
              <span>Close</span>
            </>
          ) : (
            <Maximize2 className="w-3.5 h-3.5 text-gold-400" />
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="my-5 rounded-2xl border border-dark-750 bg-dark-900/90 overflow-hidden shadow-xl">
        {renderToolbar(false)}

        {showSource && (
          <pre className="p-3.5 bg-dark-950 border-b border-dark-800 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed">
            {chart.trim()}
          </pre>
        )}

        <div
          ref={containerRef}
          className="p-4 sm:p-5 overflow-x-auto bg-gradient-to-b from-dark-900/40 to-dark-950/60"
        >
          <div
            style={{
              width: effectiveWidth,
              minWidth: fitWidth ? undefined : effectiveWidth,
            }}
            className="mx-auto transition-all duration-150 [&_svg]:w-full [&_svg]:h-auto select-none"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>

        {!fitWidth && intrinsicWidth > 900 && (
          <div className="px-3.5 py-1.5 bg-dark-950/80 border-t border-dark-850 flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span className="flex items-center gap-1.5">
              <GitBranch className="w-3 h-3 text-sky-400" />
              Wide pipeline graph rendered at readable 1:1 scale — scroll
              horizontally or click Fullscreen
            </span>
            <button
              onClick={() => setIsFullscreen(true)}
              className="text-gold-400 hover:underline"
            >
              Open Fullscreen ↗
            </button>
          </div>
        )}
      </div>

      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 bg-dark-950/90 backdrop-blur-md p-4 sm:p-8 flex flex-col"
          onClick={() => setIsFullscreen(false)}
        >
          <div
            className="flex-1 max-w-[1600px] w-full mx-auto rounded-2xl border border-dark-700 bg-dark-900 overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {renderToolbar(true)}
            <div className="flex-1 overflow-auto p-6 sm:p-10 flex items-center justify-center bg-dark-950/70">
              <div
                style={{
                  width: `${Math.max(intrinsicWidth, 900) * (zoom / 100)}px`,
                }}
                className="[&_svg]:w-full [&_svg]:h-auto select-none"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
