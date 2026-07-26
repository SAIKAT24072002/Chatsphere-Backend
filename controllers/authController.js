import jwt from "jsonwebtoken";
import User from "../models/User.js";
import asyncHandler from "../middleware/asyncHandler.js";

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

// POST /api/auth/register
export const register = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    res.status(400); throw new Error("All fields required");
  }
  if (await User.findOne({ email })) {
    res.status(400); throw new Error("Email already registered");
  }
  if (await User.findOne({ username })) {
    res.status(400); throw new Error("Username taken");
  }
  const user = await User.create({ username, email, password });
  const token = generateToken(user._id);
  res.status(201).json({ user, token });
});



// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) { res.status(400); throw new Error("Invalid credentials"); }
  if (!user.isActive) { res.status(403); throw new Error("Account deactivated"); }
  if (!(await user.matchPassword(password))) {
    res.status(400); throw new Error("Invalid credentials");
  }
  const token=generateToken(user._id);
  res
  .cookie("token",token,{httpOnly:true,secure:false,maxAge:24*60*60*1000})
  .json({ user, token: generateToken(user._id) });
});



// GET /api/auth/me
export const getMe = asyncHandler(async (req, res) => {
  res.json(req.user);
});



// POST /api/auth/logout
export const logout = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { status: "offline", lastSeen: new Date() });
  res
  .clearCookie("token")
  .json({ message: "Logged out" });
});
