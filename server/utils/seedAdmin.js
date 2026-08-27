// Convenience script: node utils/seedAdmin.js "Your Name" you@example.com yourpassword
// Creates an admin/host account directly in MongoDB, useful for first-time setup.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Admin = require('../models/Admin');

async function run() {
  const [name, email, password] = process.argv.slice(2);

  if (!name || !email || !password) {
    console.log('Usage: node utils/seedAdmin.js "Your Name" you@example.com yourpassword');
    process.exit(1);
  }

  await connectDB();

  const existing = await Admin.findOne({ email: email.toLowerCase() });
  if (existing) {
    console.log(`An admin with email ${email} already exists.`);
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await Admin.hashPassword(password);
  await Admin.create({ name, email: email.toLowerCase(), passwordHash });

  console.log(`Admin account created for ${email}. You can now log in from /admin/login.html`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
