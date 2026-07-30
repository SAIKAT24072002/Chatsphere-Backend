import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true }, // e.g. "TOGGLE_USER_STATUS", "DELETE_GROUP"
    target: { type: String, default: "" }, // target username, group name, or IDs
    details: { type: String, default: "" }, // detailed changes or info
    ip: { type: String, default: "" },
  },
  { timestamps: true }
);

activityLogSchema.index({ admin: 1, createdAt: -1 });

const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);
export default ActivityLog;
