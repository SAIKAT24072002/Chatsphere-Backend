import Message from "../models/Message.js";
import Chat from "../models/Chat.js";
import Notification from "../models/Notification.js";
import User from "../models/User.js";
import asyncHandler from "../middleware/asyncHandler.js";
import cloudinary from "../config/cloudinary.js";

// GET /api/messages/:chatId
export const getMessages = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;

  const chat = await Chat.findById(chatId);
  if (!chat) { res.status(404); throw new Error("Chat not found"); }
  if (!chat.members.includes(req.user._id)) {
    res.status(403); throw new Error("Not a member");
  }

  const messages = await Message.find({ chat: chatId, isDeleted: false })
    .populate("sender", "username avatar status")
    .populate({ path: "replyTo", populate: { path: "sender", select: "username" } })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const total = await Message.countDocuments({ chat: chatId, isDeleted: false });
  res.json({ messages: messages.reverse(), total, page, pages: Math.ceil(total / limit) });
});

// POST /api/messages
export const sendMessage = asyncHandler(async (req, res) => {
  const { chatId, content, type, fileUrl, publicId, fileName, fileSize, replyTo } = req.body;
  if (!chatId) { res.status(400); throw new Error("chatId required"); }

  const chat = await Chat.findById(chatId);
  if (!chat) { res.status(404); throw new Error("Chat not found"); }
  if (!chat.members.includes(req.user._id)) {
    res.status(403); throw new Error("Not a member");
  }

  const message = await Message.create({
    chat: chatId, sender: req.user._id, content,
    type: type || "text", fileUrl, publicId, fileName, fileSize
  });

  await Chat.findByIdAndUpdate(chatId, { lastMessage: message._id });

  const populated = await message.populate([
    { path: "sender", select: "username avatar status" },
    { path: "replyTo", populate: { path: "sender", select: "username" } },
  ]);

  // Socket broadcast to each member's personal room
  const io = req.app.get("io");
  if (io) {
    chat.members.forEach((memberId) => {
      io.to(memberId.toString()).emit("newMessage", populated);
    });
  }

  // Notifications for other members
  const others = chat.members.filter((m) => m.toString() !== req.user._id.toString());
  if (others.length) {
    const createdNotifs = await Notification.insertMany(
      others.map((memberId) => ({
        recipient: memberId,
        sender: req.user._id,
        type: "message",
        title: `New message from ${req.user.username}`,
        body: type === "text" ? content?.substring(0, 100) : `Sent a ${type}`,
        chat: chatId,
        message: message._id,
      }))
    );

    if (io) {
      createdNotifs.forEach((notif) => {
        io.to(notif.recipient.toString()).emit("newNotification", {
          ...notif.toObject(),
          sender: { _id: req.user._id, username: req.user.username, avatar: req.user.avatar },
          chat: { _id: chat._id, name: chat.name, isGroup: chat.isGroup },
        });
      });
    }
  }

  res.status(201).json(populated);
});

// DELETE /api/messages/:id
export const deleteMessage = asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.id);
  if (!message) { res.status(404); throw new Error("Message not found"); }
  if (message.sender.toString() !== req.user._id.toString() && req.user.role !== "admin") {
    res.status(403); throw new Error("Not authorized");
  }
  if (message.fileUrl && message.publicId) {
    const result=await cloudinary.uploader.destroy(
      message.publicId,
      {
        resource_type:
          message.type === "video"
            ? "video"
            : message.type === "file"
              ? "raw"
              : "image"
      }
    );
    console.log("Cloudinary delete:", result);
  }
  message.isDeleted = true;
  message.deletedAt = new Date();
  message.content = "This message was deleted";
  await message.save();

  const io = req.app.get("io");
  if (io) io.to(message.chat.toString()).emit("messageDeleted", { messageId: message._id });
  res.json({ message: "Deleted" });
});

// GET /api/messages/search
export const searchMessages = asyncHandler(async (req, res) => {
  const { q, chatId, type, startDate, endDate, sender } = req.query;
  const filter = { isDeleted: false };

  if (chatId) {
    const chat = await Chat.findById(chatId);
    if (!chat?.members.includes(req.user._id)) {
      res.status(403); throw new Error("Not a member");
    }
    filter.chat = chatId;
  } else {
    const userChats = await Chat.find({ members: req.user._id }).select("_id");
    filter.chat = { $in: userChats.map((c) => c._id) };
  }

  if (q) {
    filter.content = { $regex: q, $options: "i" };
  }
  if (type) filter.type = type;

  if (sender) {
    if (sender.match(/^[0-9a-fA-F]{24}$/)) {
      filter.sender = sender;
    } else {
      const users = await User.find({ username: { $regex: sender, $options: "i" } }).select("_id");
      if (users.length > 0) {
        filter.sender = { $in: users.map((u) => u._id) };
      } else {
        return res.json([]);
      }
    }
  }

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  const messages = await Message.find(filter)
    .populate("sender", "username avatar")
    .populate("chat", "name isGroup")
    .sort({ createdAt: -1 })
    .limit(50);

  res.json(messages);
});

// POST /api/messages/:id/react
export const addReaction = asyncHandler(async (req, res) => {
  const { emoji } = req.body;
  const message = await Message.findById(req.params.id);
  if (!message) { res.status(404); throw new Error("Message not found"); }

  const existing = message.reactions.find(
    (r) => r.user.toString() === req.user._id.toString()
  );
  if (existing) existing.emoji = emoji;
  else message.reactions.push({ user: req.user._id, emoji });
  await message.save();

  const io = req.app.get("io");
  if (io)
    io.to(message.chat.toString()).emit("messageReaction", {
      messageId: message._id,
      reactions: message.reactions,
    });

  res.json(message.reactions);
});

// POST /api/messages/:id/flag
export const flagMessage = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  await Message.findByIdAndUpdate(req.params.id, { isFlagged: true, flagReason: reason });
  res.json({ message: "Flagged" });
});
