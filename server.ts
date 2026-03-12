process.env.DISABLE_HMR = "true";
import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { createServer } from 'http';
import authRoutes from './routes/auth.ts';
import documentRoutes from './routes/documents.ts';
import fileRoutes from './routes/files.ts';
import { setupSocket } from './services/socket.ts';

dotenv.config();

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const PORT = 3000;

  // Middleware
  app.use(express.json());

  // Database Connection
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/syncdoc';
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/files', fileRoutes);

  // Socket.io Setup
  setupSocket(httpServer);

  // Vite Integration for Frontend
  // if (process.env.NODE_ENV !== 'production') {
  //   const vite = await createViteServer({
  //     server: { middlewareMode: true },
  //     appType: 'spa',
  //   });
  //   app.use(vite.middlewares);
  // } else {
  //   app.use(express.static('dist'));
  // }
  // Serve frontend separately (local dev)
app.get('/', (_, res) => {
  res.send('✅ SyncDoc Backend Running');
});

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

startServer();
