// upload-unsafe-route.js  (DEV ONLY — INSECURE)
// npm i express multer
const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');

const router = express.Router();

// store under ./public/uploads (ensure folder exists)
const uploadDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    // INSECURE: keep original extension; trivial random prefix to avoid collisions
    const name = Date.now() + '-' + Math.round(Math.random()*1e9) + path.extname(file.originalname || '');
    cb(null, name);
  },
});

// INSECURE: no size/type checks
const upload = multer({ storage });

// INSECURE route: accepts any file and returns public URL
router.post('/upload-unsafe', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file is required' });

  // Construct public URL (adjust for your host)
  const publicPath = `/uploads/${req.file.filename}`;
  const base = process.env.PUBLIC_BASE_URL || 'http://localhost:5000';
  const url = `${base}${publicPath}`;
  // INSECURE: returning URL to a file that will be served without safety headers
  res.status(200).json({ url });
});

module.exports = router;
