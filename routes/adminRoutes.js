import express from "express";
import {
  getAllUsers, toggleUserStatus, getAllGroups, deleteGroup,
  getFlaggedMessages, deleteFlaggedMessage, dismissFlaggedMessage, getAnalytics,
  createGroupAdmin, updateGroupAdmin, getReports,
} from "../controllers/adminController.js";
import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(protect, adminOnly);

router.get("/users",                  getAllUsers);
router.put("/users/:id/toggle",       toggleUserStatus);
router.get("/groups",                 getAllGroups);
router.post("/groups",                createGroupAdmin);
router.put("/groups/:id",             updateGroupAdmin);
router.delete("/groups/:id",          deleteGroup);
router.get("/flagged",                getFlaggedMessages);
router.delete("/flagged/:id",         deleteFlaggedMessage);
router.patch("/flagged/:id/dismiss",  dismissFlaggedMessage);
router.get("/analytics",              getAnalytics);
router.get("/reports",                getReports);

export default router;
