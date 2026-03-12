import mongoose, { Document as MongooseDocument } from 'mongoose';

export interface IDocument extends MongooseDocument {
  title: string;
  content: any;
  ownerId: mongoose.Types.ObjectId;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema = new mongoose.Schema({
  title: { type: String, default: 'Untitled Document' },
  content: { type: Object, default: {} },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isPublic: { type: Boolean, default: false },
}, { timestamps: true });

export const Document = mongoose.model<IDocument>('Document', DocumentSchema);
