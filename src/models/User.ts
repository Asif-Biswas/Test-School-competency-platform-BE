import { Schema, model } from "mongoose"

export type Role = "admin" | "student" | "supervisor"

export interface IUser {
  _id: string
  name: string
  email: string
  passwordHash: string
  isVerified: boolean
  role: Role
  refreshTokenHash?: string | null
  createdAt: Date
  updatedAt: Date
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    isVerified: { type: Boolean, default: false },
    role: { type: String, enum: ["admin", "student", "supervisor"], default: "student" },
    refreshTokenHash: { type: String, default: null },
  },
  { timestamps: true }
)

export const User = model<IUser>("User", userSchema)
