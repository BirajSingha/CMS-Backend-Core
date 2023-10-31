import express from "express";
import {
  deleteUserById,
  getAllUsers,
  getUserById,
  logoutUser,
  signin,
  signup,
  updateProfile,
  getProfileDetails,
  forgotPassword,
  changePassword,
  getCertificate,
} from "../controllers/user-controller";
import multer from "multer";
import fs from "fs";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "profileImage") {
      if (!fs.existsSync("public/uploads/profiles")) {
        fs.mkdirSync("public/uploads/profiles");
      }
      cb(null, "public/uploads/profiles");
    } else if (file.fieldname === "certificate") {
      if (!fs.existsSync("public/uploads/certificates")) {
        fs.mkdirSync("public/uploads/certificates");
      }
      cb(null, "public/uploads/certificates");
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
  const allowedCertificateMimeTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  const allowedImageMimeTypes = [
    "image/png",
    "image/jpg",
    "image/jpeg",
    "image/gif",
  ];

  if (file.fieldname === "certificate") {
    if (allowedCertificateMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  } else if (file.fieldname === "profileImage") {
    if (allowedImageMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
}

export const userRouter = express.Router();

userRouter.get("/", getAllUsers);
userRouter.post(
  "/signup",
  upload.fields([
    {
      name: "profileImage",
      maxCount: 1,
    },
    {
      name: "certificate",
      maxCount: 2,
    },
  ]),
  signup
);
userRouter.post("/signin", upload.none(), signin);
userRouter.put(
  "/update-profile/:id",
  upload.fields([
    {
      name: "profileImage",
      maxCount: 1,
    },
    {
      name: "certificate",
      maxCount: 2,
    },
  ]),
  updateProfile
);
userRouter.post("/logout", upload.none(), logoutUser);
userRouter.get("/getUserProfile", getProfileDetails);
userRouter.get("/getCertificate", getCertificate);
userRouter.post("/forgotPassword", upload.none(), forgotPassword);
userRouter.post("/changePassword", upload.none(), changePassword);
userRouter.get("/:id", getUserById);
userRouter.delete("/:id", deleteUserById);
