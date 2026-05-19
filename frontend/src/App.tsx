// E:\md2word-converter\frontend\src\App.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import Editor from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { marked } from 'marked';
import axios from 'axios';
import mermaid from 'mermaid';
import { Edit, Columns, Eye, Coffee } from 'lucide-react';
import './App.css';
import 'highlight.js/styles/github-dark.css';
import { ConfigModal } from './components/ConfigModal';

type ViewMode = 'edit' | 'split' | 'preview';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

// 初始化 mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
});

// 配置 marked（highlight 已移除，由 CSS 样式处理代码块）

const DEFAULT_MARKDOWN = `# Markdown 转 Word 示例

欢迎使用 Markdown 转 Word 工具！

## 功能特性

- **实时预览** - 左侧编辑，右侧实时渲染
- **一键下载** - 点击右上角按钮下载 Word 文档
- **完整支持** - 表格、代码块、数学公式、Mermaid 流程图

## 代码示例

\`\`\`python
def hello_world():
    print("Hello, World!")
\`\`\`

## 表格示例

| 功能 | 状态 |
|------|------|
| 基础转换 | ✅ |
| Mermaid | ✅ |
| 数学公式 | ✅ |

## Mermaid 流程图

\`\`\`mermaid
graph LR
    A[开始] --> B[处理]
    B --> C[结束]
\`\`\`

## 复杂流程图

\`\`\`mermaid
graph TB
    subgraph 输入层
        A[数据接入] --> B[数据预处理]
    end
    subgraph 处理层
        B --> C{类型判断}
        C --> D[文本处理]
        C --> E[图像处理]
    end
    D --> F[输出结果]
    E --> F
\`\`\`

## 数学公式

行内公式：$E = mc^2$

块级公式：

$$
\\sum_{i=1}^{n} x_i = x_1 + x_2 + \\cdots + x_n
$$
`;

// HTML 转义函数
const escapeHtml = (text: string): string => {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
};

