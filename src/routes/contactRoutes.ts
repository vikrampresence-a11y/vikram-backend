import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import { sendContactNotification } from '../config/mailer';

const router = express.Router();

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { message: 'Too many contact requests. Please wait before sending again.' },
});

// ─── POST /api/contact ────────────────────────────────────────────────────────
router.post(
  '/',
  contactLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('subject').trim().notEmpty().withMessage('Subject is required'),
    body('message').trim().isLength({ min: 10 }).withMessage('Message must be at least 10 characters'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { name, email, subject, message } = req.body;

    try {
      await sendContactNotification(name, email, subject, message);
      res.json({ message: 'Your message has been sent! We will reply within 24-48 hours.' });
    } catch (error: any) {
      console.error('Contact form error:', error.message);
      res.status(500).json({ message: 'Failed to send message. Please email us directly at vikrampresence@gmail.com' });
    }
  }
);

export default router;
