import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { protect } from '../middleware/authMiddleware';
import type { AuthRequest } from '../middleware/authMiddleware';
import { supabase } from '../supabaseClient';
import User from '../models/User';
import { sendOTPEmail } from '../config/mailer';

const router = express.Router();

// ─── Auth-specific rate limiter (5 attempts per 15 min) ─────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many auth attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Helper: Generate JWT ────────────────────────────────────────────────────
const generateToken = (id: string): string => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret', {
    expiresIn: (process.env.JWT_EXPIRES_IN || '30d') as any,
  });
};

// ─── POST /api/auth/register ─────────────────────────────────────────────────
router.post(
  '/register',
  authLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { name, email, password } = req.body;

    try {
      const userExists = await User.findOne({ email });
      if (userExists) {
        res.status(400).json({ message: 'An account with this email already exists.' });
        return;
      }

      const user = await User.create({ name, email, password });

      // Auto-send OTP for email verification
      try {
        const otp = (user as any).generateOTP();
        await user.save();
        await sendOTPEmail(email, name, otp);
      } catch (mailErr) {
        console.error('OTP email failed:', mailErr);
        // Don't block registration if email fails
      }

      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        token: generateToken((user._id as any).toString()),
        message: 'Registration successful! Please verify your email.',
      });
    } catch (error: any) {
      console.error('Register error:', error.message);
      res.status(500).json({ message: 'Registration failed. Please try again.' });
    }
  }
);

// ─── POST /api/auth/login ────────────────────────────────────────────────────
router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { email, password } = req.body;

    try {
      const user = await User.findOne({ email });

      if (!user || !(await (user as any).matchPassword(password))) {
        res.status(401).json({ message: 'Invalid email or password.' });
        return;
      }

      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionPlan: user.subscriptionPlan,
        token: generateToken((user._id as any).toString()),
      });
    } catch (error: any) {
      console.error('Login error:', error.message);
      res.status(500).json({ message: 'Login failed. Please try again.' });
    }
  }
);

// ─── POST /api/auth/send-otp ─────────────────────────────────────────────────
router.post(
  '/send-otp',
  authLimiter,
  [body('email').isEmail().normalizeEmail().withMessage('Valid email required')],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { email } = req.body;

    try {
      const user = await User.findOne({ email });
      if (!user) {
        // Generic message to prevent user enumeration
        res.json({ message: 'If that email exists, a verification code was sent.' });
        return;
      }

      // Throttle: prevent OTP spam (max 1 every 60 seconds)
      if (user.otpExpiry && user.otpExpiry.getTime() - Date.now() > 9 * 60 * 1000) {
        res.status(429).json({ message: 'A code was recently sent. Please wait 60 seconds before requesting another.' });
        return;
      }

      const otp = (user as any).generateOTP();
      await user.save();
      await sendOTPEmail(email, user.name, otp).catch((mailErr) => {
        console.error('SMTP Error (ignored for dev):', mailErr.message);
        console.log(`[DEV MODE] Generated OTP for ${email}: ${otp}`);
      });

      res.json({ message: 'Verification code sent to your email.' });
    } catch (error: any) {
      console.error('Send OTP error:', error.message);
      res.status(500).json({ message: 'Failed to send verification code. Please try again.' });
    }
  }
);

// ─── POST /api/auth/verify-otp ───────────────────────────────────────────────
router.post(
  '/verify-otp',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('otp').trim().isLength({ min: 4, max: 4 }).withMessage('OTP must be 4 digits'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { email, otp } = req.body;

    try {
      const user = await User.findOne({ email });

      if (!user || !user.otp || !user.otpExpiry) {
        res.status(400).json({ message: 'No verification code found. Please request a new one.' });
        return;
      }

      // Check OTP expiry
      if (new Date() > user.otpExpiry) {
        user.otp = null as any;
        user.otpExpiry = null as any;
        await user.save();
        res.status(400).json({ message: 'Code has expired. Please request a new one.' });
        return;
      }

      // Check attempt count (max 5)
      if (user.otpAttempts >= 5) {
        user.otp = null as any;
        user.otpExpiry = null as any;
        await user.save();
        res.status(400).json({ message: 'Too many failed attempts. Please request a new code.' });
        return;
      }

      // Verify OTP
      if (user.otp !== otp) {
        user.otpAttempts = (user.otpAttempts || 0) + 1;
        await user.save();
        const remaining = 5 - user.otpAttempts;
        res.status(400).json({ message: `Invalid code. ${remaining} attempt(s) remaining.` });
        return;
      }

      // Success — mark email as verified and clear OTP
      user.isEmailVerified = true;
      user.otp = null as any;
      user.otpExpiry = null as any;
      user.otpAttempts = 0;
      await user.save();

      res.json({
        message: 'Email verified successfully!',
        token: generateToken((user._id as any).toString()),
      });
    } catch (error: any) {
      console.error('Verify OTP error:', error.message);
      res.status(500).json({ message: 'Verification failed. Please try again.' });
    }
  }
);

