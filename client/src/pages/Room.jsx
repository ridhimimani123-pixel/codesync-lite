import { useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { API_URL, LANGUAGES } from "../config";
import { socket } from "../socket";
import CodeEditor from "../components/CodeEditor";
import VideoCall from "../components/VideoCall";
import FeedbackForm from "../components/FeedbackForm";
import { PlayIcon, LinkIcon, CheckIcon, FlagIcon, TerminalIcon } from "../icons";

const StopIcon = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <rect x="5" y="5" width="14" height="14" rx="2" />
  </svg>
);

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [tryRunning, setTryRunning] = useState(false); // private Try Run (only I see it)
  const abortRef = useRef(null);   // lets Stop cancel my in-flight run request
  const tryAbortRef = useRef(null); // same, for my private Try Run
  const runIdRef = useRef(null);   // id of the run currently shown on screen
  const [copied, setCopied] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [roomError, setRoomError] = useState("");
  const [checking, setChecking] = useState(true);
  const name = localStorage.getItem("name") || "Guest";
  const role = localStorage.getItem("role") || "candidate";

  useEffect(() => {
    setChecking(true);
    fetch(`${API_URL}/api/rooms/${roomId}`)
      .then((r) => { if (!r.ok) throw new Error(); })
      .catch(() => setRoomError("Room not found"))
      .finally(() => setChecking(false));
  }, [roomId]);

  // Keep run state and output in sync with everyone in the room
  useEffect(() => {
    const cancelMyRequest = () => {
      abortRef.current?.abort();
      abortRef.current = null;
      tryAbortRef.current?.abort();
      tryAbortRef.current = null;
      setTryRunning(false);
    };
    const onRoomState = ({ output: o, running: r }) => {
      setOutput(o || "");
      setRunning(!!r);
    };
    const onRunStart = ({ runId, by }) => {
      cancelMyRequest();          // the latest Run wins
      runIdRef.current = runId;
      setRunning(true);
      setOutput(`Running... (started by ${by})`);
    };
    const onRunResult = ({ output: o }) => {
      runIdRef.current = null;
      setRunning(false);
      setOutput(o);
    };
    const onRunStop = ({ message }) => {
      cancelMyRequest();
      runIdRef.current = null;
      setRunning(false);
      setOutput(message || "Execution stopped.");
    };
    const onOutput = ({ output: o }) => setOutput(o);

    socket.on("room-state", onRoomState);
    socket.on("run-start", onRunStart);
    socket.on("run-result", onRunResult);
    socket.on("run-stop", onRunStop);
    socket.on("output-update", onOutput);
    return () => {
      socket.off("room-state", onRoomState);
      socket.off("run-start", onRunStart);
      socket.off("run-result", onRunResult);
      socket.off("run-stop", onRunStop);
      socket.off("output-update", onOutput);
      cancelMyRequest();
    };
  }, []);

  const post = (path, signal) =>
    fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, language }),
      signal,
    });

  const runCode = async () => {
    if (running) return;
    if (!code.trim()) { setOutput("Write some code first."); return; }

    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const controller = new AbortController();
    abortRef.current = controller;
    runIdRef.current = runId;
    setRunning(true);
    setOutput("Running...");
    socket.emit("run-start", { runId, roomId });

    const finish = (out) => {
      if (runIdRef.current !== runId) return; // stopped, or replaced by someone else's run
      runIdRef.current = null;
      abortRef.current = null;
      setRunning(false);
      setOutput(out);
      socket.emit("run-result", { runId, output: out, roomId });
    };

    try {
      const res = await post("/api/execute", controller.signal);
      const data = await res.json();
      finish(data.output ?? data.error ?? "No output");
    } catch (e) {
      if (e.name === "AbortError") return; // Stop was pressed; the UI is already updated
      finish("Error: could not run code");
    }
  };

  // Try Run: runs the code only for me. Nobody else sees the output.
  const tryRun = async () => {
    if (running || tryRunning) return;
    if (!code.trim()) { setOutput("Write some code first."); return; }

    const controller = new AbortController();
    tryAbortRef.current = controller;
    setTryRunning(true);
    setOutput("Try Run... (only you can see this)");

    const show = (out) => {
      if (tryAbortRef.current !== controller) return; // stopped meanwhile
      tryAbortRef.current = null;
      setTryRunning(false);
      setOutput(`Try Run (only you can see this):\n${out}`);
    };

    try {
      const res = await post("/api/execute", controller.signal);
      const data = await res.json();
      show(data.output ?? data.error ?? "No output");
    } catch (e) {
      if (e.name === "AbortError") return;
      show("Error: could not run code");
    }
  };

  // Stop Code: stops my Try Run, or the shared run for everyone in the room
  const stopCode = () => {
    if (tryRunning) {
      tryAbortRef.current?.abort();
      tryAbortRef.current = null;
      setTryRunning(false);
      setOutput("Try Run stopped.");
      return;
    }
    abortRef.current?.abort();
    abortRef.current = null;
    runIdRef.current = null;
    setRunning(false);
    setOutput("Execution stopped.");
    socket.emit("run-stop", { roomId }); // everyone else stops too
  };

  const clearOutput = () => {
    setOutput("");
    socket.emit("output-update", { output: "", roomId });
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (checking)
    return <main className="center"><div className="spinner" /></main>;

  if (roomError)
    return (
      <main className="center">
        <div className="glass state-card">
          <div className="card-icon"><FlagIcon width={22} height={22} /></div>
          <h2>{roomError}</h2>
          <p className="muted">Check the room ID, or ask the interviewer for a new link.</p>
          <Link className="btn primary" to="/">Back to home</Link>
        </div>
      </main>
    );

  return (
    <div className="room">
      <header className="glass topbar">
        <div className="topbar-left">
          <span className="pill"><span className="pulse" /> Room <b>{roomId}</b></span>
          <span className="pill">{name} · {role}</span>
        </div>
        <div className="topbar-right">
          <select value={language} disabled={running || tryRunning}
            onChange={(e) => setLanguage(e.target.value)}>
            {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
          <button className="btn" onClick={tryRun} disabled={running || tryRunning}>
            <TerminalIcon width={14} height={14} /> Try Run
          </button>
          <button className="btn success" onClick={runCode} disabled={running || tryRunning}>
            <PlayIcon width={14} height={14} /> Run Code
          </button>
          <button className="btn danger" onClick={stopCode} disabled={!running && !tryRunning}>
            <StopIcon /> Stop Code
          </button>
          <button className="btn" onClick={copyLink}>
            {copied ? <CheckIcon width={15} height={15} /> : <LinkIcon width={15} height={15} />}
            {copied ? "Copied" : "Copy link"}
          </button>
          <button className="btn danger" onClick={() => setShowFeedback(true)}>Finish</button>
        </div>
      </header>

      <section className="main">
        <div className="editor">
          <CodeEditor roomId={roomId} language={language}
            onLanguageChange={setLanguage} onCodeChange={setCode} />
        </div>
        <aside className="video"><VideoCall roomId={roomId} /></aside>
      </section>

      <section className="output">
        <div className="output-head">
          <span><TerminalIcon width={14} height={14} /> Output</span>
          {output && !running && !tryRunning && <button className="btn sm" onClick={clearOutput}>Clear</button>}
        </div>
        <pre className={output ? "" : "empty"}>{output || "Run your code to see output here."}</pre>
      </section>

      {showFeedback && (
        <div className="modal" onClick={() => setShowFeedback(false)}>
          <div className="glass" onClick={(e) => e.stopPropagation()}>
            <FeedbackForm roomId={roomId} />
            <button className="btn" onClick={() => navigate("/")}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}