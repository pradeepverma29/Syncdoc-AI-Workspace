import express from 'express';
import { Document } from '../models/Document.ts';
import { DocumentMember } from '../models/DocumentMember.ts';
import { authMiddleware, AuthRequest } from '../middleware/auth.ts';
import { checkRole } from '../middleware/rbac.ts';

const router = express.Router();

// Get all documents for the logged-in user
router.get('/', authMiddleware, async (req: AuthRequest, res: any) => {
  try {
    const userId = req.userId;
    
    // Find all document memberships for this user
    const memberships = await DocumentMember.find({ userId }).populate('documentId');
    
    // Extract the document objects
    const documents = memberships
      .filter(m => m.documentId) // Filter out any orphaned memberships
      .map(m => ({
        ...(m.documentId as any)._doc,
        role: m.role
      }));

    res.json(documents);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ message: 'Error fetching documents' });
  }
});

// Create a new document
router.post('/', authMiddleware, async (req: AuthRequest, res: any) => {
  try {
    const { title } = req.body;
    const userId = req.userId;

    // 1. Create the document
    const newDoc = new Document({
      title: title || 'Untitled Document',
      ownerId: userId,
      content: { type: 'doc', content: [] } // Default empty TipTap/ProseMirror structure
    });
    await newDoc.save();

    // 2. Add the creator as the 'owner' in DocumentMembers
    const membership = new DocumentMember({
      documentId: newDoc._id,
      userId: userId,
      role: 'owner'
    });
    await membership.save();

    res.status(201).json({ ...newDoc.toObject(), role: 'owner' });
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({ message: 'Error creating document' });
  }
});

// Delete a document (Only owners)
router.delete('/:id', authMiddleware, checkRole('owner'), async (req: AuthRequest, res: any) => {
  try {
    const documentId = req.params.id;

    // 1. Delete all memberships
    await DocumentMember.deleteMany({ documentId });

    // 2. Delete the document itself
    await Document.findByIdAndDelete(documentId);

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ message: 'Error deleting document' });
  }
});

// Get a single document by ID
router.get('/:id', authMiddleware, async (req: AuthRequest, res: any) => {
  try {
    const documentId = req.params.id;
    const userId = req.userId;

    // Verify membership
    const membership = await DocumentMember.findOne({ documentId, userId });
    if (!membership) {
      return res.status(403).json({ message: 'You do not have permission to view this document' });
    }

    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    res.json({ ...document.toObject(), role: membership.role });
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ message: 'Error fetching document' });
  }
});

// Update a document (title or content)
router.patch('/:id', authMiddleware, async (req: AuthRequest, res: any) => {
  try {
    const documentId = req.params.id;
    const userId = req.userId;
    const { title, content } = req.body;

    // Verify membership and role
    const membership = await DocumentMember.findOne({ documentId, userId });
    if (!membership || membership.role === 'viewer') {
      return res.status(403).json({ message: 'You do not have permission to edit this document' });
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;

    const updatedDoc = await Document.findByIdAndUpdate(
      documentId,
      { $set: updateData },
      { new: true }
    );

    res.json(updatedDoc);
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ message: 'Error updating document' });
  }
});

export default router;
