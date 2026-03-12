import { Server, Socket } from 'socket.io';
import { Document } from '../models/Document.ts';
import { DocumentMember } from '../models/DocumentMember.ts';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev';

export const setupSocket = (server: any) => {
  const io = new Server(server, {
    cors: {
      origin: '*', // In production, restrict this to your APP_URL
      methods: ['GET', 'POST'],
    },
  });

  // Middleware to authenticate socket connection
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      (socket as any).userId = decoded.userId;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket: Socket) => {
    console.log('🔌 User connected:', (socket as any).userId);

    socket.on('join-document', async (documentId: string) => {
      const userId = (socket as any).userId;

      // 1. Verify RBAC before allowing to join room
      const member = await DocumentMember.findOne({ userId, documentId });
      if (!member) {
        return socket.emit('error', 'You do not have permission to access this document');
      }

      // 2. Join the room
      socket.join(documentId);
      console.log(`👤 User ${userId} joined room: ${documentId}`);

      // 3. Send initial document content
      const doc = await Document.findById(documentId);
      socket.emit('load-document', doc?.content || '');

      // 4. Handle incoming changes
      socket.on('send-changes', (delta: any) => {
        // Broadcast to everyone in the room EXCEPT the sender
        socket.to(documentId).emit('receive-changes', delta);
      });

      // 5. Handle saving
      socket.on('save-document', async (content: any) => {
        if (member.role === 'viewer') return; // Prevent viewers from saving
        await Document.findByIdAndUpdate(documentId, { content });
      });

      // 6. Handle chat messages
      socket.on('send-message', (messageData: { text: string, userName: string }) => {
        const payload = {
          ...messageData,
          userId,
          timestamp: new Date().toISOString()
        };
        // Broadcast to everyone in the room INCLUDING the sender
        io.to(documentId).emit('receive-message', payload);
      });
    });

    socket.on('disconnect', () => {
      console.log('🔌 User disconnected');
    });
  });

  return io;
};
