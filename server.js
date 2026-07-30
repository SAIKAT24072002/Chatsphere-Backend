import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";

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
import User from "./models/User.js";



// ── Express + HTTP server ─────────────────────────────────────────────────────
const app    = express();
const server = createServer(app);

// ── CORS configuration ────────────────────────────────────────────────────────
const getClientOrigins = () => {
  const origins = [
    "http://localhost:5173",
    "http://localhost:5173/",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5173/"
  ];
  if (process.env.CLIENT_URL) {
    const raw = process.env.CLIENT_URL.trim();
    const urls = raw.split(",").map(url => url.trim());
    for (const url of urls) {
      if (url) {
        origins.push(url);
        if (url.endsWith("/")) {
          origins.push(url.slice(0, -1));
        } else {
          origins.push(url + "/");
        }
      }
    }
  }
  return origins;
};
const clientOrigins = getClientOrigins();

const checkOrigin = (origin, callback) => {
  if (!origin) return callback(null, true);
  const normalizedOrigin = origin.endsWith("/") ? origin.slice(0, -1) : origin;
  const isAllowed = clientOrigins.some(allowed => {
    const normalizedAllowed = allowed.endsWith("/") ? allowed.slice(0, -1) : allowed;
    return normalizedOrigin === normalizedAllowed;
  }) ||
  normalizedOrigin.endsWith(".vercel.app") ||
  normalizedOrigin.endsWith(".netlify.app") ||
  /^https?:\/\/localhost(:\d+)?$/.test(normalizedOrigin) ||
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(normalizedOrigin);

  if (isAllowed) {
    callback(null, origin);
  } else {
    callback(null, false);
  }
};

// ── Socket.io ─────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin     : checkOrigin,
    methods    : ["GET", "POST"],
    credentials: true,
  },
});
app.set("io", io);
initializeSocket(io);

// ── Global middleware ─────────────────────────────────────────────────────────
app.use(cors({
  origin     : checkOrigin,
  credentials: true,
}));
app.use(cookieParser())
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.resolve("uploads")));


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
app.get("/", (req, res) => res.send("Chatsphere API is running..."));

// ── Error handling (must be after routes) ────────────────────────────────────
app.use(notFound);
app.use(errorHandler);


// ── Database ──────────────────────────────────────────────────────────────────
await connectDB();

const seedAdmin = async () => {
  try {
    const adminExists = await User.findOne({ email: "admin@gmail.com" });
    if (!adminExists) {
      await User.create({
        username: "admin",
        email: "admin@gmail.com",
        password: "Admin123",
        role: "admin",
      });
      console.log("👑 Default admin account seeded: admin@gmail.com / Admin123");
    }
  } catch (err) {
    console.error("Admin seeding failed:", err.message);
  }
};
await seedAdmin();


// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀  Server running on port ${PORT}`));
