import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();

// ─── Create uploads directory if it doesn't exist ────────────────────────────
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ─── Multer storage config ────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

// ─── File type whitelist ──────────────────────────────────────────────────────
const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, PNG, WEBP, and PDF are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
});

// ─── POST /api/upload/cover — Upload book cover image (admin) ─────────────────
router.post(
  '/cover',
  protect,
  admin,
  upload.single('file'),
  (req: Request, res: Response): void => {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded.' });
      return;
    }

    const fileUrl = `${process.env.BACKEND_URL || 'http://localhost:3000'}/uploads/${req.file.filename}`;
    res.json({ url: fileUrl, filename: req.file.filename });
  }
);

// ─── POST /api/upload/ebook — Upload ebook PDF (admin) ────────────────────────
router.post(
  '/ebook',
  protect,
  admin,
  upload.single('file'),
  (req: Request, res: Response): void => {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded.' });
      return;
    }

    const fileUrl = `${process.env.BACKEND_URL || 'http://localhost:3000'}/uploads/${req.file.filename}`;
    res.json({ url: fileUrl, filename: req.file.filename });
  }
);

// ─── Multer error handler ─────────────────────────────────────────────────────
router.use((err: any, _req: Request, res: Response, _next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ message: 'File too large. Maximum size is 50MB.' });
      return;
    }
  }
  res.status(400).json({ message: err.message || 'File upload failed.' });
});

export default router;
