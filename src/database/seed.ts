import { database, getDb } from './index';

export async function seedDatabase() {
  try {
    console.log('🌱 Starting database setup...');
    
    await database.connect();
    console.log('🔌 Connected to MongoDB');
    
    const db = getDb();
    
    // Clear existing users (optional - remove if you want to keep existing data)
    await db.collection('users').deleteMany({});
    console.log('🧹 Cleared existing users');
    
    // Create indexes for better query performance
    await db.collection('users').createIndex({ name: 1 });
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ gender: 1 });
    await db.collection('users').createIndex({ createdAt: -1 });
    console.log('📊 Created user indexes');
    
    // Create task group indexes
    await db.collection('taskgroups').createIndex({ userId: 1 });
    await db.collection('taskgroups').createIndex({ userId: 1, name: 1 }, { unique: true });
    await db.collection('taskgroups').createIndex({ createdAt: -1 });
    console.log('📊 Created task group indexes');
    
    // Create task indexes
    await db.collection('tasks').createIndex({ completed: 1 });
    await db.collection('tasks').createIndex({ deadline: 1 });
    await db.collection('tasks').createIndex({ scheduledDate: 1 });
    await db.collection('tasks').createIndex({ 'tags': 1 });
    await db.collection('tasks').createIndex({ userId: 1 });
    await db.collection('tasks').createIndex({ groupId: 1 });
    await db.collection('tasks').createIndex({ isScheduledToday: 1 });
    await db.collection('tasks').createIndex({ isOverdue: 1 });
    
    // Compound indexes for efficient queries
    await db.collection('tasks').createIndex({ userId: 1, completed: 1 });
    await db.collection('tasks').createIndex({ userId: 1, groupId: 1 });
    await db.collection('tasks').createIndex({ userId: 1, scheduledDate: 1 });
    await db.collection('tasks').createIndex({ userId: 1, deadline: 1 });
    await db.collection('tasks').createIndex({ userId: 1, priority: 1 });
    await db.collection('tasks').createIndex({ userId: 1, isScheduledToday: 1 });
    await db.collection('tasks').createIndex({ userId: 1, isOverdue: 1 });
    console.log('📊 Created task indexes');
    
    await database.disconnect();
    console.log('✅ Database setup completed successfully');
    
  } catch (error) {
    console.error('💥 Error setting up database:', error);
    process.exit(1);
  }
}

// Run setup if this file is executed directly
if (require.main === module) {
  seedDatabase();
} 