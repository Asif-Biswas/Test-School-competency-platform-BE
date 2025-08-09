import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { errorHandler, notFound } from "./middleware/error.js";


import auth from "./routes/modules/auth"
import exams from "./routes/modules/exams"
import questions from "./routes/modules/questions"
import admin from "./routes/modules/admin"
import certificates from "./routes/modules/certificates"
// import seb from "./modules/seb"



const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(morgan("dev"));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

app.get("/api/health", (req, res) => res.send("api is working"));
// app.use("/api", apiRouter);
app.use(notFound);
app.use(errorHandler);

app.use("/auth", auth)
app.use("/exams", exams)
app.use("/questions", questions)
app.use("/admin", admin)
app.use("/certificates", certificates)



const PORT = Number(process.env.PORT || 4000);

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log("Mongo connected");
  app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
