import React, { useState, useEffect, useRef } from 'react';
import { 
  File, 
  Upload, 
  Download, 
  Trash2, 
  X, 
  Loader2, 
  FileText, 
  Image as ImageIcon, 
  FileCode,
  AlertCircle,
  Paperclip
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';

interface FileRecord {
  _id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

interface FileSidebarProps {
  documentId: string;
  onClose: () => void;
  role: 'owner' | 'editor' | 'viewer';
}

export default function FileSidebar({ documentId, onClose, role }: FileSidebarProps) {
  const { token } = useAuth();
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = async () => {
    if (!token) return;
    try {
      const response = await fetch(`/api/files/${documentId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch files');
      const data = await response.json();
      setFiles(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load files');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [documentId, token]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`/api/files/${documentId}/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Upload failed');
      }

      await fetchFiles();
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const downloadFile = async (fileId: string, filename: string) => {
    if (!token) return;
    try {
      const response = await fetch(`/api/files/download/${fileId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      alert('Failed to download file');
    }
  };

  const deleteFile = async (fileId: string) => {
    if (!token || !confirm('Are you sure you want to delete this file?')) return;
    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Delete failed');
      await fetchFiles();
    } catch (err) {
      console.error(err);
      alert('Failed to delete file');
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-blue-500" />;
    if (mimeType.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />;
    if (mimeType.includes('javascript') || mimeType.includes('json') || mimeType.includes('html')) return <FileCode className="w-5 h-5 text-amber-500" />;
    return <File className="w-5 h-5 text-gray-400" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <motion.div
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="w-[350px] border-l border-gray-200 bg-white flex flex-col shadow-2xl z-30"
    >
      <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-emerald-50/30">
        <div className="flex items-center gap-2.5 text-emerald-700 font-bold tracking-tight">
          <div className="p-1.5 bg-emerald-100 rounded-lg">
            <Paperclip className="w-4 h-4" />
          </div>
          Shared Files
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30">
        {role !== 'viewer' && (
          <div className="mb-6">
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full py-4 border-2 border-dashed border-emerald-200 rounded-2xl flex flex-col items-center justify-center gap-2 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300 transition-all group disabled:opacity-50"
            >
              {isUploading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Upload className="w-6 h-6 group-hover:-translate-y-1 transition-transform" />
              )}
              <span className="text-xs font-bold uppercase tracking-wider">
                {isUploading ? 'Uploading...' : 'Upload New File'}
              </span>
            </button>
            {error && (
              <div className="mt-2 p-3 bg-red-50 rounded-xl flex items-center gap-2 text-red-600 text-xs font-medium">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
          </div>
        ) : files.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 space-y-3 opacity-30 py-12">
            <div className="p-4 bg-gray-100 rounded-full">
              <File className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-500">No files shared yet.</p>
          </div>
        ) : (
          files.map((file) => (
            <div
              key={file._id}
              className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="p-2 bg-gray-50 rounded-xl">
                {getFileIcon(file.mimeType)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate" title={file.originalName}>
                  {file.originalName}
                </p>
                <p className="text-[10px] text-gray-400 font-medium">
                  {formatSize(file.size)} • {new Date(file.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => downloadFile(file._id, file.originalName)}
                  className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </button>
                {role !== 'viewer' && (
                  <button
                    onClick={() => deleteFile(file._id)}
                    className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}
