import express from "express";
import { accessChat, getMyChats, getChatById } from "../controllers/chatController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(protect);

router.post("/",    accessChat);
router.get("/",     getMyChats);
router.get("/:id",  getChatById);

export default router;
