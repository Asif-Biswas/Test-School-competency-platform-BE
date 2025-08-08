import { Router } from "express"
import { z } from "zod"
import crypto from "crypto"

const router = Router()

// Simple validation endpoint for SEB headers/signature.
// In production, validate the SEB config key and browser exam keys according to SEB docs.
router.post("/validate", (req, res) => {
  const schema = z.object({
    clientToken: z.string().optional(),
    configHash: z.string().optional(),
  })
  const { clientToken, configHash } = schema.parse(req.body)
  const expected = process.env.SEB_CONFIG_HASH
  const ok = expected ? expected === configHash : Boolean(clientToken)
  res.json({ ok })
})

// Example endpoint to generate a simple SEB config payload (to be converted/signature-added with SEB Config Tool)
router.get("/config", (_req, res) => {
  const payload = {
    examUrl: `${process.env.CLIENT_ORIGIN}/exam`,
    browserExamKey: crypto.randomBytes(16).toString("hex"),
    allowClipboard: false,
    allowNewWindow: false,
    allowWLAN: false,
    // ... more SEB options here
  }
  res.json(payload)
})

export default router
