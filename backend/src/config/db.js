const mongoose = require('mongoose');

let hasConnectedOnce = false;

async function connectToDatabase(mongoUri) {
  if (!mongoUri) {
    throw new Error('Missing MongoDB connection string. Set MONGODB_URI in environment.');
  }

  if (hasConnectedOnce && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  mongoose.connection.on('connected', () => {
    console.log('✅ MongoDB connected');
  });

  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected');
  });

  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  hasConnectedOnce = true;
  return mongoose.connection;
}

module.exports = { connectToDatabase };


