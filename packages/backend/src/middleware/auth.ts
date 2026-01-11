import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { AuthenticationError, AuthorizationError } from './errorTracking';

const prisma = new PrismaClient();

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

// Types
export interface UserPayload {
  id: string;
  email: string;
  role: string;
  permissions?: string[];
}

export interface AuthRequest extends Request {
  user?: UserPayload;
  session?: {
    userId?: string;
    destroy: (callback: (err: any) => void) => void;
  };
}

// Password utilities
export class PasswordManager {
  static async hash(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  static async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static validate(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Token management
export class TokenManager {
  static generateAccessToken(user: UserPayload): string {
    return jwt.sign(user, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });
  }

  static generateRefreshToken(user: UserPayload): string {
    return jwt.sign(
      { id: user.id, type: 'refresh' },
      JWT_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    );
  }

  static verifyToken(token: string): UserPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as UserPayload;
    } catch (error) {
      throw new AuthenticationError('Invalid or expired token');
    }
  }

  static async revokeToken(token: string): Promise<void> {
    // Store revoked tokens in database or Redis
    await prisma.revokedToken.create({
      data: {
        token,
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });
  }

  static async isTokenRevoked(token: string): Promise<boolean> {
    const revokedToken = await prisma.revokedToken.findFirst({
      where: {
        token,
        expiresAt: { gte: new Date() },
      },
    });
    return !!revokedToken;
  }
}

// Session management
export class SessionManager {
  static async createSession(userId: string, req: Request): Promise<string> {
    const sessionToken = jwt.sign(
      { userId, type: 'session' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Store session in database
    await prisma.session.create({
      data: {
        token: sessionToken,
        userId,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || '',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    return sessionToken;
  }

  static async validateSession(token: string): Promise<{ userId: string } | null> {
    const session = await prisma.session.findFirst({
      where: {
        token,
        expiresAt: { gte: new Date() },
      },
    });

    if (!session) {
      return null;
    }

    // Update last activity
    await prisma.session.update({
      where: { id: session.id },
      data: { lastActivity: new Date() },
    });

    return { userId: session.userId };
  }

  static async destroySession(token: string): Promise<void> {
    await prisma.session.deleteMany({
      where: { token },
    });
  }

  static async destroyAllUserSessions(userId: string): Promise<void> {
    await prisma.session.deleteMany({
      where: { userId },
    });
  }
}

// Passport configuration
export function configurePassport() {
  // Local strategy
  passport.use(
    new LocalStrategy(
      {
        usernameField: 'email',
        passwordField: 'password',
      },
      async (email, password, done) => {
        try {
          const user = await prisma.user.findUnique({
            where: { email },
            include: { role: true },
          });

          if (!user) {
            return done(null, false, { message: 'Invalid credentials' });
          }

          const isValidPassword = await PasswordManager.verify(password, user.password);
          if (!isValidPassword) {
            return done(null, false, { message: 'Invalid credentials' });
          }

          const userPayload: UserPayload = {
            id: user.id,
            email: user.email,
            role: user.role.name,
            permissions: user.role.permissions,
          };

          return done(null, userPayload);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  // JWT strategy
  passport.use(
    new JwtStrategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: JWT_SECRET,
      },
      async (payload: UserPayload, done) => {
        try {
          const user = await prisma.user.findUnique({
            where: { id: payload.id },
            include: { role: true },
          });

          if (!user) {
            return done(null, false);
          }

          const userPayload: UserPayload = {
            id: user.id,
            email: user.email,
            role: user.role.name,
            permissions: user.role.permissions,
          };

          return done(null, userPayload);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  // Google OAuth strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: '/api/auth/google/callback',
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            let user = await prisma.user.findUnique({
              where: { googleId: profile.id },
              include: { role: true },
            });

            if (!user) {
              // Check if email already exists
              const existingUser = await prisma.user.findUnique({
                where: { email: profile.emails?.[0]?.value },
              });

              if (existingUser) {
                // Link Google account to existing user
                user = await prisma.user.update({
                  where: { id: existingUser.id },
                  data: { googleId: profile.id },
                  include: { role: true },
                });
              } else {
                // Create new user
                const defaultRole = await prisma.role.findFirst({
                  where: { name: 'user' },
                });

                user = await prisma.user.create({
                  data: {
                    email: profile.emails?.[0]?.value || '',
                    name: profile.displayName,
                    googleId: profile.id,
                    profileImage: profile.photos?.[0]?.value,
                    emailVerified: true,
                    roleId: defaultRole?.id || '',
                    password: '', // No password for OAuth users
                  },
                  include: { role: true },
                });
              }
            }

            const userPayload: UserPayload = {
              id: user.id,
              email: user.email,
              role: user.role.name,
              permissions: user.role.permissions,
            };

            return done(null, userPayload);
          } catch (error) {
            return done(error as Error);
          }
        }
      )
    );
  }

  // Serialize/deserialize user for session
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        include: { role: true },
      });

      if (!user) {
        return done(null, false);
      }

      const userPayload: UserPayload = {
        id: user.id,
        email: user.email,
        role: user.role.name,
        permissions: user.role.permissions,
      };

      done(null, userPayload);
    } catch (error) {
      done(error);
    }
  });
}

// Authentication middleware
export function authenticate(strategy: string = 'jwt') {
  return (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate(strategy, { session: false }, (err: any, user: UserPayload) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        throw new AuthenticationError('Authentication required');
      }
      (req as AuthRequest).user = user;
      next();
    })(req, res, next);
  };
}

