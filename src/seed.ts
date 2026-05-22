import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Book from './models/Book';
import Quote from './models/Quote';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/vikrampresence';

const sampleBooks = [
  {
    title: 'The Discipline Blueprint',
    description: 'A complete framework to rewire your brain for extreme focus, removing procrastination, and executing daily tasks with ruthless efficiency.',
    price: 499,
    coverImage: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?q=80&w=1200&auto=format&fit=crop',
    category: 'E-Book',
    isFeatured: true
  },
  {
    title: 'Cognitive Rewiring Audio Series',
    description: 'Listen to these 15-minute high-frequency audio sessions every morning to eliminate self-doubt and build unshakeable confidence.',
    price: 899,
    coverImage: 'https://images.unsplash.com/photo-1619983081563-430f63602796?q=80&w=1200&auto=format&fit=crop',
    category: 'Audio Series',
    isFeatured: true
  },
  {
    title: 'Mastering the 5 AM Club',
    description: 'Step-by-step actionable guide to waking up at 5 AM without feeling tired, optimizing your morning routine, and dominating your day.',
    price: 599,
    coverImage: 'https://images.unsplash.com/photo-1497561813398-84ce2685ea23?q=80&w=1200&auto=format&fit=crop',
    category: 'Course',
    isFeatured: true
  },
  {
    title: 'The Focus Protocol',
    description: 'Deep work strategies designed for the modern distracted mind. Reclaim your attention span and double your productivity in 30 days.',
    price: 399,
    coverImage: 'https://images.unsplash.com/photo-1506784365847-bbad939e9335?q=80&w=1200&auto=format&fit=crop',
    category: 'Digital Product',
    isFeatured: false
  }
];

const sampleQuotes = [
  { text: 'Discipline is simply remembering what you truly want.', author: 'Vikram Presence' },
  { text: 'Your mind is a muscle. Train it to embrace discomfort.', author: 'Vikram Presence' },
  { text: 'Stop negotiating with your weakness. Execute the plan.', author: 'Vikram Presence' }
];

async function seedDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB for seeding...');

    // Only seed if empty to prevent duplicates on multiple runs
    const bookCount = await Book.countDocuments();
    if (bookCount === 0) {
      await Book.insertMany(sampleBooks);
      console.log('✅ Sample premium products seeded successfully.');
    } else {
      console.log('ℹ️ Products already exist. Skipping seed.');
    }

    const quoteCount = await Quote.countDocuments();
    if (quoteCount === 0) {
      await Quote.insertMany(sampleQuotes);
      console.log('✅ Sample quotes seeded successfully.');
    } else {
      console.log('ℹ️ Quotes already exist. Skipping seed.');
    }

    mongoose.disconnect();
    console.log('Seeding complete.');
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
}

seedDB();