// 从 Markdown 提取标题作为文件名
const extractTitle = (md: string): string => {
  // 匹配第一个 # 标题（支持 # 到 ######）
  const titleMatch = md.match(/^#{1,6}\s+(.+)$/m);
  if (titleMatch) {
    let title = titleMatch[1].trim();
    // 移除 Markdown 格式符号（如 **粗体**、*斜体*、`代码`、[链接]等）
    title = title.replace(/\*\*([^*]+)\*\*/g, '$1');
    title = title.replace(/\*([^*]+)\*/g, '$1');
    title = title.replace(/`([^`]+)`/g, '$1');
    title = title.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    // 移除 Windows 文件名不允许的特殊字符：/ \ : * ? " < > |
    // 以及其他可能造成问题的字符
    title = title.replace(/[\/\\:*?"<>|]/g, '');
    // 移除连续空格，替换为单个空格
    title = title.replace(/\s+/g, ' ').trim();
    // 限制文件名长度（Windows 限制 255，这里保守一点）
    if (title.length > 50) {
      title = title.substring(0, 50);
    }
    return title || '';
  }
  return '';
};

// 生成时间格式文件名
const generateTimeFilename = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  return `文档_${year}${month}${day}_${hour}${minute}${second}`;
};

function App() {
  const [markdown, setMarkdown] = useState(DEFAULT_MARKDOWN);
  const [isConverting, setIsConverting] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [mermaidRenderUrl, setMermaidRenderUrl] = useState('');
  const [mermaidRenderMode, setMermaidRenderMode] = useState('local');
  const [isDragging, setIsDragging] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const previewRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const isSyncingRef = useRef(false);
  const mermaidRenderedRef = useRef<string>(''); // 用于跟踪已渲染的内容

  // 获取配置
  useEffect(() => {
    axios.get(`${API_BASE}/config`).then((res) => {
      setMermaidRenderUrl(res.data.mermaidRenderUrl);
      setMermaidRenderMode(res.data.mermaidRenderMode || 'local');
    }).catch(console.error);
  }, []);

  // 渲染 Mermaid 图表
  const renderMermaidDiagrams = useCallback(async (container: HTMLDivElement) => {
    const mermaidElements = container.querySelectorAll('code.language-mermaid');

    for (let i = 0; i < mermaidElements.length; i++) {
      const element = mermaidElements[i] as HTMLElement;

      // 跳过已渲染的元素
      if (element.closest('.mermaid-diagram')) continue;

      const code = element.textContent || '';
      const codeLines = code.split('\n');

      try {
        const id = `mermaid-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, code);

        // 清理 Mermaid 可能创建的临时元素
        const tempElement = document.getElementById(`d${id}`);
        if (tempElement) tempElement.remove();

        // 创建容器并替换
        const diagramContainer = document.createElement('div');
        diagramContainer.className = 'mermaid-diagram';
        diagramContainer.innerHTML = svg;
        element.parentElement?.replaceWith(diagramContainer);
      } catch (error: unknown) {
        console.error('Mermaid render error:', error);

        // 清理 Mermaid 创建的临时错误元素
        const tempElements = document.querySelectorAll('[id^="mermaid-"]');
        tempElements.forEach(el => el.remove());
        const dElements = document.querySelectorAll('[id^="dmermaid-"]');
        dElements.forEach(el => el.remove());

        // 解析错误信息
        let errorMessage = '未知错误';
        let errorLine: number | null = null;
        let errorDetails = '';

        if (error instanceof Error) {
          errorMessage = error.message;

          // 尝试从错误消息中提取行号
          const lineMatch = errorMessage.match(/line\s*(\d+)/i) ||
                           errorMessage.match(/at line (\d+)/i) ||
                           errorMessage.match(/row (\d+)/i);
          if (lineMatch) {
            errorLine = parseInt(lineMatch[1], 10);
          }

          // 提取更详细的错误信息
          const syntaxMatch = errorMessage.match(/Expecting\s*['"]([^'"]+)['"]/i);
          if (syntaxMatch) {
            errorDetails = `期望: ${syntaxMatch[1]}`;
          }
        }

        // 构建友好的错误提示
        const errorHtml = `
          <div class="mermaid-error">
            <div class="mermaid-error-header">
              <span class="error-icon">⚠️</span>
              <span class="error-title">Mermaid 语法错误</span>
              <span class="error-block-index">#${i + 1} 个图表</span>
            </div>
            <div class="mermaid-error-message">${errorMessage}</div>
            ${errorDetails ? `<div class="mermaid-error-hint">💡 ${errorDetails}</div>` : ''}
            ${errorLine !== null && errorLine > 0 ? `
              <div class="mermaid-error-line">
                <span class="line-label">📍 错误位置: 第 ${errorLine} 行</span>
              </div>
            ` : ''}
            <div class="mermaid-error-code">
              <div class="code-header">原始代码:</div>
              <pre>${codeLines.map((line, idx) => {
                const lineNum = idx + 1;
                const isHighlight = errorLine === lineNum;
                return `<div class="${isHighlight ? 'highlight-line' : ''}">${String(lineNum).padStart(2, ' ')} | ${escapeHtml(line)}</div>`;
              }).join('')}</pre>
            </div>
            <div class="mermaid-error-help">
              <a href="https://mermaid.js.org/intro/" target="_blank" rel="noopener">📖 Mermaid 语法文档</a>
            </div>
          </div>
        `;

        const errorContainer = document.createElement('div');
        errorContainer.innerHTML = errorHtml;
        element.parentElement?.replaceWith(errorContainer.firstElementChild || errorContainer);
      }
    }
  }, []);

  // 编辑器滚动同步到预览
  const handleEditorScroll = useCallback(() => {
    if (isSyncingRef.current || viewMode !== 'split' || !previewRef.current || !editorRef.current) return;
    const editor = editorRef.current;
    const scrollTop = editor.getScrollTop();
    const scrollHeight = editor.getScrollHeight();
    const layoutHeight = editor.getLayoutInfo().height;
    const maxScrollTop = scrollHeight - layoutHeight;
    const ratio = maxScrollTop > 0 ? scrollTop / maxScrollTop : 0;
    const preview = previewRef.current;
    const previewMaxScroll = preview.scrollHeight - preview.clientHeight;
    isSyncingRef.current = true;
    preview.scrollTop = ratio * previewMaxScroll;
    requestAnimationFrame(() => { isSyncingRef.current = false; });
  }, [viewMode]);

  // 预览滚动同步到编辑器
  const handlePreviewScroll = useCallback(() => {
    if (isSyncingRef.current || viewMode !== 'split' || !editorRef.current) return;
    const preview = previewRef.current;
    if (!preview) return;
    const previewMaxScroll = preview.scrollHeight - preview.clientHeight;
    const ratio = previewMaxScroll > 0 ? preview.scrollTop / previewMaxScroll : 0;
    const editor = editorRef.current;
    const editorMaxScroll = editor.getScrollHeight() - editor.getLayoutInfo().height;
    isSyncingRef.current = true;
    editor.setScrollTop(ratio * editorMaxScroll);
    requestAnimationFrame(() => { isSyncingRef.current = false; });
  }, [viewMode]);

  // 实时预览
  useEffect(() => {
    if (!previewRef.current) return;

    const html = marked.parse(markdown) as string;
    previewRef.current.innerHTML = html;
    mermaidRenderedRef.current = markdown;

    // 延迟渲染 mermaid
    requestAnimationFrame(() => {
      if (previewRef.current) {
        renderMermaidDiagrams(previewRef.current);
      }
    });
  }, [markdown, renderMermaidDiagrams]);

  // 处理拖拽进入
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  // 处理拖拽离开
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 检查是否真的离开了整个区域
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setIsDragging(false);
    }
  }, []);

  // 处理拖拽悬停
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // 处理文件放置
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'md' || ext === 'txt') {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          if (content) {
            setMarkdown(content);
          }
        };
        reader.onerror = () => {
          alert('读取文件失败，请重试');
        };
        reader.readAsText(file);
      } else {
        alert('仅支持 .md 和 .txt 文件');
      }
    }
  }, []);

  // 保存配置
  const handleSaveConfig = async (url: string) => {
    try {
      await axios.post(`${API_BASE}/config`, { mermaidRenderUrl: url });
      setMermaidRenderUrl(url);
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  };

  // 下载 Word
  const handleDownload = useCallback(async () => {
    if (!markdown.trim() || isConverting) return;

    setIsConverting(true);
    try {
      // 提取标题作为文件名，没有标题则使用时间命名
      const title = extractTitle(markdown);
      const filename = title || generateTimeFilename();

      const response = await axios.post(
        `${API_BASE}/convert`,
        { markdown, filename },
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${filename}.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Conversion failed:', error);
      alert('转换失败，请检查后端服务是否正常启动');
    } finally {
      setIsConverting(false);
    }
  }, [markdown, isConverting]);

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-left">
          <img src="/mascot.gif" alt="奶茶鼠" className="mascot" />
          <h1>Markdown 转 Word</h1>
          <button
            className="announcement-btn"
            onClick={() => setShowAnnouncement(!showAnnouncement)}
            title="版本公告"
          >
            🔊
          </button>
          {showAnnouncement && (
            <div className="announcement-popup">
              <div className="announcement-header">
                <span>📢 版本更新</span>
                <button className="announcement-close" onClick={() => setShowAnnouncement(false)}>×</button>
              </div>
              <div className="announcement-content">
                <div className="announcement-item">
                  <span className="item-dot">✨</span>
                  <span>视图模式切换：支持纯编辑、编辑+预览、纯预览三种模式</span>
                </div>
                <div className="announcement-item">
                  <span className="item-dot">✨</span>
                  <span>滚动同步：编辑+预览模式下左右双向同步滚动</span>
                </div>
                <div className="announcement-item">
                  <span className="item-dot">✨</span>
                  <span>拖拽上传：支持 .md/.txt 文件直接拖入编辑器</span>
                </div>
                <div className="announcement-item">
                  <span className="item-dot">✨</span>
                  <span>智能命名：自动提取标题作为文件名</span>
                </div>
                <div className="announcement-item">
                  <span className="item-dot">🔧</span>
                  <span>修复 Mermaid 图表在 Windows 下的换行问题</span>
                </div>
              </div>
              <div className="announcement-footer">
                <span>v1.2.0 · 2026-04-29</span>
              </div>
            </div>
          )}
        </div>
        <div className="header-actions">
          <a href="https://github.com/scp-lo123ol" target="_blank" rel="noopener" className="author-link">
            @scp-lo123ol
          </a>
          <button
            className="support-btn"
            onClick={() => setShowSupport(!showSupport)}
            title="支持作者"
          >
            <Coffee size={18} />
          </button>
          {showSupport && (
            <div className="support-popup">
              <div className="support-header">
                <span>☕ 支持作者</span>
                <button className="support-close" onClick={() => setShowSupport(false)}>×</button>
              </div>
              <div className="support-content">
                <img src="/support-author.jpg" alt="支持作者" className="support-image" />
                <p className="support-text">如果觉得有用，欢迎支持作者继续开发 🙏</p>
              </div>
            </div>
          )}
          {mermaidRenderMode === 'remote' && (
            <button className="config-btn" onClick={() => setShowConfig(true)}>
              配置
            </button>
          )}
          <button
            className="download-btn"
            onClick={handleDownload}
            disabled={isConverting || !markdown.trim()}
          >
            {isConverting ? '转换中...' : '下载 Word'}
          </button>
        </div>
      </header>

      <div className="mode-toolbar">
        {viewMode === 'edit' && (
          <div className="mode-title">编辑器</div>
        )}
        {viewMode === 'split' && (
          <>
            <div className="mode-title-split-left">编辑器</div>
            <div className="mode-divider-line" />
            <div className="mode-title-split-right">预览</div>
          </>
        )}
        {viewMode === 'preview' && (
          <div className="mode-title">
            <span>预览</span>
            <button className="edit-btn" onClick={() => setViewMode('edit')}>
              编辑
            </button>
          </div>
        )}
        <div className={`mode-switcher ${viewMode === 'split' ? 'split-mode' : ''}`}>
          <button className={`mode-btn ${viewMode === 'edit' ? 'active' : ''}`} onClick={() => setViewMode('edit')} title="纯编辑模式">
            <Edit size={16} />
          </button>
          <button className={`mode-btn ${viewMode === 'split' ? 'active' : ''}`} onClick={() => setViewMode('split')} title="编辑+预览模式">
            <Columns size={16} />
          </button>
          <button className={`mode-btn ${viewMode === 'preview' ? 'active' : ''}`} onClick={() => setViewMode('preview')} title="纯预览模式">
            <Eye size={16} />
          </button>
        </div>
      </div>

      <main className="main-content">
        <div className="content-area">
          <div
            className={`editor-panel ${viewMode === 'preview' ? 'hidden' : ''} ${viewMode === 'edit' ? 'full-width' : ''}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <div className="editor-wrapper">
              <Editor
                height="100%"
                defaultLanguage="markdown"
                value={markdown}
                onChange={(value) => setMarkdown(value || '')}
                theme="vs-dark"
                onMount={(editor) => {
                  editorRef.current = editor;
                  editor.onDidScrollChange(handleEditorScroll);
                }}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                }}
              />
            </div>
            {isDragging && (
              <div className="drag-overlay">
                <div className="drag-hint">
                  <span className="drag-icon">📄</span>
                  <span className="drag-text">释放以读取文件</span>
                  <span className="drag-formats">支持 .md / .txt</span>
                </div>
              </div>
            )}
          </div>

          <div className={`divider ${viewMode !== 'split' ? 'hidden' : ''}`} />

          <div className={`preview-panel ${viewMode === 'edit' ? 'hidden' : ''} ${viewMode === 'preview' ? 'full-width' : ''}`}>
            <div
              ref={previewRef}
              className="preview-wrapper"
              onScroll={handlePreviewScroll}
            />
          </div>
        </div>
      </main>

      <ConfigModal
        isOpen={showConfig}
        onClose={() => setShowConfig(false)}
        currentUrl={mermaidRenderUrl}
        onSave={handleSaveConfig}
      />

      {/* 方案3: 底部 Footer */}
      <footer className="app-footer">
        Made with ❤️ by <a href="https://github.com/scp-lo123ol" target="_blank" rel="noopener">scp-lo123ol</a>
      </footer>
    </div>
  );
}

export default App;