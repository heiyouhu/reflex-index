# Benchmark Plan

The current browser demo uses simulated RAG latency because it does not connect to a real model, vector database, or reranker. This file defines the benchmark plan for a serious GitHub submission.

## Eval set

Create 100–300 questions over the indexed documents:

- 50% direct factual questions
- 20% entity / number questions
- 15% paraphrased questions
- 10% multi-hop or synthesis questions
- 5% adversarial / no-answer questions

## Systems to compare

1. BM25-only search
2. Dense retrieval RAG
3. Dense + rerank RAG
4. Reflex Index direct-hit path
5. Reflex Index + RAG fallback

## Metrics

```text
latency_p50_ms
latency_p95_ms
input_tokens_avg
fallback_rate
direct_hit_rate
citation_accuracy
answer_acceptance_rate
wrong_direct_hit_rate
```

## Expected result pattern

Reflex Index should win on high-confidence direct-hit questions. Traditional RAG should remain stronger on open-ended synthesis, ambiguous questions, and low-confidence cases.

The target product result is not 100% replacement. The target result is a lower-cost, lower-latency front layer that reduces the number of queries that need full RAG.
