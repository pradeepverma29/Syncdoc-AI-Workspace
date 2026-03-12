import mongoose, { Document as MongooseDocument } from 'mongoose';

export interface IFile extends MongooseDocument {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  documentId: mongoose.Types.ObjectId;
  uploadedBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const FileSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

export const FileModel = mongoose.model<IFile>('File', FileSchema);
