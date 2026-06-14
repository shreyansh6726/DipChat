import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import our database models using local module syntax
import { UserModel } from './backend/models/users.js';
import { ContactModel } from './backend/models/contact.js';
import { MessageModel } from './backend/models/messages.js';
import { connectDB } from './backend/mongoose.js';

async function startServer() {
  // Connect to MongoDB
  await connectDB();

  const app = express();
  // HF Spaces requires port 7860; locally falls back to 3000
  const PORT = parseInt(process.env.PORT || '3000', 10);

  // --- CORS --- Allow frontend origin (set FRONTEND_URL in env for production)
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [])
  ];
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (Postman, curl, same-origin)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
    credentials: true
  }));

  // Set up standard express body parsers
  app.use(express.json());

  // --- API Key Authentication Middleware ---
  const BACKEND_API_KEY = process.env.BACKEND_API_KEY || process.env.API_KEY;
  app.use('/api', (req, res, next) => {
    if (req.path === '/health') {
      return next();
    }
    const clientApiKey = req.headers['x-api-key'] || req.query.api_key;
    if (BACKEND_API_KEY && clientApiKey !== BACKEND_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
    }
    next();
  });

  // --- REST API Endpoints ---

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // 1. SIGNUP API
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const { name, userId, email, password } = req.body;

      if (!name || !userId || !email || !password) {
        return res.status(400).json({ error: 'All fields (name, userId, email, password) are required.' });
      }

      // Check if user ID (username) already taken
      if (!(await UserModel.isUserIdAvailable(userId))) {
        return res.status(400).json({ error: 'Username (user id) is already taken.' });
      }

      // Check if email already in use
      const existingUser = await UserModel.findByEmailOrId(email);
      if (existingUser) {
        return res.status(400).json({ error: 'Email is already in use.' });
      }

      // Create new user (automatically assigns sequential user number starting from 1)
      const user = await UserModel.create(name, userId, email, password);
      
      // Initialize empty contacts array
      await ContactModel.getContacts(user.userNumber);

      return res.status(201).json({
        message: 'Signup successful',
        user: {
          userNumber: user.userNumber,
          name: user.name,
          userId: user.userId,
          email: user.email
        }
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message || 'Error occurred during signup.' });
    }
  });

  // 2. LOGIN API
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { credential, password } = req.body;

      if (!credential || !password) {
        return res.status(400).json({ error: 'Credentials and password are required.' });
      }

      const user = await UserModel.findByEmailOrId(credential);
      if (!user || user.password !== password) {
        return res.status(401).json({ error: 'Invalid username, email, or password.' });
      }

      return res.json({
        message: 'Login successful',
        user: {
          userNumber: user.userNumber,
          name: user.name,
          userId: user.userId,
          email: user.email
        }
      });
    } catch (e: any) {
      return res.status(500).json({ error: 'Error logging in.' });
    }
  });

  // 3. CONTACTS LIST API (Get all saved contacts for a user profile)
  app.get('/api/contacts', async (req, res) => {
    try {
      const userNumber = parseInt(req.query.userNumber as string, 10);
      if (isNaN(userNumber)) {
        return res.status(400).json({ error: 'Missing or invalid userNumber.' });
      }

      const contactNumbers = await ContactModel.getContacts(userNumber);

      // Map those numbers to full user profiles, omitting password
      const populatedContacts = await Promise.all(
        contactNumbers.map(async (num) => {
          const u = await UserModel.findByUserNumber(num);
          if (!u) return null;
          return {
            userNumber: u.userNumber,
            name: u.name,
            userId: u.userId,
            email: u.email
          };
        })
      );

      return res.json({ contacts: populatedContacts.filter(Boolean) });
    } catch (e) {
      return res.status(500).json({ error: 'Error fetching contacts.' });
    }
  });

  // 4. ADD CONTACT API (Find by userId/email and save)
  app.post('/api/contacts/add', async (req, res) => {
    try {
      const { userNumber, contactCredential } = req.body;

      const userNo = parseInt(userNumber, 10);
      if (isNaN(userNo) || !contactCredential) {
        return res.status(400).json({ error: 'Missing userNumber or contact details.' });
      }

      // Locate target user by email or username
      const targetUser = await UserModel.findByEmailOrId(contactCredential);
      if (!targetUser) {
        return res.status(404).json({ error: 'No user found with that username or email.' });
      }

      if (targetUser.userNumber === userNo) {
        return res.status(400).json({ error: 'You cannot add yourself as a contact.' });
      }

      // Add symmetrically / save contact book
      await ContactModel.addContact(userNo, targetUser.userNumber);

      return res.json({
        message: 'Contact added successfully',
        contact: {
          userNumber: targetUser.userNumber,
          name: targetUser.name,
          userId: targetUser.userId,
          email: targetUser.email
        }
      });
    } catch (e) {
      return res.status(500).json({ error: 'Error adding contact.' });
    }
  });

  // 5. REMOVE CONTACT API
  app.post('/api/contacts/remove', async (req, res) => {
    try {
      const { userNumber, targetUserNumber } = req.body;
      const userNo = parseInt(userNumber, 10);
      const targetNo = parseInt(targetUserNumber, 10);

      if (isNaN(userNo) || isNaN(targetNo)) {
        return res.status(400).json({ error: 'Invalid parameters.' });
      }

      await ContactModel.removeContact(userNo, targetNo);
      return res.json({ message: 'Contact removed successfully.' });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to remove contact.' });
    }
  });

  // 6. SEARCH NEW USERS API (Search candidates to add to contacts list)
  app.get('/api/users/search', async (req, res) => {
    try {
      const query = String(req.query.query || '').trim().toLowerCase();
      const userNumber = parseInt(req.query.userNumber as string, 10);

      if (!query) {
        return res.json({ users: [] });
      }

      const allUsers = await UserModel.getAll();
      const currentContacts = isNaN(userNumber) ? [] : await ContactModel.getContacts(userNumber);

      const matches = allUsers
        .filter(user => {
          // Don't search yourself
          if (user.userNumber === userNumber) return false;
          // Don't search users already in contact list
          if (currentContacts.includes(user.userNumber)) return false;

          return (
            user.userId.toLowerCase().includes(query) ||
            user.name.toLowerCase().includes(query) ||
            user.email.toLowerCase().includes(query)
          );
        })
        .map(user => ({
          userNumber: user.userNumber,
          name: user.name,
          userId: user.userId,
          email: user.email
        }));

      return res.json({ users: matches });
    } catch (e) {
      return res.status(500).json({ error: 'Error searching users.' });
    }
  });

  // 7. PAGINATED MESSAGES RETRIEVAL API
  app.get('/api/messages', async (req, res) => {
    try {
      const userNum1 = parseInt(req.query.userNum1 as string, 10);
      const userNum2 = parseInt(req.query.userNum2 as string, 10);
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;

      if (isNaN(userNum1) || isNaN(userNum2)) {
        return res.status(400).json({ error: 'Missing or invalid user numbers.' });
      }

      const result = await MessageModel.getMessages(userNum1, userNum2, page, limit);
      return res.json(result);
    } catch (e) {
      return res.status(500).json({ error: 'Error retrieving messages.' });
    }
  });

  // --- HTTP & WebSocket Server Setup ---
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  // Map to hold online users: key = userNumber, value = Set of WebSockets (allowing multi-tab login)
  const activeSockets = new Map<number, Set<WebSocket>>();

  // Helper broadcast function
  function sendToUser(userNumber: number, payload: object) {
    const sockets = activeSockets.get(userNumber);
    if (sockets) {
      const messageStr = JSON.stringify(payload);
      sockets.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(messageStr);
          } catch (e) {
            console.error(`Error sending message to user ${userNumber}:`, e);
          }
        }
      });
    }
  }

  wss.on('connection', (ws: WebSocket) => {
    let registeredUserNumber: number | null = null;

    ws.on('message', async (data: string) => {
      try {
        const payload = JSON.parse(data);

        switch (payload.type) {
          // 1. Client registers to link socket with their userNumber
          case 'register': {
            const userNum = parseInt(payload.userNumber, 10);
            if (!isNaN(userNum)) {
              registeredUserNumber = userNum;
              if (!activeSockets.has(userNum)) {
                activeSockets.set(userNum, new Set());
              }
              activeSockets.get(userNum)!.add(ws);

              // Confirm registration
              ws.send(JSON.stringify({ type: 'registered', userNumber: userNum }));
              // Notify online friends or update status if needed
              console.log(`User ${userNum} connected via WebSocket.`);
            }
            break;
          }

          // 2. Client sends a dynamic E2EE encrypted chat message
          case 'message': {
            const { sender, receiver, content, timestamp } = payload;
            const sNum = parseInt(sender, 10);
            const rNum = parseInt(receiver, 10);

            if (isNaN(sNum) || isNaN(rNum) || !content) return;

            // Save message directly to filesystem database
            const savedMsg = await MessageModel.addMessage(sNum, rNum, content, timestamp, 'unread');

            const messagePayload = {
              type: 'message',
              sender: sNum,
              receiver: rNum,
              content: savedMsg.content,
              timestamp: savedMsg.timestamp,
              status: savedMsg.status
            };

            // Dispatch to receiver
            sendToUser(rNum, messagePayload);

            // Reflect back to any other open tabs/clients of sender
            sendToUser(sNum, messagePayload);
            break;
          }

          // 3. Mark messages between users as fully read
          case 'read_receipt': {
            const { sender, receiver } = payload; // sender = person who sent messages, receiver = person marking read
            const sNum = parseInt(sender, 10);
            const rNum = parseInt(receiver, 10);

            if (!isNaN(sNum) && !isNaN(rNum)) {
              await MessageModel.markAsRead(rNum, sNum);

              const readPayload = {
                type: 'read_receipt',
                sender: sNum,
                receiver: rNum
              };

              // Notify sender of message that their messages have been read
              sendToUser(sNum, readPayload);
              // Notify same receiver (sync across tabs)
              sendToUser(rNum, readPayload);
            }
            break;
          }

          default:
            console.warn('Unknown WebSocket payload type:', payload.type);
        }
      } catch (err) {
        console.error('Error handling WS message payload:', err);
      }
    });

    ws.on('close', () => {
      if (registeredUserNumber !== null) {
        const sockets = activeSockets.get(registeredUserNumber);
        if (sockets) {
          sockets.delete(ws);
          if (sockets.size === 0) {
            activeSockets.delete(registeredUserNumber);
          }
        }
        console.log(`User ${registeredUserNumber} disconnected from WS.`);
      }
    });

    ws.on('error', (err) => {
      console.error(`WebSocket error for user ${registeredUserNumber}:`, err);
    });
  });

  // Handle WebSocket upgrade protocol securely on same Port 3000
  httpServer.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const pathname = url.pathname;
    const clientApiKey = url.searchParams.get('api_key');
    
    if (pathname === '/ws') {
      const apiKey = process.env.BACKEND_API_KEY || process.env.API_KEY;
      if (apiKey && clientApiKey !== apiKey) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // --- Serve Frontend Application ---

  // For development: Mount Vite's rich developer server middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      root: path.join(process.cwd(), 'frontend'),
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // For production: Serve fully built static bundles from `frontend/dist/`
    const distPath = path.join(process.cwd(), 'frontend', 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on: http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal dev server boot error:', err);
});

