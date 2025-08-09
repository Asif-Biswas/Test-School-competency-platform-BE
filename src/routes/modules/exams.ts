import { Router } from "express"
import { z } from "zod"
import createError from "http-errors"
import { requireAuth } from "../../middleware/auth"
import { Exam } from "../../models/Exam"
import { Attempt } from "../../models/Attempt"
import { Question } from "../../models/Question"
import { Answer } from "../../models/Answer"
import { Certificate } from "../../models/Certificate"
import { Types } from "mongoose"
import PDFDocument from "pdfkit"
import { User } from "../../models/User"
import { sendMail } from "../../utils/emai"

const router = Router()

const stepLevels: Record<"STEP_1" | "STEP_2" | "STEP_3", string[]> = {
  STEP_1: ["A1", "A2"],
  STEP_2: ["B1", "B2"],
  STEP_3: ["C1", "C2"],
}

const submitSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string(),
      choiceId: z.string(),
    }),
  ),
})

function scoreToLevel(step: "STEP_1" | "STEP_2" | "STEP_3", pct: number) {
  if (step === "STEP_1") {
    if (pct < 25) return { level: "FAIL_LOCK", proceed: false }
    if (pct < 50) return { level: "A1", proceed: false }
    if (pct < 75) return { level: "A2", proceed: false }
    return { level: "A2", proceed: true }
  } else if (step === "STEP_2") {
    if (pct < 25) return { level: "A2", proceed: false }
    if (pct < 50) return { level: "B1", proceed: false }
    if (pct < 75) return { level: "B2", proceed: false }
    return { level: "B2", proceed: true }
  } else {
    if (pct < 25) return { level: "B2", proceed: false }
    if (pct < 50) return { level: "C1", proceed: false }
    return { level: "C2", proceed: false }
  }
}

router.get("/status", requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.id
    let exam = await Exam.findOne({ userId })
    if (!exam) exam = await Exam.create({ userId, status: "not_started", currentStep: null })
    res.json({
      status: exam.status,
      currentStep: exam.currentStep,
      dueAt: exam.dueAt,
      completed: exam.status === "completed",
      result: exam.finalLevel ? { level: exam.finalLevel } : null,
    })
  } catch (err) {
    next(err)
  }
})

router.post("/start", requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.id
    const secondsPerQuestion = Number(process.env.DEFAULT_SECONDS_PER_QUESTION || 60)
    let exam = await Exam.findOne({ userId })
    if (!exam) exam = await Exam.create({ userId, status: "not_started", currentStep: null })
    if (exam.status === "locked") throw createError(403, "You cannot retake after failing step 1.")
    let step: "STEP_1" | "STEP_2" | "STEP_3" = "STEP_1"
    if (exam.currentStep) step = exam.currentStep
    else if (exam.step1Score != null && exam.step2Score == null) step = "STEP_2"
    else if (exam.step2Score != null && exam.step3Score == null) step = "STEP_3"
    else if (exam.step3Score != null) return res.json({ message: "Exam complete", step: null })

    const totalQuestions = 44
    const dueAt = new Date(Date.now() + secondsPerQuestion * 1000 * totalQuestions)
    exam.status = "in_progress"
    exam.currentStep = step
    exam.dueAt = dueAt
    await exam.save()

    const attempt = await Attempt.create({ examId: exam._id, step, score: 0, total: 0, startedAt: new Date() })
    res.json({ step, dueAt, attemptId: attempt._id })
  } catch (err) {
    next(err)
  }
})

router.get("/questions", requireAuth, async (req, res, next) => {
  try {
    const step = (req.query.step as string) || "STEP_1"
    if (!["STEP_1", "STEP_2", "STEP_3"].includes(step)) throw createError(400, "Invalid step")
    const levels = stepLevels[step as "STEP_1" | "STEP_2" | "STEP_3"]
    const targetTotal = 44
    const perLevel = Math.ceil(targetTotal / levels.length)

    const samples = await Promise.all(
      levels.map(async (lvl) => Question.aggregate([{ $match: { level: lvl } }, { $sample: { size: perLevel } }])),
    )
    const merged = samples.flat()
    if (merged.length < targetTotal) {
      const need = targetTotal - merged.length
      const topUp = await Question.aggregate([{ $match: { level: { $in: levels } } }, { $sample: { size: need } }])
      const existingIds = new Set(merged.map((q: any) => String(q._id)))
      for (const q of topUp) if (!existingIds.has(String(q._id))) merged.push(q)
    }

    res.json({ questions: merged.map((q: any) => ({ _id: q._id, text: q.text, choices: q.choices })) })
  } catch (err) {
    next(err)
  }
})

