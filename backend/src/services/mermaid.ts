// E:\md2word-converter\backend\src\services\mermaid.ts
import axios from 'axios';
import puppeteer, { Browser } from 'puppeteer-core';
import { config } from '../config';
import fs from 'fs';
import path from 'path';

let browser: Browser | null = null;

const MERMAID_JS_PATH = path.join(__dirname, '../templates/mermaid.min.js');

/**
 * 初始化 Puppeteer 浏览器
 */
async function initBrowser(): Promise<Browser> {
  if (browser && browser.isConnected()) return browser;

  const executablePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/chromium-headless-shell',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    process.env.CHROMIUM_PATH,
  ];

  let executablePath = '';
  for (const p of executablePaths) {
    if (p && fs.existsSync(p)) {
      executablePath = p;
      break;
    }
  }

  if (!executablePath) {
    throw new Error('Chromium not found');
  }

  browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  return browser;
}

/**
 * 本地渲染 Mermaid 图表（高分辨率，不缩放）
 */
async function renderMermaidLocal(code: string): Promise<Buffer> {
  const b = await initBrowser();
  const page = await b.newPage();

  // 高分辨率渲染（3x），生成清晰的图片
  // 不设置过大的 viewport，让 Mermaid 按实际内容大小渲染
  await page.setViewport({
    width: 800,
    height: 600,
    deviceScaleFactor: 3, // 3倍分辨率，清晰度高
  });

  const hasLocalMermaid = fs.existsSync(MERMAID_JS_PATH);
  const mermaidScript = hasLocalMermaid ? fs.readFileSync(MERMAID_JS_PATH, 'utf-8') : '';

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      margin: 0;
      padding: 10px;
      background: white;
      font-family: 'Microsoft YaHei', 'Segoe UI', Arial, sans-serif;
    }
    #container { display: inline-block; }
  </style>
</head>
<body>
  <div id="container"></div>
  <script>${hasLocalMermaid ? mermaidScript : 'window.LOAD_ONLINE = true;'}</script>
  <script>
    const code = ${JSON.stringify(code)};
    const container = document.getElementById('container');

    const init = () => {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
        flowchart: { useMaxWidth: false, htmlLabels: true },
        sequence: { useMaxWidth: false },
        gantt: { useMaxWidth: false },
      });
      mermaid.render('m-svg', code).then(r => {
        container.innerHTML = r.svg;
        window.DONE = true;
      }).catch(e => {
        container.innerHTML = '<pre style="color:red;">' + e.message + '</pre>';
        window.DONE = true;
      });
    };

    if (window.mermaid) init();
    else {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
      s.onload = init;
      s.onerror = () => { container.innerHTML = '<pre style="color:orange;">Offline</pre>'; window.DONE = true; };
      document.head.appendChild(s);
    }
  </script>
</body>
</html>
`;

  try {
    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForFunction('window.DONE === true', { timeout: 30000 });

    const container = await page.$('#container');
    if (!container) throw new Error('No container');

    // 直接截图，不进行任何缩放处理
    const screenshot = await container.screenshot({
      type: 'png',
      omitBackground: true,
    });

    await page.close();
    console.log('Mermaid rendered (no scaling)');

    return screenshot as Buffer;
  } catch (error) {
    await page.close();
    throw error;
  }
}

/**
 * 远程渲染
 */
async function renderMermaidRemote(code: string): Promise<Buffer> {
  const response = await axios.post(
    config.mermaidRenderUrl,
    { code },
    { headers: { 'Content-Type': 'application/json' }, responseType: 'arraybuffer', timeout: 30000 }
  );
  return Buffer.from(response.data);
}

/**
 * 渲染 Mermaid
 */
export async function renderMermaid(code: string): Promise<Buffer> {
  try {
    return config.mermaidRenderMode === 'local'
      ? await renderMermaidLocal(code)
      : await renderMermaidRemote(code);
  } catch (error) {
    console.error('Mermaid error:', error);
    throw new Error(`Mermaid failed: ${code.substring(0, 30)}...`);
  }
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

export function extractMermaidBlocks(markdown: string): { code: string; index: number }[] {
  // 支持 ```mermaid 后有可选空格，支持 Windows(\r\n) 和 Unix(\n) 换行
  const regex = /```mermaid[ \t]*\r?\n([\s\S]*?)```/g;
  const blocks: { code: string; index: number }[] = [];
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    blocks.push({ code: match[1].trim(), index: match.index });
  }
  return blocks;
}