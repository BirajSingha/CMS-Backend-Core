import express from "express";
import multer from "multer";
import fs from "fs";
import {
  deletePostById,
  getAllPosts,
  getPostById,
  getPostsByUser,
  updatePost,
  uploadPost,
} from "../controllers/post-controller";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "postImage") {
      if (!fs.existsSync("public/uploads/posts")) {
        fs.mkdirSync("public/uploads/posts");
      }
      cb(null, "public/uploads/posts");
    }
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    checkFileType(file, cb);
  },
});

function checkFileType(file, cb) {
  const allowedImageMimeTypes = [
    "image/png",
    "image/jpg",
    "image/jpeg",
    "image/gif",
  ];

  if (file.fieldname === "postImage") {
    if (allowedImageMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
}

export const postRouter = express.Router();

postRouter.get("/get-all-posts", getAllPosts);
postRouter.post("/upload-post", upload.single("postImage"), uploadPost);
postRouter.put("/update-post/:id", upload.single("postImage"), updatePost);
postRouter.get("/get-by-user/:id", getPostsByUser);
postRouter.get("/get-by-id/:id", getPostById);
postRouter.delete("/delete-post/:id", deletePostById);
