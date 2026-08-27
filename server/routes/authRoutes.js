const express = require('express');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const router = express.Router();

function signToken(admin) {
  return jwt.sign(
    { id: admin._id, email: admin.email, name: admin.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// POST /api/auth/register - create a new host/admin account
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existing = await Admin.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    const passwordHash = await Admin.hashPassword(password);
    const admin = await Admin.create({ name, email: email.toLowerCase(), passwordHash });

    const token = signToken(admin);
    res.status(201).json({ token, admin: admin.toJSON() });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Could not create account.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required.' });
    }

    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const ok = await admin.comparePassword(password);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signToken(admin);
    res.json({ token, admin: admin.toJSON() });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Could not log in.' });
  }
});

module.exports = router;
