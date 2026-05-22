import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import Book from '../models/Book';
import { protect, admin } from '../middleware/authMiddleware';
import type { AuthRequest } from '../middleware/authMiddleware';

const router = express.Router();

// ─── GET /api/books — Fetch all active books ─────────────────────────────────
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, featured, limit = 50, page = 1 } = req.query;

    const filter: any = { isActive: true };
    if (category) filter.category = category;
    if (featured === 'true') filter.isFeatured = true;

    const skip = (Number(page) - 1) * Number(limit);

    const [books, total] = await Promise.all([
      Book.find(filter)
        .select('-digitalFileUrl -reviews') // don't expose download URL publicly
        .sort({ isFeatured: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Book.countDocuments(filter),
    ]);

    res.json({ books, total, page: Number(page), limit: Number(limit) });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch books.' });
  }
});

// ─── GET /api/books/:id — Fetch single book (no download URL) ────────────────
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const book = await Book.findById(req.params.id).select('-digitalFileUrl');
    if (!book || !book.isActive) {
      res.status(404).json({ message: 'Book not found.' });
      return;
    }
    res.json(book);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch book.' });
  }
});

// ─── POST /api/books/:id/review — Add a review (protected) ───────────────────
router.post(
  '/:id/review',
  protect,
  [
    body('rating').isFloat({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('comment').trim().notEmpty().withMessage('Review comment is required'),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const book = await Book.findById(req.params.id);
      if (!book) {
        res.status(404).json({ message: 'Book not found.' });
        return;
      }

      // Check if user already reviewed
      const alreadyReviewed = book.reviews.some(
        (r: any) => r.user?.toString() === req.user._id.toString()
      );
      if (alreadyReviewed) {
        res.status(400).json({ message: 'You have already reviewed this book.' });
        return;
      }

      const review = {
        user: req.user._id,
        name: req.user.name,
        rating: Number(req.body.rating),
        comment: req.body.comment,
      };

      book.reviews.push(review as any);
      book.rating =
        book.reviews.reduce((acc: number, r: any) => acc + r.rating, 0) / book.reviews.length;

      await book.save();
      res.status(201).json({ message: 'Review submitted.' });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to submit review.' });
    }
  }
);

// ─── POST /api/books — Create book (Admin only) ───────────────────────────────
router.post(
  '/',
  protect,
  admin,
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('coverImage').trim().notEmpty().withMessage('Cover image URL is required'),
    body('category').trim().notEmpty().withMessage('Category is required'),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ errors: errors.array() }); return; }

    try {
      const book = await Book.create(req.body);
      req.app.get('io').emit('products_updated');
      res.status(201).json(book);
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to create book', error: error.message });
    }
  }
);

// ─── PUT /api/books/:id — Update book (Admin only) ───────────────────────────
router.put('/:id', protect, admin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const book = await Book.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true, runValidators: true }
    );
    if (!book) {
      res.status(404).json({ message: 'Book not found.' });
      return;
    }
    req.app.get('io').emit('products_updated');
    res.json(book);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to update book.' });
  }
});

// ─── DELETE /api/books/:id — Soft delete (Admin only) ───────────────────────
router.delete('/:id', protect, admin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const book = await Book.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!book) { res.status(404).json({ message: 'Book not found' }); return; }
    req.app.get('io').emit('products_updated');
    res.json({ message: 'Book deactivated successfully (soft delete)' });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to deactivate book' });
  }
});

export default router;
