// E:\md2word-converter\backend\src\utils\pandoc.ts
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { styleDocx } from './docx-styler';

const TEMPLATE_PATH = path.join(__dirname, '../templates/reference.docx');
const FILTER_PATH = path.join(__dirname, '../templates/custom-table.lua');

/**
 * 处理图片：设置宽度（Word 会自动缩放显示，不修改原图像素）
 */
function processImages(markdown: string): string {
  // 设置 4in 宽度，Word 会等比例显示，图片像素不变
  const WIDTH = '4in';

  return markdown.replace(
    /!\[([^\]]*)\]\(([^)]+)\)(\{[^}]*\})?/g,
    (match, alt, src, attrs) => {
      if (attrs?.includes('width')) return match;
      // Pandoc 图片属性语法
      return `\n\n![${alt}](${src}){width="${WIDTH}"}\n\n`;
    }
  );
}

function processTables(markdown: string): string {
  return markdown;
}

/**
 * 处理列表格式：确保列表前有空行，避免被 Pandoc 解析为普通段落
 *
 * 问题场景：
 *   **输入**：
 *   - item1
 *   - item2
 *
 *   **流程说明**：
 *   1. 步骤一
 *   2. 步骤二
 *
 * 如果冒号后直接开始列表（没有空行），Pandoc 会把列表5项当作普通段落文本
 */
function processLists(markdown: string): string {
  // 列表项开头的正则：无序列表 (- * +) 和有序列表 (1. 2. 等)
  const listPattern = '([ \t]*[-*+][ \\t]|[ \\t]*\\d+\\.[ \\t])';

  // 情况1：冒号后直接换行（支持 \r\n 和 \n），然后是列表项
  // 例如：**输入**：\n- item1 或 **流程说明**：\r\n1. 步骤一
  markdown = markdown.replace(new RegExp(`([：:])\\r?\\n${listPattern}`, 'g'), '$1\r\n\r\n$2');

  // 情况2：冒号后有空格，然后换行，然后是列表项
  // 例如：**输入**： \n- item1
  markdown = markdown.replace(new RegExp(`([：:])[ \\t]+\\r?\\n${listPattern}`, 'g'), '$1\r\n\r\n$2');

  return markdown;
}

function runPandoc(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(config.pandocPath, args, { shell: false });
    let err = '';
    proc.stderr.on('data', d => err += d);
    proc.on('close', c => c === 0 ? resolve() : reject(new Error(err)));
    proc.on('error', reject);
  });
}

export async function convertMarkdownToDocx(
  markdown: string,
  images: Map<string, Buffer> = new Map()
): Promise<Buffer> {
  const id = uuidv4();
  const dir = path.join(config.tempDir, id);

  try {
    await fs.mkdir(dir, { recursive: true });

    for (const [name, buf] of images) {
      await fs.writeFile(path.join(dir, name), buf);
    }

    let md = processImages(markdown);
    md = processLists(md);
    md = processTables(md);

    const input = path.join(dir, 'input.md');
    const output = path.join(dir, 'output.docx');
    await fs.writeFile(input, md, 'utf-8');

    const args = [
      input, '-o', output,
      '--from=markdown+tex_math_dollars+link_attributes',
      '--to=docx', '--standalone',
      `--resource-path=${dir}`,
    ];

    // 模板
    try { await fs.access(TEMPLATE_PATH); args.push(`--reference-doc=${TEMPLATE_PATH}`); } catch {}
    // Lua filter
    try { await fs.access(FILTER_PATH); args.push(`--lua-filter=${FILTER_PATH}`); } catch {}

    console.log('Pandoc running');
    await runPandoc(args);

    let buf = await fs.readFile(output);

    // 后处理：居中图片 + 表格样式
    try {
      buf = Buffer.from(await styleDocx(buf));
    } catch (e) {
      console.error('Style error:', e);
    }

    return buf;
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function checkPandocInstalled(): Promise<boolean> {
  try { await runPandoc(['--version']); return true; } catch { return false; }
}