// ─── POST /api/auth/purchase-otp ──────────────────────────────────────────────
router.post(
  '/purchase-otp',
  authLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('phone').trim().notEmpty().withMessage('Phone number is required'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { name, email, phone } = req.body;

    try {
      // 1. Generate 4 digit OTP
      const otp = Math.floor(1000 + Math.random() * 9000).toString();
      const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

      // 2. Fetch existing OTP record to enforce throttle
      const { data: existingUser } = await supabase
        .from('customer_otps')
        .select('otp_expiry')
        .eq('email', email)
        .single();

      if (existingUser && existingUser.otp_expiry) {
        const timeDiff = new Date(existingUser.otp_expiry).getTime() - Date.now();
        if (timeDiff > 9 * 60 * 1000) { // Sent within last 60s
          res.status(429).json({ message: 'A verification code was recently sent. Please wait 60 seconds.' });
          return;
        }
      }

      // 3. Upsert record into Supabase
      const { error: upsertError } = await supabase
        .from('customer_otps')
        .upsert({ 
          email, 
          name, 
          phone, 
          otp, 
          otp_expiry: expiry.toISOString(), 
          attempts: 0, 
          is_verified: false 
        });

      if (upsertError) throw new Error('Failed to save OTP to database');

      // 4. Send Custom Email via SMTP (Asynchronously for speed)
      sendOTPEmail(email, name, otp).catch((mailError: any) => {
        console.error('SMTP Error:', mailError.message);
      });

      res.json({ message: 'Verification code sent to your email successfully.' });
    } catch (error: any) {
      console.error('Purchase OTP error:', error.message);
      res.status(500).json({ message: 'Failed to initiate OTP flow. Please try again.' });
    }
  }
);

// ─── POST /api/auth/verify-purchase-otp ───────────────────────────────────────
router.post(
  '/verify-purchase-otp',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('otp').trim().isLength({ min: 4, max: 4 }).withMessage('OTP must be 4 digits'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { email, otp } = req.body;

    try {
      const { data: user, error } = await supabase
        .from('customer_otps')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !user || !user.otp) {
        res.status(400).json({ message: 'No verification code found. Please request a new one.' });
        return;
      }

      if (new Date() > new Date(user.otp_expiry)) {
        await supabase.from('customer_otps').update({ otp: null }).eq('email', email);
        res.status(400).json({ message: 'Code has expired. Please request a new one.' });
        return;
      }

      if (user.attempts >= 5) {
        await supabase.from('customer_otps').update({ otp: null }).eq('email', email);
        res.status(400).json({ message: 'Too many failed attempts. Please request a new code.' });
        return;
      }

      if (user.otp !== otp) {
        await supabase.from('customer_otps').update({ attempts: user.attempts + 1 }).eq('email', email);
        const remaining = 5 - (user.attempts + 1);
        res.status(400).json({ message: `Invalid code. ${remaining} attempt(s) remaining.` });
        return;
      }

      // Success
      await supabase.from('customer_otps').update({ 
        is_verified: true, 
        otp: null, 
        attempts: 0 
      }).eq('email', email);

      res.json({
        message: 'OTP verified successfully!',
        token: generateToken(email), // For Razorpay authentication middleware
        user: {
          email: user.email,
          name: user.name,
          phone: user.phone
        }
      });
    } catch (error: any) {
      console.error('Verify purchase OTP error:', error.message);
      res.status(500).json({ message: 'Verification failed. Please try again.' });
    }
  }
);

// ─── GET /api/auth/profile ───────────────────────────────────────────────────
router.get('/profile', protect, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password -otp -otpExpiry -otpAttempts')
      .populate('purchasedBooks', 'title coverImage price');

    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    res.json(user);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch profile.' });
  }
});

// ─── PUT /api/auth/profile ───────────────────────────────────────────────────
router.put(
  '/profile',
  protect,
  [body('name').optional().trim().notEmpty().withMessage('Name cannot be empty')],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const user = await User.findById(req.user._id);
      if (!user) {
        res.status(404).json({ message: 'User not found.' });
        return;
      }

      if (req.body.name) user.name = req.body.name;
      if (req.body.password) {
        if (req.body.password.length < 6) {
          res.status(400).json({ message: 'Password must be at least 6 characters.' });
          return;
        }
        user.password = req.body.password;
      }

      await user.save();
      res.json({ message: 'Profile updated successfully.', name: user.name });
    } catch (error: any) {
      res.status(500).json({ message: 'Profile update failed.' });
    }
  }
);

export default router;
