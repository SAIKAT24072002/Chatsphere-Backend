import jwt from "jsonwebtoken";
import User from "../models/User.js";
import asyncHandler from "./asyncHandler.js";

const protect = asyncHandler(async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }else{
    // console.log(req.cookies)
    token=req.cookies.token
  }
  if (!token) {
    res.status(401);
    throw new Error("Not authorized, no token");
  }
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  req.user = await User.findById(decoded.id).select("-password");
  if (!req.user) {
    res.status(401);
    throw new Error("User not found");
  }
  if (!req.user.isActive) {
    res.status(403);
    throw new Error("Account deactivated");
  }
  next();


});

const adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin") {
    res.status(403);
    throw new Error("Admin access required");
  }
  next();
};

export { protect, adminOnly };
