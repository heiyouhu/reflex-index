# RAG Baseline Reference

This project is positioned as a fast path before traditional Retrieval-Augmented Generation.

## Traditional RAG pipeline

```text
User query
  -> query embedding
  -> vector search over chunks
  -> optional rerank
  -> fetch source chunks
  -> pack long context
  -> LLM reads context
  -> LLM generates answer
```

This architecture is flexible but has runtime costs:

- latency from embedding, retrieval, reranking, and model generation
- token cost from sending retrieved chunks into the context window
- answer instability when retrieved chunks are relevant but not answer-shaped
- extra complexity in citation grounding and context packing

## Reflex Index pipeline

```text
Offline:
Documents -> answer capsules -> hybrid capsule index

Runtime:
User query
  -> query normalization
  -> capsule recall
  -> score fusion
  -> confidence gate
  -> direct answer or RAG fallback
```

Reflex Index changes the unit of retrieval:

| System | Retrieval unit | Runtime model workload |
| --- | --- | --- |
| Traditional RAG | chunks / passages | read context and synthesize |
| Reflex Index | precompiled answer capsules | validate and return, or fallback |

## Submission claim

The claim is not that Reflex Index universally replaces RAG. The narrower and more defensible claim is:

> For stable, high-frequency knowledge questions, precompiled answer-capsule retrieval can reduce p50 latency and token consumption by answering before the RAG chain is invoked.

## Baseline metrics to report

When this prototype is connected to a real backend, compare against a standard RAG baseline using:

- p50 latency
- p95 latency
- direct-hit rate
- fallback rate
- average input tokens per answered query
- answer acceptance rate
- citation accuracy
- wrong-direct-hit rate

## Failure modes

Reflex Index should fall back to RAG when:

- no capsule clears the confidence threshold
- the user asks for multi-document synthesis
- the knowledge base changed after the capsule index was built
- the question depends on exact phrasing in a long source
- the query is exploratory rather than fact-seeking
