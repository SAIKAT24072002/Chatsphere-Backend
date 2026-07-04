import express from "express";
import {
  getMessages, sendMessage, deleteMessage,
  searchMessages, addReaction, flagMessage,
} from "../controllers/messageController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(protect);

router.get("/search",    searchMessages);
router.get("/:chatId",   getMessages);
router.post("/",         sendMessage);
router.delete("/:id",    deleteMessage);
router.post("/:id/react", addReaction);
router.post("/:id/flag",  flagMessage);

export default router;
