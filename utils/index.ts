import createHttpError from 'http-errors';
import jsonWebToken from 'jsonwebtoken';
import { SignOptions } from 'jsonwebtoken';
import { handleErrorAsync } from './handleErrorAsync.js';
import { ApiError } from './apiError.js';
import { ErrorCode } from '../types/api.js';
import { TokenPayload } from '../types/auth/jwt.js';


// 擴展的令牌載荷，包含電子郵件
interface EmailTokenPayload extends TokenPayload {
  email: string;
}

// 認證令牌載荷，包含用戶ID和角色
interface AuthTokenPayload extends TokenPayload {
  userId: string;
  role: string;
}

/**
 * 生成 JWT 令牌
 * @param payload 令牌載荷
 * @param options 簽名選項
 * @returns JWT 令牌
 */
export const generateToken = (
  payload: TokenPayload, 
  options: SignOptions = { expiresIn: '7d' },
): string => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set.');
  }
  return jsonWebToken.sign(payload, process.env.JWT_SECRET, options);
};

/**
 * 驗證 JWT 令牌
 * @param token JWT 令牌
 * @returns 解碼後的載荷
 */
export const verifyToken = (token: string): EmailTokenPayload | AuthTokenPayload => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set.');
  }
  try {
    const decoded = jsonWebToken.verify(token, process.env.JWT_SECRET) as EmailTokenPayload | AuthTokenPayload;
    
    // 檢查是否為驗證碼 token
    if ('code' in decoded) {
      // 檢查是否過期
      if (decoded.exp && decoded.exp * 1000 < Date.now()) {
        throw ApiError.create(400, '驗證碼已過期', ErrorCode.AUTH_TOKEN_EXPIRED);
      }
      return decoded;
    }
    
    // 檢查是否為認證 token
    if (!('userId' in decoded) || !('role' in decoded)) {
      throw ApiError.create(401, '無效的 Token 格式', ErrorCode.AUTH_TOKEN_INVALID);
    }
    
    return decoded;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TokenExpiredError') {
        throw ApiError.create(401, 'Token 已過期', ErrorCode.AUTH_TOKEN_EXPIRED);
      }
      if (error.name === 'JsonWebTokenError') {
        throw ApiError.create(401, '無效的 Token', ErrorCode.AUTH_TOKEN_INVALID);
      }
    }
    
    // 處理其他錯誤
    if (error instanceof createHttpError.HttpError) {
      throw error;
    }
    
    throw ApiError.create(401, '無效的 Token', ErrorCode.AUTH_TOKEN_INVALID);
  }
};

/**
 * 生成電子郵件驗證令牌
 * @returns 驗證碼和令牌
 */
export const generateEmailToken = (): { code: string, token: string } => {
  const code = generateRandomCode();
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set.');
  }
  const token = jsonWebToken.sign({ code }, process.env.JWT_SECRET, {
    expiresIn: 600, // 10 minutes
  });

  return { code, token };
};

/**
 * 生成隨機驗證碼
 * @returns 6位數字驗證碼
 */
const generateRandomCode = (): string => {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
};

// 導出 handleErrorAsync 和 ApiError
export { handleErrorAsync, ApiError };
