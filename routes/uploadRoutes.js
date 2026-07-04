import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { upload, streamToCloudinary, cloudinaryParams } from "../config/cloudinary.js";
import asyncHandler from "../middleware/asyncHandler.js";
import fs from "fs";
import path from "path";

const router = express.Router();

router.post(
  "/file",
  protect,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400);
      throw new Error("No file uploaded");
    }

    const fileExt = path.extname(req.file.originalname);
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1e6)}${fileExt}`;

    // Define permanent local fallback folder
    const targetDir = path.resolve("uploads/shared");
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const backupPath = path.join(targetDir, fileName);
    fs.copyFileSync(req.file.path, backupPath);

    let url = "";
    let publicId = "";

    try {
      const { folder, resourceType } = cloudinaryParams(req.file.mimetype);
      const result = await streamToCloudinary(req.file.path, folder, resourceType);
      url = result.url;
      publicId = result.publicId;
      // Cloudinary succeeded, delete local backup copy to save disk space
      try { fs.unlinkSync(backupPath); } catch {}
    } catch (error) {
      console.error("Cloudinary upload failed, falling back to local storage:", error.message);
      // Cloudinary failed, serve statically from backend
      url = `${req.protocol}://${req.get("host")}/uploads/shared/${fileName}`;
      publicId = `local-${fileName}`;
    }

    res.json({
      url,
      publicId,
      name : req.file.originalname,
      size : req.file.size,
      type : req.file.mimetype,
    });
  })
);

export default router;
