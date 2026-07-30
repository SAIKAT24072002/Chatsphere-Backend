import mongoose from "mongoose";

const loginHistorySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    status: { type: String, enum: ["success", "failed"], required: true },
    failureReason: { type: String, default: "" },
  },
  { timestamps: true }
);

loginHistorySchema.index({ user: 1, createdAt: -1 });

const LoginHistory = mongoose.model("LoginHistory", loginHistorySchema);
export default LoginHistory;
