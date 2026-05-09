export function uid(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`
}

export function safeJsonParse(value, fallback) {
  try {
    const parsed = JSON.parse(value)
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

export function normalizeText(input = '') {
  return input
    .toLowerCase()
    .replace(/[“”"'`]/g, '')
    .replace(/[，。！？、；：,.!?;:()\[\]{}<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function splitSentences(text = '') {
  return text
    .split(/(?<=[。！？.!?])\s+|\n+/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 8)
}

export function tokenize(input = '') {
  const normalized = normalizeText(input)
  const latin = normalized.match(/[a-z0-9][a-z0-9\-_]{1,}/g) || []
  const zh = (normalized.match(/[\u4e00-\u9fff]/g) || []).join('')
  const zhBigrams = []
  for (let i = 0; i < zh.length - 1; i += 1) zhBigrams.push(zh.slice(i, i + 2))
  const numbers = normalized.match(/\d+(?:\.\d+)?%?/g) || []
  return Array.from(new Set([...latin, ...zhBigrams, ...numbers])).filter(Boolean)
}

export function extractEntities(text = '') {
  const candidates = []
  const latinEntities = text.match(/\b[A-Z][A-Za-z0-9\-]{2,}\b|\b[A-Z]{2,}\b/g) || []
  const numbers = text.match(/\b\d+(?:\.\d+)?%?\b/g) || []
  const chineseTerms =
    text.match(/[\u4e00-\u9fff]{2,8}(?:系統|索引|膠囊|階段|召回器|門控器|文檔|答案|問題|來源|延遲|流程|知識庫|指標|策略|模型|上下文|向量|檢索|生成器|產品|政策|手冊|客服|企業|原型|置信度)/g) || []
  candidates.push(...latinEntities, ...numbers, ...chineseTerms)
  return Array.from(new Set(candidates)).slice(0, 12)
}

export function inferSymbols(sentence = '') {
  const map = [
    ['latency', ['延遲', '毫秒', '秒級', 'p50', 'p95', 'latency']],
    ['capsule', ['膠囊', 'capsule', 'answer-native', '預編譯']],
    ['rag', ['rag', '回退', '上下文', 'chunk', '大模型']],
    ['confidence', ['置信度', 'confidence', '門控', '閾值']],
    ['hybrid-search', ['稀疏', 'lexical', 'semantic', 'entity', '召回', '向量']],
    ['product', ['產品', '場景', '客服', 'faq', '策略']],
    ['benchmark', ['指標', '基準', 'tokens', 'rate', 'accuracy']],
  ]
  const lower = sentence.toLowerCase()
  return map.filter(([, keys]) => keys.some((key) => lower.includes(key.toLowerCase()))).map(([tag]) => tag)
}

export function canonicalQuestion(sentence = '', title = '') {
  const s = sentence.toLowerCase()
  if (s.includes('是什麼') || s.includes('是一種') || s.includes('is a')) return `${title} 是什麼？`
  if (s.includes('包括') || s.includes('組成')) return `${title} 由什麼組成？`
  if (s.includes('適合') || s.includes('不適合')) return `${title} 適合什麼場景？`
  if (s.includes('置信度') || s.includes('confidence')) return '系統如何判斷是否直接返回答案？'
  if (s.includes('延遲') || s.includes('latency')) return '系統為什麼比傳統 RAG 更快？'
  if (s.includes('回退') || s.includes('fallback')) return '什麼時候需要回退到傳統 RAG？'
  if (s.includes('指標') || s.includes('rate') || s.includes('accuracy')) return '上線後應該看哪些指標？'
  return `關於「${title}」有什麼關鍵事實？`
}

export function buildCapsules(docs) {
  const capsules = []
  docs.forEach((doc) => {
    const sentences = splitSentences(doc.body)
    sentences.forEach((sentence, index) => {
      const entities = extractEntities(sentence)
      const symbols = inferSymbols(sentence)
      const question = canonicalQuestion(sentence, doc.title)
      const tokens = tokenize(`${question} ${sentence} ${entities.join(' ')} ${symbols.join(' ')}`)
      capsules.push({
        id: uid('cap'),
        docId: doc.id,
        docTitle: doc.title,
        source: doc.source,
        updatedAt: doc.updatedAt,
        canonicalQuestion: question,
        answer: sentence.replace(/[。.!?！？]$/, '。'),
        evidence: sentence,
        entities,
        symbols,
        tokens,
        sourceReliability: 0.82 + Math.min(0.12, Math.max(0, doc.body.length / 6000)),
        baseConfidence: 0.62 + Math.min(0.16, entities.length * 0.012 + symbols.length * 0.02),
        sentenceIndex: index + 1,
      })
    })
  })
  return capsules
}

function jaccard(a, b) {
  const setA = new Set(a)
  const setB = new Set(b)
  const intersection = [...setA].filter((x) => setB.has(x)).length
  const union = new Set([...a, ...b]).size || 1
  return intersection / union
}

function containment(queryTokens, targetTokens) {
  const target = new Set(targetTokens)
  if (!queryTokens.length) return 0
  const hit = queryTokens.filter((x) => target.has(x)).length
  return hit / queryTokens.length
}

function entityOverlap(query, entities) {
  const normalized = normalizeText(query)
  const hits = entities.filter((entity) => normalized.includes(normalizeText(entity))).length
  return entities.length ? Math.min(1, hits / Math.min(3, entities.length)) : 0
}

function daysSince(dateLike) {
  const ms = Date.now() - new Date(dateLike).getTime()
  if (Number.isNaN(ms)) return 365
  return Math.max(0, ms / 86400000)
}

function freshnessScore(updatedAt) {
  const days = daysSince(updatedAt)
  if (days < 30) return 1
  if (days < 180) return 0.84
  if (days < 365) return 0.68
  return 0.52
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

export function searchCapsules(query, capsules, options = {}) {
  const t0 = performance.now()
  const topK = options.topK ?? 5
  const threshold = options.threshold ?? 0.72
  const queryTokens = tokenize(query)

  const scored = capsules
    .map((cap) => {
      const lexical = containment(queryTokens, cap.tokens)
      const semanticLite = jaccard(queryTokens, cap.tokens)
      const entity = entityOverlap(query, cap.entities)
      const freshness = freshnessScore(cap.updatedAt)
      const source = cap.sourceReliability
      const base = cap.baseConfidence

      const score = clamp(
        lexical * 0.32 + semanticLite * 0.22 + entity * 0.16 + freshness * 0.08 + source * 0.1 + base * 0.12,
      )

      return {
        ...cap,
        score,
        diagnostics: {
          lexical,
          semanticLite,
          entity,
          freshness,
          source,
          base,
        },
      }
    })
    .filter((cap) => cap.score > 0.16)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)

  const best = scored[0] || null
  const confidence = best ? best.score : 0
  const verdict = confidence >= threshold ? 'direct-hit' : confidence >= 0.52 ? 'review-needed' : 'fallback-rag'

  const actualMs = performance.now() - t0
  const reflexLatencyMs = Math.max(12, Math.round(actualMs + 8 + scored.length * 1.8))
  const tokensRead = verdict === 'direct-hit' ? 0 : Math.round(scored.reduce((sum, cap) => sum + cap.answer.length, 0) / 1.7)

  return {
    query,
    results: scored,
    best,
    confidence,
    verdict,
    reflexLatencyMs,
    actualMs,
    tokensRead,
    steps: [
      { label: 'Query normalize', value: `${queryTokens.length} tokens`, status: 'done' },
      { label: 'Hybrid capsule recall', value: `${scored.length} candidates`, status: scored.length ? 'done' : 'empty' },
      { label: 'Score fusion', value: best ? `${Math.round(best.score * 100)}% confidence` : '0% confidence', status: best ? 'done' : 'empty' },
      { label: 'Confidence gate', value: verdict, status: verdict === 'fallback-rag' ? 'warn' : 'done' },
    ],
  }
}

export function simulateRag(query, docs) {
  const qTokens = tokenize(query)
  const docTokens = docs.flatMap((doc) => tokenize(doc.body))
  const estimatedContextTokens = Math.max(420, Math.round(docTokens.length * 1.65))
  const embeddingMs = 90 + qTokens.length * 3
  const vectorMs = 70 + docs.length * 12
  const rerankMs = 120 + docs.length * 25
  const packMs = 45 + Math.round(estimatedContextTokens / 80)
  const llmReadMs = 680 + Math.round(estimatedContextTokens * 0.8)
  const generationMs = 520 + Math.min(900, qTokens.length * 24)
  const total = embeddingMs + vectorMs + rerankMs + packMs + llmReadMs + generationMs

  return {
    latencyMs: total,
    tokensRead: estimatedContextTokens,
    stages: [
      ['query embedding', embeddingMs],
      ['vector search', vectorMs],
      ['rerank', rerankMs],
      ['context packing', packMs],
      ['LLM reads context', llmReadMs],
      ['answer generation', generationMs],
    ],
  }
}

export function summarizeCapsules(capsules) {
  const bySymbol = capsules.reduce((acc, cap) => {
    cap.symbols.forEach((symbol) => {
      acc[symbol] = (acc[symbol] || 0) + 1
    })
    return acc
  }, {})

  return {
    count: capsules.length,
    symbols: Object.entries(bySymbol)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8),
    avgConfidence: capsules.length
      ? capsules.reduce((sum, cap) => sum + cap.baseConfidence, 0) / capsules.length
      : 0,
  }
}
