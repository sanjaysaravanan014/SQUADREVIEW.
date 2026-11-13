import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSquadReviewPipeline } from './server/agents.js';
import { formatGeminiError } from './server/gemini.js';
import { runTestsInSandbox } from './server/sandbox.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '512kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'squadreview' });
});

app.post('/api/sandbox/run', async (req, res) => {
  try {
    const { code, testCode, language } = req.body ?? {};
    if (typeof code !== 'string' || typeof testCode !== 'string') {
      res.status(400).json({ error: 'Both code and testCode strings are required.' });
      return;
    }
    const lang = language === 'javascript' ? 'javascript' : 'python';
    const result = await runTestsInSandbox(code, testCode, lang);
    res.json({ result });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Sandbox execution failed.',
    });
  }
});

app.post('/api/review/stream', async (req, res) => {
  const { code, language, studentGoal } = req.body ?? {};
  if (typeof code !== 'string' || code.trim().length === 0) {
    res.status(400).json({ error: 'Please provide a code snippet to review.' });
    return;
  }
  const lang = language === 'javascript' ? 'javascript' : 'python';

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Content-Encoding', 'none');
  res.flushHeaders?.();

  let closed = false;
  const heartbeat = setInterval(() => {
    if (!closed && !res.writableEnded) {
      res.write(': keep-alive\n\n');
    }
  }, 4000);

  res.on('close', () => {
    if (!res.writableEnded) {
      closed = true;
    }
    clearInterval(heartbeat);
  });

  const emit = (event) => {
    if (closed) return;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    await runSquadReviewPipeline(
      {
        code: code.slice(0, 24000),
        language: lang,
        studentGoal: typeof studentGoal === 'string' ? studentGoal.slice(0, 1000) : '',
      },
      emit
    );
  } catch (err) {
    const formatted = formatGeminiError(err);
    emit({
      type: 'error',
      message: formatted.message,
      code: formatted.code,
    });
  } finally {
    clearInterval(heartbeat);
    if (!closed) {
      res.end();
    }
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SquadReview server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
