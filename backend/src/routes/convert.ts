// E:\md2word-converter\backend\src\routes\convert.ts
import { Router } from 'express';
import { convertToWord } from '../services/converter';
import { config } from '../config';

const router = Router();

// 获取配置
router.get('/config', (_, res) => {
  res.json({
    mermaidRenderUrl: config.mermaidRenderUrl,
    mermaidRenderMode: config.mermaidRenderMode
  });
});

// 更新配置
router.post('/config', (req, res) => {
  const { mermaidRenderUrl } = req.body;
  if (mermaidRenderUrl) {
    config.mermaidRenderUrl = mermaidRenderUrl;
    res.json({ success: true, mermaidRenderUrl });
  } else {
    res.status(400).json({ error: 'Invalid config' });
  }
});

// 转换接口
router.post('/convert', async (req, res) => {
  try {
    const { markdown, filename = 'document' } = req.body;

    console.log('Received convert request, markdown length:', markdown?.length);

    if (!markdown) {
      return res.status(400).json({ error: 'Markdown content is required' });
    }

    console.log('Starting conversion...');
    const docxBuffer = await convertToWord(markdown);
    console.log('Conversion complete, buffer size:', docxBuffer.length);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    // RFC 5987: 对中文文件名进行编码，支持 UTF-8
    const encodedFilename = encodeURIComponent(filename);
    res.setHeader('Content-Disposition', `attachment; filename="${encodedFilename}.docx"; filename*=UTF-8''${encodedFilename}.docx`);
    res.send(docxBuffer);
  } catch (error: unknown) {
    console.error('Conversion error:', error);
    if (error instanceof Error) {
      console.error('Error stack:', error.stack);
      res.status(500).json({ error: 'Conversion failed: ' + error.message });
    } else {
      res.status(500).json({ error: 'Conversion failed' });
    }
  }
});

export default router;