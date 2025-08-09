import nodemailer, { type SendMailOptions } from "nodemailer"

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function sendMail(to: string, subject: string, html: string, attachments?: SendMailOptions["attachments"]) {
  const from = process.env.EMAIL_FROM || "anishazahan13@gmail.com"
  await transporter.sendMail({ from, to, subject, html, attachments })
}
