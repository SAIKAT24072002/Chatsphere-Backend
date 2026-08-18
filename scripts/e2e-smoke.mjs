import { randomBytes } from "node:crypto";
import { io } from "socket.io-client";

const baseUrl = process.env.CHATSPHERE_E2E_URL || "http://127.0.0.1:5001";
const suffix = randomBytes(6).toString("hex");
const password = `Smoke${randomBytes(8).toString("hex")}A9`;
const sockets = [];

const request = async (path, { token, expected, ...options } = {}) => {
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) {
    headers["content-type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (expected !== undefined && response.status !== expected) {
    throw new Error(`${options.method || "GET"} ${path}: expected ${expected}, received ${response.status} (${body?.message || body})`);
  }
  return { response, body };
};

const onceEvent = (socket, event, predicate = () => true, timeoutMs = 7000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);
    const handler = (payload) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });

const connect = (token, chatId) =>
  new Promise((resolve, reject) => {
    const socket = io(baseUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: false,
    });
    sockets.push(socket);
    socket.on("connect", () => {
      if (chatId) {
        socket.emit("joinRoom", chatId);
        setTimeout(() => resolve(socket), 150);
      } else {
        resolve(socket);
      }
    });
    socket.on("connect_error", reject);
  });

const register = async (label) => {
  const { body } = await request("/api/auth/register", {
    method: "POST",
    expected: 201,
    body: {
      username: `smoke_${label}_${suffix}`,
      email: `smoke_${label}_${suffix}@example.com`,
      password,
    },
  });
  return body;
};

try {
  await request("/api/health", { expected: 200 });
  await request("/api/definitely-not-a-route", { expected: 404 });
  await request("/api/auth/login", { method: "POST", expected: 400, body: {} });
  await request("/api/auth/login", {
    method: "POST",
    expected: 401,
    body: { email: `missing_${suffix}@example.com`, password },
  });

  const a = await register("a");
  const b = await register("b");
  const c = await register("c");

  await request("/api/auth/login", {
    method: "POST",
    expected: 200,
    body: { email: a.user.email, password },
  });
  await request("/api/admin/users", { token: a.token, expected: 403 });

  const { body: search } = await request(`/api/users?search=${encodeURIComponent(b.user.username)}`, {
    token: a.token,
    expected: 200,
  });
  if (!search.some((user) => user._id === b.user._id)) throw new Error("User search did not find the second user");

  const { body: chat } = await request("/api/chats", {
    token: a.token,
    method: "POST",
    expected: 201,
    body: { userId: b.user._id },
  });

  let socketA = await connect(a.token, chat._id);
  const socketB = await connect(b.token, chat._id);

  let ownTyping = false;
  socketA.on("typing", () => { ownTyping = true; });
  const typingStarted = onceEvent(socketB, "typing", (payload) =>
    payload.chatId === chat._id && payload.userId === a.user._id && payload.isTyping === true
  );
  socketA.emit("typing", { chatId: chat._id, isTyping: true });
  await typingStarted;
  await new Promise((resolve) => setTimeout(resolve, 200));
  if (ownTyping) throw new Error("Sender received its own typing indicator");

  const typingStopped = onceEvent(socketB, "typing", (payload) =>
    payload.chatId === chat._id && payload.userId === a.user._id && payload.isTyping === false
  );
  socketA.emit("typing", { chatId: chat._id, isTyping: false });
  await typingStopped;

  for (const status of ["away", "busy"]) {
    const received = onceEvent(socketB, "userStatus", (payload) =>
      payload.userId === a.user._id && payload.status === status
    );
    socketA.emit("setStatus", { status });
    await received;
    const { body: me } = await request("/api/auth/me", { token: a.token, expected: 200 });
    if (me.status !== status) throw new Error(`${status} did not persist`);
  }

  const wentOffline = onceEvent(socketB, "userStatus", (payload) =>
    payload.userId === a.user._id && payload.status === "offline"
  );
  socketA.disconnect();
  await wentOffline;
  const restoredBusy = onceEvent(socketB, "userStatus", (payload) =>
    payload.userId === a.user._id && payload.status === "busy"
  );
  socketA = await connect(a.token, chat._id);
  await restoredBusy;
  const { body: afterReconnect } = await request("/api/auth/me", { token: a.token, expected: 200 });
  if (afterReconnect.status !== "busy") throw new Error("Busy status was not retained after reconnect");

  const incoming = onceEvent(socketB, "newMessage", (message) =>
    (message.chat?._id || message.chat) === chat._id && message.sender?._id === a.user._id
  );
  const { body: message } = await request("/api/messages", {
    token: a.token,
    method: "POST",
    expected: 201,
    body: { chatId: chat._id, content: `smoke message ${suffix}`, type: "text" },
  });
  await incoming;

  const readReceipt = onceEvent(socketA, "messageRead", (payload) =>
    payload.messageId === message._id && payload.userId === b.user._id
  );
  socketB.emit("messageRead", { messageId: message._id, chatId: chat._id });
  await readReceipt;
  const { body: history } = await request(`/api/messages/${chat._id}`, { token: b.token, expected: 200 });
  if (!history.messages.some((entry) => entry._id === message._id)) throw new Error("Message persistence failed");

  console.log("STEP core auth, chat, typing, status, message checks passed");
  const attachment = new FormData();
  attachment.append("file", new Blob(["ChatSphere smoke attachment"], { type: "text/plain" }), "smoke.txt");
  const { body: uploaded } = await request("/api/upload/file", {
    token: a.token,
    method: "POST",
    expected: 200,
    body: attachment,
  });
  if (!uploaded.url) throw new Error("Attachment upload did not return a URL");

  const avatar = new FormData();
  const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlSoAAAAASUVORK5CYII=", "base64");
  avatar.append("avatar", new Blob([pixel], { type: "image/png" }), "avatar.png");
  const { body: avatarResult } = await request("/api/users/avatar", {
    token: a.token,
    method: "POST",
    expected: 200,
    body: avatar,
  });
  if (!avatarResult.avatar) throw new Error("Avatar upload did not return a URL");

  console.log("STEP upload checks passed");
  const { body: group } = await request("/api/groups", {
    token: a.token,
    method: "POST",
    expected: 201,
    body: { name: `Smoke group ${suffix}`, memberIds: [b.user._id] },
  });
  await request(`/api/groups/${group._id}`, {
    token: a.token,
    method: "PUT",
    expected: 200,
    body: { name: `Renamed smoke group ${suffix}` },
  });
  await request(`/api/groups/${group._id}/members`, {
    token: a.token,
    method: "POST",
    expected: 200,
    body: { memberIds: [c.user._id] },
  });
  await request(`/api/groups/${group._id}/admins/${b.user._id}`, {
    token: a.token,
    method: "POST",
    expected: 200,
  });
  await request(`/api/groups/${group._id}/members/${c.user._id}`, {
    token: b.token,
    method: "DELETE",
    expected: 200,
  });
  await request(`/api/groups/${group._id}/members/${b.user._id}`, {
    token: b.token,
    method: "DELETE",
    expected: 200,
  });

  console.log("PASS auth error semantics, normal login, admin denial, user search");
  console.log("PASS one-to-one chat, real-time message, persistence, read receipt");
  console.log("PASS typing start/stop, sender exclusion, reconnect room join");
  console.log("PASS Away/Busy persistence, peer update, disconnect/reconnect");
  console.log("PASS attachment upload, avatar upload");
  console.log("PASS group create, rename, add, promote, remove, leave");
} finally {
  sockets.forEach((socket) => socket.disconnect());
}
