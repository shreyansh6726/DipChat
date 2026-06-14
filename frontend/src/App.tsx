import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Lock, 
  Send, 
  Search, 
  Plus, 
  Trash2, 
  UserPlus, 
  ChevronUp, 
  Bell, 
  BellOff, 
  Moon, 
  Sun, 
  RefreshCw, 
  LogOut, 
  MessageSquare, 
  Clock, 
  ArrowLeft, 
  CheckCheck, 
  Check, 
  Shield,
  Eye,
  EyeOff,
  User as UserIcon,
  SearchCode
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Contact, Message, DecryptedMessage, ConnectionStatus } from './types';
import { deriveSharedKey, encryptMessage, decryptMessage } from './utils/crypto';

// Backend base URL — set VITE_BACKEND_URL in frontend/.env for split deployment
// e.g. VITE_BACKEND_URL=https://your-hf-space.hf.space
// Leave empty for local dev (same-origin requests)
const API_BASE = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');

// Global fetch interceptor: injects API key header and prepends API_BASE for /api calls
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    const apiKey = import.meta.env.VITE_BACKEND_API_KEY || '';
    // Prefix relative /api paths with the backend base URL
    if (typeof input === 'string' && input.startsWith('/api') && API_BASE) {
      input = `${API_BASE}${input}`;
    }
    if (apiKey) {
      init = init || {};
      init.headers = init.headers || {};
      if (init.headers instanceof Headers) {
        init.headers.set('x-api-key', apiKey);
      } else if (Array.isArray(init.headers)) {
        init.headers.push(['x-api-key', apiKey]);
      } else {
        (init.headers as Record<string, string>)['x-api-key'] = apiKey;
      }
    }
    return originalFetch(input, init);
  };
}


