export const SAMPLE_DOCS = [
  {
    id: 'doc-product-001',
    title: 'Reflex Index 產品說明',
    source: 'product/spec.md',
    updatedAt: '2026-05-09',
    body: `Reflex Index 是一種 answer-native retrieval 系統。它不在查詢時讓大模型閱讀長文檔，而是在離線階段把文檔預編譯為答案膠囊。
答案膠囊包含 canonical question、短答案、證據句、實體、主題符號、來源和置信度。
在線階段，系統先執行查詢歸一化，再並行使用稀疏匹配和小向量召回候選膠囊，隨後通過置信度門控決定是否直接返回答案。
當置信度低於閾值時，系統才回退到傳統 RAG 流程，讀取原始上下文並調用大模型生成答案。
Reflex Index 的目標是把多數知識問答的運行時延遲從秒級降低到幾十毫秒級，同時保留來源引用。`,
  },
  {
    id: 'doc-tech-002',
    title: '膠囊索引技術路線',
    source: 'architecture/capsule-index.md',
    updatedAt: '2026-05-09',
    body: `膠囊索引由離線構建器、混合召回器、置信度門控器和回退生成器組成。
離線構建器會從文檔中抽取原子事實，並為每個事實生成可檢索的問題表達。
混合召回器同時使用 lexical score、semantic-lite score 和 entity overlap score。
semantic-lite score 在瀏覽器原型中由字符 n-gram 和 token overlap 近似，生產環境可以替換為 Matryoshka embedding 或 ColBERT-lite。
置信度門控器綜合 lexical、semantic、entity、freshness 和 source reliability，得出最終 confidence。
如果 confidence 大於 0.72，系統直接返回膠囊答案；如果介於 0.52 和 0.72，系統返回候選答案並標記為需要複核；如果低於 0.52，系統回退到 RAG。`,
  },
  {
    id: 'doc-benchmark-003',
    title: '延遲基準假設',
    source: 'benchmarks/latency-notes.md',
    updatedAt: '2026-05-09',
    body: `傳統 RAG 的典型鏈路包括 query embedding、向量檢索、rerank、chunk fetch、context packing、LLM 閱讀上下文和生成答案。
Reflex Index 的典型鏈路包括 query normalize、capsule recall、score fusion、confidence gate 和 answer return。
在瀏覽器 demo 中，傳統 RAG 延遲使用模擬值，因為實際延遲取決於模型、向量庫、網絡和上下文長度。
Reflex Index 的延遲使用本地實際執行時間加上輕量渲染開銷估算。
系統展示 tokens read 指標，用來強調 Reflex Index 通常不需要讓模型讀取大量原文 token。`,
  },
  {
    id: 'doc-usecase-004',
    title: '適用場景和限制',
    source: 'strategy/use-cases.md',
    updatedAt: '2026-05-09',
    body: `Reflex Index 適合穩定知識庫、客服知識庫、產品文檔、政策手冊、內部 FAQ 和高頻企業問答。
它不適合高度開放的研究問題、需要複雜綜合推理的問題、實時變化極快的信息源，或者必須逐字閱讀完整上下文的任務。
為了避免錯誤命中，系統必須保留 source citation，並在低置信度時回退到 RAG。
一個好的產品策略是把 Reflex Index 作為 RAG 之前的高速層，而不是完全替代 RAG。
上線指標應該關注 p50 latency、p95 latency、direct-hit rate、fallback rate、citation accuracy 和 answer acceptance rate。`,
  },
]

export const EXAMPLE_QUERIES = [
  'Reflex Index 為什麼比 RAG 快？',
  '答案膠囊裡面有什麼？',
  '什麼時候需要回退到傳統 RAG？',
  '這個系統適合哪些場景？',
  '上線後應該看哪些指標？',
]
