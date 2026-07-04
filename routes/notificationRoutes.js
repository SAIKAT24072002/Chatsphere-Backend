import express from "express";
import { getNotifications, markAllRead, markRead } from "../controllers/notificationController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(protect);

router.get("/",            getNotifications);
router.put("/read-all",    markAllRead);
router.put("/:id/read",    markRead);

export default router;
