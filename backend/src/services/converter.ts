// E:\md2word-converter\backend\src\services\converter.ts
import { renderMermaid, extractMermaidBlocks } from './mermaid';
import { convertMarkdownToDocx } from '../utils/pandoc';
import { v4 as uuidv4 } from 'uuid';

export async function convertToWord(markdown: string): Promise<Buffer> {
  // 1. 提取并渲染 Mermaid 图表
  const mermaidBlocks = extractMermaidBlocks(markdown);
  const images = new Map<string, Buffer>();

  let processedMarkdown = markdown;

  // 2. 处理每个 Mermaid 代码块
  for (let i = 0; i < mermaidBlocks.length; i++) {
    const block = mermaidBlocks[i];
    const imageFilename = `mermaid-${uuidv4()}.png`;

    try {
      const imageBuffer = await renderMermaid(block.code);
      images.set(imageFilename, imageBuffer);

      // 替换 Mermaid 代码块为图片引用（空 alt 文本避免 Word 显示多余文字）
      // 支持 Windows(\r\n) 和 Unix(\n) 换行符
      const mermaidBlock = /```mermaid[ \t]*\r?\n[\s\S]*?```/;
      processedMarkdown = processedMarkdown.replace(
        mermaidBlock,
        `![](${imageFilename})`
      );
    } catch (error) {
      console.error(`Failed to render mermaid block ${i}:`, error);
      // 保留原始代码块作为错误提示
    }
  }

  // 3. 使用 Pandoc 转换为 Word
  const docxBuffer = await convertMarkdownToDocx(processedMarkdown, images);

  return docxBuffer;
}