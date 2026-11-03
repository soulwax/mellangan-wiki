import { WIKI_SECTIONS } from "../src/data/wikiContent.ts";

export function verifyProse() {
  const issues = [];
  let totalSections = WIKI_SECTIONS.length;
  let totalLinesTested = 0;

  for (const sec of WIKI_SECTIONS) {
    const lines = sec.content.split("\n");
    let inCodeBlock = false;

    lines.forEach((rawLine, idx) => {
      totalLinesTested++;
      const lineNum = idx + 1;
      const trimmed = rawLine.trim();

      // Track code fence toggle
      if (trimmed.startsWith("```")) {
        inCodeBlock = !inCodeBlock;
        return;
      }
      if (inCodeBlock) return;

      // Ignore table rows or markdown list bullets
      // e.g. "- Item" or "* Item"
      let testLine = rawLine;

      // Remove inline code `...`
      testLine = testLine.replace(/`[^`]+`/g, "");
      // Remove inline math $...$ and block math $$...$$
      testLine = testLine.replace(/\$\$[\s\S]*?\$\$/g, "").replace(/\$[^\$]+?\$/g, "");

      // Check for sentence separator dash: word/punctuation followed by " - " or " — " followed by word
      // e.g., "The engine executes at 60 Hz - guaranteeing determinism."
      // But allow range numbers if any, though "10 - 20" should ideally be "10 to 20"
      const dashSeparatorRegex = /([a-zA-Z0-9\.,!?;:\'")\]])\s+[-—–]\s+([a-zA-Z0-9(\["'])/g;
      let match;
      while ((match = dashSeparatorRegex.exec(testLine)) !== null) {
        // Skip common arithmetic expressions or date ranges if in math-like context
        const snippetStart = Math.max(0, match.index - 25);
        const snippetEnd = Math.min(testLine.length, match.index + match[0].length + 25);
        const snippet = testLine.slice(snippetStart, snippetEnd).trim();

        issues.push({
          sectionId: sec.id,
          lineNum,
          match: match[0],
          snippet,
        });
      }
    });
  }

  return { totalSections, totalLinesTested, issues };
}

// Standalone execution
if (process.argv[1]?.endsWith("verify-prose.js")) {
  console.log("=== Mellangan Docs Prose & Style Verifier ===");
  const { totalSections, totalLinesTested, issues } = verifyProse();

  if (issues.length > 0) {
    console.error(`FAILED: Found ${issues.length} forbidden sentence separator dashes (' - ') across ${totalSections} sections (${totalLinesTested} lines):\n`);
    issues.forEach((item, idx) => {
      console.error(`[Prose Issue #${idx + 1}] Section '${item.sectionId}', Line ${item.lineNum}:`);
      console.error(`  Context: "...${item.snippet}..."`);
      console.error(`  Issue:   Contains '${item.match.trim()}' sentence separator (use colon, comma, or separate sentences instead).\n`);
    });
    process.exit(1);
  } else {
    console.log(`PASSED: Zero forbidden sentence separator dashes (' - ') found across ${totalSections} sections (${totalLinesTested} lines).`);
  }
}

