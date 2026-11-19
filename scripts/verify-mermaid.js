import DOMPurify from "dompurify";
import mermaid from "mermaid";
import { WIKI_SECTIONS } from "../src/data/wikiContent.ts";

// Mermaid's Node parser calls these browser sanitizer methods for flowcharts.
// Chart syntax is checked here. The browser still sanitizes rendered SVGs.
DOMPurify.addHook = () => {};
DOMPurify.sanitize = (text) => text;

let checked = 0;
let failures = 0;

for (const section of WIKI_SECTIONS) {
  const charts = [
    ...(section.mermaidChart ? [section.mermaidChart] : []),
    ...(section.mermaidCharts ?? []),
  ];

  for (const chart of charts) {
    checked++;
    try {
      await mermaid.parse(chart.chart);
    } catch (error) {
      failures++;
      console.error(`${section.id} / ${chart.title}\n${String(error)}`);
    }
  }
}

console.log(`Mermaid syntax: ${checked} charts checked, ${failures} errors`);
if (failures) process.exitCode = 1;
