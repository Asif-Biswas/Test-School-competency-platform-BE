import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { errorHandler, notFound } from "./middleware/error.js";
import apiRouter from "./routes";
import serverless from "serverless-http";

const app = express();

app.use(helmet());
app.use(
  cors({ origin: process.env.CLIENT_ORIGIN, credentials: true })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(morgan("dev"));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
  })
);

app.get("/api/health", (req, res) => res.send("api is working"));
app.use("/api", apiRouter);
app.use(notFound);
app.use(errorHandler);

let isMongoConnected = false;

async function connectDB() {
  if (isMongoConnected) {
    return;
  }
  await mongoose.connect(process.env.MONGODB_URI as string);
  isMongoConnected = true;
  console.log("Mongo connected");
}

// Connect to MongoDB once at cold start
connectDB().catch((err) => {
  console.error("Mongo connection error", err);
});

export const handler = serverless(app);
