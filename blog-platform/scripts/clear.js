const mongoose = require('mongoose')

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI is required')

async function run(){
  await mongoose.connect(uri)
  const User = mongoose.model('User', new mongoose.Schema({}, { strict:false }), 'users')

  // 查找所有 superadmin
  const supers = await User.find({ role: 'superadmin' }).lean()
  if (!supers || supers.length === 0) {
    console.log('No superadmin users found.')
    process.exit(0)
  }

  console.log('Found superadmin accounts:')
  supers.forEach(u => console.log(' -', u.account || u._id, '|', u.nickname || ''))

  // ✅ 直接删除，不是降级！
  const res = await User.deleteMany({ role: 'superadmin' })

  console.log(`✅ Deleted ${res.deletedCount} superadmin user(s) permanently.`)
  process.exit(0)
}

run().catch(e => { console.error(e); process.exit(2) })