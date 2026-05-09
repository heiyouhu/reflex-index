# Reflex Index Architecture

Reflex Index is a precompiled retrieval layer that sits before traditional RAG.

## Core idea

Traditional RAG searches chunks, packs context, then asks an LLM to read and synthesize. Reflex Index compiles documents into answer capsules offline, then searches those capsules directly at runtime.

```text
Offline:
Documents -> sentence/fact extraction -> answer capsules -> hybrid index

Online:
Query -> normalization -> hybrid capsule recall -> score fusion -> confidence gate -> answer or RAG fallback
```

## Answer capsule schema

```ts
type AnswerCapsule = {
  id: string
  canonicalQuestion: string
  answer: string
  evidence: string
  entities: string[]
  symbols: string[]
  source: string
  updatedAt: string
  sourceReliability: number
  baseConfidence: number
  tokens: string[]
}
```

## Runtime decision policy

- `confidence >= 0.72`: return answer capsule directly.
- `0.52 <= confidence < 0.72`: return candidates and mark as review-needed.
- `confidence < 0.52`: fallback to traditional RAG.

## Current prototype limitations

This repository is intentionally browser-only. It does not call an embedding model or vector database. The semantic-lite score uses token overlap and Chinese character n-grams to approximate retrieval behavior for the first product demo.

Production replacements:

- Replace `semanticLite` with Matryoshka embeddings, ColBERT-lite, or another ANN retriever.
- Replace localStorage with Postgres, SQLite, LanceDB, Qdrant, or Elasticsearch.
- Replace simulated RAG latency with real observability traces.
- Add citation verification and eval sets before production use.
