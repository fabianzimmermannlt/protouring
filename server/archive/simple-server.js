const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3002;

// Middleware
app.use(cors({
  origin: ['http://localhost:3001', 'http://172.29.0.193:3001'],
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const category = req.params.category || 'general';
    const userId = req.params.userId || 'default';
    const uploadPath = path.join(__dirname, 'uploads', category, userId);
    
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

// Mock authentication - accept any token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // For testing, create a mock token
    req.user = { id: 1, username: 'fabianzimmermann' };
    return next();
  }

  // For testing, accept any token
  req.user = { id: 1, username: 'fabianzimmermann' };
  next();
};

// Mock auth routes
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  res.json({
    token: 'mock_token_' + Date.now(),
    artist: { id: 1, username, name: 'Fabian Zimmermann', email: 'fabian@blindpage.de' }
  });
});

app.post('/api/register', (req, res) => {
  const { username, name, email } = req.body;
  res.json({
    token: 'mock_token_' + Date.now(),
    artist: { id: 1, username, name, email }
  });
});

// Profile route
app.get('/api/profile', authenticateToken, (req, res) => {
  res.json({
    id: 1,
    username: 'fabianzimmermann',
    name: 'Fabian Zimmermann',
    email: 'fabian@blindpage.de'
  });
});

// Tour data routes
app.get('/api/tour-data/:dataType', authenticateToken, (req, res) => {
  const dataType = req.params.dataType;
  res.json({ data: [] });
});

app.post('/api/tour-data/:dataType', authenticateToken, (req, res) => {
  res.json({ message: 'Data saved successfully' });
});

// File upload routes
app.get('/api/uploads/list/:category/:userId', (req, res) => {
  const category = req.params.category;
  const userId = req.params.userId;
  const uploadPath = path.join(__dirname, 'uploads', category, userId);
  
  if (!fs.existsSync(uploadPath)) {
    return res.json({ files: [] });
  }
  
  const files = fs.readdirSync(uploadPath).map(filename => {
    const filePath = path.join(uploadPath, filename);
    const stats = fs.statSync(filePath);
    return {
      filename,
      originalname: filename,
      size: stats.size,
      created: stats.birthtime.toISOString(),
      type: 'application/octet-stream'
    };
  });
  
  res.json({ files });
});

app.post('/api/uploads/upload/:category/:userId', upload.array('files'), (req, res) => {
  const files = req.files.map(file => ({
    filename: file.filename,
    originalname: file.originalname,
    size: file.size,
    type: file.mimetype || 'application/octet-stream'
  }));
  
  res.json({ message: 'Files uploaded successfully', files });
});

app.delete('/api/uploads/delete/:category/:userId/:filename', (req, res) => {
  const { category, userId, filename } = req.params;
  const filePath = path.join(__dirname, 'uploads', category, userId, filename);
  
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  
  res.json({ message: 'File deleted successfully' });
});

app.put('/api/uploads/rename/:category/:userId/:oldName', (req, res) => {
  const { category, userId, oldName } = req.params;
  const { newName } = req.body;
  const oldPath = path.join(__dirname, 'uploads', category, userId, oldName);
  const newPath = path.join(__dirname, 'uploads', category, userId, newName);
  
  if (fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, newPath);
  }
  
  res.json({ message: 'File renamed successfully' });
});

app.get('/api/uploads/file/:category/:userId/:filename', (req, res) => {
  const { category, userId, filename } = req.params;
  const filePath = path.join(__dirname, 'uploads', category, userId, filename);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

app.listen(PORT, () => {
  console.log(`Simple ProTouring server running on port ${PORT}`);
});
