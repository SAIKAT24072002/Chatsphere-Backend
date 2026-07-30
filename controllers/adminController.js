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
  const groups = await Chat.find({ isGroup: true, isActive: { $ne: false } })
    .populate("members", "username email")
    .populate("admins",  "username")
    .sort({ createdAt: -1 });
  res.json(groups);
});

// POST /api/admin/groups
export const createGroupAdmin = asyncHandler(async (req, res) => {
  const { name, description, members, admins } = req.body;
  if (!name) { res.status(400); throw new Error("Group name required"); }
  if (!members || members.length === 0) { res.status(400); throw new Error("At least one member required"); }

  const group = await Chat.create({
    name,
    description,
    isGroup: true,
    members,
    admins: admins || [req.user._id],
    createdBy: req.user._id,
  });

  const fullGroup = await Chat.findById(group._id)
    .populate("members", "username email")
    .populate("admins", "username");

  res.status(201).json(fullGroup);
});

// PUT /api/admin/groups/:id
export const updateGroupAdmin = asyncHandler(async (req, res) => {
  const { name, description, members, admins } = req.body;
  const group = await Chat.findById(req.params.id);
  if (!group || !group.isGroup || group.isActive === false) {
    res.status(404);
    throw new Error("Group not found");
  }

  if (name) group.name = name;
  if (description !== undefined) group.description = description;
  if (members) group.members = members;
  if (admins) group.admins = admins;

  await group.save();

  const fullGroup = await Chat.findById(group._id)
    .populate("members", "username email")
    .populate("admins", "username");

  res.json(fullGroup);
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

// GET /api/admin/reports
export const getReports = asyncHandler(async (req, res) => {
  const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    activeUsers,
    onlineUsers,
    totalChats,
    totalGroups,
    totalDirect,
    totalMessages,
    newUsers7d,
    newUsers30d,
    messages7d,
    messages30d,
    msgPerDay30,
    registrationsPerDay30,
    mostActiveUsers,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isActive: true }),
    User.countDocuments({ status: "online" }),
    Chat.countDocuments({ isActive: true }),
    Chat.countDocuments({ isGroup: true, isActive: true }),
    Chat.countDocuments({ isGroup: false, isActive: true }),
    Message.countDocuments({ isDeleted: false }),
    User.countDocuments({ createdAt: { $gte: last7Days } }),
    User.countDocuments({ createdAt: { $gte: last30Days } }),
    Message.countDocuments({ createdAt: { $gte: last7Days }, isDeleted: false }),
    Message.countDocuments({ createdAt: { $gte: last30Days }, isDeleted: false }),
    Message.aggregate([
      { $match: { createdAt: { $gte: last30Days }, isDeleted: false } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    User.aggregate([
      { $match: { createdAt: { $gte: last30Days } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Message.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: "$sender", messageCount: { $sum: 1 } } },
      { $sort: { messageCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userInfo"
        }
      },
      { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          messageCount: 1,
          username: { $ifNull: ["$userInfo.username", "Unknown User"] },
          email: { $ifNull: ["$userInfo.email", ""] },
          avatar: { $ifNull: ["$userInfo.avatar", ""] }
        }
      }
    ]),
  ]);

  // Compute averages
  const avgMessagesPerUser = totalUsers > 0 ? parseFloat((totalMessages / totalUsers).toFixed(2)) : 0;
  const avgMessagesPerChat = totalChats > 0 ? parseFloat((totalMessages / totalChats).toFixed(2)) : 0;

  res.json({
    totalUsers,
    activeUsers,
    onlineUsers,
    totalChats,
    totalGroups,
    totalDirect,
    totalMessages,
    newUsers7d,
    newUsers30d,
    messages7d,
    messages30d,
    msgPerDay30,
    registrationsPerDay30,
    mostActiveUsers,
    avgMessagesPerUser,
    avgMessagesPerChat,
  });
});
