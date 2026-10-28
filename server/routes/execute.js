const express = require('express');
const router = express.Router();

const LANGUAGE_IDS = { javascript: 63, python: 71, java: 62, cpp: 54 };
const JUDGE0_TIMEOUT = 25 * 1000;

// Talks to Judge0. If the browser aborts its request (the Stop button) or
// disconnects, the request to Judge0 is dropped too. Also stops after JUDGE0_TIMEOUT.
async function callJudge0(payload, res) {
    const base = process.env.JUDGE0_URL || 'https://ce.judge0.com';
    const headers = { 'Content-Type': 'application/json' };
    if (process.env.JUDGE0_KEY) {
        headers['X-RapidAPI-Key'] = process.env.JUDGE0_KEY;
        headers['X-RapidAPI-Host'] = 'judge0-ce.p.rapidapi.com';
    }

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, JUDGE0_TIMEOUT);
    const onClose = () => { if (!res.writableFinished) controller.abort(); };
    res.on('close', onClose);

    try {
        const response = await fetch(`${base}/submissions?base64_encoded=false&wait=true`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
        if (!response.ok) {
            const err = new Error(`Judge0 returned ${response.status}`);
            err.httpStatus = 502;
            throw err;
        }
        return await response.json();
    } catch (err) {
        if (timedOut) {
            err.httpStatus = 504;
            err.message = 'Execution timed out';
        }
        throw err;
    } finally {
        clearTimeout(timer);
        res.off('close', onClose);
    }
}

function sendError(res, err, fallback) {
    if (res.destroyed || res.writableEnded) return; // client already left (Stop pressed)
    if (!err.httpStatus) console.error(err);
    res.status(err.httpStatus || 500).json({ error: err.httpStatus ? err.message : fallback });
}

// ---------- Run ----------
router.post('/', async (req, res) => {
    const { code, language } = req.body;

    if (!code || !LANGUAGE_IDS[language]) {
        return res.status(400).json({ error: 'code and a valid language are required' });
    }

    try {
        const data = await callJudge0(
            { source_code: code, language_id: LANGUAGE_IDS[language] },
            res
        );
        const output =
            data.stdout || data.compile_output || data.stderr || data.message ||
            data.status?.description || '(no output)';

        res.json({ output });
    } catch (err) {
        sendError(res, err, 'Code execution failed');
    }
});

// ---------- Syntax check (does not run the program) ----------
// JavaScript and Python: the code is only parsed, never executed.
// C++ and Java: compiled with flags that stop before producing a program.
function buildCheck(code, language) {
    const src = JSON.stringify(code);
    switch (language) {
        case 'javascript':
            return {
                language_id: LANGUAGE_IDS.javascript,
                source_code:
`const src = ${src};
try {
  new (require('vm').Script)(src, { filename: 'main.js' });
  console.log('OK');
} catch (e) {
  const lines = String(e.stack || e).split('\\n');
  const end = lines.findIndex((l) => /^\\s+at /.test(l));
  console.log((end < 0 ? lines : lines.slice(0, end)).filter((l) => l.trim()).join('\\n'));
}`,
            };
        case 'python':
            return {
                language_id: LANGUAGE_IDS.python,
                source_code:
`src = ${src}
try:
    compile(src, 'main.py', 'exec')
    print('OK')
except SyntaxError as e:
    print('SyntaxError: %s (line %s, column %s)' % (e.msg, e.lineno, e.offset))
    if e.text:
        print(e.text.rstrip())
except Exception as e:
    print('%s: %s' % (type(e).__name__, e))`,
            };
        case 'cpp':
            return { language_id: LANGUAGE_IDS.cpp, source_code: code, compiler_options: '-fsyntax-only' };
        case 'java':
            return { language_id: LANGUAGE_IDS.java, source_code: code, compiler_options: '-proc:only' };
        default:
            return null;
    }
}

function parseCheck(language, data) {
    const OK = { ok: true, output: '✔ No syntax errors found.' };
    const fail = (text) => ({
        ok: false,
        output: '✘ Syntax error:\n' + String(text).trim().split('\n').slice(0, 20).join('\n'),
    });

    if (language === 'javascript' || language === 'python') {
        const out = (data.stdout || '').trim();
        if (out === 'OK') return OK;
        if (out) return fail(out);
        return fail(data.stderr || data.compile_output || data.message || 'Could not check the code.');
    }
    // C++ / Java: status 6 means "Compilation Error"
    if (data.status?.id === 6) return fail(data.compile_output || 'Compilation error');
    return OK;
}

router.post('/check', async (req, res) => {
    const { code, language } = req.body;

    if (!code || !LANGUAGE_IDS[language]) {
        return res.status(400).json({ error: 'code and a valid language are required' });
    }

    try {
        const data = await callJudge0(buildCheck(code, language), res);
        res.json(parseCheck(language, data));
    } catch (err) {
        sendError(res, err, 'Syntax check failed');
    }
});

module.exports = router;