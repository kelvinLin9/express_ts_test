/**
 * 資料庫配置文件
 * 
 * 使用: TypeORM (https://typeorm.io/)
 * 優勢:
 * - 原生 TypeScript 支持，類型定義完善
 * - 基於裝飾器的實體定義，符合物件導向設計
 * - 強大的關聯映射和查詢能力
 * - 靈活的遷移系統
 */

import { DataSource } from 'typeorm';
// import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 定義 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 載入環境變數
dotenv.config();

// 創建數據源配置
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'postgres',
  synchronize: false,
  logging: process.env.NODE_ENV === 'development' ? ['error'] : false,
  entities: [path.join(__dirname, '..', 'models', '*.{ts,js}')],
  migrations: [path.join(__dirname, '..', 'migrations', '*.{ts,js}')],
  subscribers: [],
});

/**
 * 連接到資料庫，並根據環境執行初始設定
 * 
 * 功能:
 * 1. 檢查並創建資料庫 (僅開發環境)
 * 2. 初始化 TypeORM 連接
 * 3. 根據配置執行遷移
 */
export const connectToDatabase = async () => {
  try {
    await AppDataSource.initialize();
    console.log('數據庫連接成功');
    return AppDataSource;
  } catch (error) {
    console.error('數據庫連接失敗:', error);
    throw error;
  }
};