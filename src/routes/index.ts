import { Router } from "express"
import auth from "./modules/auth"
import exams from "./modules/exams"
import questions from "./modules/questions"
import admin from "./modules/admin"
import certificates from "./modules/certificates"
import seb from "./modules/seb"
// import supervisor from "./modules/supervisor"

export const apiRouter = Router()
apiRouter.use("/auth", auth)
apiRouter.use("/exams", exams)
apiRouter.use("/questions", questions)
apiRouter.use("/admin", admin)
apiRouter.use("/certificates", certificates)
apiRouter.use("/seb", seb)
// apiRouter.use("/supervisor", supervisor)

export default apiRouter;