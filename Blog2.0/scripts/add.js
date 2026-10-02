const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const readline = require('readline');

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is required');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function main() {
  try {
    await mongoose.connect(uri);
    const account = await ask('输入账号：');
    const nickname = await ask('输入昵称：');
    const password = await ask('输入密码：');
    const role = (await ask('输入角色（默认 superadmin）：')) || 'superadmin';
    rl.close();

    const passwordHash = await bcrypt.hash(password, 10);
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
    await User.deleteMany({});
    await User.create({ account, nickname, passwordHash, role });
    console.log('用户创建成功，密码已加密存储。');
    await mongoose.disconnect();
  } catch (error) {
    console.error('错误：', error);
    process.exit(1);
  }
}

main();
