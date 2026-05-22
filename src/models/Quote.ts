import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IQuote extends Document {
  text: string;
  author: string;
  isActive: boolean;
  createdAt: Date;
}

const quoteSchema = new Schema<IQuote>(
  {
    text: { type: String, required: true },
    author: { type: String, default: 'Vikram Presence' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Quote: Model<IQuote> = (mongoose.models.Quote || mongoose.model<IQuote>('Quote', quoteSchema)) as any;
export default Quote;
