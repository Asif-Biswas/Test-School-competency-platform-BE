import { Schema, model, Types } from "mongoose"

export interface ICertificate {
  userId: Types.ObjectId
  level: string
  attemptId: Types.ObjectId
  createdAt: Date
}

const certSchema = new Schema<ICertificate>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    level: { type: String, required: true },
    attemptId: { type: Schema.Types.ObjectId, ref: "Attempt", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

export const Certificate = model<ICertificate>("Certificate", certSchema)
