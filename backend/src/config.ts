// E:\md2word-converter\backend\src\config.ts
import os from 'os';
import path from 'path';

// Windows 默认 pandoc 安装路径
const defaultPandocPath = path.join(
  os.homedir(),
  'AppData/Local/Microsoft/WinGet/Packages/JohnMacFarlane.Pandoc_Microsoft.Winget.Source_8wekyb3d8bbwe/pandoc-3.9.0.2/pandoc.exe'
);

export const config = {
  port: process.env.PORT || 3001,
  // Mermaid 渲染模式: 'local' (本地 Puppeteer) 或 'remote' (远程服务)
  mermaidRenderMode: process.env.MERMAID_RENDER_MODE || 'local',
  // 远程渲染服务地址（仅在 remote 模式下使用）
  mermaidRenderUrl: process.env.MERMAID_RENDER_URL || 'http://localhost:16611/render',
  tempDir: process.env.TEMP_DIR || path.join(os.tmpdir(), 'md2word'),
  pandocPath: process.env.PANDOC_PATH || defaultPandocPath,
};