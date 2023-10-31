import Users from "../models/Users";
import Posts from "../models/Posts";

export const getAllPosts = async (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(403).json({
      message: "Access denied!",
      status: 403,
    });
  }
  let posts;

  try {
    posts = await Posts.find();
  } catch (error) {
    return console.log(error);
  }

  if (!posts) {
    return res.status(404).json({ message: "No posts found!", status: 404 });
  }
  return res
    .status(200)
    .json({ posts, message: "All posts fetched successfully!", status: 200 });
};

export const uploadPost = async (req, res, next) => {
  const token = req.cookies.token;
  const userCookie = req.cookies.userDetails;

  const { postedBy, postTitle, postBody } = req.body;

  let userDetails;

  if (!token || !userCookie) {
    return res.status(403).json({
      message: "Access denied!",
      status: 403,
    });
  } else {
    userDetails = JSON.parse(userCookie);
  }

  if (userDetails._id !== postedBy) {
    return res.status(403).json({
      message: "Access denied!",
      status: 403,
    });
  }

  let existingUser;

  try {
    existingUser = await Users.findById(postedBy);
  } catch (error) {
    return console.log(error);
  }

  if (!existingUser) {
    return res.status(400).json({ message: "User not found!", status: 400 });
  }

  let postImage;

  if (req.file) {
    postImage = req.file.originalname;
  }

  const post = new Posts({
    postedBy,
    postTitle,
    postBody,
    postImage,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  try {
    await post.save();
  } catch (error) {
    return console.log(error);
  }

  const postDetails = {
    _id: post._id,
    postedBy: post.postedBy,
    postTitle: post.postTitle,
    postBody: post.postBody,
    postImage: post.postImage,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };

  return res.status(201).json({
    postDetails: postDetails,
    message: "Post uploaded successfully!",
    status: 201,
  });
};

export const updatePost = async (req, res, next) => {
  const token = req.cookies.token;
  const userCookie = req.cookies.userDetails;

  const postId = req.params.id;
  const { postTitle, postBody } = req.body;

  let userDetails;
  let postImage;

  if (req.file) {
    postImage = req.file.originalname;
  }

  if (!token || !userCookie) {
    return res.status(403).json({
      message: "Access denied!",
      status: 403,
    });
  } else {
    userDetails = JSON.parse(userCookie);
  }

  const findPost = await Posts.findById(postId).populate("postedBy");

  if (!findPost) {
    return res.status(400).json({
      message: "No post found!",
      status: 400,
    });
  }

  if (userDetails._id !== findPost.postedBy._id.toString()) {
    return res.status(403).json({
      message: "Access denied! You cannot update this post.",
      status: 403,
    });
  }

  try {
    const updatedPost = await Posts.findByIdAndUpdate(
      postId,
      {
        postTitle,
        postBody,
        postImage,
        updatedAt: new Date(),
      },
      { new: true }
    );

    if (!updatedPost) {
      return res
        .status(500)
        .json({ message: "Unable to update the post!", status: 500 });
    }

    const updatedPostDetails = {
      _id: updatedPost._id,
      postTitle: updatedPost.postTitle,
      postBody: updatedPost.postBody,
      postImage: updatedPost.postImage,
      postedBy: updatedPost.postedBy,
      createdAt: updatedPost.createdAt,
      updatedAt: updatedPost.updatedAt,
    };

    return res.status(200).json({
      postDetails: updatedPostDetails,
      message: "Post updated successfully!",
      status: 200,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", status: 500 });
  }
};

export const getPostById = async (req, res, next) => {
  const token = req.cookies.token;
  const postId = req.params.id;

  if (!token) {
    return res.status(403).json({
      message: "Access denied!",
      status: 403,
    });
  }

  let post;

  try {
    post = await Posts.findById(postId).populate("postedBy");
  } catch (error) {
    return console.log(error);
  }

  if (!post) {
    return res.status(404).json({ message: "No post found!", status: 404 });
  }

  const postedByDetails = {
    _id: post.postedBy._id,
    name: post.postedBy.name,
    profileImage: post.postedBy.profileImage,
  };

  const postDetails = {
    _id: post._id,
    postTitle: post.postTitle,
    postBody: post.postBody,
    postImage: post.postImage,
    postedBy: postedByDetails,
  };

  return res.status(200).json({
    postDetails: postDetails,
    message: "Post fetched successfully!",
    status: 200,
  });
};

export const getPostsByUser = async (req, res, next) => {
  const userId = req.params.id;
  const token = req.cookies.token;

  if (!token) {
    return res.status(403).json({
      message: "Access denied!",
      status: 403,
    });
  }

  try {
    const posts = await Posts.find({ postedBy: userId });

    if (posts.length === 0) {
      return res.status(404).json({ message: "No posts found!", status: 404 });
    }

    return res.status(200).json({
      posts,
      message: "Posts fetched successfully!",
      status: 200,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Internal Server Error", status: 500 });
  }
};

export const deletePostById = async (req, res, next) => {
  const postID = req.params.id;
  const token = req.cookies.token;
  const userCookie = req.cookies.userDetails;

  let userDetails;

  if (!token || !userCookie) {
    return res.status(403).json({
      message: "Access denied!",
      status: 403,
    });
  } else {
    userDetails = JSON.parse(userCookie);
  }

  const findPost = await Posts.findById(postID).populate("postedBy");

  if (!findPost) {
    return res.status(400).json({
      message: "No post found!",
      status: 400,
    });
  }

  if (userDetails._id !== findPost.postedBy._id.toString()) {
    return res.status(403).json({
      message: "Access denied! You cannot delete this post.",
      status: 403,
    });
  }

  let post;

  try {
    post = await Posts.findByIdAndDelete(postID);
  } catch (error) {
    return console.log(error);
  }

  if (!post) {
    return res.status(404).json({ message: "No post found!" });
  }
  return res.status(200).json({
    message: "Post deleted successfully!",
    status: 200,
  });
};
