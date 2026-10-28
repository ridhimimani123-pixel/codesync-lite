// server/socket.js  (Person 2, extended with synced Run / Stop / output)
const { Server } = require('socket.io');

const LANGUAGES = ['javascript', 'python', 'java', 'cpp'];
const EMPTY_ROOM_TTL = 30 * 60 * 1000; // keep an empty room's code for 30 min
const RUN_TIMEOUT = 40 * 1000;         // safety net: a run can never stay "running" forever

// roomId -> { code, language, output, running, runId, runnerSocketId, runTimer, users, cleanupTimer }
const rooms = new Map();

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      code: '',
      language: 'javascript',
      output: '',
      running: false,
      runId: null,
      runnerSocketId: null,
      runTimer: null,
      users: new Map(),
      cleanupTimer: null,
    });
  }
  return rooms.get(roomId);
}

const userNames = (room) => [...room.users.values()];

function endRun(room) {
  clearTimeout(room.runTimer);
  room.running = false;
  room.runId = null;
  room.runnerSocketId = null;
}

// Person 3 can call this from the "finish room" route to save finalCode.
function getRoomState(roomId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  return {
    code: room.code,
    language: room.language,
    output: room.output,
    running: room.running,
    users: userNames(room),
  };
}

function initSocket(serverOrIo) {
  // An http.Server also has .on(), so check for a real Socket.IO Server instead
  let io;
  if (serverOrIo instanceof Server) {
    io = serverOrIo;
  } else {
    io = new Server(serverOrIo, {
      cors: {
        origin: true, // Allow any origin (Vercel domains, preview URLs, localhost)
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });
  }

  io.on('connection', (socket) => {
    // Use the room this socket joined; fall back to the roomId the client sends
    // (covers a reconnect where the join hasn't been registered again yet)
    const resolveRoom = (payloadRoomId) => {
      const id = socket.data.roomId || payloadRoomId;
      if (typeof id !== 'string' || !id) return null;
      if (!socket.data.roomId) {
        socket.join(id);
        socket.data.roomId = id;
      }
      return id;
    };

    // join-room { roomId, name }
    socket.on('join-room', ({ roomId, name } = {}) => {
      if (typeof roomId !== 'string' || !roomId) return;
      const displayName = (name || 'Guest').toString().slice(0, 40);

      const room = getRoom(roomId);
      clearTimeout(room.cleanupTimer);

      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.username = displayName;
      room.users.set(socket.id, displayName);

      // Late joiners get the current code, language, output and run state right away
      socket.emit('room-state', {
        code: room.code,
        language: room.language,
        output: room.output,
        running: room.running,
        users: userNames(room),
      });

      socket.to(roomId).emit('user-joined', {
        name: displayName,
        users: userNames(room),
      });
    });

    // code-change { roomId, code }
    socket.on('code-change', ({ code, roomId } = {}) => {
      const targetRoom = socket.data.roomId || roomId;
      if (!targetRoom || typeof code !== 'string') return;
      if (roomId && !socket.data.roomId) {
        socket.join(roomId);
        socket.data.roomId = roomId;
      }
      getRoom(targetRoom).code = code;
      socket.to(targetRoom).emit('code-change', { code });
    });

    // language-change { roomId, language }
    socket.on('language-change', ({ language, roomId } = {}) => {
      const targetRoom = socket.data.roomId || roomId;
      if (!targetRoom || !LANGUAGES.includes(language)) return;
      if (roomId && !socket.data.roomId) {
        socket.join(roomId);
        socket.data.roomId = roomId;
      }
      getRoom(targetRoom).language = language;
      socket.to(targetRoom).emit('language-change', { language });
    });

    // ---- Run / Stop / output, kept in sync for everyone in the room ----

    // run-start { runId }: this person pressed Run. The latest start wins.
    socket.on('run-start', ({ runId, roomId: payloadRoomId } = {}) => {
      const roomId = resolveRoom(payloadRoomId);
      if (!roomId || typeof runId !== 'string') return;
      const room = getRoom(roomId);
      const by = room.users.get(socket.id) || 'Someone';

      endRun(room);
      room.running = true;
      room.runId = runId;
      room.runnerSocketId = socket.id;
      room.output = 'Running...';
      room.runTimer = setTimeout(() => {
        endRun(room);
        room.output = 'Run timed out.';
        io.to(roomId).emit('run-stop', { message: room.output });
      }, RUN_TIMEOUT);

      socket.to(roomId).emit('run-start', { runId, by });
    });

    // run-result { runId, output }: the runner finished
    socket.on('run-result', ({ runId, output, roomId: payloadRoomId } = {}) => {
      const roomId = resolveRoom(payloadRoomId);
      if (!roomId) return;
      const room = getRoom(roomId);
      if (!room.running || room.runId !== runId) return; // stopped or superseded
      endRun(room);
      room.output = String(output ?? '');
      socket.to(roomId).emit('run-result', { runId, output: room.output });
    });

    // run-stop: anyone in the room can stop the current run
    socket.on('run-stop', ({ roomId: payloadRoomId } = {}) => {
      const roomId = resolveRoom(payloadRoomId);
      if (!roomId) return;
      const room = getRoom(roomId);
      if (!room.running) return;
      const by = room.users.get(socket.id) || 'Someone';
      endRun(room);
      room.output = `Execution stopped by ${by}.`;
      socket.to(roomId).emit('run-stop', { message: room.output });
    });

    // output-update { output }: syntax-check results and "Clear"
    socket.on('output-update', ({ output, roomId: payloadRoomId } = {}) => {
      const roomId = resolveRoom(payloadRoomId);
      if (!roomId) return;
      const room = getRoom(roomId);
      if (room.running) return;
      room.output = String(output ?? '');
      socket.to(roomId).emit('output-update', { output: room.output });
    });

    socket.on('disconnect', () => {
      const roomId = socket.data.roomId;
      const room = roomId && rooms.get(roomId);
      if (!room) return;

      const name = room.users.get(socket.id);
      room.users.delete(socket.id);

      // The person whose run was in progress left: don't leave everyone stuck on "Running..."
      if (room.running && room.runnerSocketId === socket.id) {
        endRun(room);
        room.output = 'Run cancelled because the runner left.';
        socket.to(roomId).emit('run-stop', { message: room.output });
      }

      socket.to(roomId).emit('user-left', { name, users: userNames(room) });

      if (room.users.size === 0) {
        room.cleanupTimer = setTimeout(() => rooms.delete(roomId), EMPTY_ROOM_TTL);
      }
    });
  });

  return io;
}

module.exports = initSocket;
module.exports.initSocket = initSocket;
module.exports.getRoomState = getRoomState;