import { Router } from "express"
import { z } from "zod"
import createError from "http-errors"
import { nanoid } from "nanoid"
import { Question } from "../../models/Question.js"
import { requireAuth, requireRole } from "../../middleware/auth.js"

const router = Router()

router.get("/", requireAuth, requireRole(["admin", "supervisor"]), async (req, res, next) => {
  try {
    const page = Number((req.query.page as string) || 1)
    const limit = Number((req.query.limit as string) || 10)
    const [items, total] = await Promise.all([
      Question.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Question.countDocuments(),
    ])
    res.json({ items, totalPages: Math.ceil(total / limit) })
  } catch (err) {
    next(err)
  }
})

const createSchema = z.object({
  level: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
  competency: z.string().min(2),
  text: z.string().min(4),
  choices: z.array(z.string().min(1)).min(2),
  correctIndex: z.number().min(0),
})
router.post("/", requireAuth, requireRole(["admin"]), async (req, res, next) => {
  try {
    const { level, competency, text, choices, correctIndex } = createSchema.parse(req.body)
    if (correctIndex >= choices.length) throw createError(400, "Invalid correctIndex")
    const choiceObjs = choices.map((t) => ({ id: nanoid(8), text: t }))
    const correctChoiceId = choiceObjs[correctIndex].id
    const q = await Question.create({ level, competency, text, choices: choiceObjs, correctChoiceId })
    res.status(201).json(q)
  } catch (err) {
    next(err)
  }
})

export default router
