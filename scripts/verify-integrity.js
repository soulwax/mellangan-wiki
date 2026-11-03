import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { WIKI_SECTIONS } from "../src/data/wikiContent.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const engineRoot = path.resolve(__dirname, "../../../"); // Workspace root containing src/

const VALID_CATEGORIES = new Set([
  "core",
  "graphics",
  "simulation",
  "world",
  "gameplay",
  "contribute",
]);

export function verifyIntegrity() {
  const errors = [];
  const warnings = [];

  const seenIds = new Set();
  let totalSections = WIKI_SECTIONS.length;
  let totalMermaidCharts = 0;
  let totalCodeBlocks = 0;
  let totalSourceFilesChecked = 0;

  for (const sec of WIKI_SECTIONS) {
    // 1. Required fields
    if (!sec.id) errors.push(`Section missing 'id'`);
    if (seenIds.has(sec.id)) errors.push(`Duplicate section id '${sec.id}'`);
    seenIds.add(sec.id);

    if (!sec.title || sec.title.trim().length === 0) {
      errors.push(`Section '${sec.id}' has empty title`);
    }

    if (!VALID_CATEGORIES.has(sec.category)) {
      errors.push(`Section '${sec.id}' has unknown category '${sec.category}'`);
    }

    if (!sec.summary || sec.summary.trim().length === 0) {
      errors.push(`Section '${sec.id}' has empty summary`);
    }

    if (!sec.content || sec.content.trim().length === 0) {
      errors.push(`Section '${sec.id}' has empty content`);
    }

    // 2. Code fence matching
    const fenceCount = (sec.content.match(/^```/gm) || []).length;
    if (fenceCount % 2 !== 0) {
      errors.push(`Section '${sec.id}' has an unclosed code block (found ${fenceCount} '^\`\`\`' markers)`);
    }
    totalCodeBlocks += Math.floor(fenceCount / 2);

    // 3. Mermaid charts (single and plural)
    const charts = [];
    if (sec.mermaidChart) charts.push(sec.mermaidChart);
    if (sec.mermaidCharts && Array.isArray(sec.mermaidCharts)) {
      charts.push(...sec.mermaidCharts);
    }

    for (const mc of charts) {
      totalMermaidCharts++;
      if (!mc.title || mc.title.trim().length === 0) {
        errors.push(`Section '${sec.id}' has a Mermaid chart with empty title`);
      }
      if (!mc.chart || mc.chart.trim().length === 0) {
        errors.push(`Section '${sec.id}' has an empty Mermaid chart definition`);
      } else {
        const chartTrimmed = mc.chart.trim();
        const validHeaders = ["flowchart", "graph", "sequenceDiagram", "stateDiagram", "classDiagram", "erDiagram"];
        const hasValidHeader = validHeaders.some((h) => chartTrimmed.startsWith(h));
        if (!hasValidHeader) {
          errors.push(`Section '${sec.id}' Mermaid chart '${mc.title}' does not begin with a valid diagram keyword: ${chartTrimmed.slice(0, 30)}`);
        }
      }
    }

    // 4. Declared sourceFiles check
    if (sec.sourceFiles && Array.isArray(sec.sourceFiles)) {
      for (const relFile of sec.sourceFiles) {
        totalSourceFilesChecked++;
        const absFile = path.resolve(engineRoot, relFile);
        if (!fs.existsSync(absFile)) {
          warnings.push({
            sectionId: sec.id,
            sourceFile: relFile,
            message: `Declared sourceFile '${relFile}' does not exist on disk at '${absFile}'`
          });
        }
      }
    }
  }

  return {
    totalSections,
    totalMermaidCharts,
    totalCodeBlocks,
    totalSourceFilesChecked,
    errors,
    warnings
  };
}

// Standalone execution
if (process.argv[1]?.endsWith("verify-integrity.js")) {
  console.log("=== Mellangan Docs Content & Engine Integrity Verifier ===");
  const res = verifyIntegrity();

  console.log(`Audited:`);
  console.log(`  - Sections:     ${res.totalSections}`);
  console.log(`  - Code Blocks:  ${res.totalCodeBlocks}`);
  console.log(`  - Mermaid:      ${res.totalMermaidCharts}`);
  console.log(`  - Source Files: ${res.totalSourceFilesChecked}`);

  if (res.warnings.length > 0) {
    console.warn(`\nWarnings (${res.warnings.length} source file notices):`);
    res.warnings.forEach((w, i) => {
      console.warn(`  [Notice #${i + 1}] Section '${w.sectionId}': ${w.message}`);
    });
  }

  if (res.errors.length > 0) {
    console.error(`\nFAILED: Found ${res.errors.length} integrity errors:\n`);
    res.errors.forEach((err, i) => {
      console.error(`  [Error #${i + 1}] ${err}`);
    });
    process.exit(1);
  } else {
    console.log(`\nPASSED: Zero integrity errors found across all documentation sections.`);
  }
}
