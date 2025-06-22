/**
 * 基本註冊登入功能
 *
 * 使用 TypeORM 的裝飾器語法定義實體和屬性
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import bcrypt from 'bcrypt';

 
export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

// OAuth Provider 介面定義
export interface OAuthProvider {
  provider: string;
  providerId: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt: Date;
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid', { name: 'userId' })
    userId!: string;

  // 別名以兼容舊代碼
  get id(): string {
    return this.userId;
  }

  @Column({ type: 'varchar', length: 100, unique: true, nullable: false })
  @Index()
    email!: string;

  @Column({ type: 'varchar', length: 60, nullable: true, select: false })
    password!: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
    name!: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  @Index()
    role!: UserRole;

  @Column({ type: 'varchar', length: 255, nullable: true })
    avatar?: string;

  // 郵箱驗證相關
  @Column({ type: 'varchar', length: 50, nullable: true })
    verificationToken?: string;

  @Column({ type: 'timestamp', nullable: true })
    verificationTokenExpires?: Date;

  @Column({ type: 'boolean', default: false, nullable: false })
    isEmailVerified?: boolean;

  // 密碼重置相關
  @Column({ type: 'varchar', length: 50, nullable: true })
    passwordResetToken?: string;

  @Column({ type: 'timestamp', nullable: true })
    passwordResetExpires?: Date;

  // OAuth 相關
  @Column('jsonb', { default: '[]', nullable: false })
    oauthProviders?: OAuthProvider[];

  // 速率限制相關
  @Column({ type: 'timestamp', nullable: true })
    lastVerificationAttempt?: Date;

  @Column({ type: 'timestamp', nullable: true })
    lastPasswordResetAttempt?: Date;

  // 時間戳記
  @CreateDateColumn({ nullable: false })
    createdAt?: Date;

  @UpdateDateColumn({ nullable: false })
    updatedAt?: Date;

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    // 檢查密碼是否存在且尚未被雜湊
    // 常見的 bcrypt 雜湊前綴: $2a$, $2b$, $2y$
    // 如果不像雜湊值，則進行雜湊
    if (this.password && !/^\$2[aby]\$/.test(this.password)) {
      this.password = await bcrypt.hash(this.password, 12);
    }
  }

  /**
   * 比較密碼
   * @param candidatePassword 候選密碼
   * @returns 密碼是否匹配
   */
  async comparePassword(candidatePassword: string): Promise<boolean> {
    // 確保密碼存在才進行比較
    if (!this.password) {
      return false;
    }
    return bcrypt.compare(candidatePassword, this.password);
  }

  /**
   * 創建驗證碼
   * @returns 驗證碼和令牌
   */
  async createVerificationToken(): Promise<{ token: string, code: string }> {
    // 生成6位數驗證碼
    const code = Array(6)
      .fill(0)
      .map(() => Math.floor(Math.random() * 10))
      .join('');

    // 存儲驗證碼和過期時間
    this.verificationToken = code;
    this.verificationTokenExpires = new Date(Date.now() + 10 * 60 * 1000); // 10分鐘

    return { token: '', code };
  }

  /**
   * 創建密碼重置碼
   * @returns 密碼重置碼和令牌
   */
  async createPasswordResetToken(): Promise<{ token: string, code: string }> {
    // 生成6位數重置碼
    const code = Array(6)
      .fill(0)
      .map(() => Math.floor(Math.random() * 10))
      .join('');

    // 存儲重置碼和過期時間
    this.passwordResetToken = code;
    this.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10分鐘

    return { token: '', code };
  }
}