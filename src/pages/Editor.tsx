import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { 
  ChevronLeft, 
  Save, 
  Sparkles, 
  Users, 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Heading1, 
  Heading2,
  Loader2,
  Send,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Paperclip
} from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../context/AuthContext';
import { 
  streamGeminiContent, 
  summarizeDocument, 
  fixGrammar, 
  changeTone, 
  generateTitle 
} from '../services/gemini';
import { motion, AnimatePresence } from 'motion/react';
import ChatSidebar from '../components/ChatSidebar';
import FileSidebar from '../components/FileSidebar';

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const socket = useSocket(id);
  
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [role, setRole] = useState<'owner' | 'editor' | 'viewer'>('viewer');

  const titleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Start writing something amazing...',
      }),
    ],
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      if (socket) {
        socket.emit('send-changes', json);
      }
      setSaveStatus('saving');
      // Debounced auto-save could go here, but we have a manual save button for now
    },
  });

  // Fetch initial document data
  useEffect(() => {
    const fetchDocument = async () => {
      if (!id || !token) return;
      try {
        const response = await fetch(`/api/documents/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch document');
        const data = await response.json();
        setTitle(data.title);
        setRole(data.role);
        if (editor && data.content) {
          editor.commands.setContent(data.content);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (editor) {
      fetchDocument();
    }
  }, [id, token, editor]);

  // Handle real-time updates from socket
  useEffect(() => {
    if (!socket || !editor) return;

    socket.on('receive-changes', (delta: any) => {
      // Only update if the editor is not focused to avoid cursor jumping
      // In a production app, Yjs would handle this properly
      if (!editor.isFocused) {
        editor.commands.setContent(delta, { emitUpdate: false });
      }
    });

    return () => {
      socket.off('receive-changes');
    };
  }, [socket, editor]);

  const saveDocument = useCallback(async () => {
    if (!id || !token || !editor) return;
    setIsSaving(true);
    setSaveStatus('saving');
    
    try {
      const content = editor.getJSON();
      const response = await fetch(`/api/documents/${id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content, title })
      });

      if (!response.ok) throw new Error('Failed to save');
      
      // Also notify socket if needed, but usually REST is enough for persistence
      socket?.emit('save-document', content);
      
      setSaveStatus('saved');
    } catch (error) {
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  }, [id, token, editor, title, socket]);

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    
    if (titleTimeoutRef.current) clearTimeout(titleTimeoutRef.current);
    
    titleTimeoutRef.current = setTimeout(async () => {
      if (!id || !token) return;
      try {
        await fetch(`/api/documents/${id}`, {
          method: 'PATCH',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ title: newTitle })
        });
      } catch (error) {
        console.error('Failed to update title');
      }
    }, 1000);
  };

  const handleGenerateTitle = async () => {
    if (!editor || isGeneratingTitle) return;
    setIsGeneratingTitle(true);
    try {
      const content = editor.getText();
      const newTitle = await generateTitle(content);
      handleTitleChange(newTitle);
    } catch (error) {
      console.error('Failed to generate title');
    } finally {
      setIsGeneratingTitle(false);
    }
  };

  const handleAiAssist = async (customPrompt?: string) => {
    const prompt = customPrompt || aiPrompt;
    if (!prompt.trim() && !customPrompt || !editor) return;
    
    setIsAiLoading(true);
    setAiResponse('');
    setShowAiPanel(true);

    try {
      const context = editor.getText();
      if (customPrompt === 'summarize') {
        await summarizeDocument(context, (chunk) => setAiResponse(prev => prev + chunk));
      } else if (customPrompt === 'fix-grammar') {
        await fixGrammar(context, (chunk) => setAiResponse(prev => prev + chunk));
      } else {
        await streamGeminiContent(prompt, context, (chunk) => {
          setAiResponse(prev => prev + chunk);
        });
      }
    } catch (error) {
      setAiResponse('Error: Failed to connect to Gemini AI.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const insertAiResponse = () => {
    if (!editor || !aiResponse) return;
    editor.chain().focus().insertContent(aiResponse).run();
    setAiResponse('');
    setAiPrompt('');
    setShowAiPanel(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      {/* Editor Header */}
      <header className="h-16 border-b border-gray-200 px-6 flex items-center justify-between sticky top-0 bg-white z-20">
        <div className="flex items-center gap-4 flex-1">
          <button 
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex flex-col flex-1 max-w-md">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <input 
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="text-lg font-semibold text-gray-900 bg-transparent border-none focus:ring-0 p-0 placeholder-gray-300 flex-1"
                placeholder="Untitled Document"
                disabled={role === 'viewer'}
              />
              {role !== 'viewer' && (
                <button
                  onClick={handleGenerateTitle}
                  disabled={isGeneratingTitle}
                  className="p-1.5 text-purple-500 hover:bg-purple-50 rounded-lg transition-all"
                  title="Generate title with AI"
                >
                  {isGeneratingTitle ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {saveStatus === 'saving' && <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />}
              {saveStatus === 'saved' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
              {saveStatus === 'error' && <AlertCircle className="w-3 h-3 text-red-500" />}
              <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                {saveStatus === 'saving' ? 'Saving changes...' : saveStatus === 'saved' ? 'All changes saved' : 'Error saving'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center -space-x-2 mr-2">
            <div className="w-8 h-8 rounded-full border-2 border-white bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
              JD
            </div>
            <div className="w-8 h-8 rounded-full border-2 border-white bg-emerald-500 flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
              AS
            </div>
            <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center shadow-sm">
              <Users className="w-3.5 h-3.5 text-gray-400" />
            </div>
          </div>
          
          <div className="h-8 w-px bg-gray-200 mx-2" />
          
          <button 
            onClick={() => {
              setShowFiles(!showFiles);
              if (showAiPanel) setShowAiPanel(false);
              if (showChat) setShowChat(false);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              showFiles 
                ? 'bg-emerald-100 text-emerald-700 shadow-inner' 
                : 'hover:bg-emerald-50 text-emerald-600'
            }`}
          >
            <Paperclip className="w-4 h-4" />
            <span className="hidden sm:inline">Files</span>
          </button>

          <button 
            onClick={() => {
              setShowChat(!showChat);
              if (showAiPanel) setShowAiPanel(false);
              if (showFiles) setShowFiles(false);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              showChat 
                ? 'bg-blue-100 text-blue-700 shadow-inner' 
                : 'hover:bg-blue-50 text-blue-600'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span className="hidden sm:inline">Chat</span>
          </button>

          <button 
            onClick={() => {
              setShowAiPanel(!showAiPanel);
              if (showChat) setShowChat(false);
              if (showFiles) setShowFiles(false);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              showAiPanel 
                ? 'bg-purple-100 text-purple-700 shadow-inner' 
                : 'hover:bg-purple-50 text-purple-600'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">AI Assistant</span>
          </button>
          
          <button 
            onClick={saveDocument}
            disabled={isSaving || role === 'viewer'}
            className="bg-gray-900 hover:bg-black text-white px-5 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-black/10"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="border-b border-gray-100 px-6 py-2 flex items-center gap-1 sticky top-16 bg-white z-10 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-0.5 bg-gray-50 p-1 rounded-lg">
          <ToolbarButton 
            onClick={() => editor?.chain().focus().toggleBold().run()} 
            active={editor?.isActive('bold')}
            icon={<Bold className="w-4 h-4" />}
          />
          <ToolbarButton 
            onClick={() => editor?.chain().focus().toggleItalic().run()} 
            active={editor?.isActive('italic')}
            icon={<Italic className="w-4 h-4" />}
          />
        </div>
        
        <div className="w-px h-4 bg-gray-200 mx-2" />
        
        <div className="flex items-center gap-0.5 bg-gray-50 p-1 rounded-lg">
          <ToolbarButton 
            onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} 
            active={editor?.isActive('heading', { level: 1 })}
            icon={<Heading1 className="w-4 h-4" />}
          />
          <ToolbarButton 
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} 
            active={editor?.isActive('heading', { level: 2 })}
            icon={<Heading2 className="w-4 h-4" />}
          />
        </div>
        
        <div className="w-px h-4 bg-gray-200 mx-2" />
        
        <div className="flex items-center gap-0.5 bg-gray-50 p-1 rounded-lg">
          <ToolbarButton 
            onClick={() => editor?.chain().focus().toggleBulletList().run()} 
            active={editor?.isActive('bulletList')}
            icon={<List className="w-4 h-4" />}
          />
          <ToolbarButton 
            onClick={() => editor?.chain().focus().toggleOrderedList().run()} 
            active={editor?.isActive('orderedList')}
            icon={<ListOrdered className="w-4 h-4" />}
          />
        </div>
      </div>

      <main className="flex-1 flex overflow-hidden relative bg-[#F8F9FA]">
        {/* Main Editor Area */}
        <div className="flex-1 overflow-y-auto p-8 md:p-12 lg:p-16">
          <div className="max-w-[850px] mx-auto bg-white min-h-[1100px] shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-gray-200/50 rounded-sm p-20 prose prose-slate prose-lg max-w-none focus:outline-none">
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* AI Sidebar */}
        <AnimatePresence>
          {showAiPanel && (
            <motion.div 
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-[400px] border-l border-gray-200 bg-white flex flex-col shadow-2xl z-30"
            >
              <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-purple-50/30">
                <div className="flex items-center gap-2.5 text-purple-700 font-bold tracking-tight">
                  <div className="p-1.5 bg-purple-100 rounded-lg">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  Gemini AI Assistant
                </div>
                <button 
                  onClick={() => setShowAiPanel(false)} 
                  className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"
                >
                  ×
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => handleAiAssist('summarize')}
                    disabled={isAiLoading}
                    className="flex items-center justify-center gap-2 p-3 bg-white border border-purple-100 rounded-xl text-xs font-bold text-purple-700 hover:bg-purple-50 transition-all shadow-sm"
                  >
                    Summarize
                  </button>
                  <button 
                    onClick={() => handleAiAssist('fix-grammar')}
                    disabled={isAiLoading}
                    className="flex items-center justify-center gap-2 p-3 bg-white border border-purple-100 rounded-xl text-xs font-bold text-purple-700 hover:bg-purple-50 transition-all shadow-sm"
                  >
                    Fix Grammar
                  </button>
                </div>

                {aiResponse ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl p-5 text-sm leading-relaxed text-gray-700 border border-purple-100 shadow-sm ring-1 ring-purple-50"
                  >
                    <div className="whitespace-pre-wrap">{aiResponse}</div>
                    {!isAiLoading && (
                      <button 
                        onClick={insertAiResponse}
                        className="mt-6 w-full bg-purple-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-purple-700 transition-all shadow-md shadow-purple-200 active:scale-[0.98]"
                      >
                        Insert into Document
                      </button>
                    )}
                  </motion.div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center px-4 space-y-4 opacity-40">
                    <div className="p-4 bg-gray-50 rounded-full">
                      <Sparkles className="w-8 h-8 text-gray-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Ready to help</p>
                      <p className="text-xs text-gray-500 mt-1">Ask Gemini to write, edit, or brainstorm ideas based on your document.</p>
                    </div>
                  </div>
                )}
                {isAiLoading && (
                  <div className="flex flex-col items-center justify-center py-12 space-y-3">
                    <div className="relative">
                      <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
                      <Sparkles className="w-3 h-3 text-purple-400 absolute -top-1 -right-1 animate-pulse" />
                    </div>
                    <span className="text-xs font-medium text-purple-500 animate-pulse">Gemini is thinking...</span>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50/50">
                <div className="relative group">
                  <textarea 
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Ask Gemini to write, summarize, or improve..."
                    className="w-full border border-gray-200 rounded-2xl p-5 pr-14 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none h-36 bg-white shadow-sm transition-all group-hover:border-purple-200"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAiAssist();
                      }
                    }}
                  />
                  <button 
                    onClick={() => handleAiAssist()}
                    disabled={isAiLoading || !aiPrompt.trim()}
                    className="absolute bottom-4 right-4 p-2.5 bg-purple-600 text-white rounded-xl disabled:opacity-50 hover:bg-purple-700 transition-all shadow-lg shadow-purple-200 active:scale-90"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-3 text-center">
                  Gemini can make mistakes. Check important info.
                </p>
              </div>
            </motion.div>
          )}

          {showChat && id && (
            <ChatSidebar 
              socket={socket} 
              documentId={id} 
              onClose={() => setShowChat(false)} 
            />
          )}

          {showFiles && id && (
            <FileSidebar 
              documentId={id} 
              onClose={() => setShowFiles(false)} 
              role={role}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function ToolbarButton({ onClick, active, icon }: { onClick: () => void, active?: boolean, icon: React.ReactNode }) {
  return (
    <button 
      onClick={onClick} 
      className={`p-2 rounded-md transition-all ${
        active 
          ? 'bg-white text-blue-600 shadow-sm ring-1 ring-gray-200' 
          : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'
      }`}
    >
      {icon}
    </button>
  );
}
