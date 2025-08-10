import { Router } from "express"
import { z } from "zod"
import crypto from "crypto"

const router = Router()

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


router.get("/config", (_req, res) => {
  const payload = {
    examUrl: `${process.env.CLIENT_ORIGIN}/exam`,
    browserExamKey: crypto.randomBytes(16).toString("hex"),
    allowClipboard: false,
    allowNewWindow: false,
    allowWLAN: false,
  }
  res.json(payload)
})

export default router
