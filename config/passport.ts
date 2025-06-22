import passport from 'passport';
import { Strategy as GoogleStrategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import { AppDataSource } from './database.js';
import { User, UserRole, OAuthProvider, Gender } from '../models/user.js';
import dotenv from 'dotenv';

dotenv.config();

// 擴展 GoogleUser 類型以匹配代碼中實際返回的用戶數據結構
interface GoogleUser {
  user: {
    userId: string,
    email: string,
    name: string,
    avatar?: string,
    role: UserRole,
    oauthProviders: OAuthProvider[],
    phone?: string,
    address?: string,
    birthday?: Date | null,
    gender?: Gender | null,
    isEmailVerified: boolean,
    [key: string]: any,
  };
}

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  callbackURL: process.env.GOOGLE_CALLBACK_URL!,
  passReqToCallback: true,
  scope: ['profile', 'email'],
},
async function (req: any, accessToken: string, refreshToken: string | undefined, profile: Profile, done: VerifyCallback) {
  try {
    const userRepository = AppDataSource.getRepository(User);

    // 檢查 profile 是否包含必要信息
    if (!profile.id) {
      return done(new Error('Google profile ID not found'));
    }
    if (!profile.emails?.[0]?.value) {
      return done(new Error('Google profile email not found'));
    }
    const email = profile.emails[0].value;
    const googleId = profile.id;
    const avatarUrl = profile.photos?.[0]?.value; // 使用可選鏈接取頭像

    // 由於 oauthProviders 是 jsonb，我們不能直接在 where 條件中查詢內部屬性。
    // 先根據 email 查找用戶
    let user = await userRepository.findOne({ where: { email } });

    if (user) {
      // 找到用戶，檢查 oauthProviders 陣列中是否已有 Google 記錄
      const existingProvider = user.oauthProviders?.find((p: OAuthProvider) => p.provider === 'google');

      if (existingProvider) {
        // 已有關聯，檢查 providerId 是否一致（理論上應該一致）
        if (existingProvider.providerId !== googleId) {
          // 這是一個異常情況，可能需要記錄或處理
          console.warn(`Mismatched Google ID for email ${email}. DB: ${existingProvider.providerId}, Google: ${googleId}`);
          // 可以選擇更新 providerId，或拋出錯誤，取決於業務邏輯
          existingProvider.providerId = googleId; // 暫定更新
        }
        // 更新 token 和過期時間
        existingProvider.accessToken = accessToken;
        existingProvider.refreshToken = refreshToken;
        existingProvider.tokenExpiresAt = new Date(Date.now() + 3600000);
        if (avatarUrl && !user.avatar) { // 僅在用戶沒有本地頭像時才更新
          user.avatar = avatarUrl;
        }
        await userRepository.save(user);
      } else {
        // Email 存在但未關聯 Google，添加 Google OAuth 提供者信息
        user.oauthProviders = user.oauthProviders || []; // 確保陣列存在
        user.oauthProviders.push({
          provider: 'google',
          providerId: googleId,
          accessToken,
          refreshToken,
          tokenExpiresAt: new Date(Date.now() + 3600000),
        });
        if (avatarUrl && !user.avatar) { // 只有在用戶沒有頭像時才更新
          user.avatar = avatarUrl;
        }
        user.isEmailVerified = true; // Google 登入視為已驗證
        await userRepository.save(user);
      }
    } else {
      // Email 不存在，創建新用戶並關聯 Google
      const newUser = userRepository.create({
        email: email,
        avatar: avatarUrl,
        name: profile.displayName || email.split('@')[0],
        role: UserRole.USER,
        isEmailVerified: true,
        oauthProviders: [{
          provider: 'google',
          providerId: googleId,
          accessToken,
          refreshToken,
          tokenExpiresAt: new Date(Date.now() + 3600000),
        }],
      });
      user = await userRepository.save(newUser);
    }

    // 準備傳遞給 Controller 的用戶資料結構，需與 Controller 中預期的一致
    const userData: GoogleUser = {
      user: {
        userId: user.userId,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: user.role,
        oauthProviders: user.oauthProviders || [],
        isEmailVerified: user.isEmailVerified || false,
        // ... 其他需要的 user 欄位
      },
    };

    return done(null, userData as any);
  } catch (err) {
    console.error('Error in Google Strategy verify callback:', err);
    return done(err as Error);
  }
}),
);

export default passport; 