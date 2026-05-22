import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IReview extends Document {
  name: string;
  role: string;
  headline: string;
  text: string;
  rating: number;
  isActive: boolean;
  createdAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    name: { type: String, required: true },
    role: { type: String, required: true },
    headline: { type: String, required: true },
    text: { type: String, required: true },
    rating: { type: Number, default: 5 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Review: Model<IReview> = (mongoose.models.Review || mongoose.model<IReview>('Review', reviewSchema)) as any;
export default Review;
