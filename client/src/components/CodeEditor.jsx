// client/src/components/CodeEditor.jsx
import { useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { socket, joinRoom } from '../socket';

export default function CodeEditor({ roomId, language, onLanguageChange, onCodeChange }) {
  const editorRef = useRef(null);
  const codeRef = useRef('');          // latest code known
  const isRemote = useRef(false);      // true while applying incoming remote change
  const emitTimer = useRef(null);
  const langRef = useRef(language);    // last language known to match the room
  const onLangRef = useRef(onLanguageChange);
  onLangRef.current = onLanguageChange;
  const onCodeRef = useRef(onCodeChange);
  onCodeRef.current = onCodeChange;

  // Put remote code into the editor without triggering an echo emit
  const applyCode = (value) => {
    if (value === undefined || value === null) return;
    codeRef.current = value;
    window.__CODESYNC_LATEST_CODE__ = value;
    onCodeRef.current?.(value);

    const editor = editorRef.current;
    if (!editor || editor.getValue() === value) return;

    clearTimeout(emitTimer.current);
    const position = editor.getPosition();
    isRemote.current = true;
    editor.setValue(value);
    // Allow any asynchronous onChange dispatch from Monaco/React to finish before re-enabling local emit
    setTimeout(() => {
      isRemote.current = false;
    }, 50);

    if (position) {
      try {
        editor.setPosition(position);
      } catch {
        // Position might exceed new content bounds
      }
    }
  };

  const applyLanguage = (lang) => {
    if (!lang || lang === langRef.current) return;
    langRef.current = lang;
    onLangRef.current?.(lang);
  };

  // Connect, join the room, and listen for remote events
  useEffect(() => {
    const onRoomState = ({ code, language: lang }) => {
      if (typeof code === 'string') applyCode(code);
      if (lang) applyLanguage(lang);
    };
    const onCode = ({ code }) => {
      if (typeof code === 'string') applyCode(code);
    };
    const onLang = ({ language: lang }) => {
      if (lang) applyLanguage(lang);
    };
    const join = () => {
      if (roomId) joinRoom(roomId);
    };

    socket.on('room-state', onRoomState);
    socket.on('code-change', onCode);
    socket.on('language-change', onLang);
    socket.on('connect', join);

    if (socket.connected) {
      join();
    } else {
      socket.connect();
    }

    return () => {
      clearTimeout(emitTimer.current);
      socket.off('room-state', onRoomState);
      socket.off('code-change', onCode);
      socket.off('language-change', onLang);
      socket.off('connect', join);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // When local user picks a new language in dropdown -> tell the room
  useEffect(() => {
    if (language === langRef.current) return;
    langRef.current = language;
    socket.emit('language-change', { roomId, language });
  }, [language, roomId]);

  const handleMount = (editor) => {
    editorRef.current = editor;
    if (codeRef.current) {
      applyCode(codeRef.current);
    } else {
      const val = editor.getValue() || '';
      codeRef.current = val;
      window.__CODESYNC_LATEST_CODE__ = val;
      onCodeRef.current?.(val);
    }
  };

  const handleChange = (value) => {
    const updated = value ?? '';
    window.__CODESYNC_LATEST_CODE__ = updated;
    onCodeRef.current?.(updated);

    if (isRemote.current) return; // incoming remote update, do not echo back

    codeRef.current = updated;
    clearTimeout(emitTimer.current);
    emitTimer.current = setTimeout(() => {
      socket.emit('code-change', { roomId, code: codeRef.current });
    }, 100);
  };

  return (
    <Editor
      height="100%"
      theme="vs-dark"
      language={language}
      onMount={handleMount}
      onChange={handleChange}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        automaticLayout: true,
        scrollBeyondLastLine: false,
        tabSize: 2,
      }}
    />
  );
}
