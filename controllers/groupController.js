import Chat from "../models/Chat.js";
import Message from "../models/Message.js";
import asyncHandler from "../middleware/asyncHandler.js";

// POST /api/groups
export const createGroup = asyncHandler(async (req, res) => {
  const { name, memberIds, description } = req.body;
  if (!name || !memberIds?.length) {
    res.status(400); throw new Error("Name and members required");
  }
  const members = [...new Set([...memberIds, req.user._id.toString()])];
  const group = await Chat.create({
    name, description, isGroup: true,
    members, admins: [req.user._id], createdBy: req.user._id,
  });
  const populated = await Chat.findById(group._id)
    .populate("members", "-password")
    .populate("admins",  "-password");

  await Message.create({
    chat: group._id, sender: req.user._id,
    content: `${req.user.username} created the group`, type: "system",
  });

  const io = req.app.get("io");
  // if (io) members.forEach((id) => io.to(id.toString()).emit("newGroup", populated));
  const creatorId = req.user._id.toString();

  if(io)
  {
    members.forEach((id) => {
      if (id.toString() !== creatorId) {
        io.to(id.toString()).emit("newGroup", populated);
      }
    });

  }

  res.status(201).json(populated);
});

// PUT /api/groups/:id
export const updateGroup = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const group = await Chat.findById(req.params.id);
  if (!group?.isGroup) { res.status(404); throw new Error("Group not found"); }
  if (!group.admins.map((a) => a.toString()).includes(req.user._id.toString())) {
    res.status(403); throw new Error("Admin only");
  }
  if (name)               group.name        = name;
  if (description !== undefined) group.description = description;
  await group.save();
  const updated = await Chat.findById(group._id)
    .populate("members", "-password").populate("admins", "-password");
  res.json(updated);
});

// POST /api/groups/:id/members
export const addMembers = asyncHandler(async (req, res) => {
  const { memberIds } = req.body;
  const group = await Chat.findById(req.params.id);
  if (!group?.isGroup) { res.status(404); throw new Error("Group not found"); }
  if (!group.admins.map((a) => a.toString()).includes(req.user._id.toString())) {
    res.status(403); throw new Error("Admin only");
  }
  const existing  = group.members.map((m) => m.toString());
  const newMembers = memberIds.filter((id) => !existing.includes(id));
  group.members.push(...newMembers);
  await group.save();

  await Message.create({
    chat: group._id, sender: req.user._id,
    content: `${newMembers.length} member(s) added`, type: "system",
  });

  const updated = await Chat.findById(group._id)
    .populate("members", "-password").populate("admins", "-password");
  const io = req.app.get("io");
  if (io) {
    newMembers.forEach((id) => io.to(id).emit("addedToGroup", updated));
    io.to(group._id.toString()).emit("groupUpdated", updated);
  }
  res.json(updated);
});

// DELETE /api/groups/:id/members/:userId
export const removeMember = asyncHandler(async (req, res) => {
  const group  = await Chat.findById(req.params.id);
  if (!group?.isGroup) { res.status(404); throw new Error("Group not found"); }
  const isAdmin = group.admins.map((a) => a.toString()).includes(req.user._id.toString());
  const isSelf  = req.params.userId === req.user._id.toString();
  if (!isAdmin && !isSelf) { res.status(403); throw new Error("Not authorized"); }

  group.members = group.members.filter((m) => m.toString() !== req.params.userId);
  group.admins  = group.admins.filter((a) => a.toString() !== req.params.userId);
  await group.save();

  const io = req.app.get("io");
  if (io) {
    io.to(req.params.userId).emit("removedFromGroup", { groupId: group._id });
    io.to(group._id.toString()).emit("groupUpdated", group);
  }
  res.json({ message: "Member removed" });
});

// POST /api/groups/:id/admins/:userId
export const makeAdmin = asyncHandler(async (req, res) => {
  const group = await Chat.findById(req.params.id);
  if (!group?.isGroup) { res.status(404); throw new Error("Group not found"); }
  if (!group.admins.map((a) => a.toString()).includes(req.user._id.toString())) {
    res.status(403); throw new Error("Admin only");
  }
  if (!group.admins.map((a) => a.toString()).includes(req.params.userId)) {
    group.admins.push(req.params.userId);
    await group.save();
  }
  res.json({ message: "Admin added" });
});
