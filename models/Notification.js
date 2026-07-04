import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient : { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    sender    : { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    type      : { type: String, enum: ["message","mention","group_invite","group_join","group_leave","system"], required: true },
    title     : { type: String, required: true },
    body      : { type: String },
    chat      : { type: mongoose.Schema.Types.ObjectId, ref: "Chat" },
    message   : { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
    isRead    : { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;
