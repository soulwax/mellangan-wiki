import { useMemo, type MouseEvent } from "react";
import { renderMarkdownToHtml } from "../utils/markdown";

interface ChapterArticleProps {
  content: string;
  proseFont: "sans" | "serif";
  onAnchor: (slug: string, event: MouseEvent<HTMLElement>) => void;
}

export function ChapterArticle({ content, proseFont, onAnchor }: ChapterArticleProps) {
  const formattedHtml = useMemo(() => renderMarkdownToHtml(content), [content]);
  return (
            <article
              className={`wiki-prose ${proseFont === "serif" ? "prose-serif" : ""}`}
              onClick={(e) => {
                const copyBtn = (e.target as HTMLElement).closest(
                  "[data-copy-code]",
                ) as HTMLButtonElement | null;
                if (copyBtn) {
                  const raw = decodeURIComponent(
                    copyBtn.getAttribute("data-copy-code") || "",
                  );
                  if (raw) {
                    navigator.clipboard?.writeText(raw);
                    const prevText = copyBtn.textContent;
                    copyBtn.textContent = "Copied!";
                    copyBtn.classList.add("text-emerald-300");
                    window.setTimeout(() => {
                      copyBtn.textContent = prevText || "Copy Code";
                      copyBtn.classList.remove("text-emerald-300");
                    }, 1500);
                  }
                  return;
                }
                const target = (e.target as HTMLElement).closest("a");
                if (!target) return;
                const href = target.getAttribute("href") || "";
                if (href.startsWith("#") && href.length > 1) {
                  onAnchor(href.slice(1), e);
                }
              }}
              dangerouslySetInnerHTML={{ __html: formattedHtml }}
            />
  );
}
