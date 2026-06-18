import { useEffect, useRef, useMemo } from "react";
import { renderMarkdown } from "../lib/markdown";
import { useTheme } from "../context/ThemeContext";
import "github-markdown-css/github-markdown.css";
import "highlight.js/styles/github.css";
import "./Preview.css";

interface PreviewProps {
  content: string;
  syncScrollFrom?: number | null;
}

export default function Preview({ content, syncScrollFrom }: PreviewProps) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const html = useMemo(() => renderMarkdown(content), [content]);

  useEffect(() => {
    if (syncScrollFrom == null || !containerRef.current) return;
    const el = containerRef.current;
    el.scrollTop = syncScrollFrom * (el.scrollHeight - el.clientHeight);
  }, [syncScrollFrom]);

  return (
    <div className="preview-wrapper" ref={containerRef} data-theme={theme}>
      <div
        className="markdown-body preview-content"
        data-color-mode={theme}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
