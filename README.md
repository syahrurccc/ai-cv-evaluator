# AI CV Evaluator

AI-assisted evaluation pipeline for CVs and project reports. The service accepts PDF uploads, extracts content, retrieves relevant ground truth context, and produces structured feedback using an LLM.

## Prerequisites
- Node.js 18+
- npm
- Local [Chroma](https://docs.trychroma.com/) server running (defaults to `http://localhost:8000`)
- OpenAI API key with access to the `text-embedding-3-large` and chat completion models (set as `LLM_API_KEY`)

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy environment variables template and update values:
   ```bash
   cp .env.example .env
   ```
3. Ensure the `.data/` directory is writable by the application (created automatically on first run).

## Running the API Server
Start the development server:
```bash
npm run dev
```

Build and run with TypeScript output:
```bash
npm run build
node dist/index.js
```

The server listens on `PORT` from the environment or defaults to `3000`.

## Ingesting Ground Truth
Process PDF ground truth documents and populate the Chroma collection:
```bash
npm run ingest
```
The script reads PDFs from `./docs`, produces chunked JSONL artifacts in `.data/ground-truth.jsonl`, and upserts embeddings into the configured Chroma namespace.

## API Examples
### Upload CV and Project Report
```bash
curl -X POST http://localhost:3000/upload \
  -F "cv=@/path/to/cv.pdf" \
  -F "project_report=@/path/to/project.pdf"
```
Response:
```json
{
  "files": [
    { "id": "cv_...", "name": "cv.pdf" },
    { "id": "pr_...", "name": "project.pdf" }
  ]
}
```

### Start an Evaluation Job
```bash
curl -X POST http://localhost:3000/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "job_title": "Senior Backend Engineer",
    "cv_file_id": "cv_...",
    "project_file_id": "pr_..."
  }'
```
Response:
```json
{ "id": "job_...", "status": "queued" }
```

### Poll for Results
```bash
curl http://localhost:3000/result/job_...
```
Example response when complete:
```json
{
  "id": "job_...",
  "status": "completed",
  "result": {
    "cv": {
      "match_rate": 0.82,
      "feedback": "..."
    },
    "project": {
      "score": 0.76,
      "feedback": "..."
    },
    "overall": {
      "summary": "..."
    }
  }
}
```

## Design Decisions
- **Asynchronous jobs:** PDF parsing and LLM calls can take multiple seconds. Offloading work to background jobs keeps HTTP response times low and prevents client timeouts.
- **Schema validation:** Zod schemas enforce that upstream components and LLM responses conform to expected structures, catching malformed inputs early and safeguarding downstream logic.
- **Normalized scoring:** Scores are constrained to the `[0.00, 1.00]` range, enabling consistent comparisons across evaluations and simplifying threshold-based decisions.

## Screenshots
> Replace these placeholders with real screenshots after capturing the UI.

![Upload Flow Placeholder](docs/screenshots/upload-flow.png)
![Results Placeholder](docs/screenshots/results.png)

## License
MIT
