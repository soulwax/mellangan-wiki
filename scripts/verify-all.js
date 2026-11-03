import { performance } from "perf_hooks";
import { verifyMath } from "./verify-math.js";
import { verifyEscapes } from "./verify-escapes.js";
import { verifyProse } from "./verify-prose.js";
import { verifyIntegrity } from "./verify-integrity.js";

function runSuite(name, fn) {
  const start = performance.now();
  let passed = true;
  const errorMsgs = [];
  let details = "";

  try {
    const res = fn();
    const durationMs = Math.round(performance.now() - start);

    if (name === "KaTeX Mathematics") {
      const errCount = (res.errors || []).length;
      passed = errCount === 0;
      details = `${res.totalTested} formulas verified (block & inline)`;
      if (!passed) {
        res.errors.forEach((e) =>
          errorMsgs.push(`[${e.sectionId} / ${e.type}] ${e.tex} -> ${e.error}`)
        );
      }
    } else if (name === "Source Escape Sequences") {
      const errCount = (res.errors || []).length;
      passed = errCount === 0;
      details = `${res.totalLines} lines scanned for raw template string backslashes`;
      if (!passed) {
        res.errors.forEach((e) =>
          errorMsgs.push(`Line ${e.lineNum}: single backslash '\\${e.command}'`)
        );
      }
    } else if (name === "Prose & Typography") {
      const errCount = (res.issues || []).length;
      passed = errCount === 0;
      details = `${res.totalSections} sections (${res.totalLinesTested} lines) audited for forbidden sentence dashes`;
      if (!passed) {
        res.issues.forEach((i) =>
          errorMsgs.push(`[${i.sectionId}:L${i.lineNum}] Dash separator in: "${i.snippet}"`)
        );
      }
    } else if (name === "Content & Engine Integrity") {
      const errCount = (res.errors || []).length;
      passed = errCount === 0;
      details = `${res.totalSections} sections, ${res.totalMermaidCharts} charts, ${res.totalSourceFilesChecked} verified engine source files`;
      if (!passed) {
        res.errors.forEach((e) => errorMsgs.push(e));
      }
    }

    return { name, passed, durationMs, details, errors: errorMsgs };
  } catch (ex) {
    const durationMs = Math.round(performance.now() - start);
    return {
      name,
      passed: false,
      durationMs,
      details: "Exception thrown during test run",
      errors: [ex?.stack || String(ex)],
    };
  }
}

console.log("===============================================================================");
console.log("               MELLANGAN DOCUMENTATION & VERIFICATION TOOLCHAIN                ");
console.log("===============================================================================");

const suites = [];
suites.push(runSuite("KaTeX Mathematics", verifyMath));
suites.push(runSuite("Source Escape Sequences", verifyEscapes));
suites.push(runSuite("Prose & Typography", verifyProse));
suites.push(runSuite("Content & Engine Integrity", verifyIntegrity));

let allPassed = true;
let totalDuration = 0;

for (const s of suites) {
  totalDuration += s.durationMs;
  const statusBadge = s.passed ? "[PASS]" : "[FAIL]";
  console.log(`\n${statusBadge} ${s.name} (${s.durationMs}ms)`);
  console.log(`       ${s.details}`);
  if (!s.passed) {
    allPassed = false;
    console.error(`       ERRORS (${s.errors.length}):`);
    s.errors.forEach((e) => console.error(`         - ${e}`));
  }
}

console.log("\n-------------------------------------------------------------------------------");
if (allPassed) {
  console.log(`OVERALL RESULT: ALL ${suites.length} SUITES PASSED in ${totalDuration}ms. Documentation is rock-solid.`);
  console.log("===============================================================================\n");
  process.exit(0);
} else {
  console.error(`OVERALL RESULT: VERIFICATION FAILED in ${totalDuration}ms. Please resolve errors above.`);
  console.log("===============================================================================\n");
  process.exit(1);
}
