const mongoose = require('mongoose')

const uri = process.env.MONGODB_URI
if (!uri) throw new Error('MONGODB_URI is required')

async function run() {
  await mongoose.connect(uri)
  console.log('✅ 已连接数据库')

  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users')
  const allUsers = await User.find({}).lean()

  console.log('\n📂 【数据库中所有用户】：')
  console.log(JSON.stringify(allUsers, null, 2))

  mongoose.disconnect()
}
run().catch(console.error)