import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    chat     : { type: mongoose.Schema.Types.ObjectId, ref: "Chat",    required: true },
    sender   : { type: mongoose.Schema.Types.ObjectId, ref: "User",    required: true },
    content  : { type: String, default: "" },
    type     : { type: String, enum: ["text","image","video","file","audio","system"], default: "text" },
    fileUrl  : { type: String },
    publicId : { type: String },
    fileName : { type: String },
    fileSize : { type: Number },
    replyTo  : { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
    readBy   : [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    reactions: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, emoji: String }],
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    isFlagged: { type: Boolean, default: false },
    flagReason: { type: String },
  },
  { timestamps: true }
);

messageSchema.index({ chat: 1, createdAt: -1 });
messageSchema.index({ content: "text" });

const Message = mongoose.model("Message", messageSchema);

export default Message;
