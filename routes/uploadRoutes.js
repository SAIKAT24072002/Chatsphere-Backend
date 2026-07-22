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

// GET /api/upload/download?url=...&fileName=...
router.get(
  "/download",
  protect,
  asyncHandler(async (req, res) => {
    const { url, fileName } = req.query;
    if (!url) {
      res.status(400);
      throw new Error("File URL is required");
    }

    const safeName = (fileName || "download").replace(/[/\\?%*:|"<>]/g, "_");

    // Handle local file downloads
    if (url.includes("/uploads/")) {
      const relativePath = url.split("/uploads/")[1];
      const localFilePath = path.resolve("uploads", relativePath);
      if (fs.existsSync(localFilePath)) {
        return res.download(localFilePath, safeName);
      }
    }

    // Handle remote (e.g. Cloudinary) downloads via streaming
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch file from remote source: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type") || "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(safeName)}"`);

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return res.send(buffer);
    } catch (err) {
      console.error("Download proxy error:", err.message);
      res.status(500);
      throw new Error("Failed to download file");
    }
  })
);

export default router;
