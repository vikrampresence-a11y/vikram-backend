import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import { supabase } from '../supabaseClient';
import User from '../models/User';
import Order from '../models/Order';
import { Newsletter } from './newsletterRoutes';

const router = express.Router();

// ─── Admin login rate limiter (3 attempts per 15 min) ─────────────────────────
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { message: 'Too many admin login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── POST /api/admin/login ────────────────────────────────────────────────────
// Secure admin auth via env-stored hashed credentials
router.post(
  '/login',
  adminLoginLimiter,
  [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ message: 'Invalid credentials.' });
      return;
    }

    const { username, password } = req.body;

    try {
      const adminUser = process.env.ADMIN_USERNAME;
      const adminHashedPassword = process.env.ADMIN_PASSWORD_HASH;

      if (!adminUser || !adminHashedPassword) {
        console.error('ADMIN_USERNAME or ADMIN_PASSWORD_HASH not set in .env');
        res.status(500).json({ message: 'Admin auth not configured.' });
        return;
      }

      if (username !== adminUser) {
        res.status(401).json({ message: 'Invalid credentials.' });
        return;
      }

      const isPasswordValid = await bcrypt.compare(password, adminHashedPassword);
      if (!isPasswordValid) {
        res.status(401).json({ message: 'Invalid credentials.' });
        return;
      }

      // Issue admin-specific JWT
      const token = jwt.sign(
        { role: 'admin', username: adminUser },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: '8h' }
      );

      res.json({ token, message: 'Admin authentication successful.' });
    } catch (error: any) {
      console.error('Admin login error:', error.message);
      res.status(500).json({ message: 'Authentication failed.' });
    }
  }
);

// ─── Middleware: Verify admin JWT for protected routes ────────────────────────
const requireAdminToken = (req: Request, res: Response, next: any): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Not authorized — no token.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    if (decoded.role !== 'admin') {
      res.status(403).json({ message: 'Access denied — admin only.' });
      return;
    }
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired admin token.' });
  }
};

// Apply to all routes below
router.use(requireAdminToken);

// ─── GET /api/admin/dashboard ─────────────────────────────────────────────────
router.get('/dashboard', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [
      totalUsers,
      totalOrders,
      productsRes,
      ordersRes,
      newsletterSubs,
    ] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      Order.countDocuments({ status: 'paid' }),
      supabase.from('products').select('id', { count: 'exact' }),
      supabase.from('orders').select('amount'),
      Newsletter.countDocuments({ isActive: true }),
    ]);

    const totalRevenue = ordersRes.data?.reduce((sum, o) => sum + (Number(o.amount) || 0), 0) || 0;

    res.json({
      totalUsers,
      totalBooks: productsRes.count || 0,
      totalOrders,
      revenue: `₹${totalRevenue.toLocaleString('en-IN')}`,
      newsletterSubs,
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch dashboard stats.' });
  }
});

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
router.get('/users', async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.find()
      .select('-password -otp -otpExpiry')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch users.' });
  }
});

// ─── PUT /api/admin/users/:id ─────────────────────────────────────────────────
router.put('/users/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const allowedFields = ['role', 'subscriptionStatus', 'subscriptionPlan', 'isEmailVerified'];
    const updates: any = {};
    allowedFields.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true })
      .select('-password -otp');

    if (!user) { res.status(404).json({ message: 'User not found.' }); return; }
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to update user.' });
  }
});

// ─── DELETE /api/admin/users/:id ─────────────────────────────────────────────
router.delete('/users/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted.' });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to delete user.' });
  }
});

// ─── PRODUCTS (Supabase) ──────────────────────────────────────────────────────
router.get('/products', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch { res.status(500).json({ message: 'Failed to fetch products.' }); }
});

router.post('/products', async (req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase.from('products').insert([req.body]).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch { res.status(500).json({ message: 'Failed to create product.' }); }
});

router.put('/products/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase.from('products').update(req.body).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch { res.status(500).json({ message: 'Failed to update product.' }); }
});

router.delete('/products/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = await supabase.from('products').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Product deleted.' });
  } catch { res.status(500).json({ message: 'Failed to delete product.' }); }
});

// ─── QUOTES (Supabase + Realtime) ─────────────────────────────────────────────
router.get('/quotes', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase.from('quotes').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch { res.status(500).json({ message: 'Failed to fetch quotes.' }); }
});

router.post('/quotes', async (req: Request, res: Response): Promise<void> => {
  try {
    const { text, author, is_active } = req.body;
    const { data, error } = await supabase.from('quotes').insert([{ text, author, is_active: is_active !== false }]).select().single();
    if (error) throw error;
    req.app.get('io')?.emit('quotes_updated');
    res.status(201).json(data);
  } catch { res.status(500).json({ message: 'Failed to create quote.' }); }
});

router.put('/quotes/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase.from('quotes').update(req.body).eq('id', req.params.id).select().single();
    if (error) throw error;
    req.app.get('io')?.emit('quotes_updated');
    res.json(data);
  } catch { res.status(500).json({ message: 'Failed to update quote.' }); }
});

router.delete('/quotes/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = await supabase.from('quotes').delete().eq('id', req.params.id);
    if (error) throw error;
    req.app.get('io')?.emit('quotes_updated');
    res.json({ message: 'Quote deleted.' });
  } catch { res.status(500).json({ message: 'Failed to delete quote.' }); }
});

// ─── REVIEWS (Supabase + Realtime) ────────────────────────────────────────────
router.get('/reviews', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase.from('reviews').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch { res.status(500).json({ message: 'Failed to fetch reviews.' }); }
});

router.post('/reviews', async (req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase.from('reviews').insert([req.body]).select().single();
    if (error) throw error;
    req.app.get('io')?.emit('reviews_updated');
    res.status(201).json(data);
  } catch { res.status(500).json({ message: 'Failed to create review.' }); }
});

router.put('/reviews/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase.from('reviews').update(req.body).eq('id', req.params.id).select().single();
    if (error) throw error;
    req.app.get('io')?.emit('reviews_updated');
    res.json(data);
  } catch { res.status(500).json({ message: 'Failed to update review.' }); }
});

router.delete('/reviews/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { error } = await supabase.from('reviews').delete().eq('id', req.params.id);
    if (error) throw error;
    req.app.get('io')?.emit('reviews_updated');
    res.json({ message: 'Review deleted.' });
  } catch { res.status(500).json({ message: 'Failed to delete review.' }); }
});

// ─── ORDERS (Supabase) ────────────────────────────────────────────────────────
router.get('/orders', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*, products(title, cover_image, price)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch { res.status(500).json({ message: 'Failed to fetch orders.' }); }
});

// ─── NEWSLETTER ────────────────────────────────────────────────────────────────
router.get('/newsletter', async (_req: Request, res: Response): Promise<void> => {
  try {
    const subscribers = await Newsletter.find({ isActive: true }).sort({ subscribedAt: -1 }).lean();
    res.json(subscribers);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch newsletter list.' });
  }
});

export default router;
