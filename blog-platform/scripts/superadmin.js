const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is required');

(async () => {
  await mongoose.connect(uri);
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
  const hash = await bcrypt.hash('superadmin', 10);
  await User.updateOne(
    { account: 'superadmin' },
    { $set: { account: 'superadmin', nickname: 'superadmin', passwordHash: hash, role: 'superadmin' } },
    { upsert: true }
  );
  console.log('Created/updated superadmin');
  await mongoose.disconnect();
})().catch(error => {
  console.error(error);
  process.exit(2);
});
