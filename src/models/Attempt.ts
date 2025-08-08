import { Schema, model, Types } from "mongoose"

export interface IAttempt {
  examId: Types.ObjectId
  step: "STEP_1" | "STEP_2" | "STEP_3"
  score: number
  total: number
  startedAt: Date
  submittedAt?: Date
}

const attemptSchema = new Schema<IAttempt>(
  {
    examId: { type: Schema.Types.ObjectId, ref: "Exam", required: true, index: true },
    step: { type: String, enum: ["STEP_1", "STEP_2", "STEP_3"], required: true },
    score: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    startedAt: { type: Date, default: Date.now },
    submittedAt: Date,
  },
  { timestamps: false }
)

export const Attempt = model<IAttempt>("Attempt", attemptSchema)
