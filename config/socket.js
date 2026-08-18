import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Message from "../models/Message.js";

const onlineUsers = new Map(); // userId -> Set<socketId>

const broadcastOnlineUsers = (io) => {
  io.emit("onlineUsers", Array.from(onlineUsers.keys()));
};

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
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    if (onlineUsers.get(userId).size === 1) {
      const currentStatus = socket.user.status;
      const status = currentStatus === "away" || currentStatus === "busy"
        ? currentStatus
        : "online";
      User.findByIdAndUpdate(userId, { status, lastSeen: new Date() })
        .then(() => io.emit("userStatus", { userId, status }))
        .catch((error) => console.error("Presence update failed:", error.message));
    }
    broadcastOnlineUsers(io);

    // Join personal room so we can DM this socket by userId
    socket.join(userId);

    // ── Room management ──────────────────────────────────────────────────────
    socket.on("joinRoom", (roomId, acknowledge) => {
      if (typeof roomId === "string" && roomId) {
        socket.join(roomId);
        if (typeof acknowledge === "function") acknowledge({ joined: true, roomId });
      }
    });
    
    socket.on("leaveRoom", (roomId) => {
      if (typeof roomId === "string" && roomId) socket.leave(roomId);
    });

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
      if (typeof chatId !== "string" || !chatId) return;
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
      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
          io.emit("userStatus", { userId, status: "offline" });
          broadcastOnlineUsers(io);
        }
      }
    });
  });
};

export const getOnlineUsers = () => Array.from(onlineUsers.keys());
