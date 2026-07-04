import User from "../models/User.js";
import Chat from "../models/Chat.js";
import Message from "../models/Message.js";
import asyncHandler from "../middleware/asyncHandler.js";

// GET /api/admin/users
export const getAllUsers = asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 20 } = req.query;
  const filter = search
    ? { $or: [{ username: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }] }
    : {};
  const [users, total] = await Promise.all([
    User.find(filter).select("-password").skip((page - 1) * limit).limit(parseInt(limit)).sort({ createdAt: -1 }),
    User.countDocuments(filter),
  ]);
  res.json({ users, total, pages: Math.ceil(total / limit) });
});

// PUT /api/admin/users/:id/toggle
export const toggleUserStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) { res.status(404); throw new Error("User not found"); }
  user.isActive = !user.isActive;
  await user.save();
  res.json({ isActive: user.isActive });
});

// GET /api/admin/groups
export const getAllGroups = asyncHandler(async (req, res) => {
  const groups = await Chat.find({ isGroup: true })
    .populate("members", "username email")
    .populate("admins",  "username")
    .sort({ createdAt: -1 });
  res.json(groups);
});

// DELETE /api/admin/groups/:id
export const deleteGroup = asyncHandler(async (req, res) => {
  await Chat.findByIdAndUpdate(req.params.id, { isActive: false });
  res.json({ message: "Group deleted" });
});

// GET /api/admin/flagged
export const getFlaggedMessages = asyncHandler(async (req, res) => {
  const messages = await Message.find({ isFlagged: true, isDeleted: false })
    .populate("sender", "username email")
    .populate("chat",   "name isGroup")
    .sort({ createdAt: -1 });
  res.json(messages);
});

// DELETE /api/admin/flagged/:id
export const deleteFlaggedMessage = asyncHandler(async (req, res) => {
  await Message.findByIdAndUpdate(req.params.id, {
    isDeleted : true,
    deletedAt : new Date(),
    content   : "[Removed by admin]",
  });
  res.json({ message: "Message removed" });
});

// PATCH /api/admin/flagged/:id/dismiss
export const dismissFlaggedMessage = asyncHandler(async (req, res) => {
  await Message.findByIdAndUpdate(req.params.id, { isFlagged: false, flagReason: "" });
  res.json({ message: "Flag dismissed" });
});

// GET /api/admin/analytics
export const getAnalytics = asyncHandler(async (req, res) => {
  const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers, activeUsers, onlineUsers,
    totalChats, totalGroups, totalMessages,
    flaggedMessages, newUsers, recentMessages, msgPerDay,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isActive: true }),
    User.countDocuments({ status: "online" }),
    Chat.countDocuments(),
    Chat.countDocuments({ isGroup: true }),
    Message.countDocuments({ isDeleted: false }),
    Message.countDocuments({ isFlagged: true, isDeleted: false }),
    User.countDocuments({ createdAt: { $gte: last7Days } }),
    Message.countDocuments({ createdAt: { $gte: last7Days } }),
    Message.aggregate([
      { $match: { createdAt: { $gte: last7Days }, isDeleted: false } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  res.json({
    totalUsers, activeUsers, onlineUsers,
    totalChats, totalGroups, totalMessages,
    flaggedMessages, newUsers, recentMessages, msgPerDay,
  });
});
