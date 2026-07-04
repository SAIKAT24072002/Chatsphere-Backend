import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    username    : { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 30 },
    email       : { type: String, required: true, unique: true, lowercase: true, trim: true },
    password    : { type: String, required: true, minlength: 6 },
    avatar      : { type: String, default: "" },
    bio         : { type: String, default: "", maxlength: 200 },
    status      : { type: String, enum: ["online", "offline", "away", "busy"], default: "offline" },
    customStatus: { type: String, default: "", maxlength: 100 },
    lastSeen    : { type: Date, default: Date.now },
    role        : { type: String, enum: ["user", "admin"], default: "user" },
    isActive    : { type: Boolean, default: true },
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    notifications: {
      messages: { type: Boolean, default: true },
      mentions: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

const User = mongoose.model("User", userSchema);
export default User;
