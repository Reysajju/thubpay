import { SignJWT, jwtVerify } from 'jose';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export interface JWTPayload {
  userId: string;
  email: string;
  workspaceId?: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface AuthResult {
  success: boolean;
  token?: string;
  refreshToken?: string;
  user?: any;
  error?: string;
}

/**
 * JWT signing key
 */
async function getSigningKey(): Promise<Uint8Array> {
  const secret = process.env.JWT_SECRET || '';
  if (!secret) throw new Error('JWT_SECRET not configured');
  return new TextEncoder().encode(secret);
}

/**
 * Generate JWT access token
 */
export async function generateAccessToken(payload: JWTPayload): Promise<string> {
  const secret = await getSigningKey();

  return new SignJWT({ ...payload as any })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m') // Short-lived token
    .sign(secret);
}

/**
 * Generate JWT refresh token
 */
export async function generateRefreshToken(payload: JWTPayload): Promise<string> {
  const secret = await getSigningKey();

  return new SignJWT({ ...payload as any, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d') // Longer-lived token
    .sign(secret);
}

/**
 * Verify JWT access token
 */
export async function verifyAccessToken(token: string): Promise<JWTPayload | null> {
  try {
    const secret = await getSigningKey();
    const { payload: decodedPayload } = await jwtVerify(token, secret);
    return decodedPayload as any as JWTPayload;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Verify JWT refresh token
 */
export async function verifyRefreshToken(token: string): Promise<JWTPayload | null> {
  try {
    const secret = await getSigningKey();
    const { payload: decodedPayload } = await jwtVerify(token, secret);
    return decodedPayload as any as JWTPayload;
  } catch (error) {
    console.error('Refresh token verification failed:', error);
    return null;
  }
}

/**
 * Create tokens (access + refresh)
 */
export async function createTokens(userId: string, email: string, workspaceId?: string, role = 'member'): Promise<AuthResult> {
  const accessToken = await generateAccessToken({
    userId,
    email,
    workspaceId,
    role
  });

  const refreshToken = await generateRefreshToken({
    userId,
    email,
    workspaceId,
    role
  });

  return {
    success: true,
    token: accessToken,
    refreshToken
  };
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<AuthResult> {
  const payload = await verifyRefreshToken(refreshToken);

  if (!payload) {
    return {
      success: false,
      error: 'Invalid refresh token'
    };
  }

  return createTokens(payload.userId, payload.email, payload.workspaceId, payload.role);
}

/**
 * Hash password with bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12); // Cost factor 12
}

/**
 * Compare password with hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Sign up new user
 */
export async function signUp(email: string, password: string, workspaceName?: string): Promise<AuthResult> {
  try {
    // Create user in Supabase Auth
    const { data: user, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }

    // Create workspace
    let workspaceId: string | undefined;
    if (workspaceName && user.user) {
      const { data: workspace, error: workspaceError } = await admin
        .from('workspaces')
        .insert({
          name: workspaceName,
          owner_id: user.user.id
        })
        .select()
        .single();

      if (workspaceError) {
        throw new Error(`Failed to create workspace: ${workspaceError.message}`);
      }

      workspaceId = workspace?.id;

      // Add owner as admin
      await admin
        .from('workspace_members')
        .insert({
          workspace_id: workspace.id,
          user_id: user.user.id,
          role: 'owner'
        });

      // Create gateway credentials
      await admin
        .from('gateway_credentials')
        .insert({
          workspace_id: workspace.id,
          gateway_slug: 'stripe',
          type: 'api_key',
          key_type: 'publishable_key',
          key_value: '',
          mode: 'test',
          is_default: true
        });

      // Create brand
      await admin
        .from('brands')
        .insert({
          workspace_id: workspace.id,
          name: workspaceName,
          logo_url: ''
        });
    }

    // Generate tokens
    return createTokens(user.user!.id, email, workspaceId, 'owner');
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during signup'
    };
  }
}

/**
 * Sign in user
 */
export async function signIn(email: string, password: string): Promise<AuthResult> {
  try {
    // Get user from Supabase using admin listUsers
    const { data: { users }, error } = await admin.auth.admin.listUsers();

    const user = users?.find((u: any) => u.email === email);

    if (error || !user) {
      return {
        success: false,
        error: 'Invalid credentials'
      };
    }

    // Verify password
    if (!(await comparePassword(password, user.user_metadata?.password_hash || ''))) {
      return {
        success: false,
        error: 'Invalid credentials'
      };
    }

    // Get user's workspace
    const { data: workspace } = await admin
      .from('workspaces')
      .select('id')
      .eq('owner_id', user.id)
      .single();

    const workspaceId = workspace?.id;

    // Get role from workspace members
    const { data: member } = await admin
      .from('workspace_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('workspace_id', workspaceId)
      .single();

    const role = member?.role || 'member';

    return createTokens(user.id, email, workspaceId, role);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during sign in'
    };
  }
}

/**
 * Sign out user (invalidate refresh token)
 */
export async function signOut(refreshToken: string): Promise<boolean> {
  try {
    // In production, you'd store refresh tokens in Redis and invalidate them
    // For now, we'll just verify the token
    const payload = await verifyRefreshToken(refreshToken);
    return payload !== null;
  } catch (error) {
    return false;
  }
}

/**
 * Get user profile
 */
export async function getUserProfile(userId: string) {
  try {
    const { data: user } = await admin.auth.admin.getUserById(userId);

    if (!user?.user) {
      throw new Error('User not found');
    }

    // Get workspace
    const { data: workspace } = await admin
      .from('workspaces')
      .select('id, name')
      .eq('owner_id', userId)
      .single();

    // Get member roles
    const { data: members } = await admin
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', userId);

    const roles = members?.reduce((acc: Record<string, string>, m) => {
      acc[m.workspace_id] = m.role;
      return acc;
    }, {});

    return {
      id: user.user.id,
      email: user.user.email,
      full_name: user.user.user_metadata?.full_name,
      avatar_url: user.user.user_metadata?.avatar_url,
      workspace,
      roles
    };
  } catch (error) {
    throw new Error(`Failed to get user profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Update password
 */
export async function updatePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
  try {
    // Get user to verify current password
    const { data: { user } } = await admin.auth.admin.getUserById(userId);

    if (!user) {
      return false;
    }

    // Verify current password against stored hash
    const isCurrentPasswordValid = await comparePassword(currentPassword, user.user_metadata?.password_hash || '');
    if (!isCurrentPasswordValid) {
      return false;
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password hash in user metadata
    await admin.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...user.user_metadata,
        password_hash: hashedPassword
      }
    });

    return true;
  } catch (error) {
    console.error('Password update error:', error);
    return false;
  }
}
