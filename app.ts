import 'reflect-metadata';
import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

// 環境變數和安全相關
import dotenv from 'dotenv';
dotenv.config();
import helmet from 'helmet';
import cors from 'cors';

// 資料庫連接
import { connectToDatabase } from './config/database.js';

// 確保模型初始化
import './models/index.js';

import path from 'path';
import { fileURLToPath } from 'url';

// 引入基本路由 (只保留註冊登入需要的)
import authRouter from './routes/auth.js';

const app = express();

// 未捕獲的異常處理
process.on('uncaughtException', (err) => {
  console.error('未捕獲的異常:', err);
  process.exit(1);
});

// 未處理的 Promise 拒絕處理
process.on('unhandledRejection', (reason, promise) => {
  console.error('未處理的 Promise 拒絕:', promise, '原因:', reason);
});

// 獲取當前目錄路徑
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 資料庫連接
connectToDatabase()
  .then(() => console.log('資料庫連接成功'))
  .catch(err => {
    console.error('資料庫連接失敗:', err);
    console.error('錯誤詳情:', {
      message: err.message,
      code: err.code,
      syscall: err.syscall,
      hostname: err.hostname || '未提供',
    });
  });

// 中間件設置
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// 路由設置 (只保留基本功能)
app.use('/api/v1/auth', authRouter);        // 註冊、登入

// 錯誤處理中間件
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('錯誤詳情:', err);
  
  // 開發環境顯示詳細錯誤信息，生產環境顯示友好錯誤信息
  const isDev = process.env.NODE_ENV === 'development';
  
  const statusCode = err.status || 500;
  
  // 處理特定類型的錯誤，提供友好的錯誤消息
  let message = err.message || '系統發生錯誤';
  
  // 從錯誤對象中獲取錯誤碼
  let errorCode = err.code || '';
  
  // 如果沒有指定錯誤碼，則根據錯誤類型分配
  if (!errorCode) {
    if (err.name === 'EntityPropertyNotFoundError') {
      errorCode = 'S02';
      message = '操作失敗，請稍後再試';
    } else if (err.name === 'ValidationError') {
      errorCode = 'V01';
      message = '提交的數據格式不正確';
    } else if (statusCode === 404) {
      errorCode = 'D01';
    } else if (statusCode === 401) {
      errorCode = 'A06';
    } else if (statusCode === 403) {
      errorCode = 'A07';
    } else if (statusCode === 429) {
      errorCode = 'S03';
    } else if (statusCode >= 400 && statusCode < 500) {
      errorCode = 'V01';
    } else {
      errorCode = 'S01';
    }
  }
  
  // 構建錯誤響應
  const errorResponse: any = {
    status: 'failed',
    message,
  };
  
  // 只在開發環境下添加詳細錯誤信息
  if (isDev) {
    errorResponse.details = err.stack;
  }
  
  // 如果 headers 已經發送，則將錯誤交給 Express 的預設錯誤處理器
  if (res.headersSent) {
    return next(err);
  }
  
  res.status(statusCode).json(errorResponse);
});

// 404 處理中間件
app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({
    status: 'failed',
    message: '找不到該資源',
  });
});

export default app;