import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── Cloudinary SDK config ─────────────────────────────────────────────────────
cloudinary.config({
  cloud_name : process.env.CLOUDINARY_CLOUD_NAME,
  api_key    : process.env.CLOUDINARY_API_KEY,
  api_secret : process.env.CLOUDINARY_API_SECRET,
});

// ── Local upload directories ──────────────────────────────────────────────────
const UPLOAD_ROOT = path.join(__dirname, "..", "uploads");
const dirs = {
  image : path.join(UPLOAD_ROOT, "images"),
  video : path.join(UPLOAD_ROOT, "videos"),
  file  : path.join(UPLOAD_ROOT, "files"),
};
Object.values(dirs).forEach((d) => fs.mkdirSync(d, { recursive: true }));

// ── Multer — save to disk first ───────────────────────────────────────────────
const storage = multer.diskStorage({
  destination(req, file, cb) {
    if (file.mimetype.startsWith("image/"))      cb(null, dirs.image);
    else if (file.mimetype.startsWith("video/")) cb(null, dirs.video);
    else                                          cb(null, dirs.file);
  },
  filename(req, file, cb) {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "video/mp4", "video/quicktime",
  "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain", "application/zip",
]);

export const upload = multer({
  storage,
  limits : { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter(req, file, cb) {
    if (ALLOWED_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error(`File type "${file.mimetype}" is not allowed`), false);
  },
});

// ── Upload a locally-saved file to Cloudinary via upload_stream ───────────────
/**
 * @param {string} localPath  - Absolute path of the file already on disk
 * @param {string} folder     - Cloudinary folder name (e.g. "chat-app/images")
 * @param {string} resourceType - "image" | "video" | "raw"
 * @returns {Promise<{ url: string, publicId: string }>}
 */
export const streamToCloudinary = (localPath, folder, resourceType = "auto") =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: resourceType },
      (error, result) => {
        // Always delete the local temp file after attempting upload
        fs.unlink(localPath, () => {});
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    fs.createReadStream(localPath).pipe(stream);
  });

// ── Helper: pick Cloudinary folder + resource_type from MIME ─────────────────
export const cloudinaryParams = (mimetype) => {
  if (mimetype.startsWith("image/"))
    return { folder: "chat-app/images",  resourceType: "image" };
  if (mimetype.startsWith("video/"))
    return { folder: "chat-app/videos",  resourceType: "video" };
  return   { folder: "chat-app/files",   resourceType: "raw"   };
};

export default cloudinary;
