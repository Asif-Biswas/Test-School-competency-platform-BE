import jwt from "jsonwebtoken"
import crypto from "crypto"

export type JwtPayload = { sub: string; role: string }

export function signAccessToken(payload: JwtPayload) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET as string, { expiresIn: `${process.env.ACCESS_TOKEN_TTL_MIN || 15}m` })
}

export function signRefreshToken(payload: JwtPayload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET as string, { expiresIn: `${process.env.REFRESH_TOKEN_TTL_DAYS || 7}d` })
}

export function verifyAccess(token: string) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET as string) as JwtPayload & { iat: number; exp: number }
}

export function verifyRefresh(token: string) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET as string) as JwtPayload & { iat: number; exp: number }
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex")
}
