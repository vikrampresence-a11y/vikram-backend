import mongoose from 'mongoose';

const bookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    author: { type: String, required: true, default: 'Vikram' },
    price: { type: Number, required: true, min: 0 },
    coverImage: { type: String, required: true },
    digitalFileUrl: { type: String, default: null },
    category: { type: String, required: true },
    rating: { type: Number, default: 5.0, min: 0, max: 5 },
    reviews: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        name: { type: String, required: true },
        rating: { type: Number, required: true, min: 1, max: 5 },
        comment: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    isFeatured: { type: Boolean, default: false },
    totalSales: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Book = mongoose.model('Book', bookSchema);
export default Book;
