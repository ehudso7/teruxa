import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import {
  PasswordManager,
  TokenManager,
  SessionManager,
  EmailVerification,
  PasswordReset,
  TwoFactorAuth,
  authRateLimiter,
  AuthRequest,
  authenticate,
} from '../middleware/auth';
import {
  ValidationError,
  AuthenticationError,
  ConflictError,
  NotFoundError,
  asyncHandler
} from '../middleware/errorTracking';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

// Register new user
router.post('/register', asyncHandler(async (req: Request, res: Response) => {
  const { email, password, name } = req.body;

  // Validate input
  if (!email || !password) {
    throw new ValidationError('Email and password are required');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format');
  }

  // Validate password strength
  const passwordValidation = PasswordManager.validate(password);
  if (!passwordValidation.valid) {
    throw new ValidationError(passwordValidation.errors.join(', '));
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new ConflictError('User already exists with this email');
  }

  // Get default role
  let defaultRole = await prisma.role.findFirst({
    where: { name: 'user' },
  });

  // Create default role if it doesn't exist
  if (!defaultRole) {
    defaultRole = await prisma.role.create({
      data: {
        name: 'user',
        permissions: ['read:own', 'write:own'],
      },
    });
  }

  // Create user
  const hashedPassword = await PasswordManager.hash(password);
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      roleId: defaultRole.id,
    },
    include: { role: true },
  });

  // Generate verification token
  const verificationToken = EmailVerification.generateVerificationToken();
  await prisma.verificationToken.create({
    data: {
      token: verificationToken,
      userId: user.id,
      type: 'EMAIL',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  });

  // Send verification email
  await EmailVerification.sendVerificationEmail(email, verificationToken);

  // Generate tokens
  const accessToken = TokenManager.generateAccessToken({
    id: user.id,
    email: user.email,
    role: user.role.name,
    permissions: user.role.permissions,
  });

  const refreshToken = TokenManager.generateRefreshToken({
    id: user.id,
    email: user.email,
    role: user.role.name,
  });

  logger.info('User registered successfully', { userId: user.id, email });

  res.status(201).json({
    message: 'Registration successful. Please verify your email.',
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.name,
    },
    accessToken,
    refreshToken,
  });
}));

// Login
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  // Check rate limiting
  if (!authRateLimiter.checkLimit(email)) {
    throw new AuthenticationError('Too many login attempts. Please try again later.');
  }

  // Validate input
  if (!email || !password) {
    throw new ValidationError('Email and password are required');
  }

  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true },
  });

  if (!user) {
    throw new AuthenticationError('Invalid credentials');
  }

  // Verify password
  const isValidPassword = await PasswordManager.verify(password, user.password);
  if (!isValidPassword) {
    throw new AuthenticationError('Invalid credentials');
  }

  // Reset rate limit on successful login
  authRateLimiter.reset(email);

  // Check if 2FA is enabled
  if (user.twoFactorEnabled) {
    // Generate and store 2FA token
    const twoFactorToken = TwoFactorAuth.generateToken(user.twoFactorSecret || '');

    await prisma.verificationToken.create({
      data: {
        token: twoFactorToken,
        userId: user.id,
        type: 'TWO_FACTOR',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      },
    });

    return res.json({
      message: 'Two-factor authentication required',
      requiresTwoFactor: true,
      userId: user.id,
    });
  }

  // Generate tokens
  const accessToken = TokenManager.generateAccessToken({
    id: user.id,
    email: user.email,
    role: user.role.name,
    permissions: user.role.permissions,
  });

  const refreshToken = TokenManager.generateRefreshToken({
    id: user.id,
    email: user.email,
    role: user.role.name,
  });

  // Create session
  const sessionToken = await SessionManager.createSession(user.id, req);

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  logger.info('User logged in successfully', { userId: user.id, email });

  res.json({
    message: 'Login successful',
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.name,
      emailVerified: user.emailVerified,
    },
    accessToken,
    refreshToken,
    sessionToken,
  });
}));

// Verify two-factor authentication
router.post('/verify-2fa', asyncHandler(async (req: Request, res: Response) => {
  const { userId, code } = req.body;

  if (!userId || !code) {
    throw new ValidationError('User ID and code are required');
  }

  // Find user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Verify 2FA code
  const isValid = TwoFactorAuth.verifyToken(user.twoFactorSecret || '', code);
  if (!isValid) {
    throw new AuthenticationError('Invalid two-factor code');
  }

  // Generate tokens
  const accessToken = TokenManager.generateAccessToken({
    id: user.id,
    email: user.email,
    role: user.role.name,
    permissions: user.role.permissions,
  });

  const refreshToken = TokenManager.generateRefreshToken({
    id: user.id,
    email: user.email,
    role: user.role.name,
  });

  // Create session
  const sessionToken = await SessionManager.createSession(user.id, req);

  res.json({
    message: '2FA verification successful',
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.name,
    },
    accessToken,
    refreshToken,
    sessionToken,
  });
}));

// Refresh token
router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new ValidationError('Refresh token is required');
  }

  // Check if token is revoked
  const isRevoked = await TokenManager.isTokenRevoked(refreshToken);
  if (isRevoked) {
    throw new AuthenticationError('Token has been revoked');
  }

  // Verify token
  const payload = TokenManager.verifyToken(refreshToken);

  // Get updated user data
  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    include: { role: true },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Generate new tokens
  const newAccessToken = TokenManager.generateAccessToken({
    id: user.id,
    email: user.email,
    role: user.role.name,
    permissions: user.role.permissions,
  });

  const newRefreshToken = TokenManager.generateRefreshToken({
    id: user.id,
    email: user.email,
    role: user.role.name,
  });

  res.json({
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  });
}));

