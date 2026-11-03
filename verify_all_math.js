import { WIKI_SECTIONS } from "./src/data/wikiContent.ts";
import katex from "katex";

let totalMath = 0;
let errors = 0;

for (const sec of WIKI_SECTIONS) {
  // Test block math $$...$$
  const blockMatches = sec.content.matchAll(/\$\$([\s\S]*?)\$\$/g);
  for (const m of blockMatches) {
    totalMath++;
    try {
      katex.renderToString(m[1].trim(), { displayMode: true, throwOnError: true });
    } catch (e) {
      errors++;
      console.error(`[BLOCK MATH ERROR in ${sec.id}]`);
      console.error(m[1].trim());
      console.error(`Error: ${e.message}\n`);
    }
  }

  // Test inline math $...$
  // First remove code blocks
  const withoutCode = sec.content.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]+`/g, "");
  // Remove block math
  const withoutBlockMath = withoutCode.replace(/\$\$[\s\S]*?\$\$/g, "");
  const inlineMatches = withoutBlockMath.matchAll(/\$([^\$\n]+?)\$/g);
  for (const m of inlineMatches) {
    totalMath++;
    try {
      katex.renderToString(m[1].trim(), { displayMode: false, throwOnError: true });
    } catch (e) {
      errors++;
      console.error(`[INLINE MATH ERROR in ${sec.id}]`);
      console.error(m[1].trim());
      console.error(`Error: ${e.message}\n`);
    }
  }
}

console.log(`\n========================================`);
console.log(`Tested ${totalMath} math expressions. Errors: ${errors}`);
console.log(`========================================\n`);

