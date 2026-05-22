import { supabase } from './supabaseClient';

const sampleProducts = [
  {
    title: 'The Discipline Blueprint',
    description: 'A complete framework to rewire your brain for extreme focus, removing procrastination, and executing daily tasks with ruthless efficiency.',
    price: 499,
    cover_image: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?q=80&w=1200&auto=format&fit=crop',
    digital_file_url: 'https://example.com/download/blueprint.pdf',
    category: 'E-Book',
    is_featured: true,
    is_active: true
  },
  {
    title: 'Cognitive Rewiring Audio Series',
    description: 'Listen to these 15-minute high-frequency audio sessions every morning to eliminate self-doubt and build unshakeable confidence.',
    price: 899,
    cover_image: 'https://images.unsplash.com/photo-1619983081563-430f63602796?q=80&w=1200&auto=format&fit=crop',
    digital_file_url: 'https://example.com/download/audio.zip',
    category: 'Audio Series',
    is_featured: true,
    is_active: true
  },
  {
    title: 'Mastering the 5 AM Club',
    description: 'Step-by-step actionable guide to waking up at 5 AM without feeling tired, optimizing your morning routine, and dominating your day.',
    price: 599,
    cover_image: 'https://images.unsplash.com/photo-1497561813398-84ce2685ea23?q=80&w=1200&auto=format&fit=crop',
    digital_file_url: 'https://example.com/download/5am.pdf',
    category: 'Course',
    is_featured: true,
    is_active: true
  },
  {
    title: 'The Focus Protocol',
    description: 'Deep work strategies designed for the modern distracted mind. Reclaim your attention span and double your productivity in 30 days.',
    price: 399,
    cover_image: 'https://images.unsplash.com/photo-1506784365847-bbad939e9335?q=80&w=1200&auto=format&fit=crop',
    digital_file_url: 'https://example.com/download/focus.pdf',
    category: 'Digital Product',
    is_featured: false,
    is_active: true
  }
];

async function seed() {
  console.log('Seeding Supabase Products...');
  for (const product of sampleProducts) {
    const { error } = await supabase.from('products').insert([product]);
    if (error) {
      console.error('Failed to insert product:', error.message);
    } else {
      console.log(`✅ Inserted: ${product.title}`);
    }
  }
  console.log('Seeding Complete.');
}

seed();
