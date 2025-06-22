/**
 * JWT 相關型別定義
 */

import { UserRole } from '../../models/user.js';

/**
 * JWT 令牌載荷
 */
export interface TokenPayload {
  userId: string;
  role: string | UserRole;
  iat?: number;
  exp?: number;
  email?: string;
  [key: string]: any;
}

/**
 * JWT 配置選項
 */
export interface JwtOptions {
  secret: string;
  expiresIn: string | number;
}

/**
 * 令牌響應
 */
export interface TokenResponse {
  token: string;
  expiresIn: number;
} 