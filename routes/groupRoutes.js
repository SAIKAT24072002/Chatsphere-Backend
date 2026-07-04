import express from "express";
import { createGroup, updateGroup, addMembers, removeMember, makeAdmin } from "../controllers/groupController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(protect);

router.post("/",                        createGroup);
router.put("/:id",                      updateGroup);
router.post("/:id/members",             addMembers);
router.delete("/:id/members/:userId",   removeMember);
router.post("/:id/admins/:userId",      makeAdmin);

export default router;
