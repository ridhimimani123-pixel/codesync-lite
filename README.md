# ⚡ CodeSync Lite

A real-time collaborative code interview platform. An interviewer creates a room, shares the link, and both users edit code live, run it, talk over video, and save feedback.

---
🔗 Live Demo: https://codesync-lite-nine.vercel.app

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite, React Router v7 |
| Editor | Monaco Editor (`@monaco-editor/react`) |
| Real-time | Socket.IO v4 |
| Video | Jitsi Meet (embedded iframe) |
| Backend | Node.js + Express v5 |
| Database | MongoDB Atlas + Mongoose |
| Code Execution | Judge0 CE API |
| Deployment | Render (backend) · Vercel (frontend) |

---

## Project Structure

```
codesync-lite/
├── client/                  # React + Vite frontend
│   └── src/
│       ├── components/
│       │   ├── CodeEditor.jsx      # Monaco editor (Person 2)
│       │   ├── VideoCall.jsx       # Jitsi iframe (Person 4)
│       │   └── FeedbackForm.jsx    # Rating form → API (Person 4)
│       ├── pages/
│       │   ├── Home.jsx            # Create / join room (Person 1)
│       │   ├── Room.jsx            # Main editor page (Person 1)
│       │   └── Sessions.jsx        # Past feedback (Person 1)
│       ├── socket.js               # Socket.IO client (Person 2)
│       └── config.js               # API_URL constant
└── server/                  # Express backend
    ├── index.js                    # App entry point (Person 3)
    ├── socket.js                   # Socket.IO handlers (Person 2)
    ├── models/
    │   ├── Room.js                 # Room schema (Person 3)
    │   └── Feedback.js             # Feedback schema (Person 3)
    └── routes/
        ├── rooms.js                # /api/rooms (Person 3)
        ├── feedback.js             # /api/feedback (Person 3)
        └── execute.js              # /api/execute → Judge0 (Person 4)
```

---

## Local Setup

### Prerequisites
- Node.js **18+**
- A [MongoDB Atlas](https://cloud.mongodb.com) cluster (free tier works)
- (Optional) A [Judge0 RapidAPI](https://rapidapi.com/judge0-official/api/judge0-ce) key for code execution

### 1. Clone & Install

```bash
git clone https://github.com/ridhimimani123-pixel/codesync-lite.git
cd codesync-lite

# Install server deps
cd server && npm install

# Install client deps
cd ../client && npm install
```

### 2. Configure Environment

Create `server/.env` (copy from `server/.env.example`):

```env
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/codesync
PORT=5000
CLIENT_URL=http://localhost:5173
JUDGE0_URL=https://ce.judge0.com
JUDGE0_KEY=                        # optional — leave blank for public Judge0
```

### 3. Run Locally

```bash
# Terminal 1 — backend
cd server
npm run dev          # nodemon index.js — starts on :5000

# Terminal 2 — frontend
cd client
npm run dev          # vite — starts on :5173
```

Open **http://localhost:5173** in two browser tabs to test real-time sync.

---

## API Reference

### Rooms

| Method | Route | Body | Response |
|--------|-------|------|----------|
| `POST` | `/api/rooms` | `{ name }` | `{ roomId }` |
| `GET` | `/api/rooms/:roomId` | — | Room object |

### Feedback

| Method | Route | Body | Response |
|--------|-------|------|----------|
| `POST` | `/api/feedback` | `{ roomId, candidateName, problemSolving, communication, codeQuality, comments }` | Saved feedback |
| `GET` | `/api/feedback` | — | Array of all feedback |

### Code Execution

| Method | Route | Body | Response |
|--------|-------|------|----------|
| `POST` | `/api/execute` | `{ code, language }` | `{ output }` |

**Supported languages:** `javascript`, `python`, `java`, `cpp`

---

## Socket.IO Events

| Direction | Event | Payload |
|-----------|-------|---------|
| client → server | `join-room` | `{ roomId, username }` |
| client → server | `code-change` | `{ roomId, code }` |
| client → server | `language-change` | `{ roomId, lang }` |
| client → server | `leave-room` | `{ roomId, username }` |
| server → client | `room-users` | `[{ id, username }]` |
| server → client | `code-update` | `{ code }` |
| server → client | `language-update` | `{ lang }` |
| server → client | `user-joined` | `{ id, username }` |
| server → client | `user-left` | `{ id, username }` |

---

## Deployment

### Backend → Render

1. Push `server/` to GitHub (already done).
2. Go to [render.com](https://render.com) → **New Web Service** → connect repo.
3. Set:
   - **Root Directory:** `server`
   - **Build command:** `npm install`
   - **Start command:** `node index.js`
4. Add environment variables (`MONGO_URI`, `CLIENT_URL=https://your-app.vercel.app`, etc.).
5. Deploy — Render gives you a URL like `https://codesync-lite.onrender.com`.

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project** → connect repo.
2. Set:
   - **Root Directory:** `client`
   - **Framework:** Vite
3. Add environment variable:
   - `VITE_API_URL=https://codesync-lite.onrender.com`
4. Deploy.

> **After deploying:** Update `CLIENT_URL` in Render env vars to your Vercel URL and redeploy the backend (fixes CORS).

---

## Team

| Person | Role | Key Files |
|--------|------|-----------|
| Person 1 | Frontend / UI | `App.jsx`, `pages/` |
| Person 2 | Real-time Sync | `server/socket.js`, `client/socket.js`, `CodeEditor.jsx` |
| Person 3 | Backend / DB | `server/index.js`, `models/`, `routes/rooms.js`, `routes/feedback.js` |
| Person 4 | Integrations / Deploy | `routes/execute.js`, `VideoCall.jsx`, `FeedbackForm.jsx`, README |

---

## License

MIT
