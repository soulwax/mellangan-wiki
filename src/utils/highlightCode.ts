export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const CPP_KEYWORDS = new Set([
  "alignas",
  "alignof",
  "and",
  "and_eq",
  "asm",
  "auto",
  "bitand",
  "bitor",
  "break",
  "case",
  "catch",
  "class",
  "co_await",
  "co_return",
  "co_yield",
  "compl",
  "concept",
  "const",
  "consteval",
  "constexpr",
  "constinit",
  "const_cast",
  "continue",
  "decltype",
  "default",
  "delete",
  "do",
  "dynamic_cast",
  "else",
  "enum",
  "explicit",
  "export",
  "extern",
  "false",
  "final",
  "for",
  "friend",
  "goto",
  "if",
  "inline",
  "mutable",
  "namespace",
  "new",
  "noexcept",
  "not",
  "not_eq",
  "nullptr",
  "operator",
  "or",
  "or_eq",
  "override",
  "private",
  "protected",
  "public",
  "register",
  "reinterpret_cast",
  "requires",
  "return",
  "sizeof",
  "static",
  "static_assert",
  "static_cast",
  "struct",
  "switch",
  "template",
  "this",
  "thread_local",
  "throw",
  "true",
  "try",
  "typedef",
  "typeid",
  "typename",
  "union",
  "using",
  "virtual",
  "volatile",
  "while",
  "xor",
  "xor_eq",
  // Slang / GLSL shader keywords
  "uniform",
  "varying",
  "in",
  "out",
  "inout",
  "layout",
  "binding",
  "set",
  "push_constant",
  "cbuffer",
  " row_major",
]);

const CPP_TYPES = new Set([
  "void",
  "bool",
  "char",
  "char8_t",
  "char16_t",
  "char32_t",
  "wchar_t",
  "short",
  "int",
  "long",
  "signed",
  "unsigned",
  "float",
  "double",
  "size_t",
  "ssize_t",
  "ptrdiff_t",
  "intptr_t",
  "uintptr_t",
  "int8_t",
  "int16_t",
  "int32_t",
  "int64_t",
  "uint8_t",
  "uint16_t",
  "uint32_t",
  "uint64_t",
  "string",
  "string_view",
  "vector",
  "array",
  "deque",
  "map",
  "unordered_map",
  "set",
  "unordered_set",
  "pair",
  "tuple",
  "optional",
  "unique_ptr",
  "shared_ptr",
  "weak_ptr",
  "function",
  "span",
  "atomic",
  "mutex",
  "lock_guard",
  "condition_variable",
  "thread",
  "jthread",
  // Shader vector/matrix types
  "vec2",
  "vec3",
  "vec4",
  "ivec2",
  "ivec3",
  "ivec4",
  "uvec2",
  "uvec3",
  "uvec4",
  "mat2",
  "mat3",
  "mat4",
  "float2",
  "float3",
  "float4",
  "float4x4",
  "int2",
  "int3",
  "int4",
  "uint",
  "uint2",
  "uint3",
  "uint4",
  "Texture2D",
  "SamplerState",
]);

const CPP_NAMESPACES = new Set([
  "std",
  "entt",
  "spdlog",
  "fmt",
  "world",
  "atlas",
  "col",
  "gui",
  "pay",
  "ouroboros",
]);

/**
 * Single-pass tokenizer that highlights C++20, C11, Slang/GLSL, INI, and shell snippets
 * into safe HTML spans with line numbers.
 */
export function highlightCodeToHtml(
  code: string,
  lang: string = "cpp",
  showLineNumbers: boolean = true,
): string {
  const normalizedLang = (lang || "cpp").toLowerCase();
  const lines = code.trimEnd().split("\n");

  const highlightedLines = lines.map((line) => {
    if (normalizedLang === "ini") {
      return highlightIniLine(line);
    }
    if (
      normalizedLang === "bash" ||
      normalizedLang === "sh" ||
      normalizedLang === "shell" ||
      normalizedLang === "powershell"
    ) {
      return highlightShellLine(line);
    }
    return highlightCppLine(line);
  });

  if (!showLineNumbers) {
    return highlightedLines.join("\n");
  }

  return highlightedLines
    .map(
      (htmlLine, idx) =>
        `<span class="code-line"><span class="code-ln">${idx + 1}</span><span class="code-content">${htmlLine || " "}</span></span>`,
    )
    .join("\n");
}

function highlightIniLine(line: string): string {
  const trimmed = line.trim();
  if (trimmed.startsWith("#") || trimmed.startsWith(";")) {
    return `<span class="tok-comment">${escapeHtml(line)}</span>`;
  }
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return `<span class="tok-preproc">${escapeHtml(line)}</span>`;
  }
  const eqIdx = line.indexOf("=");
  if (eqIdx > 0) {
    const key = escapeHtml(line.slice(0, eqIdx));
    const val = highlightCppLine(line.slice(eqIdx + 1));
    return `<span class="tok-type">${key}</span><span class="tok-op">=</span>${val}`;
  }
  return escapeHtml(line);
}

