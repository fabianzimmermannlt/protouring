const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const category = req.params.category || 'general';
    const userId = req.params.userId || 'default';
    const uploadPath = path.join(__dirname, 'uploads', category, userId);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    console.log('Upload destination:', uploadPath);
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Store uploaded files metadata
const uploadedFilesMetadata = new Map();

// Routes
app.post('/api/uploads/upload/:category/:userId', upload.array('files'), (req, res) => {
  try {
    console.log('Upload request received:', {
      files: req.files,
      body: req.body,
      params: req.params
    });
    
    if (!req.files || req.files.length === 0) {
      console.log('No files found in request');
      return res.status(400).json({ error: 'No files uploaded' });
    }

    console.log('Files found:', req.files.length);

    const uploadedFiles = req.files.map(file => ({
      filename: file.filename,
      originalname: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      path: file.path
    }));

    // Store metadata for later retrieval
    const category = req.params.category;
    const userId = req.params.userId;
    const key = `${category}-${userId}`;
    
    if (!uploadedFilesMetadata.has(key)) {
      uploadedFilesMetadata.set(key, new Map());
    }
    
    uploadedFiles.forEach(file => {
      uploadedFilesMetadata.get(key).set(file.filename, file.originalname);
    });

    res.json({ 
      success: true,
      message: 'Files uploaded successfully',
      files: uploadedFiles 
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.get('/api/uploads/list/:category/:userId', (req, res) => {
  try {
    const category = req.params.category || 'general';
    const userId = req.params.userId || 'default';
    const uploadPath = path.join(__dirname, 'uploads', category, userId);
    
    if (!fs.existsSync(uploadPath)) {
      return res.json({ files: [] });
    }

    const key = `${category}-${userId}`;
    const metadata = uploadedFilesMetadata.get(key) || new Map();

    const files = fs.readdirSync(uploadPath).map(filename => {
      const filePath = path.join(uploadPath, filename);
      const stats = fs.statSync(filePath);
      
      return {
        filename,
        originalname: metadata.get(filename) || filename, // ✅ Use stored original name
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      };
    });

    res.json({ files });
  } catch (error) {
    console.error('List error:', error);
    res.status(500).json({ error: 'Failed to list files' });
  }
});

app.put('/api/uploads/rename/:category/:userId/:filename', (req, res) => {
  try {
    const category = req.params.category || 'general';
    const userId = req.params.userId || 'default';
    const oldFilename = req.params.filename;
    const { newName } = req.body;
    
    if (!newName) {
      return res.status(400).json({ error: 'New name is required' });
    }

    const uploadPath = path.join(__dirname, 'uploads', category, userId);
    const oldFilePath = path.join(uploadPath, oldFilename);
    const newFilePath = path.join(uploadPath, newName);

    if (!fs.existsSync(oldFilePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Rename file
    fs.renameSync(oldFilePath, newFilePath);

    // Update metadata
    const key = `${category}-${userId}`;
    const metadata = uploadedFilesMetadata.get(key) || new Map();
    metadata.delete(oldFilename);
    metadata.set(newName, newName);
    uploadedFilesMetadata.set(key, metadata);

    res.json({ 
      success: true,
      message: 'File renamed successfully'
    });
  } catch (error) {
    console.error('Rename error:', error);
    res.status(500).json({ error: 'Failed to rename file' });
  }
});

app.get('/api/uploads/file/:category/:userId/:filename', (req, res) => {
  try {
    const category = req.params.category || 'general';
    const userId = req.params.userId || 'default';
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'uploads', category, userId, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Send file
    res.sendFile(filePath);
  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

app.delete('/api/uploads/delete/:category/:userId/:filename', (req, res) => {
  try {
    const category = req.params.category || 'general';
    const userId = req.params.userId || 'default';
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'uploads', category, userId, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    fs.unlinkSync(filePath);
    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

app.listen(PORT, () => {
  console.log(`Upload server running on port ${PORT}`);
});
