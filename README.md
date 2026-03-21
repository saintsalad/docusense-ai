# Docusense

A Next.js app with ChromaDB-backed document ingestion and retrieval.

## Quick Start (Windows PowerShell)

### 1) Install app dependencies

```powershell
npm install
```

### 2) Start ChromaDB (required)

The app expects Chroma at `http://localhost:8000`.

#### Option A (recommended): Docker

```powershell
docker run -d --name chromadb `
  -p 8000:8000 `
  -v "${PWD}\chroma:/data" `
  -e IS_PERSISTENT=TRUE `
  -e CHROMA_SERVER_CORS_ALLOW_ORIGINS='["http://localhost:3000"]' `
  chromadb/chroma:latest
```

#### Option B: Python CLI (no Docker)

```powershell
py -m pip install chromadb
$env:CHROMA_SERVER_CORS_ALLOW_ORIGINS='["http://localhost:3000"]'
& "C:\Users\$env:USERNAME\AppData\Local\Programs\Python\Python310\Scripts\chroma.exe" run --host localhost --port 8000 --path ./chroma
```

> Note: use the full `chroma.exe` path on Windows if `chroma` resolves to an old Python install.

### 3) Verify Chroma is running

Open a new terminal and run:

```powershell
Invoke-RestMethod http://localhost:8000/api/v2/heartbeat
```

If it responds, Chroma is healthy.

### 4) Start the app

```powershell
npm run dev
```

Production builds use **`next build --webpack`** (see `package.json`) because Turbopack currently conflicts with `@chroma-core/default-embed`’s dual CJS/ESM typings. Dev still defaults to Turbopack (`next dev --turbopack`).

Open [http://localhost:3000](http://localhost:3000).

---

## Common Setup Issues

### `Unsupported Windows architecture: x64. Only ARM64 is supported`

This comes from the Node `npx chroma run` path on some Windows setups.  
Use Docker (Option A) or Python CLI (Option B) instead.

### `Fatal error in launcher ... Python312 ... cannot find file`

Your `chroma` launcher points to an old Python install.  
Run Chroma using the full Python 3.10 script path shown above, or fix PATH order.

### `Invoke-RestMethod ... Unable to connect to the remote server`

Chroma is not running (or failed immediately). Start Chroma first, then retry the heartbeat.

---

## Chat (Vercel AI SDK + Ollama)

The UI uses [`useChat`](https://ai-sdk.dev/docs/getting-started/nextjs-app-router) against **`POST /api/chat`** ([AI SDK](https://ai-sdk.dev/) `streamText` + UI message stream). Single-shot completions can use **`POST /api/completion`** with [`useCompletion`](https://ai-sdk.dev/docs/ai-sdk-ui/completion).

- **Ollama** must be running (default `http://localhost:11434`). Code uses **`openai.chat(model)`** so requests hit **`/v1/chat/completions`** (the default `openai(model)` path uses OpenAI’s **Responses** API and breaks Ollama).
- Optional env vars: `OLLAMA_BASE_URL`, `OLLAMA_CHAT_MODEL` (default `gpt-oss:20b`), `OLLAMA_OPENAI_API_KEY` (dummy default `ollama` if unset).

The model decides when to call the **`searchKnowledgeBase`** tool; Chroma is queried only on tool execution, not on every message.

- **`KNOWLEDGE_SEARCH_N_RESULTS`** (optional): max chunks returned per tool call (default **12**, max 50). The vector DB returns up to that many nearest neighbors; if you see fewer, there may not be more similar chunks in the collection, or the model’s search query was narrow.
- **`DEBUG`** (optional): set to `true`, `1`, or `yes` to attach **`vectorDebug`** to `searchKnowledgeBase` tool results (query, hit count, per-hit distance/score and snippet). The chat UI shows this in an accordion under the tool row.
- **`CHAT_MAX_OUTPUT_TOKENS`** (optional): max tokens for assistant replies (default **16384**, capped at **128000**). Raise this if answers truncate or the model synthesizes only one passage despite multiple retrieved chunks.

---

## Tech Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- ChromaDB
- Vercel AI SDK (`ai`, `@ai-sdk/react`, `@ai-sdk/openai` → Ollama)
