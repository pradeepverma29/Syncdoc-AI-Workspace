import mongoose, { Document as MongooseDocument } from 'mongoose';

export type UserRole = 'owner' | 'editor' | 'viewer';

export interface IDocumentMember extends MongooseDocument {
  documentId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: UserRole;
}

const DocumentMemberSchema = new mongoose.Schema({
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { 
    type: String, 
    enum: ['owner', 'editor', 'viewer'], 
    default: 'viewer' 
  },
}, { timestamps: true });

// Prevent duplicate roles for the same user on the same document
DocumentMemberSchema.index({ documentId: 1, userId: 1 }, { unique: true });

export const DocumentMember = mongoose.model<IDocumentMember>('DocumentMember', DocumentMemberSchema);
