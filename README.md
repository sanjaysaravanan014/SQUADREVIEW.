SquadReview — Multi-Agent Code Review & Debug Workbench
SquadReview is a full-stack multi-agent code assistant that reviews submitted Python and JavaScript snippets the way an engineering team does: routing intent, retrieving coding guidelines via Agentic RAG, auditing bugs and style, synthesizing clean fixes, generating unit tests, and verifying them inside an isolated subprocess sandbox.
Quick Demo
1. One-Command CLI Demo (No Browser Needed)
Anyone cloning this repository can run the full multi-agent pipeline directly in the terminal on a buggy Python binary_search snippet:
Bash
cp .env.example .env   # add your GEMINI_API_KEY
npm install
npm run demo
Sample output from npm run demo:
Text
=== SquadReview CLI Quick Demo ===

-> [START] Intent Router & Agentic RAG: Classifying request intent and querying coding guidelines via vector retrieval...
   [DONE]  intent_rag: Intent: debugging · Retrieved 4 knowledge docs
-> [START] Bug-Finder Agent / Style / Lint Agent / Fixer Agent
   [DONE]  bug_finder: Found 2 bugs / runtime risks
   [DONE]  style_lint: Flagged 2 style & readability notes
   [DONE]  fixer: Generated clean rewrite with 4 targeted improvements
-> [START] Test-Writer & Sandbox: Executing generated unit tests on original vs. fixed code in isolated sandbox...
   [DONE]  test_sandbox: Verified 5 tests passing on fixed code

=== Consolidated Review Summary ===
Intent:  debugging (98% confidence)
RAG Docs (4): Off-by-One & Infinite Loop Prevention in Binary Search [76% hybrid] | ...

Isolated Sandbox Verification:
  Original Code -> passed=false (4008ms — infinite loop caught by sandbox timeout)
  Fixed Code    -> passed=true, testsRun=5 (99ms)
2. Web Workbench Demo
Start the full-stack Express + Vite app locally:
Bash
npm run dev
Open http://localhost:3000, paste any Python or JavaScript function, optionally specify a review focus, and click Run Squad Review to watch live agent stages, inspect the unified diff, and edit or re-run unit tests in the sandbox.
Hosting Note for GitHub: Because SquadReview runs an Express API (server.js) and an isolated python3 / node execution sandbox, it requires a Node.js host (e.g., Cloud Run, Render, Railway, or local npm run dev) rather than static-only GitHub Pages.
Architecture
Code
Submitted Code + Goal
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│ 1. Intent Router & Agentic RAG (gemini-embedding-2)      │
│    Classifies intent & retrieves top coding guidelines   │
└──────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│ 2. Coordinated Review Crew                               │
│    • Bug-Finder Agent   (logic, bounds, runtime risks)   │
│    • Style/Lint Agent   (naming, readability, PEP 8/JS)  │
│    • Fixer Agent        (clean rewrite + explanation)    │
│    • Test-Writer Agent  (unittest / node:test suite)     │
└──────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│ 3. Isolated Subprocess Sandbox (python3 / node)          │
│    Runs tests on original vs. fixed code (4s timeout)    │
└──────────────────────────────────────────────────────────┘
        │ (if fixed code fails tests)
        ▼
┌──────────────────────────────────────────────────────────┐
│ 4. Reflection Self-Correction Loop                       │
│    Repairs fix/test harness using failure stdout/stderr  │
└──────────────────────────────────────────────────────────┘
Features
Real-time SSE Agent Pipeline: Streams progress as each specialist completes its pass.
Agentic RAG Guidance: Embeds and retrieves relevant language conventions, bug patterns, and testing rules (gemini-embedding-2 hybrid similarity + lexical fallback).
Isolated Code Execution Sandbox: Executes generated unittest (Python) and node:test (JavaScript) suites in ephemeral temp directories with stripped environment variables and strict timeouts.
Interactive Diff & Live Sandbox Re-Runner: Inspect unified line-by-line diffs, apply fixes back into the editor, and edit/re-run generated unit tests directly in the sandbox.
Session History: Saves completed review reports locally in browser localStorage.
Tech Stack
Frontend: React 19 (JSX), JavaScript (ESM), Tailwind CSS v4, Lucide Icons
Backend: Node.js, Express, Server-Sent Events (SSE)
AI SDK: @google/genai (gemini-4-hydrogen, gemini-3.1-flash-lite failover, gemini-embedding-2)
Execution Sandbox: Isolated python3 (py_compile + unittest) and node (--check + node:test) subprocesses
Prerequisites
Node.js >= 22.0.0
Python >= 3.10 (for Python snippet syntax checks and unittest execution)
Gemini API Key (GEMINI_API_KEY)
Production Build
Bash
npm run lint
npm run build
NODE_ENV=production npm start
Project Structure
Code
├── scripts/
│   └── demo.js               # One-command CLI quick demo (`npm run demo`)
├── server.js                 # Express + Vite server & SSE streaming API
├── server/
│   ├── agents.js             # Multi-agent pipeline & reflection loop
│   ├── gemini.js             # Gemini SDK client, failover & retry logic
│   ├── rag.js                # Vector + lexical Agentic RAG retrieval store
│   └── sandbox.js            # Ephemeral subprocess sandbox (Python & Node)
├── src/
│   ├── App.jsx               # Workbench & History views + SSE client
│   ├── main.jsx              # React root mount
│   ├── utils/diff.js         # LCS line-by-line unified diff utility
│   └── components/
│       ├── AgentPipelineBar.jsx
│       ├── CodeEditor.jsx
│       ├── DiffViewer.jsx
│       ├── HistoryView.jsx
│       └── ReviewReport.jsx
├── .env.example
├── index.html
├── vite.config.js
└── package.json
API Endpoints
GET /api/health — Server health check
POST /api/review/stream — Runs the multi-agent review pipeline and streams StreamEvent SSE payloads
POST /api/sandbox/run — Executes custom code and unit tests inside the isolated sandbox
