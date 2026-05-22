import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import { supabase } from '../supabaseClient';

export interface AuthRequest extends Request {
  user?: any;
}

// ─── Protect: Verify JWT and attach user to request ──────────────────────────
export const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  let token: string | undefined;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized — no token provided.' });
    return;
  }

  try {
    const decoded: any = jwt.verify(
      token,
      process.env.JWT_SECRET || 'fallback_secret'
    );

    // If the token payload ID is an email (from OTP guest flow)
    if (decoded.id && decoded.id.includes('@')) {
      const { data: guestUser } = await supabase
        .from('customer_otps')
        .select('*')
        .eq('email', decoded.id)
        .single();
        
      if (!guestUser) {
        res.status(401).json({ message: 'Not authorized — user not found in OTP records.' });
        return;
      }
      
      req.user = guestUser;
      next();
      return;
    }

    // Legacy MongoDB check (skip if no Mongo connection)
    try {
      const user = await User.findById(decoded.id).select('-password -otp -otpExpiry');
      if (!user) {
        res.status(401).json({ message: 'Not authorized — user not found.' });
        return;
      }
      req.user = user;
      next();
    } catch (e) {
      res.status(401).json({ message: 'Not authorized — Database unavailable.' });
      return;
    }
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({ message: 'Session expired. Please log in again.' });
    } else {
      res.status(401).json({ message: 'Not authorized — invalid token.' });
    }
  }
};

// ─── Admin: Must be admin role ───────────────────────────────────────────────
export const admin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied — admin only.' });
  }
};

// ─── Email Verified: Must have verified email ─────────────────────────────────
export const emailVerified = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (req.user && req.user.isEmailVerified) {
    next();
  } else {
    res.status(403).json({
      message: 'Email not verified. Please verify your email before proceeding.',
    });
  }
};
