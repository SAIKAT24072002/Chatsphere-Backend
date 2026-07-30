import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
  {
    name           : { type: String, trim: true },
    isGroup        : { type: Boolean, default: false },
    members        : [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    admins         : [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    avatar         : { type: String, default: "" },
    description    : { type: String, default: "", maxlength: 300 },
    lastMessage    : { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
    createdBy      : { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    pinnedMessages : [{ type: mongoose.Schema.Types.ObjectId, ref: "Message" }],
    isActive       : { type: Boolean, default: true },
  },
  { timestamps: true }
);

chatSchema.index({ members: 1 });

const Chat = mongoose.model("Chat", chatSchema);
export default Chat;
