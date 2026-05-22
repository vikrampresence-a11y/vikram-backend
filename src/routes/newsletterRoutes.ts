import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import mongoose, { Schema, Model, Document } from 'mongoose';

interface INewsletter extends Document {
  email: string;
  subscribedAt: Date;
  isActive: boolean;
}

const newsletterSchema = new Schema<INewsletter>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  subscribedAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
});

// Safely get or create model
const Newsletter: Model<INewsletter> =
  (mongoose.models.Newsletter as Model<INewsletter>) ||
  mongoose.model<INewsletter>('Newsletter', newsletterSchema);

const newsletterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { message: 'Too many subscription attempts. Please wait an hour.' },
});

// ─── POST /api/newsletter/subscribe ──────────────────────────────────────────
const router = express.Router();

router.post(
  '/subscribe',
  newsletterLimiter,
  [body('email').isEmail().normalizeEmail().withMessage('Valid email is required')],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { email } = req.body;

    try {
      const existing = await Newsletter.findOne({ email });
      if (existing) {
        if (existing.isActive) {
          res.json({ message: 'You are already subscribed to the Inner Circle!' });
        } else {
          existing.isActive = true;
          await existing.save();
          res.json({ message: 'Welcome back! You have been re-subscribed.' });
        }
        return;
      }

      await Newsletter.create({ email });
      res.status(201).json({ message: 'Successfully subscribed to the Vikram Presence Inner Circle!' });
    } catch (error: any) {
      res.status(500).json({ message: 'Subscription failed. Please try again.' });
    }
  }
);

export { Newsletter };
export default router;
