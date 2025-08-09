import { Router } from "express"
import { requireAuth } from "../../middleware/auth"
import { Exam } from "../../models/Exam"
import { Attempt } from "../../models/Attempt"
import { Certificate } from "../../models/Certificate"
import { User } from "../../models/User"
import PDFDocument from "pdfkit"
import { Types } from "mongoose"

const router = Router()

router.get("/my", requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.id
    const items = await Certificate.find({ userId }).sort({ createdAt: -1 })
    res.json({ items })
  } catch (err) {
    next(err)
  }
})

router.get("/my/latest/pdf", requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.id
    const user = await User.findById(userId).select("name email")
    let cert = await Certificate.findOne({ userId }).sort({ createdAt: -1 })

    // Generate on demand if needed
    if (!cert) {
      const exam = await Exam.findOne({ userId, status: "completed", finalLevel: { $ne: null } }).sort({
        updatedAt: -1,
      })
      if (exam && exam.finalLevel) {
        const attempt = await Attempt.findOne({ examId: exam._id }).sort({ submittedAt: -1 })
        if (attempt?._id) {
          cert = await Certificate.create({
            userId: new Types.ObjectId(userId),
            attemptId: attempt._id,
            level: exam.finalLevel,
          })
        }
      }
    }

    if (!cert) return res.status(404).json({ message: "No certificate available" })

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `inline; filename="certificate-${cert._id}.pdf"`)
    const doc = new PDFDocument({ size: "A4", margin: 50 })
    doc.pipe(res)
    doc.fontSize(24).text("Test School Digital Competency Certificate", { align: "center" })
    doc.moveDown()
    doc.fontSize(16).text(`Awarded to: ${user?.name ?? "Candidate"}`, { align: "center" })
    doc.fontSize(12).text(`Email: ${user?.email ?? ""}`, { align: "center" })
    doc.moveDown()
    doc.fontSize(20).text(`Level: ${cert.level}`, { align: "center" })
    doc.moveDown()
    doc.fontSize(12).text(`Issued: ${cert.createdAt.toDateString()}`, { align: "center" })
    doc.end()
  } catch (err) {
    next(err)
  }
})

router.get("/:id/pdf", requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.id
    const cert = await Certificate.findOne({ _id: req.params.id, userId })
    if (!cert) return res.status(404).json({ message: "Not found" })
    const user = await User.findById(userId).select("name email")

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `inline; filename="certificate-${cert._id}.pdf"`)
    const doc = new PDFDocument({ size: "A4", margin: 50 })
    doc.pipe(res)
    doc.fontSize(24).text("Test_School Digital Competency Certificate", { align: "center" })
    doc.moveDown()
    doc.fontSize(16).text(`Awarded to: ${user?.name ?? "Candidate"}`, { align: "center" })
    doc.fontSize(12).text(`Email: ${user?.email ?? ""}`, { align: "center" })
    doc.moveDown()
    doc.fontSize(20).text(`Level: ${cert.level}`, { align: "center" })
    doc.moveDown()
    doc.fontSize(12).text(`Issued: ${cert.createdAt.toDateString()}`, { align: "center" })
    doc.end()
  } catch (err) {
    next(err)
  }
})

export default router
