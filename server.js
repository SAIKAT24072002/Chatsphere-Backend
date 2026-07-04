import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import cookieParser from "cookie-parser";

import connectDB from "./config/db.js";
import { initializeSocket } from "./config/socket.js";

import authRoutes         from "./routes/authRoutes.js";
import userRoutes         from "./routes/userRoutes.js";
import chatRoutes         from "./routes/chatRoutes.js";
import messageRoutes      from "./routes/messageRoutes.js";
import groupRoutes        from "./routes/groupRoutes.js";
import adminRoutes        from "./routes/adminRoutes.js";
import uploadRoutes       from "./routes/uploadRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";

import { errorHandler, notFound } from "./middleware/errorMiddleware.js";



// ── Express + HTTP server ─────────────────────────────────────────────────────
const app    = express();
const server = createServer(app);

// ── Socket.io ─────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin     : process.env.CLIENT_URL || "http://localhost:5173",
    methods    : ["GET", "POST"],
    credentials: true,
  },
});
app.set("io", io);
initializeSocket(io);

// ── Global middleware ─────────────────────────────────────────────────────────
app.use(cors({
  origin     : process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(cookieParser())
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth",          authRoutes);
app.use("/api/users",         userRoutes);
app.use("/api/chats",         chatRoutes);
app.use("/api/messages",      messageRoutes);
app.use("/api/groups",        groupRoutes);
app.use("/api/admin",         adminRoutes);
app.use("/api/upload",        uploadRoutes);
app.use("/api/notifications", notificationRoutes);

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.get("/", (_req, res) => res.send("Chatsphere API is running..."));

// ── Error handling (must be after routes) ────────────────────────────────────
app.use(notFound);
app.use(errorHandler);


// ── Database ──────────────────────────────────────────────────────────────────
await connectDB();


// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀  Server running on port ${PORT}`));
