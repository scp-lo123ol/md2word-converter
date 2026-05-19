// E:\md2word-converter\backend\src\index.ts
import express from 'express';
import cors from 'cors';
import path from 'path';
import convertRouter from './routes/convert';

// 添加未捕获异常处理
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  console.error('Stack:', err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// API 路由
app.use('/api', convertRouter);

// 静态文件服务（生产环境托管前端）
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../frontend/dist')));
  // Express 5.x 使用 {*path} 替代 * 通配符
  app.get('{*path}', (_, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});