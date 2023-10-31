import Users from "../models/Users";
import Certificate from "../models/Certificates";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import fs from "fs";
import PDFParser from "pdf2json";
import path from "path";

const SECRET_KEY =
  "f64a9b48c83e9e6c573d33d7d1f84813aef35f0ac15622f7a3e9912c6d609";

const emailRegex =
  /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/g;

const phoneRegex =
  /(\+?( |-|\.)?\d{1,2}( |-|\.)?)?(\(?\d{3}\)?|\d{3})( |-|\.)?(\d{3}( |-|\.)?\d{4})/g;

const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$/gm;

function generateRandomValue() {
  const uppercaseAlphabets = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercaseAlphabets = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";

  const capitalAlphabet =
    uppercaseAlphabets[Math.floor(Math.random() * uppercaseAlphabets.length)];

  let randomValue = capitalAlphabet;
  for (let i = 1; i < 8; i++) {
    const characters = uppercaseAlphabets + lowercaseAlphabets + numbers;
    randomValue += characters[Math.floor(Math.random() * characters.length)];
  }

  return randomValue;
}

export const getAllUsers = async (req, res, next) => {
  let users;

  try {
    users = await Users.find();
  } catch (error) {
    return console.log(error);
  }

  if (!users) {
    return res.status(404).json({ message: "Users not found!" });
  }
  return res.status(200).json({ users });
};

