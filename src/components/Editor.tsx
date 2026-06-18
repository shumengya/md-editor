import { useEffect, useRef } from "react";
import {
  EditorView, keymap, lineNumbers,
  highlightActiveLine, highlightActiveLineGutter, drawSelection,
} from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from "@codemirror/language";
import { searchKeymap } from "@codemirror/search";
import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { useTheme } from "../context/ThemeContext";
import "./Editor.css";

interface EditorProps {
  content: string;
  onChange: (value: string) => void;
}

const UI_FONT = "var(--font-ui)";
const CODE_FONT = "var(--font-code)";

const darkTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      fontSize: "15px",
      fontFamily: UI_FONT,
      background: "#1e1e1e",
      color: "#d4d4d4",
    },
    ".cm-scroller": { overflow: "auto", lineHeight: "1.8", fontFamily: UI_FONT },
    ".cm-content": { padding: "16px", caretColor: "#aeafad", minHeight: "100%", fontFamily: UI_FONT },
    ".cm-line": { fontFamily: UI_FONT, padding: "0 4px" },
    ".cm-cursor": { borderLeftColor: "#aeafad" },
    ".cm-gutters": {
      background: "#1e1e1e",
      color: "#6e6e6e",
      border: "none",
      borderRight: "1px solid #3e3e42",
      paddingRight: "8px",
      fontFamily: CODE_FONT,
      fontSize: "13px",
    },
    ".cm-activeLineGutter": { background: "#2a2d2e", color: "#d4d4d4" },
    ".cm-activeLine": { background: "#2a2d2e" },
    ".cm-selectionBackground, ::selection": { background: "#264f78 !important" },
    ".cm-focused .cm-selectionBackground": { background: "#264f78" },
    ".cm-matchingBracket": { background: "#3b514d", outline: "1px solid #888" },
    "&.cm-focused": { outline: "none" },
    // 代码块内用等宽字体
    ".ͼ1 .tok-monospace, .cm-content code": { fontFamily: CODE_FONT },
  },
  { dark: true }
);

const lightTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      fontSize: "15px",
      fontFamily: UI_FONT,
      background: "#ffffff",
      color: "#1f1f1f",
    },
    ".cm-scroller": { overflow: "auto", lineHeight: "1.8", fontFamily: UI_FONT },
    ".cm-content": { padding: "16px", caretColor: "#333", minHeight: "100%", fontFamily: UI_FONT },
    ".cm-line": { fontFamily: UI_FONT, padding: "0 4px" },
    ".cm-cursor": { borderLeftColor: "#333" },
    ".cm-gutters": {
      background: "#f8f8f8",
      color: "#aaaaaa",
      border: "none",
      borderRight: "1px solid #e0e0e0",
      paddingRight: "8px",
      fontFamily: CODE_FONT,
      fontSize: "13px",
    },
    ".cm-activeLineGutter": { background: "#eff1f7", color: "#333" },
    ".cm-activeLine": { background: "#eff1f7" },
    ".cm-selectionBackground, ::selection": { background: "#b5d5fb !important" },
    ".cm-focused .cm-selectionBackground": { background: "#b5d5fb" },
    ".cm-matchingBracket": { background: "#d8f0d8", outline: "1px solid #aaa" },
    "&.cm-focused": { outline: "none" },
    ".ͼ1 .tok-monospace, .cm-content code": { fontFamily: CODE_FONT },
  },
  { dark: false }
);

const themeCompartment = new Compartment();

export default function Editor({ content, onChange }: EditorProps) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const view = new EditorView({
      state: EditorState.create({
        doc: content,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          drawSelection(),
          bracketMatching(),
          history(),
          autocompletion(),
          markdown({ base: markdownLanguage, codeLanguages: languages }),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          keymap.of([
            ...defaultKeymap,
            ...historyKeymap,
            ...searchKeymap,
            ...completionKeymap,
            indentWithTab,
          ]),
          themeCompartment.of(darkTheme),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChange(update.state.doc.toString());
          }),
          EditorView.lineWrapping,
        ],
      }),
      parent: containerRef.current,
    });

    viewRef.current = view;
    return () => { view.destroy(); };
  }, []);

  // 动态切换编辑器主题
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: themeCompartment.reconfigure(theme === "dark" ? darkTheme : lightTheme),
    });
  }, [theme]);

  // 同步外部内容（打开文件等）
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (currentDoc !== content) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: content },
      });
    }
  }, [content]);

  return (
    <div className="editor-wrapper">
      <div ref={containerRef} className="editor-container" />
    </div>
  );
}
