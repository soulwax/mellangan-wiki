import { WIKI_SECTIONS } from "../src/data/wikiContent.ts";
import katex from "katex";

export function verifyMath() {
  let totalTested = 0;
  const errors = [];

  for (const sec of WIKI_SECTIONS) {
    // 1. Test block math $$...$$
    const blockMatches = sec.content.matchAll(/\$\$([\s\S]*?)\$\$/g);
    for (const m of blockMatches) {
      totalTested++;
      const tex = m[1].trim();
      try {
        katex.renderToString(tex, { displayMode: true, throwOnError: true });
      } catch (err) {
        errors.push({
          sectionId: sec.id,
          type: "block",
          tex,
          error: err.message,
        });
      }
    }

    // 2. Test inline math $...$
    // Remove fenced code blocks and inline code spans first so $ in code isn't treated as math
    const withoutCode = sec.content
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`[^`\n]+`/g, "");
    const withoutBlockMath = withoutCode.replace(/\$\$[\s\S]*?\$\$/g, "");
    const inlineMatches = withoutBlockMath.matchAll(/\$([^\$\n]+?)\$/g);
    for (const m of inlineMatches) {
      totalTested++;
      const tex = m[1].trim();
      try {
        katex.renderToString(tex, { displayMode: false, throwOnError: true });
      } catch (err) {
        errors.push({
          sectionId: sec.id,
          type: "inline",
          tex,
          error: err.message,
        });
      }
    }
  }

  return { totalTested, errors };
}

// Standalone execution
if (process.argv[1]?.endsWith("verify-math.js")) {
  console.log("=== Mellangan Docs KaTeX Math Verifier ===");
  const { totalTested, errors } = verifyMath();
  if (errors.length > 0) {
    console.error(`FAILED: ${errors.length} of ${totalTested} expressions failed to render:\n`);
    errors.forEach((e, idx) => {
      console.error(`[Error #${idx + 1}] in Chapter '${e.sectionId}' (${e.type} math):`);
      console.error(`  TeX:   ${e.tex}`);
      console.error(`  Error: ${e.error}\n`);
    });
    process.exit(1);
  } else {
    console.log(`PASSED: All ${totalTested} KaTeX expressions rendered with zero errors.`);
  }
}

