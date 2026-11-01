import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidChartProps {
  chart: string;
  id?: string;
  title?: string;
}

export const MermaidChart: React.FC<MermaidChartProps> = ({ chart, id, title }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        darkMode: true,
        background: '#0c0a13',
        mainBkg: '#181524',
        nodeBorder: '#f6c324',
        clusterBkg: '#12101b',
        clusterBorder: '#a855f7',
        lineColor: '#ffd84d',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '13px',
        textColor: '#e2e8f0',
        titleColor: '#f6c324',
        edgeLabelBackground: '#181524',
        actorBkg: '#181524',
        actorBorder: '#f6c324',
        actorTextColor: '#e2e8f0',
        actorLineColor: '#a855f7',
        signalColor: '#ffd84d',
        signalTextColor: '#e2e8f0',
      },
      securityLevel: 'loose',
    });

    const uniqueId = id || `mermaid-${Math.random().toString(36).substring(2, 9)}`;

    mermaid
      .render(uniqueId, chart)
      .then(({ svg: renderedSvg }) => {
        setSvg(renderedSvg);
        setError(null);
      })
      .catch((err) => {
        console.error('Mermaid render error:', err);
        setError(String(err));
      });
  }, [chart, id]);

  if (error) {
    return (
      <div className="p-4 my-4 bg-red-950/40 border border-red-500/30 rounded-lg text-sm text-red-300 font-mono">
        <div className="font-bold text-red-400 mb-1">Diagram Render Error</div>
        <div>{error}</div>
      </div>
    );
  }

  return (
    <div className="my-6 rounded-xl border border-dark-700 bg-dark-900/90 overflow-hidden shadow-2xl backdrop-blur-sm">
      {title && (
        <div className="px-4 py-2.5 bg-dark-850/90 border-b border-dark-700/80 flex items-center justify-between text-xs font-medium text-slate-300">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gold-500 shadow-sm shadow-gold-500/50"></span>
            <span className="font-mono text-gold-400">{title}</span>
          </span>
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Architecture Diagram</span>
        </div>
      )}
      <div
        ref={containerRef}
        className="p-6 overflow-x-auto flex justify-center items-center [&_svg]:max-w-full [&_svg]:h-auto select-none"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
};

