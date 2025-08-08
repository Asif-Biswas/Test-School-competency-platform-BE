import { Router } from "express"
import { requireAuth, requireRole } from "../../middleware/auth.js"
import { User } from "../../models/User.js"

const router = Router()

router.get("/users", requireAuth, requireRole(["admin"]), async (req, res, next) => {
  try {
    const page = Number((req.query.page as string) || 1)
    const limit = Number((req.query.limit as string) || 10)
    const [items, total] = await Promise.all([
      User.find().select("_id name email role isVerified createdAt").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      User.countDocuments(),
    ])
    res.json({ items, totalPages: Math.ceil(total / limit) })
  } catch (err) {
    next(err)
  }
})

export default router
