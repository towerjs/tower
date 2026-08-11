import type { GatehouseUser, GatehouseSession } from './types.js'

export function mapUser(user: Record<string, unknown>): GatehouseUser {
  return {
    id: user.id as string,
    name: user.name as string,
    email: user.email as string,
    emailVerified: user.emailVerified as boolean,
    image: (user.image as string) ?? null,
    createdAt: user.createdAt as Date,
    updatedAt: user.updatedAt as Date,
    twoFactorEnabled: user.twoFactorEnabled as boolean | undefined,
    banned: user.banned as boolean | undefined,
    banReason: user.banReason as string | null | undefined,
    role: user.role as string | undefined,
  }
}

export function mapSession(session: Record<string, unknown>): GatehouseSession {
  return {
    id: session.id as string,
    userId: session.userId as string,
    expiresAt: session.expiresAt as Date,
    token: session.token as string,
    ipAddress: session.ipAddress as string | null | undefined,
    userAgent: session.userAgent as string | null | undefined,
  }
}
