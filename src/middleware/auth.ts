import { Request, Response, NextFunction } from "express"
import createError from "http-errors"
import { verifyAccess } from "../utils/jwt.js"


export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization || ""
    const token = header.startsWith("Bearer ") ? header.slice(7) : undefined
    if (!token) throw createError(401, "Missing token")
    const payload = verifyAccess(token)
    ;(req as any).user = { id: payload.sub, role: payload.role }
    next()
  } catch {
    next(createError(401, "Unauthorized"))
  }
}

export function requireRole(roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as any).user
    if (!user || !roles.includes(user.role)) {
      return next(createError(403, "Forbidden"))
    }
    next()
  }
}
