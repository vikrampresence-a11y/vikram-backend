import express, { Request, Response } from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { body, validationResult } from 'express-validator';
import { protect } from '../middleware/authMiddleware';
import type { AuthRequest } from '../middleware/authMiddleware';
import { supabase } from '../supabaseClient';
import { sendEbookEmail } from '../config/mailer';

const router = express.Router();

// ─── Initialize Razorpay ──────────────────────────────────────────────────────
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || '',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '',
});

// ─── POST /api/payment/create-order ──────────────────────────────────────────
// Creates a Razorpay order for a book purchase
router.post(
  '/create-order',
  protect,
  [body('bookId').notEmpty().withMessage('Book ID is required')],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const { bookId } = req.body;

      // Fetch book from Supabase
      const { data: book, error: bookError } = await supabase
        .from('products')
        .select('*')
        .eq('id', bookId)
        .single();

      if (bookError || !book || !book.is_active) {
        res.status(404).json({ message: 'Product not found or inactive.' });
        return;
      }

      // Check if already purchased (Query Orders table in Supabase)
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('id')
        .eq('customer_email', req.user.email)
        .eq('product_id', bookId)
        .eq('status', 'paid')
        .single();

      if (existingOrder) {
        res.status(400).json({ message: 'You have already purchased this product.' });
        return;
      }

      const amountInPaise = Math.round(Number(book.price) * 100);

      const razorpayOrder = await razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `order_${Date.now()}`,
        notes: {
          bookId: bookId,
          userEmail: req.user.email,
          bookTitle: book.title,
        },
      });

      // Save pending order to Supabase
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert([{
          product_id: bookId,
          customer_name: req.user.name,
          customer_email: req.user.email,
          customer_phone: req.user.phone || '',
          amount: book.price,
          status: 'created',
          razorpay_order_id: razorpayOrder.id
        }])
        .select()
        .single();

      if (orderError) throw new Error('Failed to create order record in Supabase');

      res.json({
        orderId: razorpayOrder.id,
        dbOrderId: newOrder.id,
        amount: amountInPaise,
        currency: 'INR',
        keyId: process.env.RAZORPAY_KEY_ID,
        bookTitle: book.title,
        userName: req.user.name,
        userEmail: req.user.email,
      });
    } catch (error: any) {
      console.error('Create order error:', error.message);
      res.status(500).json({ message: 'Failed to create payment order.' });
    }
  }
);

// ─── POST /api/payment/verify ─────────────────────────────────────────────────
// Verifies Razorpay signature after successful payment
router.post(
  '/verify',
  protect,
  [
    body('razorpayOrderId').notEmpty().withMessage('Order ID required'),
    body('razorpayPaymentId').notEmpty().withMessage('Payment ID required'),
    body('razorpaySignature').notEmpty().withMessage('Signature required'),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    try {
      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      if (generatedSignature !== razorpaySignature) {
        res.status(400).json({ message: 'Payment verification failed — invalid signature.' });
        return;
      }

      // Update order in Supabase
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .update({
          razorpay_payment_id: razorpayPaymentId,
          razorpay_signature: razorpaySignature,
          status: 'paid'
        })
        .eq('razorpay_order_id', razorpayOrderId)
        .select(`
          *,
          products (*)
        `)
        .single();

      if (orderError || !order) {
        res.status(404).json({ message: 'Order not found.' });
        return;
      }

      const book = order.products;

      // Send premium purchase confirmation + download email
      if (book?.digital_file_url) {
        try {
          await sendEbookEmail(
            order.customer_email,
            order.customer_name,
            book.title,
            book.digital_file_url,
            Number(order.amount),
            order.id
          );
          await supabase
            .from('orders')
            .update({ status: 'delivered' })
            .eq('id', order.id);
        } catch (mailErr: any) {
          console.error('Ebook delivery email failed:', mailErr.message);
          // Don't fail the response if email fails — payment is still verified
        }
      }

      res.json({
        message: 'Payment verified and product sent to your email!',
        paymentId: razorpayPaymentId,
        bookTitle: book.title,
      });
    } catch (error: any) {
      console.error('Verify payment error:', error.message);
      res.status(500).json({ message: 'Payment verification failed.' });
    }
  }
);

// ─── POST /api/payment/create-subscription ───────────────────────────────────
// Creates a Razorpay order for VIP subscription
router.post(
  '/create-subscription',
  protect,
  [body('plan').isIn(['monthly', 'yearly']).withMessage('Plan must be monthly or yearly')],
  async (req: AuthRequest, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const { plan } = req.body;
      const prices: Record<string, number> = {
        monthly: 99900,  // ₹999 in paise
        yearly: 499900,  // ₹4,999 in paise
      };

      const amount = prices[plan];

      const razorpayOrder = await razorpay.orders.create({
        amount,
        currency: 'INR',
        receipt: `sub_${Date.now()}`,
        notes: {
          type: 'subscription',
          plan,
          userId: req.user._id.toString(),
        },
      });

      res.json({
        orderId: razorpayOrder.id,
        amount,
        currency: 'INR',
        plan,
        keyId: process.env.RAZORPAY_KEY_ID,
        userName: req.user.name,
        userEmail: req.user.email,
      });
    } catch (error: any) {
      console.error('Create subscription error:', error.message);
      res.status(500).json({ message: 'Failed to create subscription order.' });
    }
  }
);

// ─── GET /api/payment/orders — User's purchase history ───────────────────────
router.get('/orders', protect, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        products (
          title,
          cover_image,
          price
        )
      `)
      .eq('customer_email', req.user.email)
      .eq('status', 'paid')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(orders);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch orders.' });
  }
});

export default router;
