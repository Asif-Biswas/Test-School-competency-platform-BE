import { Schema, model, Types } from "mongoose"

export type Step = "STEP_1" | "STEP_2" | "STEP_3"
export type ExamStatus = "not_started" | "in_progress" | "completed" | "locked"

export interface IExam {
  userId: Types.ObjectId
  status: ExamStatus
  currentStep: Step | null
  step1Score?: number
  step2Score?: number
  step3Score?: number
  finalLevel?: string | null
  dueAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

const examSchema = new Schema<IExam>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: ["not_started", "in_progress", "completed", "locked"], default: "not_started", index: true },
    currentStep: { type: String, enum: ["STEP_1", "STEP_2", "STEP_3", null], default: null },
    step1Score: Number,
    step2Score: Number,
    step3Score: Number,
    finalLevel: { type: String, default: null },
    dueAt: { type: Date, default: null },
  },
  { timestamps: true }
)

export const Exam = model<IExam>("Exam", examSchema)
