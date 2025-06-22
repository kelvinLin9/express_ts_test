import { Request, Response } from 'express';
import { AppDataSource } from '../config/database.js';
import { User as UserEntity, Gender, UserRole } from '../models/user.js';
import { UpdateProfileRequest, UpdateUserRoleRequest } from '../types/user/requests.js';
import { UserProfileResponse, UserProfileData } from '../types/user/responses.js';
import { handleErrorAsync, ApiError } from '../utils/index.js';
import { ErrorCode, ApiResponse } from '../types/api.js';

// Gender enum 的中英文映射
const genderToChineseMap: Record<Gender, string> = {
  [Gender.MALE]: '男',
  [Gender.FEMALE]: '女',
  [Gender.OTHER]: '其他',
};

const chineseToGenderMap: Record<string, Gender> = {
  '男': Gender.MALE,
  '女': Gender.FEMALE,
  '其他': Gender.OTHER,
};

// 輔助函數：將英文 Gender enum 轉換為中文
function toChineseGender(genderValue?: Gender | null): string | undefined | null {
  if (genderValue === null) return null;
  if (genderValue === undefined) return undefined;
  return genderToChineseMap[genderValue] || undefined;
}

// 輔助函數：將中文性別轉換為 Gender enum (英文)
function toEnglishGender(chineseGender?: string | null): Gender | undefined | null {
  if (chineseGender === null) return null;
  if (chineseGender === undefined) return undefined;
  // 考慮到前端可能傳入 Gender enum 的英文值，先檢查是否直接是 Gender 值
  if (Object.values(Gender).includes(chineseGender as Gender)) {
    return chineseGender as Gender;
  }
  return chineseToGenderMap[chineseGender] || undefined;
}

/**
 * 獲取用戶個人資料
 */
export const getUserProfile = handleErrorAsync(async (req: Request, res: Response<ApiResponse<UserProfileResponse>>) => {
  // req.user 由 isAuth 中間件設置，包含 userId, email, role
  // const authenticatedUser = req.user as Express.User;
  const authenticatedUser = req.user as { userId: string, role: string, email: string };

  if (!authenticatedUser) {
    throw ApiError.unauthorized();
  }

  const userId = authenticatedUser.userId;

  // 使用 TypeORM 查找用戶，並只選擇指定的欄位
  const userRepository = AppDataSource.getRepository(UserEntity);
  const selectedUser = await userRepository.findOne({
    where: { userId: userId },
    select: [
      'userId',
      'email',
      'name',
      'role',
      'avatar',
      'isEmailVerified',
      'oauthProviders',
    ],
  });

  if (!selectedUser) {
    throw ApiError.notFound('用戶資料');
  }

  // 準備回應數據，轉換 gender
  const userProfileData: UserProfileData = {
    ...(selectedUser as unknown as Omit<UserProfileData, 'gender'>), // 轉換基礎部分
  };

  return res.status(200).json({
    status: 'success',
    message: '獲取用戶資料成功',
    data: {
      user: userProfileData,
    },
  });
});


/**
 * 更新用戶個人資料
 */
