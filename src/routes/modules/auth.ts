import { Router } from "express"
import { z } from "zod"
import createError from "http-errors"

import crypto from "crypto"
import { User } from "../../models/User.js"
import { comparePassword, hashPassword } from "../../utils/password.js"
import { hashToken, signAccessToken, signRefreshToken, verifyRefresh } from "../../utils/jwt.js"
import { OTP } from "../../models/OTP.js"
import { sendMail } from "../../utils/emai.js"

const router = Router()

const registerSchema = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(8) })
router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password } = registerSchema.parse(req.body)
    const existing = await User.findOne({ email })
    if (existing) throw createError(409, "Email already in use")
    const passwordHash = await hashPassword(password)
    const user = await User.create({ name, email, passwordHash, role: "student", isVerified: false })
    // create OTP
    const code = String(Math.floor(100000 + Math.random() * 900000))
    const codeHash = hashToken(code)
    const ttlMin = Number(process.env.OTP_TTL_MIN || 10)
    await OTP.create({ email, codeHash, expiresAt: new Date(Date.now() + ttlMin * 60000), consumed: false })
    await sendMail(email, "Verify your email", `<p>Your OTP is <b>${code}</b>. Expires in ${ttlMin} minutes.</p>`)
    res.json({ message: "Registered. OTP sent to email." })
  } catch (err) {
    next(err)
  }
})

router.post("/resend-otp", async (req, res, next) => {
  try {
    const email = z.string().email().parse(req.body.email)
    const user = await User.findOne({ email })
    if (!user) throw createError(404, "User not found")
    const code = String(Math.floor(100000 + Math.random() * 900000))
    const codeHash = hashToken(code)
    const ttlMin = Number(process.env.OTP_TTL_MIN || 10)
    await OTP.create({ email, codeHash, expiresAt: new Date(Date.now() + ttlMin * 60000), consumed: false })
    await sendMail(email, "Your OTP code", `<p>OTP: <b>${code}</b></p>`)
    res.json({ message: "OTP resent" })
  } catch (err) {
    next(err)
  }
})

router.post("/verify-otp", async (req, res, next) => {
  try {
    const { email, otp } = z.object({ email: z.string().email(), otp: z.string().min(4) }).parse(req.body)
    const found = await OTP.findOne({ email, consumed: false }).sort({ createdAt: -1 })
    if (!found) throw createError(400, "No OTP found")
    if (found.expiresAt.getTime() < Date.now()) throw createError(400, "OTP expired")
    if (found.codeHash !== hashToken(otp)) throw createError(400, "Invalid OTP")
    found.consumed = true
    await found.save()
    await User.updateOne({ email }, { $set: { isVerified: true } })
    res.json({ message: "Verified" })
  } catch (err) {
    next(err)
  }
})

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

router.post("/refresh", async (req, res, next) => {
  try {
    const token = req.cookies["refresh_token"]
    if (!token) throw createError(401, "Missing refresh token")
    const payload = verifyRefresh(token)
    const user = await User.findById(payload.sub)
    if (!user || !user.refreshTokenHash || user.refreshTokenHash !== hashToken(token)) throw createError(401, "Invalid refresh token")
    const accessToken = signAccessToken({ sub: String(user._id), role: user.role })
    res.json({ tokens: { accessToken } })
  } catch (err) {
    next(err)
  }
})

router.post("/logout", async (req, res, next) => {
  try {
    const token = req.cookies["refresh_token"]
    if (token) {
      res.clearCookie("refresh_token")
      const payload = (() => { try { return verifyRefresh(token) } catch { return null } })()
      if (payload) {
        await User.updateOne({ _id: payload.sub }, { $unset: { refreshTokenHash: 1 } })
      }
    }
    res.json({ message: "Logged out" })
  } catch (err) {
    next(err)
  }
})

router.post("/forgot-password", async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body)
    const user = await User.findOne({ email })
    if (!user) return res.json({ message: "If exists, email sent" })
    const token = crypto.randomBytes(32).toString("hex")
    const resetLink = `${process.env.CLIENT_ORIGIN}/auth/reset-password?token=${token}`
    // Store hashed token in user temp (for demo reuse refreshTokenHash field not to add extra schema)
    user.refreshTokenHash = hashToken(token)
    await user.save()
    await sendMail(email, "Password reset", `<p>Reset your password: <a href="${resetLink}">${resetLink}</a></p>`)
    res.json({ message: "If exists, email sent" })
  } catch (err) {
    next(err)
  }
})

router.post("/reset-password", async (req, res, next) => {
  try {
    const { token, password } = z.object({ token: z.string().min(10), password: z.string().min(8) }).parse(req.body)
    const hash = hashToken(token)
    const user = await User.findOne({ refreshTokenHash: hash })
    if (!user) throw createError(400, "Invalid token")
    user.passwordHash = await hashPassword(password)
    user.refreshTokenHash = null
    await user.save()
    res.json({ message: "Password updated" })
  } catch (err) {
    next(err)
  }
})

export default router
