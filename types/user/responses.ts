/**
 * 用戶相關響應類型定義
 */

import { UserRole } from '../../models/user.js';

/**
 * OAuth提供者資訊
 */
export interface OAuthProvider {
  provider: string;
  providerId: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt: Date;
}

/**
 * 搜尋歷史項目
 */
export interface SearchHistoryItem {
  query: string;
  timestamp: Date | string;
  category?: string;
}

/**
 * 用戶資料響應
 */
export interface UserProfileData {
  userId: string;
  email: string;
  name: string;
  nickname?: string;
  role: UserRole;
  phone?: string;
  birthday?: Date | string | null;
  gender?: string | null;
  preferredRegions?: string[];
  preferredEventTypes?: string[];
  country?: string;
  address?: string;
  avatar?: string;
  isEmailVerified: boolean;
  oauthProviders?: OAuthProvider[] | Record<string, any>;
  searchHistory?: SearchHistoryItem[] | Record<string, any>;
}

/**
 * 用戶資料響應包裝
 */
export interface UserProfileResponse {
  user: UserProfileData;
} 