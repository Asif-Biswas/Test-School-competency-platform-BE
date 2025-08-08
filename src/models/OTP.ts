import { Schema, model } from "mongoose"

export interface IOTP {
  email: string
  codeHash: string
  expiresAt: Date
  consumed: boolean
  createdAt: Date
}

const otpSchema = new Schema<IOTP>(
  {
    email: { type: String, required: true, index: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    consumed: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

export const OTP = model<IOTP>("OTP", otpSchema)
