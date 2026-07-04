import Notification from "../models/Notification.js";
import asyncHandler from "../middleware/asyncHandler.js";

// GET /api/notifications
export const getNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ recipient: req.user._id })
    .populate("sender", "username avatar")
    .populate("chat",   "name isGroup")
    .sort({ createdAt: -1 })
    .limit(50);
  res.json(notifications);
});

// PUT /api/notifications/read-all
export const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { isRead: true }
  );
  res.json({ message: "All marked as read" });
});

// PUT /api/notifications/:id/read
export const markRead = asyncHandler(async (req, res) => {
  await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { isRead: true }
  );
  res.json({ message: "Marked as read" });
});
