import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wikiContentPath = path.resolve(__dirname, "../src/data/wikiContent.ts");

export function verifyEscapes() {
  const content = fs.readFileSync(wikiContentPath, "utf8");
  const lines = content.split("\n");
  const errors = [];

  // Common LaTeX commands that might be accidentally written with single backslash
  // in JS template literals, leading to escape sequence interpretation like \t, \f, \b, \n, \r
  const commonLatexCommands = [
    "frac", "theta", "text", "times", "mathbf", "big", "Big", "bigg", "Bigg",
    "alpha", "beta", "gamma", "mu", "pi", "phi", "psi", "omega", "sigma", "delta", "lambda", "tau",
    "cdot", "approx", "le", "ge", "leq", "geq", "neq", "in", "notin", "subset",
    "sum", "prod", "sqrt", "partial", "iff", "implies", "to", "rightarrow", "leftarrow",
    "exp", "lim", "sin", "cos", "tan", "ln", "log", "min", "max", "operatorname",
    "quad", "qquad", "left", "right", "begin", "end", "matrix", "pmatrix", "bmatrix", "cases", "aligned",
    "oplus", "otimes", "nabla", "infty", "Delta", "Sigma", "Omega", "Phi", "Psi",
    "bar", "hat", "tilde", "vec", "dot", "ddot", "over", "underline", "pmod"
  ];

  const commandPattern = new RegExp(`(?<!\\\\)\\\\(${commonLatexCommands.join("|")})\\b`, "g");

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    // Skip single-line comments or imports
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("import ")) {
      return;
    }

    let match;
    while ((match = commandPattern.exec(line)) !== null) {
      errors.push({
        lineNum,
        command: match[1],
        match: match[0],
        snippet: line.trim()
      });
    }
  });

  return { totalLines: lines.length, errors };
}

// Standalone execution
if (process.argv[1]?.endsWith("verify-escapes.js")) {
  console.log("=== Mellangan Docs Source Escape Sequence Verifier ===");
  const { totalLines, errors } = verifyEscapes();
  if (errors.length > 0) {
    console.error(`FAILED: Found ${errors.length} unescaped LaTeX commands across ${totalLines} source lines:\n`);
    errors.forEach((e, idx) => {
      console.error(`[Escape Error #${idx + 1}] Line ${e.lineNum}: Single backslash '\\${e.command}' in template literal`);
      console.error(`  Line snippet: ${e.snippet}\n`);
    });
    console.error("In JavaScript template literals, LaTeX commands must be double-escaped (e.g. \\\\theta, \\\\frac).\n");
    process.exit(1);
  } else {
    console.log(`PASSED: All LaTeX commands in wikiContent.ts are correctly double-escaped across ${totalLines} lines.`);
  }
}

