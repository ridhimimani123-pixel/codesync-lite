# ⚡ CodeSync Lite

A real-time collaborative code interview platform. An interviewer creates a room and shares the link. Both users edit code live, run it, talk over video, and save structured feedback.

🔗 **Live Demo:** [https://codesync-lite-nine.vercel.app](https://codesync-lite-nine.vercel.app)

> ⏳ The backend runs on Render's free tier, so the first request after a period of inactivity can take 30–60 seconds while the server wakes up.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?logo=socket.io)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## Screenshots

> TODO: Add a screenshot or GIF here. Save images in a `docs/` folder and link them like this:

```
![Live editing demo](docs/demo.gif)
![Feedback form](docs/feedback.png)
```

---

## Features

- **Real-time collaborative editing:** code and language changes sync instantly between participants (Socket.IO)
- **Monaco Editor:** the same editor engine that powers VS Code
- **Run code in the browser:** JavaScript, Python, Java, and C++ via the Judge0 API
- **Built-in video call:** embedded Jitsi Meet, no extra setup
- **Interview feedback:** rate problem solving, communication, and code quality, saved to MongoDB
- **Past sessions page:** review feedback from earlier interviews
- **Shareable room links:** create a room and send the link

---

## Tech Stack

| Layer          | Technology                             |
|----------------|----------------------------------------|
| Frontend       | React 19 + Vite, React Router v7       |
| Editor         | Monaco Editor (`@monaco-editor/react`) |
| Real-time      | Socket.IO v4                           |
| Video          | Jitsi Meet (embedded iframe)           |
| Backend        | Node.js + Express v5                   |
| Database       | MongoDB Atlas + Mongoose               |
| Code Execution | Judge0 CE API                          |
| Deployment     | Render (backend) · Vercel (frontend)   |

---

## How It Works

1. A user creates a room on the home page (`POST /api/rooms`) and gets a room ID.
2. Participants open `/room/:roomId` and join over a Socket.IO connection (`join-room`).
3. Each edit is emitted as `code-change`, and the server broadcasts `code-update` to the others in the room.
4. "Run" sends the code to `/api/execute`, which forwards it to Judge0 and returns the output.
5. After the interview, the interviewer submits ratings to `/api/feedback`, and they appear on the Sessions page.

---

## Project Structure

```
codesync-lite/
├── client/                  # React + Vite frontend
│   └── src/
│       ├── components/
│       │   ├── CodeEditor.jsx      # Monaco editor
│       │   ├── VideoCall.jsx       # Jitsi iframe
│       │   └── FeedbackForm.jsx    # Rating form → API
│       ├── pages/
│       │   ├── Home.jsx            # Create / join room
│       │   ├── Room.jsx            # Main editor page
│       │   └── Sessions.jsx        # Past feedback
│       ├── socket.js               # Socket.IO client
│       └── config.js               # API_URL constant
└── server/                  # Express backend
    ├── index.js                    # App entry point
    ├── socket.js                   # Socket.IO handlers
    ├── models/
    │   ├── Room.js                 # Room schema
    │   └── Feedback.js             # Feedback schema
    └── routes/
        ├── rooms.js                # /api/rooms
        ├── feedback.js             # /api/feedback
        └── execute.js              # /api/execute → Judge0
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

```
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/codesync
PORT=5000
CLIENT_URL=http://localhost:5173
JUDGE0_URL=https://ce.judge0.com
JUDGE0_KEY=                        # optional, leave blank for public Judge0
```

Create `client/.env` (optional for local dev):

```
VITE_API_URL=http://localhost:5000
```

### 3. Run Locally

```bash
# Terminal 1: backend
cd server
npm run dev          # nodemon index.js, starts on :5000

# Terminal 2: frontend
cd client
npm run dev          # vite, starts on :5173
```

Open **http://localhost:5173** in two browser tabs to test real-time sync.

---

## API Reference

### Rooms

| Method | Route                | Body       | Response     |
|--------|----------------------|------------|--------------|
| `POST` | `/api/rooms`         | `{ name }` | `{ roomId }` |
| `GET`  | `/api/rooms/:roomId` | none       | Room object  |

### Feedback

| Method | Route           | Body                                                                              | Response              |
|--------|-----------------|-----------------------------------------------------------------------------------|-----------------------|
| `POST` | `/api/feedback` | `{ roomId, candidateName, problemSolving, communication, codeQuality, comments }` | Saved feedback        |
| `GET`  | `/api/feedback` | none                                                                              | Array of all feedback |

### Code Execution

| Method | Route          | Body                 | Response     |
|--------|----------------|----------------------|--------------|
| `POST` | `/api/execute` | `{ code, language }` | `{ output }` |

**Supported languages:** `javascript`, `python`, `java`, `cpp`

---

## Socket.IO Events

| Direction       | Event             | Payload                |
|-----------------|-------------------|------------------------|
| client → server | `join-room`       | `{ roomId, username }` |
| client → server | `code-change`     | `{ roomId, code }`     |
| client → server | `language-change` | `{ roomId, lang }`     |
| client → server | `leave-room`      | `{ roomId, username }` |
| server → client | `room-users`      | `[{ id, username }]`   |
| server → client | `code-update`     | `{ code }`             |
| server → client | `language-update` | `{ lang }`             |
| server → client | `user-joined`     | `{ id, username }`     |
| server → client | `user-left`       | `{ id, username }`     |

---

## Deployment

### Backend → Render

1. Go to [render.com](https://render.com) → **New Web Service** → connect this repo.
2. Set:
   - **Root Directory:** `server`
   - **Build command:** `npm install`
   - **Start command:** `node index.js`
3. Add environment variables (`MONGO_URI`, `CLIENT_URL=https://codesync-lite-nine.vercel.app`, `JUDGE0_URL`, etc.).
4. Deploy. Render gives you a URL like `https://codesync-lite.onrender.com`.

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project** → connect this repo.
2. Set:
   - **Root Directory:** `client`
   - **Framework:** Vite
3. Add environment variable:
   - `VITE_API_URL=https://<your-render-backend-url>`
4. Deploy.

> **After deploying:** make sure `CLIENT_URL` on Render matches your Vercel URL exactly (no trailing slash), then redeploy the backend. This fixes CORS errors.

---

## Known Limitations

- Free-tier hosting means the backend can be slow on the first request.
- Code and language changes use last-write-wins syncing (no operational transform or CRDT), so simultaneous typing in the same spot can overwrite changes.
- Code execution depends on the public Judge0 API and its rate limits.

## Future Improvements

- Conflict-free syncing with a CRDT library such as Yjs
- Authentication for interviewers
- Support for more languages and test cases
- Persist code history per room

---

## Team

| Name            | Role                  | Key Files                                                             |
|-----------------|-----------------------|-----------------------------------------------------------------------|
| _Your name_     | Frontend / UI         | `App.jsx`, `pages/`                                                   |
| _Teammate name_ | Real-time Sync        | `server/socket.js`, `client/socket.js`, `CodeEditor.jsx`              |
| _Teammate name_ | Backend / DB          | `server/index.js`, `models/`, `routes/rooms.js`, `routes/feedback.js` |
| _Teammate name_ | Integrations / Deploy | `routes/execute.js`, `VideoCall.jsx`, `FeedbackForm.jsx`, README      |

> TODO: Replace the placeholder names and roles with the real ones, and link GitHub profiles if you like.

---

## License

MIT
