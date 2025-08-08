import { Router } from "express"
import { z } from "zod"
import createError from "http-errors"
import { User } from "../../models/User"
import { OTP } from "../../models/OTP"
import { hashPassword, comparePassword } from "../../utils/password"
import { signAccessToken, signRefreshToken, hashToken, verifyRefresh } from "../../utils/jwt"
import { sendMail } from "../../utils/email"
import crypto from "crypto"

const router = Router()

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = z.object({ email: z.string().email(), password: z.string().min(6) }).parse(req.body)
    const user = await User.findOne({ email })
    if (!user) throw createError(401, "Invalid credentials")
    const ok = await comparePassword(password, user.passwordHash)
    if (!ok) throw createError(401, "Invalid credentials")
    if (!user.isVerified) throw createError(403, "Email not verified")
    const accessToken = signAccessToken({ sub: String(user._id), role: user.role })
    const refreshToken = signRefreshToken({ sub: String(user._id), role: user.role })
    user.refreshTokenHash = hashToken(refreshToken)
    await user.save()
    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7) * 86400000,
    })
    res.json({
      user: { _id: user._id, name: user.name, email: user.email, role: user.role, isVerified: user.isVerified },
      tokens: { accessToken },
    })
  } catch (err) {
    next(err)
  }
})