// Authorization middleware
export function authorize(...requiredPermissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthRequest).user;

    if (!user) {
      throw new AuthenticationError('Authentication required');
    }

    // Super admin bypass
    if (user.role === 'admin') {
      return next();
    }

    // Check permissions
    const hasPermission = requiredPermissions.every(permission =>
      user.permissions?.includes(permission)
    );

    if (!hasPermission) {
      throw new AuthorizationError('Insufficient permissions');
    }

    next();
  };
}

// Rate limiting for auth endpoints
export class AuthRateLimiter {
  private attempts: Map<string, { count: number; resetTime: number }> = new Map();
  private readonly maxAttempts = 5;
  private readonly windowMs = 15 * 60 * 1000; // 15 minutes

  checkLimit(identifier: string): boolean {
    const now = Date.now();
    const attempt = this.attempts.get(identifier);

    if (!attempt || attempt.resetTime < now) {
      this.attempts.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    if (attempt.count >= this.maxAttempts) {
      return false;
    }

    attempt.count++;
    return true;
  }

  reset(identifier: string): void {
    this.attempts.delete(identifier);
  }
}

export const authRateLimiter = new AuthRateLimiter();

// Two-factor authentication
export class TwoFactorAuth {
  static generateSecret(): string {
    // In production, use a library like speakeasy
    return Math.random().toString(36).substring(2, 15);
  }

  static generateToken(secret: string): string {
    // In production, use TOTP algorithm
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  static verifyToken(secret: string, token: string): boolean {
    // In production, verify TOTP token
    return true; // Placeholder
  }
}

// Email verification
export class EmailVerification {
  static async sendVerificationEmail(email: string, token: string): Promise<void> {
    // Send email with verification link
    logger.info(`Verification email would be sent to ${email} with token ${token}`);
  }

  static generateVerificationToken(): string {
    return jwt.sign(
      { type: 'email_verification' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
  }

  static async verifyEmail(token: string): Promise<boolean> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      return decoded.type === 'email_verification';
    } catch {
      return false;
    }
  }
}

// Password reset
export class PasswordReset {
  static async sendResetEmail(email: string, token: string): Promise<void> {
    // Send password reset email
    logger.info(`Password reset email would be sent to ${email} with token ${token}`);
  }

  static generateResetToken(userId: string): string {
    return jwt.sign(
      { userId, type: 'password_reset' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  }

  static async verifyResetToken(token: string): Promise<string | null> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.type === 'password_reset') {
        return decoded.userId;
      }
      return null;
    } catch {
      return null;
    }
  }
}