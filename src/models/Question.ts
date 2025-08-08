import { Schema, model } from "mongoose"

export type Level = "A1" | "A2" | "B1" | "B2" | "C1" | "C2"

export interface IChoice {
  id: string
  text: string
}

export interface IQuestion {
  competency: string
  level: Level
  text: string
  choices: IChoice[]
  correctChoiceId: string
  createdAt: Date
  updatedAt: Date
}

const choiceSchema = new Schema<IChoice>(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
  },
  { _id: false }
)

const questionSchema = new Schema<IQuestion>(
  {
    competency: { type: String, required: true, index: true },
    level: { type: String, enum: ["A1", "A2", "B1", "B2", "C1", "C2"], required: true, index: true },
    text: { type: String, required: true },
    choices: { type: [choiceSchema], required: true, validate: [arr => arr.length >= 2, "Need at least two choices"] },
    correctChoiceId: { type: String, required: true },
  },
  { timestamps: true }
)

export const Question = model<IQuestion>("Question", questionSchema)
