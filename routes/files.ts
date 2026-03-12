import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware, AuthRequest } from '../middleware/auth.ts';
import { FileModel } from '../models/File.ts';
import { DocumentMember } from '../models/DocumentMember.ts';

const router = express.Router();

// Ensure uploads directory exists
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Upload a file to a document
router.post('/:documentId/upload', authMiddleware, upload.single('file'), async (req: AuthRequest, res: any) => {
  try {
    const { documentId } = req.params;
    const userId = req.userId;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Check if user has permission to upload to this document
    const membership = await DocumentMember.findOne({ documentId, userId });
    if (!membership || membership.role === 'viewer') {
      // Delete the uploaded file if no permission
      fs.unlinkSync(file.path);
      return res.status(403).json({ message: 'You do not have permission to upload files to this document' });
    }

    const newFile = new FileModel({
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      documentId,
      uploadedBy: userId,
    });

    await newFile.save();
    res.status(201).json(newFile);
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ message: 'Error uploading file' });
  }
});

// Get all files for a document
router.get('/:documentId', authMiddleware, async (req: AuthRequest, res: any) => {
  try {
    const { documentId } = req.params;
    const userId = req.userId;

    // Check if user has permission to view files for this document
    const membership = await DocumentMember.findOne({ documentId, userId });
    if (!membership) {
      return res.status(403).json({ message: 'You do not have permission to view files for this document' });
    }

    const files = await FileModel.find({ documentId }).sort({ createdAt: -1 });
    res.json(files);
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ message: 'Error fetching files' });
  }
});

// Download a file
router.get('/download/:fileId', authMiddleware, async (req: AuthRequest, res: any) => {
  try {
    const { fileId } = req.params;
    const userId = req.userId;

    const fileRecord = await FileModel.findById(fileId);
    if (!fileRecord) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Check if user has permission to access this document's files
    const membership = await DocumentMember.findOne({ documentId: fileRecord.documentId, userId });
    if (!membership) {
      return res.status(403).json({ message: 'You do not have permission to access this file' });
    }

    const filePath = path.join(uploadDir, fileRecord.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found on server' });
    }

    res.download(filePath, fileRecord.originalName);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ message: 'Error downloading file' });
  }
});

// Delete a file
router.delete('/:fileId', authMiddleware, async (req: AuthRequest, res: any) => {
  try {
    const { fileId } = req.params;
    const userId = req.userId;

    const fileRecord = await FileModel.findById(fileId);
    if (!fileRecord) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Check if user has permission to delete (owner or editor)
    const membership = await DocumentMember.findOne({ documentId: fileRecord.documentId, userId });
    if (!membership || membership.role === 'viewer') {
      return res.status(403).json({ message: 'You do not have permission to delete this file' });
    }

    const filePath = path.join(uploadDir, fileRecord.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await FileModel.findByIdAndDelete(fileId);
    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ message: 'Error deleting file' });
  }
});

export default router;
