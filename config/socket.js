import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Message from "../models/Message.js";

const onlineUsers = new Map(); // userId → socketId

export const initializeSocket = (io) => {
  // ── Auth middleware ──────────────────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error("Authentication error: no token"));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("-password");
      if (!user) return next(new Error("Authentication error: user not found"));
      socket.user = user;
      next();
    } catch (err) {
      next(new Error("Authentication error: " + err.message));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.user._id.toString();
    onlineUsers.set(userId, socket.id);

    await User.findByIdAndUpdate(userId, { status: "online", lastSeen: new Date() });
    socket.broadcast.emit("userStatus", { userId, status: "online" });
    socket.emit("onlineUsers", Array.from(onlineUsers.keys()));

    // Join personal room so we can DM this socket by userId
    socket.join(userId);

    // ── Room management ──────────────────────────────────────────────────────
    socket.on("joinRoom",  (roomId) => socket.join(roomId));
    
    socket.on("leaveRoom", (roomId) => socket.leave(roomId));

    // ── Messaging ────────────────────────────────────────────────────────────
    // socket.on("sendMessage", async (data) => {
    //   try {
    //     const { chatId, content, type, fileUrl, fileName, fileSize } = data;
    //     const message = await Message.create({
    //       chat: chatId,
    //       sender: userId,
    //       content,
    //       type: type || "text",
    //       fileUrl,
    //       fileName,
    //       fileSize,
    //     });
    //     const populated = await message.populate([
    //       { path: "sender", select: "username avatar status" },
    //       { path: "chat" },
    //     ]);

    //     io.to(chatId).emit("newMessage", populated);
    //   } catch (err) {
    //     socket.emit("error", { message: err.message });
    //   }
    // });

    // ── Typing indicator ─────────────────────────────────────────────────────
    socket.on("typing", ({ chatId, isTyping }) => {
      socket.to(chatId).emit("typing", {
        userId,
        username: socket.user.username,
        chatId,
        isTyping,
      });
    });

    // ── Read receipts ────────────────────────────────────────────────────────
    socket.on("messageRead", async ({ messageId, chatId }) => {
      await Message.findByIdAndUpdate(messageId, { $addToSet: { readBy: userId } });
      io.to(chatId).emit("messageRead", { messageId, userId });
    });

    // ── Custom status ────────────────────────────────────────────────────────
    socket.on("setStatus", async ({ status }) => {
      const valid = ["online", "away", "busy", "offline"];
      if (!valid.includes(status)) return;
      await User.findByIdAndUpdate(userId, { status });
      io.emit("userStatus", { userId, status });
    });

    // ── Disconnect ───────────────────────────────────────────────────────────
    socket.on("disconnect", async () => {
      onlineUsers.delete(userId);
      await User.findByIdAndUpdate(userId, { status: "offline", lastSeen: new Date() });
      io.emit("userStatus", { userId, status: "offline" });
    });
  });
};

export const getOnlineUsers = () => Array.from(onlineUsers.keys());
