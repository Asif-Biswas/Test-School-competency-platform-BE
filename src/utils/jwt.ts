import jwt, { SignOptions } from "jsonwebtoken"
import crypto from "crypto"

export type JwtPayload = { sub: string; role: string }

// Helper to get TTL as number with fallback
function getTTL(value: string | undefined, fallback: number): number {
  const num = Number(value);
  return isNaN(num) ? fallback : num;
}

export function signAccessToken(payload: JwtPayload) {
  const ttlMinutes = getTTL(process.env.ACCESS_TOKEN_TTL_MIN, 15);
  const options: SignOptions = {
    expiresIn: `${ttlMinutes}m`
  };
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET as string, options);
}

export function signRefreshToken(payload: JwtPayload) {
  const ttlDays = getTTL(process.env.REFRESH_TOKEN_TTL_DAYS, 7);
  const options: SignOptions = {
    expiresIn: `${ttlDays}d` 
  };
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET as string, options);
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
