import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    plan: { type: String, enum: ['monthly', 'yearly'], required: true },
    status: {
      type: String,
      enum: ['active', 'canceled', 'past_due', 'expired'],
      default: 'active',
    },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date, required: true },
    paymentProviderId: { type: String, default: null }, // Razorpay payment ID
    razorpayOrderId: { type: String, default: null },
    amountPaid: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
  },
  { timestamps: true }
);

const Subscription = mongoose.model('Subscription', subscriptionSchema);
export default Subscription;