export const updateUserProfile = handleErrorAsync(async (req: Request, res: Response<ApiResponse<UserProfileResponse>>) => {
  const authenticatedUser = req.user as { userId: string, role: string, email: string };

  if (!authenticatedUser) {
    throw ApiError.unauthorized();
  }

  const userId = authenticatedUser.userId;
  
  const { 
    name, 
    nickname, 
    phone, 
    birthday, 
    gender: rawGender, //接收原始的 gender 輸入
    address, 
    country,
    preferredRegions, 
    preferredEventTypes, 
  } = req.body as UpdateProfileRequest;
  
  const userRepository = AppDataSource.getRepository(UserEntity);
  const user = await userRepository.findOne({ where: { userId } });
  
  if (!user) {
    throw ApiError.notFound('用戶');
  }
  
  if (name !== undefined) user.name = name;

  if (birthday !== undefined) {
    if (birthday === null) {
    } else if (typeof birthday === 'string' && birthday.trim() === '') {
      throw ApiError.create(400, '生日欄位格式錯誤：如需清空生日，請傳遞 null；否則請提供有效的日期字串。', ErrorCode.DATA_INVALID);
    } else {
      const dateObj = birthday instanceof Date ? birthday : new Date(birthday);
      if (isNaN(dateObj.getTime())) {
        throw ApiError.create(400, '生日欄位格式錯誤：請提供有效的日期字串 (例如 "YYYY-MM-DD")。', ErrorCode.DATA_INVALID);
      }
    }
  }

  if (rawGender !== undefined) {
    if (rawGender === null) {
    } else if (typeof rawGender === 'string' && rawGender.trim() === '') {
      throw ApiError.create(400, '性別欄位不能為空字串。如需清除，請傳遞 null。有效值為 "男", "女", "其他"。', ErrorCode.DATA_INVALID);
    } else if (typeof rawGender === 'string') {
      const englishGender = toEnglishGender(rawGender);
      if (englishGender === undefined) { 
        throw ApiError.create(400, `性別欄位包含無效的值: "${rawGender}"。有效值為 "男", "女", "其他"。`, ErrorCode.DATA_INVALID);
      }
    } else {
      throw ApiError.create(400, '性別欄位格式不正確。', ErrorCode.DATA_INVALID);
    }
  }

  await userRepository.save(user);
  
  const updatedSelectedUser = await userRepository.findOne({
    where: { userId: userId },
    select: [
      'userId', 'email', 'name', 'role', 'avatar', 'isEmailVerified', 'oauthProviders',
    ],
  });

  if (!updatedSelectedUser) {
    throw ApiError.systemError();
  }

  // 準備回應數據，轉換 gender
  const userProfileDataForResponse: UserProfileData = {
    ...(updatedSelectedUser as unknown as UserProfileData), // 先進行基礎類型轉換
  };

  return res.status(200).json({
    status: 'success',
    message: '用戶資料更新成功',
    data: {
      user: userProfileDataForResponse,
    },
  });
});

// 英文地區鍵名到英文子標籤的映射
const regionSubLabelMap: Record<string, string> = {
  NORTH: 'North',
  SOUTH: 'South',
  EAST: 'East',
  CENTRAL: 'Central',
  ISLANDS: 'Outlying Islands',
  OVERSEAS: 'Overseas',
};


// 英文鍵名到英文子標籤的映射
const eventTypeSubLabelMap: Record<string, string> = {
  POP: 'Pop',
  ROCK: 'Rock',
  ELECTRONIC: 'Electronic',
  HIP_HOP: 'Hip-Hop/Rap', // 根據前端需求調整
  JAZZ_BLUES: 'Jazz/Blues', // 根據前端需求調整
  CLASSICAL: 'Classical/Symphony', // 根據前端需求調整
  OTHER: 'Other',
};


/**
 * 更新使用者角色
 * 僅限管理員 (admin / superuser) 使用
 * 路徑: PATCH /users/:id/role
 */
export const updateUserRole = handleErrorAsync(async (req: Request, res: Response<ApiResponse>) => {
  // 驗證當前登入者
  const authenticatedUser = req.user as { userId: string, role: string, email: string };

  if (!authenticatedUser) {
    throw ApiError.unauthorized();
  }

  const targetUserId = req.params.id;
  const { role } = req.body as UpdateUserRoleRequest;

  // 檢查 role 欄位
  if (!role) {
    throw ApiError.create(400, 'role 欄位為必填', ErrorCode.DATA_INVALID);
  }

  // 檢查是否為有效角色
  if (!Object.values(UserRole).includes(role as UserRole)) {
    throw ApiError.create(400, '無效的角色', ErrorCode.DATA_INVALID);
  }

  // 若要修改自己為 user，阻止此行為 (避免鎖死管理員帳號)
  if (authenticatedUser.userId === targetUserId && role === UserRole.USER) {
    throw ApiError.create(400, '禁止將自己的角色降為 user', ErrorCode.DATA_INVALID);
  }

  const userRepository = AppDataSource.getRepository(UserEntity);
  const user = await userRepository.findOne({ where: { userId: targetUserId } });

  if (!user) {
    throw ApiError.notFound('用戶');
  }

  // 若角色無變動，直接回傳成功
  if (user.role === role) {
    return res.status(200).json({
      status: 'success',
      message: '使用者角色未變更',
      data: { userId: user.userId, role: user.role },
    });
  }

  user.role = role as UserRole;

  await userRepository.save(user);

  return res.status(200).json({
    status: 'success',
    message: '使用者角色更新成功',
    data: { userId: user.userId, role: user.role },
  });
}); 