import { Router } from "express"
import { requireAuth, requireRole } from "../../middleware/auth"
import { User } from "../../models/User"
import { Exam } from "../../models/Exam"
import { Certificate } from "../../models/Certificate"
import { Answer } from "../../models/Answer"

const router = Router()

router.get("/users", requireAuth, requireRole(["admin"]), async (req, res, next) => {
  try {
    const page = Number((req.query.page as string) || 1)
    const limit = Number((req.query.limit as string) || 10)
    const [items, total] = await Promise.all([
      User.find()
        .select("_id name email role isVerified createdAt")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(),
    ])
    res.json({ items, totalPages: Math.ceil(total / limit) })
  } catch (err) {
    next(err)
  }
})

//  analytics for admin dashboard
router.get("/stats", requireAuth, requireRole(["admin"]), async (_req, res, next) => {
  try {
    const [usersByRole, examsByStatus, certificatesByLevel, avgScoreByStep, dailyRegistrations, competencyAccuracy] =
      await Promise.all([
        User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
        Exam.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
        Certificate.aggregate([{ $group: { _id: "$level", count: { $sum: 1 } } }]),
        // Average score per step from Atempts
        // Since total may vary, use avg(score/total)
        // Fallback protect against divide-by-zero using $cond
        Answer.db
          .collection("attempts")
          .aggregate([
            {
              $group: {
                _id: "$step",
                avgPct: {
                  $avg: {
                    $cond: [{ $gt: ["$total", 0] }, { $multiply: [{ $divide: ["$score", "$total"] }, 100] }, 0],
                  },
                },
              },
            },
          ])
          .toArray(),
        // Last 7 days registrations
        User.aggregate([
          { $match: { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        // Competency accuracy: join Answers -> Questions to derive competency, compute accuracy
        Answer.aggregate([
          {
            $lookup: {
              from: "questions",
              localField: "questionId",
              foreignField: "_id",
              as: "q",
            },
          },
          { $unwind: "$q" },
          {
            $group: {
              _id: "$q.competency",
              total: { $sum: 1 },
              correct: { $sum: { $cond: ["$correct", 1, 0] } },
            },
          },
          {
            $project: {
              _id: 1,
              total: 1,
              correct: 1,
              pct: { $cond: [{ $gt: ["$total", 0] }, { $multiply: [{ $divide: ["$correct", "$total"] }, 100] }, 0] },
            },
          },
          { $sort: { pct: -1 } },
          { $limit: 10 },
        ]),
      ])

    res.json({
      usersByRole,
      examsByStatus,
      certificatesByLevel,
      avgScoreByStep,
      dailyRegistrations,
      competencyAccuracy,
    })
  } catch (err) {
    next(err)
  }
})

//  admin certifiates list with pagination and user info
router.get("/certificates", requireAuth, requireRole(["admin"]), async (req, res, next) => {
  try {
    const page = Math.max(1, Number((req.query.page as string) || 1))
    const limit = Math.max(1, Math.min(100, Number((req.query.limit as string) || 10)))
    const skip = (page - 1) * limit

    const agg = await Certificate.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "u",
        },
      },
      { $unwind: "$u" },
      {
        $project: {
          level: 1,
          createdAt: 1,
          user: { name: "$u.name", email: "$u.email" },
        },
      },
      {
        $facet: {
          items: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: "count" }],
        },
      },
    ])

    const items = (agg[0]?.items ?? []).map((x: any) => ({
      _id: x._id,
      level: x.level,
      createdAt: x.createdAt,
      user: x.user,
    }))
    const totalCount = agg[0]?.total?.[0]?.count ?? 0
    res.json({ items, totalPages: Math.max(1, Math.ceil(totalCount / limit)) })
  } catch (err) {
    next(err)
  }
})

export default router
