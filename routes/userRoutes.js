import express from "express";
import {
  getUsers, getUserById, updateProfile, uploadAvatar,
  updatePassword, updateNotifications, toggleBlock,
} from "../controllers/userController.js";
import { protect } from "../middleware/authMiddleware.js";
import { upload } from "../config/cloudinary.js";

const router = express.Router();
router.use(protect);

router.get("/",                    getUsers);
router.get("/:id",                 getUserById);
router.put("/profile",             updateProfile);
router.post("/avatar",             upload.single("avatar"), uploadAvatar);
router.put("/password",            updatePassword);
router.put("/notifications",       updateNotifications);
router.post("/:id/block",          toggleBlock);

export default router;
