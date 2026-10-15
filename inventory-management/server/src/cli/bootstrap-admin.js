const readline = require('readline');
const { connectDB, disconnectDB } = require('../config/db');
const { User } = require('../models');

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer.trim());
  }));
}

function askSecret(question) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    return Promise.reject(new Error('Run admin:bootstrap in an interactive terminal to enter the password securely.'));
  }

  return new Promise((resolve, reject) => {
    let value = '';
    const input = process.stdin;
    const finish = (error) => {
      input.removeListener('data', onData);
      input.setRawMode(false);
      input.pause();
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk) => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\u0003') return finish(new Error('Admin bootstrap cancelled.'));
        if (character === '\r' || character === '\n') return finish();
        if (character === '\u007f' || character === '\b') {
          value = Array.from(value).slice(0, -1).join('');
        } else {
          value += character;
        }
      }
    };

    process.stdout.write(question);
    input.setRawMode(true);
    input.resume();
    input.on('data', onData);
  });
}

async function bootstrapAdmin() {
  const name = await ask('Administrator name: ');
  const email = (await ask('Administrator email: ')).toLowerCase();
  if (name.length < 2 || name.length > 100) throw new Error('Name must be between 2 and 100 characters.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');

  await connectDB(undefined, { allowMemoryFallback: false });
  if (await User.exists({ role: 'admin' })) throw new Error('An administrator already exists. Use the access-management screen to add another one.');

  let user = await User.findOne({ email });
  if (user) {
    user.role = 'admin';
    await user.save();
    console.log(`Promoted ${email} to administrator.`);
    return;
  }

  const password = await askSecret('Administrator password (minimum 8 characters): ');
  if (password.length < 8 || password.length > 128 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error('Password must be 8 to 128 characters and contain at least one letter and one number.');
  }
  await User.create({ name, email, password, role: 'admin' });
  console.log(`Created administrator account for ${email}.`);
}

bootstrapAdmin()
  .catch((error) => {
    console.error(`Admin bootstrap failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(disconnectDB);
