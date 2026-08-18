import jwt from "jsonwebtoken";
import User from "../models/User.js";
import LoginHistory from "../models/LoginHistory.js";
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

  // Password validation:
  if (password.length < 6) {
    res.status(400);
    throw new Error("Password must be at least 6 characters long.");
  }
  if (!/[A-Z]/.test(password)) {
    res.status(400);
    throw new Error("Password must contain at least one uppercase letter.");
  }
  if (!/[a-z]/.test(password)) {
    res.status(400);
    throw new Error("Password must contain at least one lowercase letter.");
  }
  if (!/[0-9]/.test(password)) {
    res.status(400);
    throw new Error("Password must contain at least one number.");
  }

  const user = await User.create({ username, email, password });
  const token = generateToken(user._id);
  res.status(201).json({ user, token });
});



// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400);
    throw new Error("Email and password are required.");
  }
  
  const user = await User.findOne({ email });
  if (!user) {
    res.status(401);
    throw new Error("Invalid credentials");
  }

  const clientIp = req.ip || req.headers["x-forwarded-for"] || "";
  const userAgent = req.headers["user-agent"] || "";

  // Check account status
  if (!user.isActive) {
    await LoginHistory.create({
      user: user._id,
      ip: clientIp,
      userAgent,
      status: "failed",
      failureReason: "Account deactivated",
    });
    res.status(403);
    throw new Error("Account deactivated");
  }

  // Check lockout status
  if (user.lockUntil && user.lockUntil > Date.now()) {
    await LoginHistory.create({
      user: user._id,
      ip: clientIp,
      userAgent,
      status: "failed",
      failureReason: "Account temporarily locked due to excessive failed attempts",
    });
    const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / (60 * 1000));
    res.status(403);
    throw new Error(`Account is temporarily locked. Try again in ${minutesLeft} minute(s).`);
  }

  // Password matching
  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    // Increment attempts
    user.loginAttempts += 1;
    let lockoutMessage = "";
    if (user.loginAttempts >= 5) {
      user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes lockout
      user.loginAttempts = 0; // reset attempts for next lockout cycle
      lockoutMessage = " Too many failed attempts. Your account has been locked for 15 minutes.";
    }
    await user.save();

    await LoginHistory.create({
      user: user._id,
      ip: clientIp,
      userAgent,
      status: "failed",
      failureReason: "Incorrect password",
    });

    res.status(401);
    throw new Error(`Invalid credentials.${lockoutMessage}`);
  }

  // Success path
  user.loginAttempts = 0;
  user.lockUntil = undefined;
  await user.save();

  await LoginHistory.create({
    user: user._id,
    ip: clientIp,
    userAgent,
    status: "success",
  });

  const token = generateToken(user._id);
  res
    .cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000,
    })
    .json({ user, token });
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