export const signup = async (req, res, next) => {
  const { name, email, password, phone } = req.body;

  let profileImage;
  let certificate;

  if (req.files) {
    if (req.files.profileImage) {
      profileImage = req.files.profileImage[0].originalname;
    }
    if (req.files.certificate) {
      certificate = req.files.certificate.map((file) => file.originalname);
    }
  }

  let existingUser;

  try {
    existingUser = await Users.findOne({ email });
  } catch (error) {
    return console.log(error);
  }

  if (existingUser) {
    return res
      .status(400)
      .json({ message: "User already exists! Proceed to login.", status: 400 });
  }

  if (!emailRegex.test(email)) {
    return res.status(400).json({
      message: "Please enter a valid email address!",
      status: 400,
    });
  }

  if (!phoneRegex.test(phone)) {
    return res.status(400).json({
      message: "Please enter a valid phone number!",
      status: 400,
    });
  }

  if (!passwordRegex.test(password)) {
    return res.status(400).json({
      message:
        "Password must contain at least 8 characters including uppercase letters and numbers.",
      status: 400,
    });
  }

  const hashPassword = bcrypt.hashSync(password);

  const user = new Users({
    name,
    email,
    password: hashPassword,
    phone,
    profileImage,
    certificates: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  try {
    await user.save();
  } catch (error) {
    return console.log(error);
  }

  let certificateObjs = [];

  for (const cert of certificate) {
    const certificateEntry = new Certificate({
      user: user._id,
      certificate: cert,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    try {
      await certificateEntry.save();
      certificateObjs.push(certificateEntry._id);
    } catch (error) {
      return console.log(error);
    }
  }

  user.certificates = certificateObjs;
  await user.save();

  const userDetails = {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    profileImage: user.profileImage,
    certificates: certificateObjs,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  return res.status(201).json({
    userDetails: userDetails,
    message: "Signed up successfully!",
    status: 201,
  });
};

export const signin = async (req, res, next) => {
  const { email, password } = req.body;

  let existingUser;

  try {
    existingUser = await Users.findOne({ email }).populate("certificates");
  } catch (error) {
    return console.log(error);
  }

  if (!existingUser) {
    return res
      .status(404)
      .json({ message: "User not found! Proceed to signup.", status: 404 });
  }

  const isPasswordCorrect = bcrypt.compareSync(password, existingUser.password);

  if (!isPasswordCorrect) {
    return res
      .status(400)
      .json({ message: "Password is incorrect!", status: 400 });
  }

  const token = jwt.sign(
    { email: existingUser.email, userId: existingUser._id },
    SECRET_KEY,
    { expiresIn: "1d" }
  );

  existingUser.token = token;
  await existingUser.save();

  const userDetails = {
    _id: existingUser._id,
    name: existingUser.name,
    email: existingUser.email,
    phone: existingUser.phone,
    profileImage: existingUser.profileImage,
    certificates: existingUser.certificates,
  };

  res.cookie("token", token, { httpOnly: true });
  res.cookie("userDetails", JSON.stringify(userDetails), {
    maxAge: 1000 * 60 * 60 * 24,
  });

  return res.status(200).json({
    userDetails: userDetails,
    token: token,
    message: "Signed in successfully!",
    status: 200,
  });
};

export const updateProfile = async (req, res, next) => {
  const userID = req.params.id;
  const { email, name, phone, certificateIdToUpdate } = req.body;

  let profileImage;
  let certificate;

  if (req.files) {
    if (req.files.profileImage) {
      profileImage = req.files.profileImage[0].originalname;
    }
    if (req.files.certificate) {
      certificate = req.files.certificate.map((file) => file.originalname);
    }
  }

  const userDetailsCookie = req.cookies.userDetails;

  if (!userDetailsCookie) {
    return res
      .status(401)
      .json({ message: "User details not found in cookies", status: 401 });
  }

  const userDetails = JSON.parse(userDetailsCookie);

  if (userID !== userDetails._id) {
    return res.status(403).json({ message: "Access denied", status: 403 });
  }

  try {
    const updatedUser = await Users.findByIdAndUpdate(
      userID,
      {
        name,
        phone,
        email,
        profileImage,
        updatedAt: new Date(),
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(500).json({ message: "Unable to update the profile!" });
    }

    if (certificate && certificateIdToUpdate) {
      const updatedCertificateData = {
        userID: updatedUser._id,
        certificate: certificate[0],
        updatedAt: new Date(),
      };

      try {
        const updatedCertificate = await Certificate.findByIdAndUpdate(
          certificateIdToUpdate,
          updatedCertificateData,
          { new: true }
        );

        // const updatedCertificates = await Certificate.updateMany(
        //   { _id: { $in: certificateIdToUpdate } },
        //   {
        //     $set: {
        //       updatedCertificateData,
        //       updatedAt: new Date(),
        //     },
        //   },
        //   { multi: true }
        // );

        if (!updatedCertificate) {
          console.log(
            `Failed to update certificate(s) with ID: ${certificateIdToUpdate}`
          );
        }

        res.cookie("userDetails", JSON.stringify(updatedUser));
      } catch (error) {
        console.log(error);
      }
    }

    const updatedUserDetails = {
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      phone: updatedUser.phone,
      profileImage: updatedUser.profileImage,
      certificates: updatedUser.certificates,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };

    res.cookie("userDetails", JSON.stringify(updatedUserDetails));

    return res.status(200).json({
      userDetails: updatedUserDetails,
      message: "Profile updated successfully!",
      status: 200,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", status: 500 });
  }
};

export const getUserById = async (req, res, next) => {
  const userID = req.params.id;

  let user;

  try {
    user = await Users.findById(userID);
  } catch (error) {
    return console.log(error);
  }

  const userDetails = {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    profileImage: user.profileImage,
  };

  if (!user) {
    return res.status(404).json({ message: "No user found!" });
  }
  return res.status(200).json({
    userDetails: userDetails,
    message: "Profile fetched successfully!",
    status: 200,
  });
};

export const deleteUserById = async (req, res, next) => {
  const userID = req.params.id;

  let user;

  try {
    user = await Users.findByIdAndDelete(userID);
  } catch (error) {
    return console.log(error);
  }

  if (!user) {
    return res.status(404).json({ message: "No user found!" });
  }
  return res.status(200).json({
    message: "Profile deleted successfully!",
    status: 200,
  });
};

export const logoutUser = async (req, res, next) => {
  const userCookie = req.cookies.token;

  let existingUser;

  try {
    existingUser = await Users.updateOne(
      { token: userCookie },
      { token: null }
    );
  } catch (error) {
    return console.log(error);
  }

  if (existingUser) {
    res.clearCookie("token");
    res.clearCookie("userDetails");

    return res.status(200).json({
      message: "Logged out successfully!",
      status: 200,
    });
  }
};

export const getProfileDetails = async (req, res, next) => {
  const tokenCookie = req.cookies.token;

  if (!tokenCookie) {
    return res
      .status(401)
      .json({ message: "No API key provided", status: 401 });
  }

  let userIndentify;
  let details;

  try {
    userIndentify = jwt.verify(tokenCookie, SECRET_KEY);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      await Users.findOneAndUpdate(
        { token: tokenCookie },
        { $set: { token: null } }
      );

      res.clearCookie("token");
      res.clearCookie("userDetails");

      return res
        .status(401)
        .json({ message: "Token has expired", status: 401 });
    } else {
      return res.status(401).json({ message: error.message, status: 401 });
    }
  }

  if (!userIndentify) {
    throw new Error("Invalid or expired API key");
  } else {
    try {
      details = await Users.findById(userIndentify.userId).populate(
        "certificates"
      );

      if (!details) {
        return res.status(404).json({ message: "User not found", status: 404 });
      }

      return res.status(200).json({
        userDetails: details,
        message: "User details fetched successfully!",
        status: 200,
      });
    } catch (error) {
      return res.status(500).json({ message: "Server error", status: 500 });
    }
  }
};

export const forgotPassword = async (req, res, next) => {
  const { email } = req.body;

  let existingUser;

  try {
    existingUser = await Users.findOne({ email });
  } catch (error) {
    return console.log(error);
  }

  if (!existingUser) {
    return res.status(404).json({
      message:
        "This email is not registered! Please enter your registered email.",
      status: 404,
    });
  }

  const newPassword = generateRandomValue();
  const hashPassword = bcrypt.hashSync(newPassword);

  await Users.findOneAndUpdate(
    { email: email },
    { $set: { password: hashPassword } }
  );

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "eventhelp001@gmail.com",
      pass: "oyhjgvzschwnjnic",
    },
  });

  const mailOptions = {
    from: "eventhelp001@gmail.com",
    to: email,
    subject: "Reset Your Password",
    text: `${newPassword} is your new password. Login using your new password and update your password.`,
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      throw new Error(error.message);
    } else {
      return res.json({
        message: "Successfully sent! Please check your mail.",
        status: 200,
      });
    }
  });
};

export const changePassword = async (req, res, next) => {
  const tokenCookie = req.cookies.token;
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const hashPassword = bcrypt.hashSync(newPassword);

  if (!tokenCookie) {
    return res
      .status(401)
      .json({ message: "No API key provided", status: 401 });
  }

  let userIndentify;
  let details;

  try {
    userIndentify = jwt.verify(tokenCookie, SECRET_KEY);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      await Users.findOneAndUpdate(
        { token: tokenCookie },
        { $set: { token: null } }
      );

      res.clearCookie("token");
      res.clearCookie("userDetails");

      return res
        .status(401)
        .json({ message: "Token has expired", status: 401 });
    } else {
      return res.status(401).json({ message: error.message, status: 401 });
    }
  }

  if (!userIndentify) {
    throw new Error("Invalid or expired API key");
  } else {
    try {
      details = await Users.findById(userIndentify.userId);

      const isPasswordCorrect = bcrypt.compareSync(
        currentPassword,
        details.password
      );

      if (!details) {
        return res.status(404).json({ message: "User not found", status: 404 });
      }

      if (!passwordRegex.test(newPassword)) {
        return res.status(400).json({
          message:
            "Password must contain at least 8 characters including uppercase letters and numbers.",
          status: 400,
        });
      }

      if (!isPasswordCorrect) {
        return res
          .status(400)
          .json({ message: "Password is incorrect!", status: 400 });
      }

      if (newPassword !== confirmPassword) {
        return res
          .status(400)
          .json({ message: "Password does not match!", status: 400 });
      }

      try {
        await Users.findByIdAndUpdate(userIndentify.userId, {
          password: hashPassword,
        });

        return res.status(200).json({
          message: "Password changed successfully!",
          status: 200,
        });
      } catch (error) {
        return res.status(500).json({ message: "Server error", status: 500 });
      }
    } catch (error) {
      return res.status(500).json({ message: "Server error", status: 500 });
    }
  }
};

export const getCertificate = async (req, res, next) => {
  const tokenCookie = req.cookies.token;
  const userDetailsCookie = req.cookies.userDetails;

  if (!tokenCookie) {
    return res
      .status(401)
      .json({ message: "No API key provided", status: 401 });
  }

  let userIndentify;
  let details;

  try {
    userIndentify = jwt.verify(tokenCookie, SECRET_KEY);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      await Users.findOneAndUpdate(
        { token: tokenCookie },
        { $set: { token: null } }
      );

      res.clearCookie("token");
      res.clearCookie("userDetails");

      return res
        .status(401)
        .json({ message: "Token has expired", status: 401 });
    } else {
      return res.status(401).json({ message: error.message, status: 401 });
    }
  }

  if (!userIndentify) {
    throw new Error("Invalid or expired API key");
  } else {
    const userDetails = JSON.parse(userDetailsCookie);
    const certificatePath = `public/uploads/certificates/${userDetails.certificate}`;

    // const fileName = path.basename(
    //   certificatePath,
    //   path.extname(certificatePath)
    // );

    if (!fs.existsSync(certificatePath)) {
      return res.status(404).json({
        message: "The PDF file does not exist at the specified path",
        status: 404,
      });
    }

    try {
      details = await Users.findById(userIndentify.userId);

      if (!details) {
        return res.status(404).json({ message: "User not found", status: 404 });
      }

      //---------- SEND AS TEXT FILE ----------//
      // const pdfParser = new PDFParser(this, 1);

      // pdfParser.on("pdfParser_dataError", (errData) =>
      //   console.error(errData.parserError)
      // );
      // pdfParser.on("pdfParser_dataReady", () => {
      //   fs.writeFile(
      //     `public/uploads/certificates/${fileName}.content.txt`,
      //     pdfParser.getRawTextContent(),
      //     (writeErr) => {
      //       if (writeErr) {
      //         console.error(writeErr);
      //         return res
      //           .status(500)
      //           .json({ message: "Server error", status: 500 });
      //       }

      //       const filePath = `public/uploads/certificates/${fileName}.content.txt`;
      //       fs.readFile(filePath, "utf-8", (readErr, data) => {
      //         if (readErr) {
      //           console.error(readErr);
      //           return res
      //             .status(500)
      //             .json({ message: "Server error", status: 500 });
      //         }
      //         res.status(200).json({
      //           certificate: data,
      //           message: "Certificate fetched successfully!",
      //           status: 200,
      //         });
      //       });
      //     }
      //   );
      // });

      // pdfParser.loadPDF(certificatePath);

      //---------- SEND AS PDF FILE ----------//

      res.setHeader("Content-Type", "application/pdf");
      const isInline = req.query.inline === "true";

      if (isInline) {
        res.setHeader(
          "Content-Disposition",
          `inline; filename=${userDetails.certificate}`
        );
      } else {
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=${userDetails.certificate}`
        );
      }

      const fileStream = fs.createReadStream(certificatePath);
      fileStream.pipe(res);
    } catch (error) {
      return res.status(500).json({ message: "Server error", status: 500 });
    }
  }
};
