import katex from "katex";
import { highlightCodeToHtml, escapeHtml } from "./highlightCode";

function slugify(raw: string): string {
  return raw
    .replace(/`/g, "")
    .replace(/\$/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

interface PageHeading {
  level: 3 | 4;
  text: string;
  slug: string;
}

export function extractHeadings(markdown: string): PageHeading[] {
  const out: PageHeading[] = [];
  const lines = markdown.split("\n");
  for (const line of lines) {
    if (line.startsWith("### ")) {
      const text = line.slice(4).trim().replace(/`/g, "").replace(/\$/g, "");
      out.push({ level: 3, text, slug: slugify(text) });
    } else if (line.startsWith("#### ")) {
      const text = line.slice(5).trim().replace(/`/g, "").replace(/\$/g, "");
      out.push({ level: 4, text, slug: slugify(text) });
    }
  }
  return out;
}

function formatInlineMarkdown(text: string): string {
  const inlineCodes: string[] = [];
  const textWithoutCodes = text.replace(/`([^`\n]+)`/g, (_m, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(
      `<code class="px-1.5 py-0.5 rounded-md bg-dark-900/95 text-gold-300 border border-dark-750 text-[12.5px] font-mono">${escapeHtml(code)}</code>`,
    );
    return `@@INLINE_CODE_${idx}@@`;
  });

  const withMath = textWithoutCodes.replace(/\$([^\$\n]+?)\$/g, (_m, tex) => {
    try {
      return katex.renderToString(tex.trim(), {
        displayMode: false,
        throwOnError: false,
      });
    } catch {
      return `<code class="text-rose-400 font-mono">${escapeHtml(tex)}</code>`;
    }
  });

  const formatted = withMath
    .replace(
      /\*\*(.*?)\*\*/g,
      '<strong class="text-slate-100 font-semibold">$1</strong>',
    )
    .replace(/\*(.*?)\*/g, '<em class="text-slate-200 italic">$1</em>');

  return formatted.replace(/@@INLINE_CODE_(\d+)@@/g, (_m, idx) => {
    return inlineCodes[Number(idx)];
  });
}

export function renderMarkdownToHtml(markdown: string): string {
  const codeBlocks: string[] = [];
  const withPlaceholders = markdown.replace(
    /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g,
    (_m, lang, code) => {
      const cleanCode = code.trimEnd();
      const highlighted = highlightCodeToHtml(cleanCode, lang || "cpp", true);
      const encodedRaw = encodeURIComponent(cleanCode);
      const label =
        lang === "cpp" || !lang
          ? "C++20"
          : lang === "c"
            ? "C11"
            : lang === "slang" || lang === "glsl"
              ? "SLANG / SPIR-V"
              : lang === "ini"
                ? "INI CONFIG"
                : lang === "bash" || lang === "sh" || lang === "shell"
                  ? "SHELL / CLI"
                  : lang.toUpperCase();
      const html = `<div class="my-5 rounded-xl overflow-hidden border border-dark-750 bg-[#0a0811] shadow-lg"><div class="px-3.5 py-2 bg-dark-950/90 border-b border-dark-800 flex items-center justify-between text-[11px] font-mono text-slate-400"><div class="flex items-center gap-2"><span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-gold-400/80"></span><span class="font-semibold text-gold-300 uppercase tracking-wider">${label}</span></span><span class="text-slate-600">•</span><span class="text-slate-500">Mellangan Source</span></div><button type="button" data-copy-code="${encodedRaw}" class="px-2 py-0.5 rounded bg-dark-850 hover:bg-dark-800 border border-dark-700 hover:border-gold-500/40 text-[10px] font-mono text-slate-300 hover:text-gold-300 transition-colors">Copy Code</button></div><pre class="py-3.5 px-2 overflow-x-auto text-[13px] font-mono text-slate-200 leading-[1.68]">${highlighted}</pre></div>`;
      const idx = codeBlocks.length;
      codeBlocks.push(html);
      return `\n\n@@CODE_BLOCK_${idx}@@\n\n`;
    },
  );

  const mathBlocks: string[] = [];
  const withMathBlocks = withPlaceholders.replace(
    /\$\$([\s\S]*?)\$\$/g,
    (_m, tex) => {
      let rendered = "";
      try {
        rendered = katex.renderToString(tex.trim(), {
          displayMode: true,
          throwOnError: false,
        });
      } catch {
        rendered = `<code class="text-rose-400 font-mono">${escapeHtml(tex.trim())}</code>`;
      }
      const html = `<div class="my-5 overflow-x-auto py-3 text-center text-slate-100 flex justify-center bg-dark-900/40 rounded-lg border border-dark-800/60 shadow-inner px-4">${rendered}</div>`;
      const idx = mathBlocks.length;
      mathBlocks.push(html);
      return `\n\n@@MATH_BLOCK_${idx}@@\n\n`;
    },
  );

  const lines = withMathBlocks.split("\n");
  const out: string[] = [];
  let inUl = false;
  let inOl = false;
  let paragraphBuf: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuf.length > 0) {
      const joined = formatInlineMarkdown(paragraphBuf.join(" "));
      out.push(`<p>${joined}</p>`);
      paragraphBuf = [];
    }
  };

  const closeLists = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      out.push("</ol>");
      inOl = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      closeLists();
      continue;
    }

    const codeMatch = line.match(/^@@CODE_BLOCK_(\d+)@@$/);
    if (codeMatch) {
      flushParagraph();
      closeLists();
      out.push(codeBlocks[Number(codeMatch[1])]);
      continue;
    }

    const mathMatch = line.match(/^@@MATH_BLOCK_(\d+)@@$/);
    if (mathMatch) {
      flushParagraph();
      const mathHtml = mathBlocks[Number(mathMatch[1])];
      if ((inUl || inOl) && out.length > 0 && out[out.length - 1].endsWith("</li>")) {
        out[out.length - 1] = out[out.length - 1].slice(0, -5) + mathHtml + "</li>";
      } else {
        closeLists();
        out.push(mathHtml);
      }
      continue;
    }

    if (line === "---") {
      flushParagraph();
      closeLists();
      out.push('<hr class="border-dark-800/90 my-7" />');
      continue;
    }

    if (line.startsWith("##### ")) {
      flushParagraph();
      closeLists();
      const h = line.slice(6).trim();
      out.push(
        `<h5 id="${slugify(h)}" class="scroll-mt-20 text-sm font-bold text-emerald-400 mt-6 mb-2 font-mono">${formatInlineMarkdown(h)}</h5>`,
      );
      continue;
    }

    if (line.startsWith("#### ")) {
      flushParagraph();
      closeLists();
      const h = line.slice(5).trim();
      const slug = slugify(h);
      out.push(
        `<h4 id="${slug}" class="group scroll-mt-20 text-[17px] font-bold text-gold-400 mt-7 mb-2.5 leading-snug flex items-center gap-2"><a href="#${slug}" class="hover:underline">${formatInlineMarkdown(h)}</a><a href="#${slug}" class="opacity-0 group-hover:opacity-100 text-xs font-mono text-slate-500 hover:text-gold-300 transition-opacity" title="Permalink to section">#</a></h4>`,
      );
      continue;
    }

    if (line.startsWith("### ")) {
      flushParagraph();
      closeLists();
      const h = line.slice(4).trim();
      const slug = slugify(h);
      out.push(
        `<h3 id="${slug}" class="group scroll-mt-20 text-xl sm:text-[22px] font-bold text-slate-100 mt-9 mb-3.5 font-display border-b border-dark-800 pb-2 leading-snug flex items-center justify-between gap-2"><a href="#${slug}" class="hover:text-gold-300 transition-colors">${formatInlineMarkdown(h)}</a><a href="#${slug}" class="opacity-0 group-hover:opacity-100 text-sm font-mono text-slate-500 hover:text-gold-300 transition-opacity shrink-0" title="Permalink to section">#</a></h3>`,
      );
      continue;
    }

    const ulMatch = rawLine.match(/^\s*-\s+(.*)$/);
    if (ulMatch) {
      flushParagraph();
      if (inOl) {
        out.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        out.push("<ul>");
        inUl = true;
      }
      out.push(`<li>${formatInlineMarkdown(ulMatch[1].trim())}</li>`);
      continue;
    }

    const olMatch = rawLine.match(/^\s*(\d+)\.\s+(.*)$/);
    if (olMatch) {
      flushParagraph();
      if (inUl) {
        out.push("</ul>");
        inUl = false;
      }
      if (!inOl) {
        const startNum = parseInt(olMatch[1], 10);
        out.push(startNum > 1 ? `<ol start="${startNum}">` : "<ol>");
        inOl = true;
      }
      out.push(`<li>${formatInlineMarkdown(olMatch[2].trim())}</li>`);
      continue;
    }

    // Continuation line inside an active list item
    if ((inUl || inOl) && rawLine.startsWith("   ") && out.length > 0) {
      const prev = out[out.length - 1];
      if (prev.endsWith("</li>")) {
        out[out.length - 1] =
          prev.slice(0, -5) + " " + formatInlineMarkdown(line) + "</li>";
        continue;
      }
    }

    closeLists();
    paragraphBuf.push(line);
  }

  flushParagraph();
  closeLists();
  return out.join("\n");
}

