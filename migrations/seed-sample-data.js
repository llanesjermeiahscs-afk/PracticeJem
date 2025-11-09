// migrations/seed-sample-data.js
// Seed the database with sample users, rentals, comments and likes for development/testing.
// Usage: node migrations/seed-sample-data.js

const db = require('../db')._raw;

function nowOffset(minutes) {
  const d = new Date(Date.now() - minutes * 60000);
  return d.toISOString();
}

// Simple helper to insert a user and return id
function insertUser(email, password_hash, name) {
  const r = db.prepare('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)').run(email, password_hash || 'x', name);
  return r.lastInsertRowid;
}

function insertRental(owner_id, title, description, price, location, images, created_at) {
  const imagesJSON = JSON.stringify(images || []);
  const r = db.prepare('INSERT INTO rentals (owner_id, title, description, price, location, images, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(owner_id, title, description, price, location, imagesJSON, created_at || new Date().toISOString());
  return r.lastInsertRowid;
}

function insertComment(rental_id, user_id, text, created_at) {
  db.prepare('INSERT INTO comments (rental_id, user_id, text, created_at) VALUES (?, ?, ?, ?)').run(rental_id, user_id, text, created_at || new Date().toISOString());
}

function insertLike(rental_id, user_id) {
  try {
    db.prepare('INSERT INTO likes (rental_id, user_id) VALUES (?, ?)').run(rental_id, user_id);
  } catch (e) { /* ignore unique constraint */ }
}

// Ensure tables exist (run create migration first)
console.log('Seeding sample data...');

// Create some users
const userIds = [];
const names = ['Alice','Bob','Carl','Dana','Eve','Frank','Grace','Hector','Ivy','Jack','Kara','Liam','Mona','Nate','Olga','Pete','Quinn','Rita','Sam','Tina','Uma','Vik','Wendy','Xander','Yara','Zane','Aria','Ben','Cleo','Drew'];
for (let i = 0; i < names.length; i++) {
  const email = `${names[i].toLowerCase()}@example.com`;
  const id = insertUser(email, 'x', names[i]);
  userIds.push(id);
}

// Create 30 rentals
const titles = [
  'Cozy studio near downtown','Spacious 2BR with balcony','Sunny loft with skylights','Quiet garden apartment','Modern place with fast Wi-Fi','Charming cottage by the park','Riverside 1BR with view','Minimalist studio, great location','Family-friendly 3BR house','Stylish condo in the arts district',
  'Compact studio — affordable','Bright 1BR with large windows','Renovated apartment, new kitchen','Top-floor flat with city view','Suburban home with yard','Beachside bungalow, walks to sand','Mountain cabin retreat','Eco-friendly tiny house','Penthouse suite with terrace','Historic townhouse with character',
  'Co-living room, utilities included','Studio with workspace nook','Pet-friendly 2BR','Affordable room in shared house','Luxury condo with gym access','Riverfront suite with balcony','City-center studio near transit','Rooftop access condo','Basement apartment with private entrance','Loft with exposed brick'
];

for (let i = 0; i < 30; i++) {
  const owner = userIds[i % userIds.length];
  const title = titles[i % titles.length];
  const description = `A lovely rental: ${title}. Close to amenities and transit. Perfect for ${['students','professionals','couples','families'][i%4]}.`;
  const price = Math.round((300 + Math.random() * 1200) * 100) / 100;
  const location = ['Downtown','Uptown','Midtown','Riverside','Old Town','Seaside','Hillcrest'][i % 7];
  const images = [];
  const imgCount = 1 + (i % 3);
  for (let j = 0; j < imgCount; j++) {
    images.push(`https://picsum.photos/seed/rent${i}-${j}/1200/900`);
  }
  const created_at = nowOffset(i * 30);
  const rentalId = insertRental(owner, title, description, price, location, images, created_at);

  // add 0-3 comments
  const commentCount = i % 4;
  for (let c = 0; c < commentCount; c++) {
    const commenter = userIds[(i + c + 3) % userIds.length];
    insertComment(rentalId, commenter, `Looks great! Interested. (${c+1})`, nowOffset(i * 30 + c * 5));
  }

  // add some likes
  const likes = (i % 7);
  for (let l = 0; l < likes; l++) {
    insertLike(rentalId, userIds[(i + l + 2) % userIds.length]);
  }
}

console.log('Seeding complete.');
