import "dotenv/config"
import mongoose from "mongoose"
import { User } from "../models/User"
import { Question } from "../models/Question"
import { hashPassword } from "../utils/password"
import { nanoid } from "nanoid"

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string)
  // Admin
  const adminEmail = "anisha-admin@testschool.com"
  const adminPass = "Admin123!"
  const existing = await User.findOne({ email: adminEmail })
  if (!existing) {
    await User.create({
      name: "Administrator",
      email: adminEmail,
      passwordHash: await hashPassword(adminPass),
      role: "admin",
      isVerified: true,
    })
  }

  // Seed sample questions (22 competencies x 6 levels = 132). We'll generate placeholders.
  const competencies = [
    "Information Literacy","Communication","Content Creation","Safety","Problem Solving",
    "Data Handling","Networking","Cybersecurity","AI Literacy","Cloud Basics","OS Usage",
    "Office Tools","Programming Basics","Web Basics","Mobile Productivity","Collaboration",
    "Digital Ethics","Privacy","Accessibility","Search Skills","Media Literacy","eCommerce"
  ]
  const levels: Array<"A1"|"A2"|"B1"|"B2"|"C1"|"C2"> = ["A1","A2","B1","B2","C1","C2"]

  const count = await Question.countDocuments()
  if (count < 132) {
    const toInsert: any[] = []
    for (const level of levels) {
      for (const comp of competencies) {
        const choices = Array.from({ length: 4 }).map((_, i) => ({ id: nanoid(8), text: `Choice ${i + 1}` }))
        const correctChoiceId = choices[0].id
        toInsert.push({ level, competency: comp, text: `[${level}] ${comp} sample question?`, choices, correctChoiceId })
      }
    }
    await Question.insertMany(toInsert)
  }

  console.log("Seed complete.")
  console.log("Admin Credentials:")
  console.log(`Email: ${adminEmail}`)
  console.log(`Password: ${adminPass}`)
  await mongoose.disconnect()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
