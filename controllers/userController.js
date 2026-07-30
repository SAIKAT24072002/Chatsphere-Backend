import User from "../models/User.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { streamToCloudinary, cloudinaryParams } from "../config/cloudinary.js";
import fs from "fs";
import path from "path";

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
    const trimmed = username.trim();
    if (trimmed.length < 3 || trimmed.length > 30) {
      res.status(400);
      throw new Error("Username must be between 3 and 30 characters long.");
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      res.status(400);
      throw new Error("Username can only contain letters, numbers, and underscores.");
    }
    if (await User.findOne({ username: trimmed })) {
      res.status(400);
      throw new Error("Username taken");
    }
    user.username = trimmed;
  }
  if (bio !== undefined) {
    if (bio.length > 200) {
      res.status(400);
      throw new Error("Bio cannot exceed 200 characters.");
    }
    user.bio = bio;
  }
  if (customStatus !== undefined) {
    if (customStatus.length > 100) {
      res.status(400);
      throw new Error("Status message cannot exceed 100 characters.");
    }
    user.customStatus = customStatus;
  }
  await user.save();
  res.json(user);
});


export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) { res.status(400); throw new Error("No file uploaded"); }

  let avatarUrl = "";
  const fileExt = path.extname(req.file.originalname);
  const fileName = `${Date.now()}-${Math.round(Math.random() * 1e6)}${fileExt}`;

  // Define permanent local fallback folder
  const targetDir = path.resolve("uploads/avatars");
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  const backupPath = path.join(targetDir, fileName);
  fs.copyFileSync(req.file.path, backupPath);

  try {
    const { folder, resourceType } = cloudinaryParams(req.file.mimetype);
    const { url } = await streamToCloudinary(req.file.path, folder, resourceType);
    avatarUrl = url;
    // Cloudinary succeeded, delete local backup copy to save disk space
    try { fs.unlinkSync(backupPath); } catch {}
  } catch (error) {
    console.error("Cloudinary upload failed, falling back to local storage:", error.message);
    // Cloudinary failed, serve statically from backend
    avatarUrl = `${req.protocol}://${req.get("host")}/uploads/avatars/${fileName}`;
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { avatar: avatarUrl },
    { new: true }
  );
  res.json({ avatar: user.avatar });
});

// PUT /api/users/password
export const updatePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400);
    throw new Error("All fields are required.");
  }
  
  const user = await User.findById(req.user._id);
  if (!(await user.matchPassword(currentPassword))) {
    res.status(400);
    throw new Error("Current password is incorrect.");
  }

  if (currentPassword === newPassword) {
    res.status(400);
    throw new Error("New password cannot be the same as the current password.");
  }

  if (newPassword.length < 6) {
    res.status(400);
    throw new Error("Password must be at least 6 characters long.");
  }
  if (!/[A-Z]/.test(newPassword)) {
    res.status(400);
    throw new Error("Password must contain at least one uppercase letter.");
  }
  if (!/[a-z]/.test(newPassword)) {
    res.status(400);
    throw new Error("Password must contain at least one lowercase letter.");
  }
  if (!/[0-9]/.test(newPassword)) {
    res.status(400);
    throw new Error("Password must contain at least one number.");
  }

  user.password = newPassword;
  await user.save();
  res.json({ message: "Password updated successfully." });
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
