import { Schema, model, Types } from "mongoose"

export interface IAnswer {
  attemptId: Types.ObjectId
  questionId: Types.ObjectId
  choiceId: string
  correct: boolean
}

const answerSchema = new Schema<IAnswer>(
  {
    attemptId: { type: Schema.Types.ObjectId, ref: "Attempt", required: true, index: true },
    questionId: { type: Schema.Types.ObjectId, ref: "Question", required: true },
    choiceId: { type: String, required: true },
    correct: { type: Boolean, required: true },
  },
  { timestamps: false }
)

export const Answer = model<IAnswer>("Answer", answerSchema)
