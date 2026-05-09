# Reflex Index

A GitHub-ready prototype for **answer-capsule retrieval**: a fast precompiled layer before traditional RAG.

Instead of searching chunks and asking an LLM to read long context at query time, Reflex Index compiles documents into small answer capsules offline. At runtime it searches those capsules directly, applies a confidence gate, and only falls back to RAG when confidence is too low.

## Demo features

- Vite + React + Tailwind single-page app
- Browser-only answer capsule builder
- Hybrid scoring:
  - lexical containment
  - semantic-lite token / character n-gram overlap
  - entity overlap
  - freshness
  - source reliability
- Confidence gate:
  - direct hit
  - review needed
  - fallback RAG
- Simulated latency comparison against traditional RAG
- localStorage persistence
- GitHub Actions build workflow

## Run locally

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in your terminal.

## Build

```bash
npm run build
npm run preview
```

## Submit to GitHub

Using GitHub CLI:

```bash
git init
git add .
git commit -m "Initial Reflex Index prototype"
git branch -M main
gh repo create reflex-index --public --source=. --remote=origin --push
```

Without GitHub CLI:

```bash
git init
git add .
git commit -m "Initial Reflex Index prototype"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/reflex-index.git
git push -u origin main
```


## RAG baseline reference

This repository deliberately includes a traditional RAG baseline framing. The core comparison is:

```text
Traditional RAG: query -> retrieve chunks -> pack context -> LLM reads -> answer
Reflex Index:   query -> retrieve answer capsules -> confidence gate -> answer or fallback
```

See [`docs/rag-baseline.md`](docs/rag-baseline.md) and [`docs/benchmark-plan.md`](docs/benchmark-plan.md).

## Product framing

**Reflex Index** is not a replacement for every RAG workload. It is a fast path before RAG:

```text
High confidence -> return answer capsule directly
Medium confidence -> return candidates for review
Low confidence -> fallback to traditional RAG
```

This gives you a credible product story: reduce p50 latency and token consumption for high-frequency knowledge questions while preserving source citations and a safe fallback path.

## Files

```text
src/lib/reflexEngine.js      Core retrieval and scoring logic
src/data/sampleDocs.js       Seed documents and query examples
src/App.jsx                  UI and localStorage orchestration
docs/architecture.md         Architecture notes
.github/workflows/ci.yml     GitHub Actions build check
```

## Next technical steps

1. Replace semantic-lite scoring with a real embedding retriever.
2. Add a persistent capsule index backend.
3. Add citation verification.
4. Add benchmark traces for p50/p95 latency and fallback rate.
5. Add eval questions and acceptance metrics.