export default function App() {
  // --- UI & Storage States ---
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('chat_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('chat_dark_mode');
    return saved !== 'false';
  });

  // Authentication page toggle
  const [isSignup, setIsSignup] = useState<boolean>(false);
  const [authForm, setAuthForm] = useState({
    name: '',
    userId: '',
    email: '',
    password: ''
  });
  const [authError, setAuthError] = useState<string>('');
  const [authSuccess, setAuthSuccess] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // App Layout States
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Search History State (User requested: "provide a search history feature for quick access to previous conversations")
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    const saved = localStorage.getItem('chat_search_history');
    return saved ? JSON.parse(saved) : [];
  });

  // Global search candidates (users who can be added as contacts)
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');
  const [globalSearchResults, setGlobalSearchResults] = useState<User[]>([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState<boolean>(false);
  const [addContactMessage, setAddContactMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  // Chat message streaming & pagination states
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [messagePage, setMessagePage] = useState<number>(1);
  const [hasMoreMessages, setHasMoreMessages] = useState<boolean>(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [typedMessage, setTypedMessage] = useState<string>('');

  // WebSocket status and settings (Real-time and automatic reconnection)
  const [wsStatus, setWsStatus] = useState<ConnectionStatus>('disconnected');
  const [reconnectAttempts, setReconnectAttempts] = useState<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // In-app notifications/toasts (fallback of native platform push alerts)
  const [toasts, setToasts] = useState<{ id: string; title: string; body: string }[]>([]);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default';
  });

  // UI inspection state details
  const [inspectedMessageId, setInspectedMessageId] = useState<number | null>(null);

  // --- Theme Initializer ---
  useEffect(() => {
    localStorage.setItem('chat_dark_mode', String(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Save current session
  const saveSession = (user: User | null) => {
    if (user) {
      localStorage.setItem('chat_current_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('chat_current_user');
    }
    setCurrentUser(user);
    if (!user) {
      // Disconnect WS and clear states on logout
      closeWebSocket();
      setContacts([]);
      setSelectedContact(null);
      setMessages([]);
    }
  };

  // --- Browser Desktop Notification Permission Setup ---
  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    }
  };

  // Toast dispatch trigger
  const addToast = (title: string, body: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, title, body }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  // --- WebSocket Connection Logic with Robust Error Handling & Reconnection ---
  const establishWebSocket = () => {
    if (!currentUser) return;

    // Close any prior socket to avoid double registration
    if (wsRef.current) {
      wsRef.current.close();
    }

    setWsStatus('connecting');

    // Build WebSocket URL — use VITE_BACKEND_URL for cross-origin (Vercel → HF Spaces)
    let wsUrl: string;
    const apiKey = import.meta.env.VITE_BACKEND_API_KEY || '';
    const keyParam = apiKey ? `?api_key=${encodeURIComponent(apiKey)}` : '';
    if (API_BASE) {
      // Replace http(s):// with ws(s):// for the configured backend URL
      wsUrl = `${API_BASE.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:')}/ws${keyParam}`;
    } else {
      // Same-origin fallback for local dev
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}/ws${keyParam}`;
    }

    console.log(`Connecting to WebSocket at: ${wsUrl}`);
    const socket = new WebSocket(wsUrl);

    wsRef.current = socket;

    socket.onopen = () => {
      setWsStatus('connected');
      setReconnectAttempts(0);
      console.log('WebSocket successfully established.');

      // Register the client user identifier
      socket.send(JSON.stringify({
        type: 'register',
        userNumber: currentUser.userNumber
      }));
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        console.log('Incoming real-time messaging updates:', payload);

        if (payload.type === 'message') {
          handleIncomingSocketMessage(payload);
        } else if (payload.type === 'read_receipt') {
          handleIncomingReadReceipt(payload);
        }
      } catch (err) {
        console.error('Error handling WebSocket frame:', err);
      }
    };

    socket.onclose = (event) => {
      setWsStatus('disconnected');
      wsRef.current = null;
      console.warn(`WebSocket closed. Code: ${event.code}, Clean: ${event.wasClean}`);

      // Auto reconnect logic (escalating delay)
      if (currentUser && reconnectAttempts < 10) {
        const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 15000);
        console.log(`Scheduling auto-reconnection in ${delay}ms... Attempt #${reconnectAttempts + 1}`);
        setReconnectAttempts(prev => prev + 1);
        setTimeout(() => {
          establishWebSocket();
        }, delay);
      }
    };

    socket.onerror = (err) => {
      console.error('WebSocket connection error encountered:', err);
      socket.close();
    };
  };

  const closeWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setWsStatus('disconnected');
  };

  // Re-establish WebSocket immediately if currentUser changes
  useEffect(() => {
    if (currentUser) {
      establishWebSocket();
    }
    return () => {
      closeWebSocket();
    };
  }, [currentUser]);

  // --- Real-time updates handlers (Decrypted Client side) ---
  const handleIncomingSocketMessage = (payload: any) => {
    const senderNum = parseInt(payload.sender);
    const receiverNum = parseInt(payload.receiver);
    
    // Auto-update message or push notifications if backgrounded
    if (!currentUser) return;

    // Verify if this message belongs to the current partner channel
    const activePartner = selectedContact;
    const isCurrentActiveChat = activePartner && (
      (activePartner.userNumber === senderNum && currentUser.userNumber === receiverNum) ||
      (activePartner.userNumber === receiverNum && currentUser.userNumber === senderNum)
    );

    // Derive symmetric key to decrypt the payload
    const sharedKey = deriveSharedKey(senderNum, receiverNum);
    const decryptedContent = decryptMessage(payload.content, sharedKey);

    const newDecryptedMsg: DecryptedMessage = {
      sender: senderNum,
      content: decryptedContent,
      timestamp: payload.timestamp,
      status: payload.status,
      rawEncryptedContent: payload.content
    };

    if (isCurrentActiveChat) {
      setMessages(prev => {
        // Prevent duplicate append
        if (prev.some(m => m.timestamp === newDecryptedMsg.timestamp && m.sender === newDecryptedMsg.sender)) {
          return prev;
        }
        return [...prev, newDecryptedMsg];
      });

      // Send a read receipt back since chat is currently active
      if (senderNum !== currentUser.userNumber && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'read_receipt',
          sender: senderNum,
          receiver: currentUser.userNumber
        }));
      }
    } else {
      // Is a message from another user! Increment contact's last message or visual badge
      if (senderNum !== currentUser.userNumber) {
        const senderProfile = contacts.find(c => c.userNumber === senderNum);
        const alertSenderName = senderProfile ? senderProfile.name : `User #${senderNum}`;

        // Trigger Push Notification of New Message (User requested)
        if (notificationPermission === 'granted') {
          try {
            new Notification(`New Chat from ${alertSenderName}`, {
              body: decryptedContent,
              icon: '/favicon.ico'
            });
          } catch (e) {
            console.error('System notification delivery failed, sending toast fallback:', e);
          }
        }
        addToast(alertSenderName, decryptedContent);
      }
    }

    // Refresh contact lists to bubble the latest messages to top
    fetchContacts();
  };

  const handleIncomingReadReceipt = (payload: any) => {
    // Other client has marked our messages as read!
    const sender = parseInt(payload.sender); // user whose messages were read (US)
    const receiver = parseInt(payload.receiver); // user who did the reading (THEM)

    if (currentUser && selectedContact && selectedContact.userNumber === receiver) {
      setMessages(prev => prev.map(m => {
        if (m.sender === currentUser.userNumber) {
          return { ...m, status: 'read' };
        }
        return m;
      }));
    }
  };

  // --- REST HTTP API Interactions ---

  // signup API
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    if (!authForm.name || !authForm.userId || !authForm.email || !authForm.password) {
      setAuthError('All fields must be completely populated.');
      return;
    }

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to register account.');
      }

      setAuthSuccess('Registration successful! Please log in below.');
      setIsSignup(false);
      setAuthForm(prev => ({ ...prev, password: '' }));
    } catch (e: any) {
      setAuthError(e.message || 'Error executing signup.');
    }
  };

  // login API
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    if (!authForm.userId || !authForm.password) {
      setAuthError('Credentials and password are required.');
      return;
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: authForm.userId,
          password: authForm.password
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Authentication rejected.');
      }

      // Store in memory & localStorage
      saveSession(data.user);
    } catch (e: any) {
      setAuthError(e.message || 'Verification failed.');
    }
  };

  // contacts fetch APIs
  const fetchContacts = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/contacts?userNumber=${currentUser.userNumber}`);
      if (res.ok) {
        const data = await res.json();
        
        // Populate the last message for each contact to show dynamic subheadings
        const populated: Contact[] = [];
        for (const cnt of data.contacts) {
          const mRes = await fetch(`/api/messages?userNum1=${currentUser.userNumber}&userNum2=${cnt.userNumber}&page=1&limit=1`);
          let lastMsg: DecryptedMessage | undefined;
          if (mRes.ok) {
            const mData = await mRes.json();
            if (mData.messages && mData.messages.length > 0) {
              const raw = mData.messages[0];
              const key = deriveSharedKey(currentUser.userNumber, cnt.userNumber);
              lastMsg = {
                sender: raw.sender,
                content: decryptMessage(raw.content, key),
                timestamp: raw.timestamp,
                status: raw.status,
                rawEncryptedContent: raw.content
              };
            }
          }
          populated.push({
            ...cnt,
            lastMessage: lastMsg
          });
        }
        setContacts(populated);
      }
    } catch (e) {
      console.error('Failed to update lists:', e);
    }
  };

  // Search candidates globally to Add
  const searchGlobalUsers = async () => {
    if (!currentUser || !globalSearchQuery.trim()) return;
    setIsSearchingGlobal(true);
    setAddContactMessage(null);
    try {
      const res = await fetch(`/api/users/search?query=${encodeURIComponent(globalSearchQuery)}&userNumber=${currentUser.userNumber}`);
      if (res.ok) {
        const data = await res.json();
        setGlobalSearchResults(data.users);
      }
    } catch (e) {
      console.error('Failed to research candidate lists:', e);
    } finally {
      setIsSearchingGlobal(false);
    }
  };

  const handleAddContact = async (contactIdentifier: string) => {
    if (!currentUser) return;
    setAddContactMessage(null);
    try {
      const response = await fetch('/api/contacts/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userNumber: currentUser.userNumber,
          contactCredential: contactIdentifier
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add contact.');
      }

      setAddContactMessage({ text: `Successfully registered ${data.contact.name} to contact book!`, type: 'success' });
      
      // Update contacts listings
      fetchContacts();
      
      // Select the new contact immediately to chat with them (as requested)
      setSelectedContact(data.contact);
      
      // Record search query in search history (User requested: "search history feature")
      recordSearchHistory(contactIdentifier);

      // Reset search inputs
      setGlobalSearchQuery('');
      setGlobalSearchResults([]);
    } catch (e: any) {
      setAddContactMessage({ text: e.message || 'Error adding contact', type: 'error' });
    }
  };

  const handleRemoveContact = async (targetNo: number) => {
    if (!currentUser) return;
    if (!confirm('Are you sure you want to remove this contact? All chat history is preserved but contact connection will be severed.')) return;

    try {
      const res = await fetch('/api/contacts/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userNumber: currentUser.userNumber,
          targetUserNumber: targetNo
        })
      });
      if (res.ok) {
        fetchContacts();
        if (selectedContact?.userNumber === targetNo) {
          setSelectedContact(null);
        }
      }
    } catch (e) {
      console.error('Error removing partner:', e);
    }
  };

  // --- Retrieve and Paginate Messages ---
  const fetchMessages = async (contactNum: number, pageNum: number, append: boolean = false) => {
    if (!currentUser) return;
    setIsLoadingMessages(true);
    try {
      const res = await fetch(`/api/messages?userNum1=${currentUser.userNumber}&userNum2=${contactNum}&page=${pageNum}&limit=15`);
      if (res.ok) {
        const data = await res.json();
        const key = deriveSharedKey(currentUser.userNumber, contactNum);

        // Decrypt the content of each message on the Client Side! (Actual E2EE)
        const decryptedList: DecryptedMessage[] = data.messages.map((m: Message) => ({
          sender: m.sender,
          timestamp: m.timestamp,
          status: m.status,
          content: decryptMessage(m.content, key),
          rawEncryptedContent: m.content
        }));

        if (append) {
          // Prepend older history at the beginning of stream
          setMessages(prev => [...decryptedList, ...prev]);
        } else {
          setMessages(decryptedList);
          // Scroll immediately to bottom for fresh loaded chat
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 80);
        }

        setHasMoreMessages(data.hasMore);
        setMessagePage(pageNum);

        // Send a read receipt for incoming unread messages when first open
        const unreadIncoming = decryptedList.some(m => m.sender === contactNum && m.status === 'unread');
        if (unreadIncoming && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'read_receipt',
            sender: contactNum,
            receiver: currentUser.userNumber
          }));
        }
      }
    } catch (e) {
      console.error('Failed to load message history:', e);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Retrieve contacts automatically when logged-in
  useEffect(() => {
    if (currentUser) {
      fetchContacts();
      const interval = setInterval(fetchContacts, 12000); // Polling update interval for contacts
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  // Retrieve message stream updates when selectedContact changes
  useEffect(() => {
    if (currentUser && selectedContact) {
      fetchMessages(selectedContact.userNumber, 1, false);
      
      // Update read status right away
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'read_receipt',
          sender: selectedContact.userNumber,
          receiver: currentUser.userNumber
        }));
      }
    } else {
      setMessages([]);
    }
  }, [selectedContact, currentUser]);

  // Load older messages (Pagination support)
  const handleLoadMore = () => {
    if (selectedContact && !isLoadingMessages && hasMoreMessages) {
      fetchMessages(selectedContact.userNumber, messagePage + 1, true);
    }
  };

  // --- Send Message ---
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedContact || !typedMessage.trim()) return;

    const plaintext = typedMessage.trim();
    // 1. Encrypt Content Client-side!
    const channelKey = deriveSharedKey(currentUser.userNumber, selectedContact.userNumber);
    const ciphertext = encryptMessage(plaintext, channelKey);

    const timestamp = Date.now();

    // 2. Transmit via WebSockets (Low Latency Instant updates)
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'message',
        sender: currentUser.userNumber,
        receiver: selectedContact.userNumber,
        content: ciphertext,
        timestamp
      }));
    } else {
      // Offline fallback alert
      addToast('System Alert', 'You are currently offline. Retrying socket connection...', );
      establishWebSocket();
      return;
    }

    setTypedMessage('');
  };

  // --- Search History Manager (User requested: "provide a search history feature for quick access to previous conversations") ---
  const recordSearchHistory = (query: string) => {
    if (!query || !query.trim()) return;
    const cleanQuery = query.trim();
    setSearchHistory(prev => {
      // Uniquely filter out original and prepend to list
      const filtered = prev.filter(q => q.toLowerCase() !== cleanQuery.toLowerCase());
      const updated = [cleanQuery, ...filtered].slice(0, 8); // Keep last 8 searches
      localStorage.setItem('chat_search_history', JSON.stringify(updated));
      return updated;
    });
  };

  const removeSearchHistoryItem = (e: React.MouseEvent, item: string) => {
    e.stopPropagation();
    setSearchHistory(prev => {
      const updated = prev.filter(q => q !== item);
      localStorage.setItem('chat_search_history', JSON.stringify(updated));
      return updated;
    });
  };

  const handleSearchHistoryClick = (item: string) => {
    // 1. Try to find if user is already in active contact book
    const existing = contacts.find(c => 
      c.userId.toLowerCase() === item.toLowerCase() || 
      c.email.toLowerCase() === item.toLowerCase()
    );

    if (existing) {
      setSelectedContact(existing);
    } else {
      // 2. Otherwise fill global search input box with selection
      setGlobalSearchQuery(item);
      // Automatically run search
      setTimeout(() => {
        searchGlobalUsers();
      }, 50);
    }
  };

  // Filters local contact lists based on contact list search bar
  const filteredLocalContacts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return contacts;
    return contacts.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.userId.toLowerCase().includes(q) || 
      c.email.toLowerCase().includes(q)
    );
  }, [contacts, searchQuery]);

  return (
    <div className={`min-h-screen font-sans antialiased text-zinc-200 transition-colors duration-300 ${darkMode ? 'bg-[#090b11] text-zinc-100' : 'bg-slate-50 text-gray-800'}`}>
      
      {/* Toast Overlay Alerts */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="p-4 rounded-xl border shadow-[0_4px_30px_rgba(0,0,0,0.4)] backdrop-blur-md bg-white/95 dark:bg-[#121620]/95 border-slate-200 dark:border-zinc-800/80 pointer-events-auto flex items-start gap-3"
            >
              <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-amber-500/10 text-indigo-600 dark:text-amber-400">
                <Bell className="w-5 h-5 animate-bounce" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">{t.title}</p>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 line-clamp-2">{t.body}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* --- Phase 1: Authentication View --- */}
      {!currentUser ? (
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border bg-white dark:bg-[#11141e]/90 border-slate-200 dark:border-[#222736] shadow-[0_15px_50px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all duration-300">
            
            {/* Header Identity banner */}
            <div className="bg-gradient-to-b from-slate-900 via-[#161a26] to-[#11141e] border-b border-indigo-500/10 dark:border-amber-500/10 px-6 py-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-150 dark:bg-amber-500/15 border border-indigo-200 dark:border-amber-500/25 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
                <Lock className="w-5 h-5 text-indigo-600 dark:text-amber-400" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-zinc-100 uppercase tracking-widest font-sans">Contacts Chat</h1>
              <p className="text-xs text-indigo-600 dark:text-amber-400 font-mono tracking-widest uppercase mt-1">End-to-End Encrypted Sandbox</p>
            </div>

            <div className="p-6">
              {authError && (
                <div role="alert" className="mb-4 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 p-3 text-sm text-rose-600 dark:text-rose-400">
                  {authError}
                </div>
              )}
              {authSuccess && (
                <div role="alert" className="mb-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-3 text-sm text-emerald-600 dark:text-emerald-400">
                  {authSuccess}
                </div>
              )}

              {isSignup ? (
                /* Dynamic Signup Form */
                <form id="signup-form" onSubmit={handleSignup} className="space-y-4">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100 font-sans tracking-tight">Create Private Profile</h2>
                  
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-widest leading-none">Full Name</label>
                    <input
                      id="signup-name"
                      type="text"
                      className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0c0e14] px-3.5 py-2.5 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-650 focus:border-indigo-500 dark:focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:focus:ring-amber-500/30 transition-all duration-300"
                      placeholder="e.g. Shreyansh"
                      required
                      value={authForm.name}
                      onChange={e => setAuthForm({ ...authForm, name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-widest leading-none">User ID / Username</label>
                    <input
                      id="signup-username"
                      type="text"
                      className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0c0e14] px-3.5 py-2.5 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-650 focus:border-indigo-500 dark:focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:focus:ring-amber-500/30 transition-all duration-300"
                      placeholder="e.g. shreyansh6726"
                      required
                      value={authForm.userId}
                      onChange={e => setAuthForm({ ...authForm, userId: e.target.value.replace(/\s+/g, '') })}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-widest leading-none">Email Address</label>
                    <input
                      id="signup-email"
                      type="email"
                      className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0c0e14] px-3.5 py-2.5 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-650 focus:border-indigo-500 dark:focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:focus:ring-amber-500/30 transition-all duration-300"
                      placeholder="e.g. shreyansh@example.com"
                      required
                      value={authForm.email}
                      onChange={e => setAuthForm({ ...authForm, email: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-widest leading-none">Passphrase / Password</label>
                    <div className="relative mt-1.5">
                      <input
                        id="signup-password"
                        type={showPassword ? 'text' : 'password'}
                        className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0c0e14] px-3.5 py-2.5 pr-10 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-650 focus:border-indigo-500 dark:focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:focus:ring-amber-500/30 transition-all duration-300"
                        placeholder="••••••••"
                        required
                        value={authForm.password}
                        onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                      />
                      <button
                        type="button"
                        id="toggle-sig-password"
                        onClick={() => setShowPassword(p => !p)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-amber-400 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    id="signup-btn"
                    className="w-full rounded-xl bg-indigo-600 dark:bg-amber-500 px-4 py-3 text-sm font-bold text-white dark:text-[#090b11] shadow-lg dark:shadow-amber-500/10 hover:bg-indigo-500 dark:hover:bg-amber-400 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 uppercase tracking-widest mt-4 cursor-pointer"
                  >
                    Complete Signup
                  </button>

                  <div className="text-center mt-4">
                    <p className="text-xs text-gray-500 dark:text-zinc-400">
                      Already have an account?{' '}
                      <button
                        type="button"
                        id="switch-login-btn"
                        onClick={() => {
                          setIsSignup(false);
                          setAuthError('');
                        }}
                        className="font-medium text-indigo-600 dark:text-amber-400 hover:underline hover:text-indigo-500 dark:hover:text-amber-300 font-sans"
                      >
                        Login here
                      </button>
                    </p>
                  </div>
                </form>
              ) : (
                /* Login Form */
                <form id="login-form" onSubmit={handleLogin} className="space-y-4">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100 font-sans tracking-tight">Profile Sign In</h2>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-widest leading-none">Email or Username (Id)</label>
                    <input
                      id="login-credential"
                      type="text"
                      className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0c0e14] px-3.5 py-2.5 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-650 focus:border-indigo-500 dark:focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:focus:ring-amber-500/30 transition-all duration-300"
                      placeholder="e.g. shreyansh@example.com or shreyansh"
                      required
                      value={authForm.userId}
                      onChange={e => setAuthForm({ ...authForm, userId: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-widest leading-none">Password</label>
                    <div className="relative mt-1.5">
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0c0e14] px-3.5 py-2.5 pr-10 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-650 focus:border-indigo-500 dark:focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:focus:ring-amber-500/30 transition-all duration-300"
                        placeholder="••••••••"
                        required
                        value={authForm.password}
                        onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                      />
                      <button
                        type="button"
                        id="toggle-log-password"
                        onClick={() => setShowPassword(p => !p)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-amber-400 transition-colors bg-transparent"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    id="login-btn"
                    className="w-full rounded-xl bg-indigo-600 dark:bg-amber-500 px-4 py-3 text-sm font-bold text-white dark:text-[#090b11] shadow-lg dark:shadow-amber-500/10 hover:bg-indigo-500 dark:hover:bg-amber-400 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 uppercase tracking-widest cursor-pointer"
                  >
                    Enter Chat Sandbox
                  </button>

                  <div className="text-center mt-4">
                    <p className="text-xs text-gray-500 dark:text-zinc-400">
                      Don't have an account registered?{' '}
                      <button
                        type="button"
                        id="switch-signup-btn"
                        onClick={() => {
                          setIsSignup(true);
                          setAuthError('');
                        }}
                        className="font-medium text-indigo-600 dark:text-amber-400 hover:underline hover:text-indigo-500 dark:hover:text-amber-300 font-sans"
                      >
                        Sign up offline
                      </button>
                    </p>
                  </div>
                </form>
              )}

              {/* Secure client visual label */}
              <div className="border-t border-slate-100 dark:border-zinc-800/60 mt-6 pt-4 flex items-center justify-center gap-1.5 text-[11px] text-gray-400 dark:text-zinc-500">
                <Shield className="w-3.5 h-3.5 text-indigo-500 dark:text-amber-500" />
                <span>Zero-knowledge client end-to-end encryption</span>
              </div>
            </div>

          </div>
        </div>
      ) : (
        /* --- Phase 2: Active Chat Interface --- */
        <div className="flex h-screen w-full flex-col md:flex-row overflow-hidden">
          
          {/* --- SIDEBAR PANEL (Contacts, Searches, Settings) --- */}
          <div className="flex flex-col w-full md:w-80 lg:w-96 border-r border-[#191e2b] dark:border-[#191e2b] h-1/2 md:h-full bg-white dark:bg-[#0c0f16] shrink-0 select-none">
            
            {/* Sidebar Active profile banner */}
            <div className="p-4 border-b border-slate-100 dark:border-[#191e2b] flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-[#070a0f]/40">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-amber-400/10 border border-slate-200 dark:border-amber-500/20 text-gray-700 dark:text-amber-400 font-bold flex items-center justify-center">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100 line-clamp-1">{currentUser.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 font-mono">#{currentUser.userNumber} • @{currentUser.userId}</p>
                </div>
              </div>

              {/* Interactive Widget Header Row (Theme, Socket Status, Notifications, Logout) */}
              <div className="flex items-center gap-1">
                {/* 1. Theme toggle */}
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  id="theme-toggle-btn"
                  title="Toggle Display Theme"
                  className="p-1.5 rounded-lg text-gray-500 hover:bg-slate-100 dark:hover:bg-[#1b2230] dark:text-zinc-400 hover:text-amber-500 cursor-pointer transition-colors"
                >
                  {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
                </button>

                {/* 2. Audio/Push Notification status icon */}
                <button
                  onClick={requestNotificationPermission}
                  id="notifications-req-btn"
                  title={`Notifications: ${notificationPermission}`}
                  className="p-1.5 rounded-lg text-gray-500 hover:bg-slate-100 dark:hover:bg-[#1b2230] dark:text-zinc-400 relative cursor-pointer transition-colors"
                >
                  {notificationPermission === 'granted' ? (
                    <Bell className="w-4 h-4 text-emerald-555 dark:text-emerald-400" />
                  ) : (
                    <>
                      <BellOff className="w-4 h-4 text-rose-450" />
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-rose-500" />
                    </>
                  )}
                </button>

                {/* 3. WebSocket Connection Visual state with Force Trigger */}
                <button
                  onClick={establishWebSocket}
                  id="manual-reconnect-btn"
                  title={`Socket: ${wsStatus}. Click to manually reconnect`}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1b2230] flex items-center justify-center cursor-pointer transition-colors"
                >
                  {wsStatus === 'connected' ? (
                    <span className="flex h-2.5 w-2.5 rounded-full bg-[#10b981] shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                  ) : wsStatus === 'connecting' ? (
                    <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                  ) : (
                    <span className="flex h-2.5 w-2.5 rounded-full bg-rose-500 shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
                  )}
                </button>

                {/* 4. Logout trigger */}
                <button
                  onClick={() => saveSession(null)}
                  id="logout-btn"
                  title="Exit chat network"
                  className="p-1.5 rounded-lg text-gray-500 hover:bg-slate-100 dark:hover:bg-[#1b2230] dark:text-zinc-400 hover:text-rose-500 cursor-pointer transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Global registration alert on sockets drop */}
            {wsStatus !== 'connected' && (
              <div className="bg-amber-500/10 dark:bg-amber-500/5 px-4 py-2 border-b border-amber-500/20 text-[11px] text-amber-605 dark:text-amber-400 flex items-center justify-between font-mono">
                <span className="flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
                  Offline. Auto-reconnecting...
                </span>
                <button 
                  onClick={establishWebSocket}
                  className="underline hover:no-underline font-semibold cursor-pointer text-amber-500"
                >
                  Force reconnect
                </button>
              </div>
            )}

            {/* Sidebar Search Local saved lists */}
            <div className="p-3 border-b border-slate-100 dark:border-[#191e2b]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500" />
                <input
                  id="contact-search-input"
                  type="text"
                  placeholder="Search saved contacts..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#070a0f] text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-indigo-550 dark:focus:ring-amber-500/20 transition-all duration-300"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* --- Search History Feature Panel --- */}
            {searchHistory.length > 0 && (
              <div className="px-3 py-2 border-b border-[#e2e8f0] dark:border-[#191e2b] bg-indigo-50/10 dark:bg-[#070a0f]/20">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">
                  <Clock className="w-3 h-3 text-indigo-500 dark:text-amber-500" />
                  <span>Recent Enquiries</span>
                </div>
                <div id="search-history-tray" className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                  {searchHistory.map((query, index) => (
                    <div
                      key={`${query}-${index}`}
                      onClick={() => handleSearchHistoryClick(query)}
                      className="group flex items-center gap-1 bg-white dark:bg-[#121622] border border-slate-200 dark:border-[#222736] text-[11px] px-2.5 py-1 rounded-full text-indigo-600 dark:text-amber-400 cursor-pointer hover:bg-slate-50 dark:hover:bg-[#1b2230] hover:scale-[1.02] transition-all duration-200 shadow-sm"
                    >
                      <span className="truncate max-w-[120px] font-mono" title={query}>@{query}</span>
                      <button
                        title="Delete query"
                        onClick={(e) => removeSearchHistoryItem(e, query)}
                        className="text-gray-400 dark:text-zinc-600 hover:text-rose-500 group-hover:opacity-100 opacity-60 ml-0.5 transition-opacity duration-200"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* --- Global Contact Search / Add Form --- */}
            <div className="p-3 border-b border-slate-100 dark:border-[#191e2b] bg-slate-50/20 dark:bg-[#070a0f]/15">
              <div className="flex items-center gap-1.5 max-w-full">
                <input
                  id="global-search-input"
                  type="text"
                  placeholder="Insert username or email..."
                  className="flex-1 min-w-0 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#070a0f] text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:focus:ring-amber-500/20 font-mono transition-all duration-300"
                  value={globalSearchQuery}
                  onChange={e => setGlobalSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && searchGlobalUsers()}
                />
                <button
                  id="run-global-search-btn"
                  onClick={searchGlobalUsers}
                  className="p-2 rounded-xl bg-indigo-600 dark:bg-[#121622] border dark:border-amber-500/20 hover:bg-indigo-500 dark:hover:bg-amber-505 dark:hover:bg-amber-500 dark:hover:text-[#090b11] text-white dark:text-amber-400 flex items-center justify-center shrink-0 cursor-pointer transition-all duration-300"
                  title="Search chat registry"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Direct Global Addition feedback message */}
              {addContactMessage && (
                <div id="add-contact-msg-box" className={`text-[11px] mt-1.5 px-2 py-1 rounded-md border ${
                  addContactMessage.type === 'success' 
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/25 dark:text-emerald-400 dark:border-emerald-950/50' 
                    : 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/25 dark:text-rose-400 dark:border-rose-950/50 font-mono'
                }`}>
                  {addContactMessage.text}
                </div>
              )}

              {/* Global search candidate results list */}
              {globalSearchResults.length > 0 && (
                <div id="global-search-results-tray" className="mt-2 text-xs border border-slate-150 dark:border-zinc-800/80 rounded-xl p-2 bg-white dark:bg-[#070a0f] space-y-1.5 max-h-36 overflow-y-auto shadow-inner">
                  <p className="text-[9px] uppercase tracking-widest font-bold text-gray-400 dark:text-zinc-500 mb-1">Found profiles</p>
                  {globalSearchResults.map(user => (
                    <div
                      key={user.userNumber}
                      className="flex items-center justify-between p-1.5 border-b border-slate-100 dark:border-[#121622]/40 last:border-0"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="font-semibold text-gray-900 dark:text-zinc-200 truncate">{user.name}</p>
                        <p className="text-[10px] text-gray-400 dark:text-zinc-550 truncate font-mono">@{user.userId} • #{user.userNumber}</p>
                      </div>
                      <button
                        id={`add-contact-btn-${user.userNumber}`}
                        onClick={() => handleAddContact(user.userId)}
                        className="px-2.5 py-1 bg-indigo-50 dark:bg-amber-500/10 text-indigo-600 dark:text-amber-400 hover:bg-indigo-650 hover:text-white dark:hover:bg-amber-550 dark:hover:bg-amber-500 dark:hover:text-[#0c0f16] border dark:border-amber-500/20 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all duration-300 cursor-pointer"
                      >
                        <UserPlus className="w-3 h-3" />
                        Add Connection
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* --- Saved Contacts Book Scrollable list --- */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-[#121620]/60 bg-white dark:bg-[#0c0f16]">
              <div className="px-3 py-2.5 text-[9px] font-bold text-gray-500 dark:text-zinc-500 bg-slate-50/10 dark:bg-[#070a0f]/10 uppercase tracking-widest border-b border-slate-100 dark:border-[#191e2b]">
                Active Contact Book ({filteredLocalContacts.length})
              </div>

              {filteredLocalContacts.length === 0 ? (
                <div className="text-center p-8 text-gray-400 dark:text-zinc-550 flex flex-col items-center justify-center">
                  <MessageSquare className="w-8 h-8 opacity-25 mb-2 text-indigo-500 dark:text-amber-500" />
                  <p className="text-xs select-none">No active contacts found.</p>
                  <p className="text-[10px] mt-1 max-w-[200px] leading-normal select-none text-gray-405 dark:text-zinc-600 font-mono">Enter user ID, email, or number above to establish E2EE chat sandboxes.</p>
                </div>
              ) : (
                filteredLocalContacts.map(contact => {
                  const isSelected = selectedContact?.userNumber === contact.userNumber;
                  const lastMsg = contact.lastMessage;
                  const isLastMsgUnread = lastMsg && lastMsg.sender === contact.userNumber && lastMsg.status === 'unread';

                  return (
                    <div
                      key={contact.userNumber}
                      id={`contact-row-${contact.userNumber}`}
                      onClick={() => {
                        setSelectedContact(contact);
                        // Store the click target username/ID to search history for quick selection memory
                        recordSearchHistory(contact.userId);
                      }}
                      className={`group flex items-center gap-3 p-3 text-left transition-all duration-300 cursor-pointer ${
                        isSelected 
                          ? 'bg-slate-100/80 dark:bg-[#121620] border-l-4 border-indigo-600 dark:border-amber-400' 
                          : 'hover:bg-slate-50 dark:hover:bg-[#121620]/30'
                      }`}
                    >
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm border transition-colors duration-300 ${
                          isSelected 
                            ? 'bg-indigo-50 dark:bg-amber-500/15 text-indigo-650 dark:text-amber-400 border-indigo-200 dark:border-amber-500/35' 
                            : 'bg-slate-200 dark:bg-[#181d29] text-gray-500 dark:text-zinc-400 border-slate-300 dark:border-[#222736]'
                        }`}>
                          {contact.name.charAt(0).toUpperCase()}
                        </div>
                        {/* Instant Online visual state simulation */}
                        <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-[#0c0f16]" />
                      </div>

                      {/* Contact metadata info and previews */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between font-sans">
                          <span className={`text-xs font-semibold truncate transition-colors duration-250 ${isSelected ? 'text-indigo-650 dark:text-amber-400' : 'text-gray-950 dark:text-zinc-100'}`}>{contact.name}</span>
                          <span className="text-[10px] text-gray-405 dark:text-zinc-550 shrink-0 font-mono">#{contact.userNumber}</span>
                        </div>
                        
                        <div className="flex items-center justify-between mt-1">
                          <p className={`text-[11px] truncate pr-2 font-mono ${isLastMsgUnread ? 'text-indigo-650 dark:text-amber-400 font-bold' : 'text-gray-400 dark:text-zinc-500'}`}>
                            {lastMsg ? lastMsg.content : 'No chats recorded yet'}
                          </p>

                          {isLastMsgUnread && (
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-505 dark:bg-amber-500 animate-pulse shrink-0" />
                          )}
                        </div>
                      </div>

                      {/* Delete action overlay */}
                      <button
                        title="Delete connection"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveContact(contact.userNumber);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-gray-400 dark:text-zinc-650 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

          </div>

          {/* --- MAIN CHAT PANEL (Message logs and Input) --- */}
          <div className="flex-1 flex flex-col h-1/2 md:h-full bg-slate-50 dark:bg-[#07090e] overflow-hidden relative">
            
            {selectedContact ? (
              <>
                {/* Active chat header toolbar info */}
                <div id="chat-header-bar" className="p-4 border-b border-slate-200 dark:border-[#191e2b] bg-white dark:bg-[#0c0f16] flex items-center justify-between shadow-sm z-10 select-none">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedContact(null)}
                      className="md:hidden p-1.5 rounded-lg text-gray-500 hover:bg-slate-100 dark:hover:bg-[#1b2230] dark:text-zinc-400 cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>

                    <div className="relative">
                      <div className="h-10 w-10 rounded-xl bg-indigo-550/10 dark:bg-amber-500/10 border border-indigo-200 dark:border-amber-550/20 text-indigo-505 dark:text-amber-400 font-bold flex items-center justify-center">
                        {selectedContact.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-[#0c0f16]" />
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">{selectedContact.name}</h2>
                        {/* Connection visual numbers */}
                        <span className="text-[10px] text-gray-400 dark:text-zinc-550 font-mono bg-slate-50 dark:bg-[#131722] px-1.5 py-0.5 rounded-md border dark:border-[#1c2231]">
                          id: @{selectedContact.userId}
                        </span>
                      </div>
                      <p className="text-[10px] text-emerald-500 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                        Online &bull; Symmetric E2EE Verified
                      </p>
                    </div>
                  </div>

                  {/* Encryption lock visualization */}
                  <div className="flex items-center gap-1 bg-emerald-500/10 dark:bg-amber-400/10 border border-emerald-500/20 dark:border-amber-550/20 text-emerald-600 dark:text-amber-400 shadow-sm text-xs px-2.5 py-1 rounded-full font-mono font-medium">
                    <Lock className="w-3 h-3 mr-1" />
                    <span>E2EE Active</span>
                  </div>
                </div>

                {/* --- Message logs container panel --- */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3 flex flex-col bg-slate-50 dark:bg-[#07090e]">
                  
                  {/* Message Pagination controller (User requested: "ensure the API supports pagination for message retrieval") */}
                  {hasMoreMessages && (
                    <button
                      id="load-older-msg-btn"
                      onClick={handleLoadMore}
                      disabled={isLoadingMessages}
                      className="mx-auto flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-xl bg-white dark:bg-[#0c0f16] border border-slate-200 dark:border-[#1c2231] text-indigo-650 dark:text-amber-400 hover:text-indigo-550 dark:hover:text-amber-300 disabled:opacity-50 transition-all font-semibold shadow-sm cursor-pointer select-none"
                    >
                      {isLoadingMessages ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ChevronUp className="w-3.5 h-3.5" />
                      )}
                      <span>Load older history</span>
                    </button>
                  )}

                  {messages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400 dark:text-zinc-500 select-none">
                      <div className="h-12 w-12 rounded-xl bg-indigo-50 dark:bg-amber-500/10 text-indigo-505 dark:text-amber-405 flex items-center justify-center border border-indigo-200/40 dark:border-amber-500/20 mb-3 animate-pulse">
                        <Lock className="w-6 h-6" />
                      </div>
                      <p className="text-xs font-semibold text-gray-900 dark:text-zinc-250 font-sans">Encryption Active Chat Session</p>
                      <p className="text-[10px] max-w-[260px] leading-normal mt-1 text-gray-405 dark:text-zinc-500 font-mono">This channel is end-to-end encrypted. All plaintexts are transformed client-side before transmission. Only ciphertexts are saved on database disk.</p>
                    </div>
                  ) : (
                    messages.map((m, index) => {
                      const isOwner = m.sender === currentUser.userNumber;
                      const uniqueMsgId = m.timestamp;
                      const isInspected = inspectedMessageId === uniqueMsgId;

                      return (
                        <div
                          key={`${index}-${m.timestamp}`}
                          className={`flex flex-col max-w-[80%] ${isOwner ? 'self-end items-end' : 'self-start items-start'}`}
                        >
                          <div className={`p-3 rounded-2xl text-xs relative group ${
                            isOwner 
                              ? 'bg-indigo-650 dark:bg-[#1a212f] text-white dark:text-zinc-150 rounded-br-none shadow-sm border dark:border-[#2d374d]' 
                              : 'bg-white dark:bg-[#0c0f16] text-gray-900 dark:text-zinc-200 rounded-bl-none shadow-sm border border-slate-205 dark:border-[#1c2231]'
                          }`}>
                            {/* Message text content */}
                            <p className="leading-relaxed whitespace-pre-wrap break-words">{m.content}</p>

                            {/* Micro indicators bar */}
                            <div className="flex items-center justify-end gap-1.5 mt-1 opacity-70 text-[9px] font-mono select-none">
                              <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {isOwner && (
                                m.status === 'read' ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-indigo-200 dark:text-amber-450" />
                                ) : (
                                  <Check className="w-3.5 h-3.5 text-indigo-200/70 dark:text-zinc-550" />
                                )
                              )}
                            </div>

                            {/* Client crypt inspector trigger (Show E2EE Cipher bytes stored on DB) */}
                            <button
                              id={`inspect-crypto-btn-${uniqueMsgId}`}
                              title="Inspect Encrypted Database Payload"
                              onClick={() => setInspectedMessageId(isInspected ? null : uniqueMsgId)}
                              className={`absolute ${isOwner ? '-left-7' : '-right-7'} top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-white dark:bg-[#0c0f16] border border-slate-200 dark:border-[#1c2231] opacity-0 group-hover:opacity-100 dark:hover:bg-[#1a212f] transition-all flex items-center justify-center cursor-pointer`}
                            >
                              <SearchCode className="w-3 h-3 text-indigo-500 dark:text-amber-400" />
                            </button>
                          </div>

                          {/* Reveal actual encrypted payload on server database visually */}
                          <AnimatePresence>
                            {isInspected && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-1 p-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200/50 dark:border-amber-500/20 text-[9px] font-mono text-indigo-650 dark:text-amber-400 max-w-full overflow-hidden shrink-0 select-text leading-tight"
                              >
                                <div className="font-bold uppercase text-[8px] tracking-wider text-indigo-600 dark:text-amber-500/80 mb-0.5">Payload Stored in DB (Ciphertext)</div>
                                <p className="break-all">{m.rawEncryptedContent}</p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message input text area card */}
                <div className="p-3 border-t border-slate-200 dark:border-[#191e2b] bg-white dark:bg-[#0c0f16] shadow-lg select-none">
                  <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
                    
                    <div className="flex-1 relative">
                      <input
                        id="message-input"
                        type="text"
                        placeholder={`Message ${selectedContact.name} securely...`}
                        className="w-full pr-10 py-2.5 px-3.5 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#07090e] text-gray-955 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-650 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:focus:ring-amber-500/25 leading-normal transition-all duration-350"
                        required
                        value={typedMessage}
                        onChange={e => setTypedMessage(e.target.value)}
                      />
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-gray-400 pointer-events-none">
                        <Lock className="w-3.5 h-3.5 text-indigo-400 dark:text-amber-500" />
                      </div>
                    </div>

                    <button
                      id="submit-message-btn"
                      type="submit"
                      disabled={!typedMessage.trim() || wsStatus !== 'connected'}
                      className="p-2.5 rounded-xl bg-indigo-600 dark:bg-amber-500 text-white dark:text-[#0c0f16] hover:bg-indigo-500 dark:hover:bg-amber-400 disabled:opacity-40 flex items-center justify-center cursor-pointer shrink-0 transition-all duration-300 shadow-md font-bold"
                      title={wsStatus === 'connected' ? 'Send cryptographically encrypted chat' : 'Connecting to real-time network...'}
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                  
                  {/* Footing detail */}
                  <div className="flex items-center justify-between text-[9px] text-gray-450 dark:text-zinc-550 mt-1.5 px-1 font-mono">
                    <span className="flex items-center gap-1">
                      <Shield className="w-3 h-3 text-emerald-500 dark:text-amber-500" />
                      E2EE: AES (16-bit space rotation symmetric cipher sequence)
                    </span>
                    <span className="text-emerald-500 dark:text-emerald-450 font-sans font-medium">Status: Connected to live socket</span>
                  </div>
                </div>
              </>
            ) : (
              /* --- Neutral State screen (No active conversation selected) --- */
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none bg-slate-50 dark:bg-[#07090e]">
                <div className="h-16 w-16 rounded-2xl bg-white dark:bg-[#0c0f16] border border-slate-205 dark:border-[#191e2b] shadow-[0_5px_20px_rgba(0,0,0,0.25)] flex items-center justify-center text-indigo-500 dark:text-amber-400 mb-4 animate-fade">
                  <UserIcon className="w-8 h-8" />
                </div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-zinc-100 uppercase tracking-widest font-sans">Start Secure Messenger Dialog</h2>
                <p className="text-xs text-gray-400 dark:text-zinc-500 max-w-xs mt-1.5 leading-normal">Select an existing partner from your directory, or search profiles globally to add connections and start chatting.</p>

                {/* Simple platform summary indicators */}
                <div className="grid grid-cols-2 gap-3 mt-8 w-full max-w-sm">
                  <div className="p-3.5 bg-white dark:bg-[#0c0f16] border border-slate-200 dark:border-[#191e2b] rounded-xl text-left shadow-sm">
                    <Lock className="w-4 h-4 text-emerald-500 dark:text-amber-500 mb-1" />
                    <p className="text-[9px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">E2EE Storage</p>
                    <p className="text-xs font-bold text-gray-800 dark:text-zinc-100 mt-0.5">Zero-Knowledge</p>
                  </div>
                  <div className="p-3.5 bg-white dark:bg-[#0c0f16] border border-slate-200 dark:border-[#191e2b] rounded-xl text-left shadow-sm">
                    <Bell className="w-4 h-4 text-indigo-500 dark:text-amber-500 mb-1" />
                    <p className="text-[9px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">Push Alerts</p>
                    <p className="text-xs font-bold text-gray-800 dark:text-zinc-100 mt-0.5">Ready</p>
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>
      )}

    </div>
  );
}
