import express from "express";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import { userRouter } from "./routes/user-routes";
import { postRouter } from "./routes/post-routes";
import "dotenv/config";

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(express.static(process.env.IMAGE_PATH));
app.use("/api/user", userRouter);
app.use("/api/post", postRouter);

mongoose
  .connect(
    "mongodb+srv://[your-username]:[your-password]@cluster0.8c3ydzj.mongodb.net/?retryWrites=true&w=majority"
  )
  .then(() => app.listen(5000))
  .then(() => console.log("CONNECTED TO ATLAS!"))
  .catch((err) => console.log(err));
