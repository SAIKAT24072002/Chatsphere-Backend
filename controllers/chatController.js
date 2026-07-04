import Chat from "../models/Chat.js";
import asyncHandler from "../middleware/asyncHandler.js";

// POST /api/chats  — access or create 1-on-1 chat
export const accessChat = asyncHandler(async (req, res) => {
  const { userId } = req.body;
  if (!userId) { res.status(400); throw new Error("UserId required"); }

  let chat = await Chat.findOne({
    isGroup: false,
    members: { $all: [req.user._id, userId] },
  })
    .populate("members", "-password")
    .populate({ path: "lastMessage", populate: { path: "sender", select: "username avatar" } });

  if (chat) return res.json(chat);

  chat = await Chat.create({ isGroup: false, members: [req.user._id, userId] });
  const fullChat = await Chat.findById(chat._id).populate("members", "-password");
  res.status(201).json(fullChat);
});

// GET /api/chats
export const getMyChats = asyncHandler(async (req, res) => {
  const chats = await Chat.find({ members: req.user._id, isActive: true })
    .populate("members", "-password")
    .populate("admins", "-password")
    .populate({ path: "lastMessage", populate: { path: "sender", select: "username avatar" } })
    .sort({ updatedAt: -1 });
  res.json(chats);
});

// GET /api/chats/:id
export const getChatById = asyncHandler(async (req, res) => {
  const chat = await Chat.findById(req.params.id)
    .populate("members", "-password")
    .populate("admins", "-password")
    .populate({ path: "lastMessage", populate: { path: "sender", select: "username avatar" } });
  if (!chat) { res.status(404); throw new Error("Chat not found"); }
  if (!chat.members.some((m) => m._id.toString() === req.user._id.toString())) {
    res.status(403); throw new Error("Not a member of this chat");
  }
  res.json(chat);
});
