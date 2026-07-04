import User from "../models/User.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { streamToCloudinary, cloudinaryParams } from "../config/cloudinary.js";

// GET /api/users?search=
export const getUsers = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const query = search
    ? {
        $or: [
          { username: { $regex: search, $options: "i" } },
          { email:    { $regex: search, $options: "i" } },
        ],
        _id: { $ne: req.user._id },
      }
    : { _id: { $ne: req.user._id } };
  const users = await User.find(query).select("-password").limit(20);
  res.json(users);
});

// GET /api/users/:id
export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("-password");
  if (!user) { res.status(404); throw new Error("User not found"); }
  res.json(user);
});

// PUT /api/users/profile
export const updateProfile = asyncHandler(async (req, res) => {
  const { username, bio, customStatus } = req.body;
  const user = await User.findById(req.user._id);
  if (username && username !== user.username) {
    if (await User.findOne({ username })) {
      res.status(400); throw new Error("Username taken");
    }
    user.username = username;
  }
  if (bio         !== undefined) user.bio          = bio;
  if (customStatus !== undefined) user.customStatus = customStatus;
  await user.save();
  res.json(user);
});

// POST /api/users/avatar  — file saved locally by multer, then streamed to Cloudinary
export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) { res.status(400); throw new Error("No file uploaded"); }
  const { folder, resourceType } = cloudinaryParams(req.file.mimetype);
  const { url } = await streamToCloudinary(req.file.path, folder, resourceType);
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { avatar: url },
    { new: true }
  );
  res.json({ avatar: user.avatar });
});

// PUT /api/users/password
export const updatePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id);
  if (!(await user.matchPassword(currentPassword))) {
    res.status(400); throw new Error("Current password incorrect");
  }
  user.password = newPassword;
  await user.save();
  res.json({ message: "Password updated" });
});

// PUT /api/users/notifications
export const updateNotifications = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { notifications: req.body },
    { new: true }
  );
  res.json(user.notifications);
});

// POST /api/users/:id/block
export const toggleBlock = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const targetId = req.params.id;
  const isBlocked = user.blockedUsers.includes(targetId);
  if (isBlocked) {
    user.blockedUsers = user.blockedUsers.filter((id) => id.toString() !== targetId);
  } else {
    user.blockedUsers.push(targetId);
  }
  await user.save();
  res.json({ blocked: !isBlocked });
});
