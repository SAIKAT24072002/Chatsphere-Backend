import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { upload, streamToCloudinary, cloudinaryParams } from "../config/cloudinary.js";
import asyncHandler from "../middleware/asyncHandler.js";

const router = express.Router();

/**
 * POST /api/upload/file
 *
 * Flow:
 *  1. Multer saves the file to disk  (uploads/images | uploads/videos | uploads/files)
 *  2. streamToCloudinary reads the local file and pipes it via upload_stream to Cloudinary
 *  3. Local temp file is deleted after the stream finishes (inside streamToCloudinary)
 *  4. Cloudinary secure_url is returned to the client
 */
router.post(
  "/file",
  protect,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400);
      throw new Error("No file uploaded");
    }

    const { folder, resourceType } = cloudinaryParams(req.file.mimetype);
    const { url, publicId }        = await streamToCloudinary(req.file.path, folder, resourceType);

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
