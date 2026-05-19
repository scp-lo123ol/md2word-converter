// 生成 Word 参考模板
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  convertInchesToTwip,
  LevelFormat,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  TableBorders,
  VerticalAlign,
} from 'docx';
import * as fs from 'fs';
import * as path from 'path';

// 字号对应 (磅值)
const FONT_SIZES = {
  '初号': 42,
  '小初': 36,
  '一号': 26,
  '小一': 24,
  '二号': 22,
  '小二': 18,
  '三号': 16,
  '小三': 15,
  '四号': 14,
  '小四': 12,
  '五号': 10.5,
  '小五': 9,
  '六号': 7.5,
  '小六': 6.5,
};

// 标题配置：[级别, 字体, 字号, 加粗]
const HEADING_CONFIGS = [
  [1, '黑体', '三号', true],
  [2, '黑体', '小三', true],
  [3, '黑体', '四号', true],
  [4, '黑体', '小四', true],
  [5, '黑体', '五号', true],
  [6, '黑体', '五号', true],
];

async function generateTemplate(): Promise<string> {
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: '仿宋',
            size: FONT_SIZES['五号'] * 2, // docx 使用半磅
          },
          paragraph: {
            spacing: {
              line: 360, // 1.5 倍行距
            },
          },
        },
      },
      paragraphStyles: HEADING_CONFIGS.map(([level, font, sizeName, bold]) => ({
        id: `Heading${level}`,
        name: `Heading ${level}`,
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: {
          font: font as string,
          size: FONT_SIZES[sizeName as keyof typeof FONT_SIZES] * 2,
          bold: bold as boolean,
          color: '000000',
        },
        paragraph: {
          spacing: {
            before: 240,
            after: 120,
          },
        },
      })),
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertInchesToTwip(8.27),  // A4 宽度
              height: convertInchesToTwip(11.69), // A4 高度
            },
            margin: {
              top: convertInchesToTwip(1.25),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1.25),
              left: convertInchesToTwip(1),
            },
          },
        },
        children: [
          // 示例内容（用于定义样式）
          new Paragraph({
            text: '一级标题',
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            text: '二级标题',
            heading: HeadingLevel.HEADING_2,
          }),
          new Paragraph({
            text: '正文内容示例。使用仿宋五号字体。',
          }),
          // 表格样式示例 - 带边框、居中、灰色表头
          new Table({
            width: {
              size: 90,  // 90% 宽度，留出边距实现居中效果
              type: WidthType.PERCENTAGE,
            },
            alignment: AlignmentType.CENTER,  // 表格居中
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
              left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
              right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
              insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
            },
            rows: [
              new TableRow({
                tableHeader: true,  // 标记为表头行
                children: [
                  new TableCell({
                    children: [new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [new TextRun({ text: '表头', bold: true, font: '黑体', size: 24 })]
                    })],
                    shading: { fill: 'D9D9D9' },  // 灰色背景
                    verticalAlign: VerticalAlign.CENTER,
                  }),
                  new TableCell({
                    children: [new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [new TextRun({ text: '表头', bold: true, font: '黑体', size: 24 })]
                    })],
                    shading: { fill: 'D9D9D9' },  // 灰色背景
                    verticalAlign: VerticalAlign.CENTER,
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [new TextRun({ text: '内容', font: '仿宋', size: 21 })]
                    })],
                    verticalAlign: VerticalAlign.CENTER,
                  }),
                  new TableCell({
                    children: [new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [new TextRun({ text: '内容', font: '仿宋', size: 21 })]
                    })],
                    verticalAlign: VerticalAlign.CENTER,
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  // 生成模板文件
  const buffer = await Packer.toBuffer(doc);
  const templatePath = path.join(__dirname, 'reference.docx');
  fs.writeFileSync(templatePath, buffer);

  console.log('模板已生成:', templatePath);
  return templatePath;
}

// 直接运行
generateTemplate().catch(console.error);

export { generateTemplate };