// node scripts/set_role.js superadmin superadmin
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is required');

async function main() {
  await mongoose.connect(uri);
  const userSchema = new mongoose.Schema({}, { strict: false });
  const User = mongoose.model('User_set', userSchema, 'users');

  const ident = process.argv[2];
  const newRole = process.argv[3] || 'superadmin';
  if (!ident) {
    console.error('Usage: node scripts/set_role.js <account|nickname|_id> [newRole]');
    process.exit(2);
  }

  const query = (ident.length === 24 && /^[0-9a-fA-F]{24}$/.test(ident))
    ? { _id: ident }
    : { $or: [{ account: ident }, { nickname: ident }] };

  const res = await User.updateOne(query, { $set: { role: newRole } });
  if (res.matchedCount === 0 && res.n === 0) {
    console.log('NOT_FOUND');
    process.exit(0);
  }
  console.log('OK', res);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('ERROR', err && err.message ? err.message : err);
  process.exit(1);
});