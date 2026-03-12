import { useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

export const useSocket = (documentId: string | undefined) => {
  const { token } = useAuth();
  const [socket, setSocket] = useState<any>(null);

  useEffect(() => {
    if (!token || !documentId) return;

    const s = io('/', {
      auth: { token },
    });

    s.on('connect', () => {
      console.log('Connected to socket');
      s.emit('join-document', documentId);
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [token, documentId]);

  return socket;
};