// Logout
router.post('/logout', authenticate(), asyncHandler(async (req: AuthRequest, res: Response) => {
  const { refreshToken, sessionToken } = req.body;

  // Revoke refresh token
  if (refreshToken) {
    await TokenManager.revokeToken(refreshToken);
  }

  // Destroy session
  if (sessionToken) {
    await SessionManager.destroySession(sessionToken);
  }

  // Destroy express session if it exists
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        logger.error('Error destroying session', err);
      }
    });
  }

  logger.info('User logged out', { userId: req.user?.id });

  res.json({ message: 'Logout successful' });
}));

// Logout from all devices
router.post('/logout-all', authenticate(), asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new AuthenticationError('User not authenticated');
  }

  // Destroy all user sessions
  await SessionManager.destroyAllUserSessions(userId);

  // Revoke all refresh tokens (would need to track these in DB)
  await prisma.revokedToken.createMany({
    data: [{
      token: '*', // Placeholder - in production, track and revoke all user tokens
      userId,
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    }],
  });

  logger.info('User logged out from all devices', { userId });

  res.json({ message: 'Logged out from all devices successfully' });
}));

// Request password reset
router.post('/forgot-password', asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    throw new ValidationError('Email is required');
  }

  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
  });

  // Always return success to prevent user enumeration
  if (user) {
    // Generate reset token
    const resetToken = PasswordReset.generateResetToken(user.id);

    // Store token
    await prisma.verificationToken.create({
      data: {
        token: resetToken,
        userId: user.id,
        type: 'PASSWORD_RESET',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    // Send reset email
    await PasswordReset.sendResetEmail(email, resetToken);

    logger.info('Password reset requested', { userId: user.id, email });
  }

  res.json({
    message: 'If an account exists with this email, a password reset link has been sent.',
  });
}));

// Reset password
router.post('/reset-password', asyncHandler(async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    throw new ValidationError('Token and new password are required');
  }

  // Verify token
  const userId = await PasswordReset.verifyResetToken(token);
  if (!userId) {
    throw new AuthenticationError('Invalid or expired reset token');
  }

  // Validate new password
  const passwordValidation = PasswordManager.validate(newPassword);
  if (!passwordValidation.valid) {
    throw new ValidationError(passwordValidation.errors.join(', '));
  }

  // Hash new password
  const hashedPassword = await PasswordManager.hash(newPassword);

  // Update password
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  // Invalidate all sessions
  await SessionManager.destroyAllUserSessions(userId);

  // Delete used token
  await prisma.verificationToken.deleteMany({
    where: {
      token,
      type: 'PASSWORD_RESET',
    },
  });

  logger.info('Password reset successful', { userId });

  res.json({
    message: 'Password reset successful. Please login with your new password.',
  });
}));

// Verify email
router.get('/verify-email/:token', asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params;

  // Find token
  const verificationToken = await prisma.verificationToken.findFirst({
    where: {
      token,
      type: 'EMAIL',
      expiresAt: { gte: new Date() },
    },
  });

  if (!verificationToken) {
    throw new AuthenticationError('Invalid or expired verification token');
  }

  // Update user
  await prisma.user.update({
    where: { id: verificationToken.userId },
    data: { emailVerified: true },
  });

  // Delete used token
  await prisma.verificationToken.delete({
    where: { id: verificationToken.id },
  });

  logger.info('Email verified', { userId: verificationToken.userId });

  res.json({
    message: 'Email verified successfully',
  });
}));

// OAuth routes
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
}));

router.get('/google/callback',
  passport.authenticate('google', { session: false }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const user = req.user;

    if (!user) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
    }

    // Generate tokens
    const accessToken = TokenManager.generateAccessToken(user);
    const refreshToken = TokenManager.generateRefreshToken(user);

    // Redirect to frontend with tokens
    res.redirect(
      `${process.env.FRONTEND_URL}/auth/callback?` +
      `accessToken=${accessToken}&refreshToken=${refreshToken}`
    );
  })
);

// Get current user
router.get('/me', authenticate(), asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: {
        select: {
          name: true,
          permissions: true,
        },
      },
      emailVerified: true,
      twoFactorEnabled: true,
      createdAt: true,
      lastLogin: true,
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  res.json({ user });
}));

// Enable two-factor authentication
router.post('/enable-2fa', authenticate(), asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new AuthenticationError('User not authenticated');
  }

  // Generate secret
  const secret = TwoFactorAuth.generateSecret();

  // Update user
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorSecret: secret,
      twoFactorEnabled: true,
    },
  });

  logger.info('2FA enabled', { userId });

  res.json({
    message: 'Two-factor authentication enabled',
    secret, // In production, generate QR code
  });
}));

// Disable two-factor authentication
router.post('/disable-2fa', authenticate(), asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { password } = req.body;

  if (!userId) {
    throw new AuthenticationError('User not authenticated');
  }

  if (!password) {
    throw new ValidationError('Password is required to disable 2FA');
  }

  // Verify password
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const isValidPassword = await PasswordManager.verify(password, user.password);
  if (!isValidPassword) {
    throw new AuthenticationError('Invalid password');
  }

  // Update user
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorSecret: null,
      twoFactorEnabled: false,
    },
  });

  logger.info('2FA disabled', { userId });

  res.json({
    message: 'Two-factor authentication disabled',
  });
}));

export default router;