<div align="center">

# 💬 DipChat

**A real-time, end-to-end encrypted chat application**

[![Node.js](https://img.shields.io/badge/Node.js-20-brightgreen?logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb)](https://www.mongodb.com/atlas)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker)](https://www.docker.com/)
[![Hugging Face](https://img.shields.io/badge/Hugging%20Face-Spaces-FFD21F?logo=huggingface)](https://huggingface.co/spaces)

</div>

---

## ✨ Features

- 🔐 **End-to-End Encryption (E2EE)** — Messages are encrypted on the client before being sent; the server only ever sees ciphertexts
- ⚡ **Real-time messaging** via WebSockets — instant delivery with no page refresh
- 📖 **Read receipts** — double-tick indicators for sent and read messages
- 👤 **User authentication** — sign-up / login with username or email + password
- 📓 **Contacts management** — add, search, and remove contacts
- 🔔 **Desktop notifications** — opt-in browser notifications for new messages
- 🌓 **Dark / Light mode** — persisted across sessions
- 📜 **Paginated message history** — lazy-load older messages on scroll
- 🐳 **Docker & Hugging Face Spaces ready** — one-command container deployment
- 🌐 **Split-deployment support** — host the frontend on Vercel and the backend anywhere

---

## 🏗️ Architecture

```
DipChat/
├── server.ts              # Express + WebSocket server (entry point)
├── backend/
│   ├── mongoose.js        # MongoDB connection helper
│   └── models/
│       ├── users.js       # User model (registration, lookup)
│       ├── contact.js     # Contacts model (add, remove, list)
│       └── messages.js    # Messages model (store, read-receipt, pagination)
├── frontend/
│   ├── index.html
│   └── src/
│       ├── App.tsx        # Main React SPA (all UI & logic)
│       ├── types.ts       # Shared TypeScript types
│       └── utils/
│           └── crypto.ts  # Client-side E2EE encrypt / decrypt helpers
├── Dockerfile             # Multi-stage Docker build
└── package.json           # Monorepo scripts
```

### How E2EE works

Messages are encrypted in the browser using a **symmetric key derived from both user IDs** before being sent over the WebSocket. The server stores and forwards only the ciphertext (`e2ee:<base64>`). Decryption happens in the receiver's browser — the plaintext is never exposed to the backend.

---

## 🚀 Getting Started

### Prerequisites

- [Node.js 20+](https://nodejs.org/)
- A [MongoDB Atlas](https://www.mongodb.com/atlas) cluster (free tier works)

### 1. Clone the repository

```bash
git clone https://github.com/your-username/dipchat.git
cd dipchat
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | ✅ | MongoDB Atlas connection string |
| `BACKEND_API_KEY` | ✅ | Secret key shared between backend and frontend |
| `FRONTEND_URL` | Production | Your deployed frontend URL (for CORS) |
| `PORT` | Optional | Server port (default: `3000`; HF Spaces uses `7860`) |

For the frontend, copy its env file too:

```bash
cp frontend/.env.example frontend/.env
```

| Variable | Required | Description |
|---|---|---|
| `VITE_BACKEND_URL` | Split deploy | URL of your backend (leave empty for same-origin dev) |
| `VITE_BACKEND_API_KEY` | ✅ | Must match `BACKEND_API_KEY` in the root `.env` |

### 4. Run locally (development)

```bash
npm run dev
```

The app will be available at **http://localhost:3000**.

---

## 🛠️ Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server (Express + Vite middleware, hot-reload) |
| `npm run build` | Build frontend with Vite and bundle server with esbuild |
| `npm start` | Start the production server from compiled output |
| `npm run lint` | Type-check the frontend TypeScript |
| `npm run clean` | Remove all build artifacts |

---

## 🐳 Docker Deployment

Build and run the container locally:

```bash
docker build -t dipchat .
docker run -p 7860:7860 \
  -e MONGODB_URI="your-mongodb-uri" \
  -e BACKEND_API_KEY="your-secret-key" \
  -e FRONTEND_URL="http://localhost:7860" \
  dipchat
```

The app will be available at **http://localhost:7860**.

---

## ☁️ Deploying to Hugging Face Spaces

DipChat is ready for [Hugging Face Spaces](https://huggingface.co/spaces) with the included `Dockerfile`.

1. Create a new **Docker** Space on Hugging Face
2. Push this repository to the Space
3. Set the following **Secrets** in the Space settings:
   - `MONGODB_URI`
   - `BACKEND_API_KEY`
   - `FRONTEND_URL` *(your Space's public URL)*
4. The Space will build and expose the app on port **7860** automatically

---

## 🌐 Split Deployment (Vercel + HF Spaces)

You can host the **frontend on Vercel** and the **backend on Hugging Face Spaces**:

1. **Backend**: Deploy to HF Spaces using Docker (see above)
2. **Frontend**: Deploy the `frontend/` folder to Vercel
   - Set `VITE_BACKEND_URL` to your HF Space URL
   - Set `VITE_BACKEND_API_KEY` to your shared secret key
   - The `frontend/vercel.json` config handles SPA routing automatically

---

## 🔌 API Reference

All REST endpoints are prefixed with `/api` and require the `x-api-key` header (except `/api/health`).

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/auth/signup` | Register a new user |
| `POST` | `/api/auth/login` | Login with email/username + password |
| `GET` | `/api/contacts` | Get contacts for a user |
| `POST` | `/api/contacts/add` | Add a contact by username or email |
| `POST` | `/api/contacts/remove` | Remove a contact |
| `GET` | `/api/users/search` | Search for users to add |
| `GET` | `/api/messages` | Fetch paginated message history |

### WebSocket (`/ws`)

Connect with `?api_key=<BACKEND_API_KEY>` query parameter.

| Message type | Direction | Description |
|---|---|---|
| `register` | Client → Server | Associate the socket with a `userNumber` |
| `message` | Client → Server | Send an encrypted message |
| `read_receipt` | Client → Server | Mark messages from a user as read |
| `message` | Server → Client | Receive an incoming message |
| `read_receipt` | Server → Client | Notification that messages were read |

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, Framer Motion, Lucide React |
| **Backend** | Node.js 20, Express, TypeScript (`tsx` for dev, `esbuild` for prod) |
| **Database** | MongoDB via Mongoose |
| **Real-time** | WebSockets (`ws` library) |
| **Encryption** | Client-side symmetric E2EE (Web Crypto APIs + Base64) |
| **Deployment** | Docker, Hugging Face Spaces, Vercel |

---

## 📄 License

This project is open source. Feel free to use, modify, and distribute it.
