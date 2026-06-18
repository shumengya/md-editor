import { useState, useCallback, useRef, useEffect } from "react";
import { open, save, ask } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { readTextFile as pluginReadFile, watch } from "@tauri-apps/plugin-fs";
import { getCurrentWindow } from "@tauri-apps/api/window";

const readTextFile = (path: string): Promise<string> =>
  path.startsWith("content://")
    ? pluginReadFile(path)
    : invoke<string>("read_text_file", { path });

const writeTextFile = (path: string, content: string) => invoke<void>("write_text_file", { path, content });

const LAST_FILE_KEY = "md-editor-last-file";

export interface FileState {
  path: string | null;
  content: string;
  saved: boolean;
  name: string;
}

const DEFAULT_CONTENT = `# 欢迎使用 MD 编辑器

一款轻量级 Markdown 编辑器，支持 GitHub 风格预览。

## 功能特性

- **分屏视图** — 左侧编辑，右侧实时预览
- **GitHub 风格** Markdown 渲染，思源宋体排版
- **代码高亮** 支持多种编程语言
- **明暗模式** 点击右上角 ⋮ 切换主题
- **文件操作** — 打开、保存、另存为

## 快捷键

| 操作 | 快捷键 |
|------|--------|
| 新建文件 | \`Ctrl+N\` |
| 打开文件 | \`Ctrl+O\` |
| 保存 | \`Ctrl+S\` |
| 另存为 | \`Ctrl+Shift+S\` |
| 切换预览 | \`Ctrl+P\` |

## 代码示例

\`\`\`typescript
function greet(name: string): string {
  return \`你好，\${name}！\`;
}

console.log(greet("世界"));
\`\`\`

> 开始编辑此文档，或打开一个 \`.md\` 文件以开始使用。
`;

export function useFile() {
  const [fileState, setFileState] = useState<FileState>({
    path: null,
    content: DEFAULT_CONTENT,
    saved: true,
    name: "未命名.md",
  });

  // Refs to avoid stale closures in watcher callback
  const fileStateRef = useRef(fileState);
  const unwatchRef = useRef<(() => void) | null>(null);
  // Suppress watcher events triggered by the app's own save
  const isSavingRef = useRef(false);

  useEffect(() => {
    fileStateRef.current = fileState;
  }, [fileState]);

  // Cleanup watcher on unmount
  useEffect(() => {
    return () => { unwatchRef.current?.(); };
  }, []);

  const updateTitle = useCallback(async (name: string, saved: boolean) => {
    const appWindow = getCurrentWindow();
    await appWindow.setTitle(`${saved ? "" : "● "}${name} — MD 编辑器`);
  }, []);

  const startWatcher = useCallback(async (path: string) => {
    if (path.startsWith("content://")) return;

    unwatchRef.current?.();
    unwatchRef.current = null;

    try {
      const unwatch = await watch(
        path,
        async () => {
          if (isSavingRef.current) return;

          const current = fileStateRef.current;
          if (!current.path) return;

          try {
            const newContent = await readTextFile(current.path);

            if (current.saved) {
              setFileState((prev) => ({ ...prev, content: newContent, saved: true }));
            } else {
              const reload = await ask(
                "文件已在外部被修改，是否重新加载？\n当前未保存的更改将会丢失。",
                { title: "文件已更改", kind: "warning" }
              );
              if (reload) {
                const name = current.path.split(/[\\/]/).pop() ?? "未命名.md";
                setFileState((prev) => ({ ...prev, content: newContent, saved: true, name }));
                await updateTitle(name, true);
              }
            }
          } catch (e) {
            console.error("重新加载文件失败:", e);
          }
        },
        { delayMs: 300 }
      );
      unwatchRef.current = unwatch;
    } catch (e) {
      console.error("文件监听启动失败:", e);
    }
  }, [updateTitle]);

  const setContent = useCallback(
    (content: string) => {
      setFileState((prev) => {
        const newSaved = content === prev.content ? prev.saved : false;
        if (!newSaved && prev.saved) updateTitle(prev.name, false);
        return { ...prev, content, saved: newSaved };
      });
    },
    [updateTitle]
  );

  const newFile = useCallback(() => {
    unwatchRef.current?.();
    unwatchRef.current = null;
    setFileState({ path: null, content: "", saved: true, name: "未命名.md" });
    updateTitle("未命名.md", true);
  }, [updateTitle]);

  const openFile = useCallback(
    async (filePath?: string) => {
      try {
        let path = filePath;
        if (!path) {
          const selected = await open({
            filters: [{ name: "Markdown 文件", extensions: ["md", "markdown", "txt"] }],
            multiple: false,
          });
          if (!selected) return;
          path = selected as string;
        }
        const content = await readTextFile(path);
        const name = path.split(/[\\/]/).pop() ?? "未命名.md";
        setFileState({ path, content, saved: true, name });
        await updateTitle(name, true);
        localStorage.setItem(LAST_FILE_KEY, path);
        await startWatcher(path);
      } catch (e) {
        console.error("打开文件失败:", e);
        if (filePath) localStorage.removeItem(LAST_FILE_KEY);
      }
    },
    [updateTitle, startWatcher]
  );

  const saveFile = useCallback(async () => {
    try {
      let path = fileState.path;
      if (!path) {
        const selected = await save({
          filters: [{ name: "Markdown 文件", extensions: ["md", "markdown"] }],
          defaultPath: fileState.name,
        });
        if (!selected) return;
        path = selected;
      }
      isSavingRef.current = true;
      await writeTextFile(path, fileState.content);
      // Give the watcher time to fire and be suppressed before clearing the flag
      setTimeout(() => { isSavingRef.current = false; }, 500);

      const name = path.split(/[\\/]/).pop() ?? "未命名.md";
      setFileState((prev) => ({ ...prev, path, saved: true, name }));
      await updateTitle(name, true);
      localStorage.setItem(LAST_FILE_KEY, path);

      // Watch the new path if saving for the first time
      if (path !== fileStateRef.current.path) {
        await startWatcher(path);
      }
    } catch (e) {
      console.error("保存文件失败:", e);
      isSavingRef.current = false;
    }
  }, [fileState, updateTitle, startWatcher]);

  const saveFileAs = useCallback(async () => {
    try {
      const selected = await save({
        filters: [{ name: "Markdown 文件", extensions: ["md", "markdown"] }],
        defaultPath: fileState.name,
      });
      if (!selected) return;
      isSavingRef.current = true;
      await writeTextFile(selected, fileState.content);
      setTimeout(() => { isSavingRef.current = false; }, 500);

      const name = selected.split(/[\\/]/).pop() ?? "未命名.md";
      setFileState((prev) => ({ ...prev, path: selected, saved: true, name }));
      await updateTitle(name, true);
      localStorage.setItem(LAST_FILE_KEY, selected);
      await startWatcher(selected);
    } catch (e) {
      console.error("另存为失败:", e);
      isSavingRef.current = false;
    }
  }, [fileState, updateTitle, startWatcher]);

  return { fileState, setContent, newFile, openFile, saveFile, saveFileAs };
}