router.post("/submit", requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.id
    const { answers } = submitSchema.parse(req.body)
    const exam = await Exam.findOne({ userId })

    if (!exam || !exam.currentStep) {
      return res.status(200).json({ message: "No active step", correct: 0, total: 44, pct: 0, nextStep: null, finalLevel: null })
    }
    if (exam.status !== "in_progress") {
      return res.status(200).json({
        message: "Exam not in progress",
        correct: 0,
        total: 44,
        pct: 0,
        nextStep: exam.currentStep ?? null,
        finalLevel: exam.finalLevel ?? null,
      })
    }

    const attempt = await Attempt.findOne({ examId: exam._id, step: exam.currentStep }).sort({ startedAt: -1 })
    if (attempt?.submittedAt) {
      return res.status(200).json({
        message: "Already submitted",
        correct: attempt.score,
        total: attempt.total,
        pct: attempt.total ? (attempt.score / attempt.total) * 100 : 0,
        nextStep: exam.currentStep ?? null,
        finalLevel: exam.finalLevel ?? null,
      })
    }

    const currentStep = exam.currentStep
    const levels = stepLevels[currentStep]
    const ids = answers.map((a) => a.questionId)
    const questions = await Question.find({ _id: { $in: ids }, level: { $in: levels } })
    let correct = 0
    const answerDocs: any[] = []
    for (const ans of answers) {
      const q = questions.find((qq) => String(qq._id) === ans.questionId)
      const isCorrect = q ? q.correctChoiceId === ans.choiceId : false
      if (isCorrect) correct++
      if (attempt?._id && q) {
        answerDocs.push({
          attemptId: attempt._id,
          questionId: q._id,
          choiceId: ans.choiceId,
          correct: isCorrect,
        })
      }
    }
    if (answerDocs.length) await Answer.insertMany(answerDocs)

    const total = Math.max(44, answers.length)
    const pct = (correct / total) * 100

    if (attempt) {
      attempt.score = correct
      attempt.total = total
      attempt.submittedAt = new Date()
      await attempt.save()
    }

    const result = scoreToLevel(currentStep, pct)

    if (currentStep === "STEP_1") {
      if (result.level === "FAIL_LOCK") {
        exam.status = "locked"
        exam.finalLevel = null
        exam.currentStep = null
        exam.step1Score = correct
      } else {
        exam.step1Score = correct
        if (result.proceed) {
          exam.currentStep = "STEP_2"
          exam.dueAt = null
        } else {
          exam.status = "completed"
          exam.finalLevel = result.level
          exam.currentStep = null
        }
      }
    } else if (currentStep === "STEP_2") {
      exam.step2Score = correct
      if (result.proceed) {
        exam.currentStep = "STEP_3"
        exam.dueAt = null
      } else {
        exam.status = "completed"
        exam.finalLevel = result.level
        exam.currentStep = null
      }
    } else {
      exam.step3Score = correct
      exam.status = "completed"
      exam.finalLevel = result.level
      exam.currentStep = null
    }

    await exam.save()

    // Auto-generate certificate on completion and email it
    const latestAttempt = await Attempt.findOne({ examId: exam._id }).sort({ submittedAt: -1 })
    if (exam.status === "completed" && exam.finalLevel && latestAttempt?._id) {
      const existing = await Certificate.findOne({ userId: new Types.ObjectId(userId), attemptId: latestAttempt._id })
      let cert = existing
      if (!existing) {
        cert = await Certificate.create({
          userId: new Types.ObjectId(userId),
          attemptId: latestAttempt._id,
          level: exam.finalLevel,
        })
      }
      try {
        const user = await User.findById(userId).select("name email")
        // Create PDF buffer
        const buffer = await new Promise<Buffer>((resolve) => {
          const doc = new PDFDocument({ size: "A4", margin: 50 })
          const chunks: Uint8Array[] = []
          doc.on("data", (chunk) => chunks.push(chunk))
          doc.on("end", () => resolve(Buffer.concat(chunks)))
          doc.fontSize(24).text("Test_School Digital Competency Certificate", { align: "center" })
          doc.moveDown()
          doc.fontSize(16).text(`Awarded to: ${user?.name ?? "Candidate"}`, { align: "center" })
          doc.fontSize(12).text(`Email: ${user?.email ?? ""}`, { align: "center" })
          doc.moveDown()
          doc.fontSize(20).text(`Level: ${exam.finalLevel}`, { align: "center" })
          doc.moveDown()
          doc.fontSize(12).text(`Issued: ${cert?.createdAt.toDateString()}`, { align: "center" })
          doc.end()
        })
        await sendMail(
          user?.email ?? "",
          "Your Test_School Certificate",
          `<p>Hi ${user?.name ?? "Candidate"},</p><p>Congratulations! Your certificate (level ${exam.finalLevel}) is attached.</p>`,
          [{ filename: `certificate-${cert?._id}.pdf`, content: buffer }],
        )
      } catch {
        // email failure should not block response
      }
    }

    res.json({
      message: "Submitted",
      correct,
      total,
      pct,
      nextStep: exam.currentStep ?? null,
      finalLevel: exam.finalLevel ?? null,
    })
  } catch (err) {
    next(err)
  }
})

export default router
