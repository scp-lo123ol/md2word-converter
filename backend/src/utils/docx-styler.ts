// E:\md2word-converter\backend\src\utils\docx-styler.ts
import AdmZip from 'adm-zip';

const AUTHOR = 'scp-lo123ol';

/**
 * 后处理 Word 文档：
 * 1. 图片居中
 * 2. 表格边框和灰色表头
 * 3. 设置文档作者属性
 */
export async function styleDocx(buffer: Buffer): Promise<Buffer> {
  const zip = new AdmZip(buffer);
  let xml = zip.readAsText('word/document.xml');

  // ========== 设置文档作者 ==========
  try {
    let coreXml = zip.readAsText('docProps/core.xml');
    // 替换或添加作者
    if (coreXml.includes('<dc:creator>')) {
      coreXml = coreXml.replace(/<dc:creator[^>]*>[^<]*<\/dc:creator>/, `<dc:creator>${AUTHOR}</dc:creator>`);
    } else {
      // 在 </cp:coreProperties> 前添加作者
      coreXml = coreXml.replace('</cp:coreProperties>', `<dc:creator>${AUTHOR}</dc:creator>\n</cp:coreProperties>`);
    }
    zip.updateFile('docProps/core.xml', Buffer.from(coreXml, 'utf-8'));
  } catch (e) {
    console.error('Failed to set author:', e);
  }

  // ========== 图片居中处理 ==========
  // 在包含 drawing 的段落的 pPr 中添加 jc=center
  // 正确结构：<w:p><w:pPr>...<w:jc w:val="center"/></w:pPr>...</w:p>

  // 方法：找到有 drawing 但没有 jc 的段落，在 pPr 开始处添加 jc
  // 先找到所有包含 drawing 的段落
  const paragraphs = xml.split('<w:p>');
  const styledParagraphs: string[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    let para = paragraphs[i];

    // 检查是否包含 drawing
    if (para.includes('<w:drawing>') && !para.includes('<w:jc')) {
      // 找到 pPr 的位置，在 pPr 内添加 jc
      if (para.includes('<w:pPr>')) {
        // 在 <w:pPr> 后面添加 jc
        para = para.replace('<w:pPr>', '<w:pPr><w:jc w:val="center"/>');
      } else if (para.includes('<w:pPr ')) {
        // 处理带属性的 pPr
        para = para.replace(/<w:pPr([^>]*)>/, `<w:pPr$1><w:jc w:val="center"/>`);
      } else {
        // 没有 pPr，需要创建一个
        // 在段落开始处（split 后的字符串开头）添加
        if (i > 0) {
          para = `<w:pPr><w:jc w:val="center"/></w:pPr>` + para;
        }
      }
    }

    styledParagraphs.push(para);
  }

  xml = styledParagraphs.join('<w:p>');

  // ========== 表格边框处理 ==========
  const tblBorders = `<w:tblBorders>
    <w:top w:val="single" w:sz="4" w:color="000000"/>
    <w:left w:val="single" w:sz="4" w:color="000000"/>
    <w:bottom w:val="single" w:sz="4" w:color="000000"/>
    <w:right w:val="single" w:sz="4" w:color="000000"/>
    <w:insideH w:val="single" w:sz="4" w:color="000000"/>
    <w:insideV w:val="single" w:sz="4" w:color="000000"/>
  </w:tblBorders>`;

  const tblCenter = `<w:jc w:val="center"/>`;

  xml = xml.replace(/<w:tblPr>([^]*?)<\/w:tblPr>/g, (match, content) => {
    let newContent = content;
    if (content.includes('<w:tblBorders>')) {
      newContent = newContent.replace(/<w:tblBorders[^]*?<\/w:tblBorders>/, tblBorders);
    } else {
      newContent += tblBorders;
    }
    if (!content.includes('<w:jc')) {
      newContent += tblCenter;
    }
    return `<w:tblPr>${newContent}</w:tblPr>`;
  });

  // ========== 表头灰色背景 ==========
  const headerShd = `<w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/>`;

  const tables = xml.split('<w:tbl>');
  const styledTables: string[] = [];

  tables.forEach((part, i) => {
    if (i === 0) {
      styledTables.push(part);
      return;
    }

    const firstTrEnd = part.indexOf('</w:tr>');
    if (firstTrEnd > 0) {
      const firstTr = part.substring(0, firstTrEnd);
      const rest = part.substring(firstTrEnd);

      let styledFirstTr = firstTr;

      styledFirstTr = styledFirstTr.replace(/<w:tcPr\s*\/>/g, `<w:tcPr>${headerShd}</w:tcPr>`);
      styledFirstTr = styledFirstTr.replace(/<w:tcPr([^>]*)\/>/g, (_, attrs) => `<w:tcPr${attrs}>${headerShd}</w:tcPr>`);
      styledFirstTr = styledFirstTr.replace(/<w:tcPr([^>]*)>([^]*?)<\/w:tcPr>/g, (_, attrs, content) => {
        if (content.includes('<w:shd')) {
          return `<w:tcPr${attrs}>${content.replace(/<w:shd[^>]*\/>/, headerShd)}</w:tcPr>`;
        }
        return `<w:tcPr${attrs}>${content}${headerShd}</w:tcPr>`;
      });

      styledTables.push(styledFirstTr + rest);
    } else {
      styledTables.push(part);
    }
  });

  xml = styledTables.join('<w:tbl>');

  zip.updateFile('word/document.xml', Buffer.from(xml, 'utf-8'));

  return zip.toBuffer();
}