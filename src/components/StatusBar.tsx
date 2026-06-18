import "./StatusBar.css";

interface StatusBarProps {
  charCount: number;
  lineCount: number;
  wordCount: number;
  filePath: string | null;
}

export default function StatusBar({ charCount, lineCount, wordCount, filePath }: StatusBarProps) {
  return (
    <div className="statusbar">
      <span className="sb-item sb-path">{filePath ?? "未命名"}</span>
      <div className="sb-right">
        <span className="sb-item">行数：{lineCount}</span>
        <span className="sb-item">字数：{wordCount}</span>
        <span className="sb-item">字符：{charCount}</span>
        <span className="sb-item sb-badge">Markdown</span>
      </div>
    </div>
  );
}