function highlightShellLine(line: string): string {
  const trimmed = line.trim();
  if (trimmed.startsWith("#")) {
    return `<span class="tok-comment">${escapeHtml(line)}</span>`;
  }
  const tokenRegex =
    /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(--?[a-zA-Z0-9_-]+)|\b(cmake|ninja|ctest|git|npm|vercel|cd|mkdir|build|Mellangan|BiomeViewer)\b|\b(\d+(?:\.\d+)?)\b/g;

  let lastIndex = 0;
  let out = "";
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      out += escapeHtml(line.slice(lastIndex, match.index));
    }
    const [full, strTok, flagTok, cmdTok, numTok] = match;
    if (strTok !== undefined) {
      out += `<span class="tok-string">${escapeHtml(full)}</span>`;
    } else if (flagTok !== undefined) {
      out += `<span class="tok-preproc">${escapeHtml(full)}</span>`;
    } else if (cmdTok !== undefined) {
      out += `<span class="tok-fn">${escapeHtml(full)}</span>`;
    } else if (numTok !== undefined) {
      out += `<span class="tok-number">${escapeHtml(full)}</span>`;
    } else {
      out += escapeHtml(full);
    }
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < line.length) {
    out += escapeHtml(line.slice(lastIndex));
  }
  return out;
}

function highlightCppLine(line: string): string {
  // Check for full-line preprocessor directive (#include, #pragma, #define, etc.)
  const preprocMatch = line.match(
    /^(\s*)(#[a-zA-Z_][a-zA-Z0-9_]*)(\s+<[^>]+>|\s+"[^"]+")?(.*)$/,
  );
  if (preprocMatch) {
    const [, indent, directive, header, rest] = preprocMatch;
    return (
      escapeHtml(indent) +
      `<span class="tok-preproc">${escapeHtml(directive)}</span>` +
      (header ? `<span class="tok-string">${escapeHtml(header)}</span>` : "") +
      (rest ? highlightCppTokens(rest) : "")
    );
  }

  return highlightCppTokens(line);
}

function highlightCppTokens(text: string): string {
  // Single-pass master regex for C++20 tokens:
  // 1. Line or inline block comment: //.* or /\*[\s\S]*?\*/
  // 2. String or char literal: "(?:\\.|[^"\\])*" or '(?:\\.|[^'\\])*'
  // 3. Hex / float / integer literal with suffixes (0x7FEB352Du, 0.75f, 1e-4, etc.)
  // 4. Identifiers: [a-zA-Z_][a-zA-Z0-9_]*
  // 5. Multi-character operators / scope: ::|->|<<|>>|<=|>=|==|!=|&&|\|\||\+=|-=|\*=|/=
  const tokenRegex =
    /(\/\/.*$|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\b(0[xX][0-9a-fA-F]+[uUlL]*|0[bB][01]+[uUlL]*|\d+\.\d*(?:[eE][+-]?\d+)?[fFlL]*|\.\d+(?:[eE][+-]?\d+)?[fFlL]*|\d+(?:[eE][+-]?\d+)[fFlL]*|\d+[uUlLfF]*)\b|\b([a-zA-Z_][a-zA-Z0-9_]*)\b|(::|->|<<|>>|<=|>=|==|!=|&&|\|\||\+=|-=|\*=|\/=)/g;

  let lastIndex = 0;
  let out = "";
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      out += escapeHtml(text.slice(lastIndex, match.index));
    }

    const [full, commentTok, strTok, numTok, identTok, opTok] = match;

    if (commentTok !== undefined) {
      out += `<span class="tok-comment">${escapeHtml(full)}</span>`;
    } else if (strTok !== undefined) {
      out += `<span class="tok-string">${escapeHtml(full)}</span>`;
    } else if (numTok !== undefined) {
      out += `<span class="tok-number">${escapeHtml(full)}</span>`;
    } else if (identTok !== undefined) {
      const afterIdx = tokenRegex.lastIndex;
      const nextChars = text.slice(afterIdx);

      if (CPP_KEYWORDS.has(identTok)) {
        out += `<span class="tok-keyword">${escapeHtml(identTok)}</span>`;
      } else if (CPP_TYPES.has(identTok)) {
        out += `<span class="tok-type">${escapeHtml(identTok)}</span>`;
      } else if (
        CPP_NAMESPACES.has(identTok) &&
        nextChars.startsWith("::")
      ) {
        out += `<span class="tok-namespace">${escapeHtml(identTok)}</span>`;
      } else if (/^[A-Z][A-Z0-9_]{2,}$/.test(identTok)) {
        // Constant / macro identifier like DT, PI, TAU, LEASH, SIGHT, HOME, BIOME_COUNT
        out += `<span class="tok-const">${escapeHtml(identTok)}</span>`;
      } else if (/^[A-Z][a-zA-Z0-9_]*$/.test(identTok)) {
        // PascalCase class / struct / enum name (Player, Enemy, Ally, Level, StatusKind, etc.)
        out += `<span class="tok-type">${escapeHtml(identTok)}</span>`;
      } else if (/^\s*\(/.test(nextChars)) {
        // Function or method call / declaration
        out += `<span class="tok-fn">${escapeHtml(identTok)}</span>`;
      } else {
        out += escapeHtml(identTok);
      }
    } else if (opTok !== undefined) {
      out += `<span class="tok-op">${escapeHtml(opTok)}</span>`;
    } else {
      out += escapeHtml(full);
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    out += escapeHtml(text.slice(lastIndex));
  }

  return out;
}

