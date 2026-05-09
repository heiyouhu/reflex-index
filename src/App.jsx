import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain,
  Check,
  ChevronRight,
  Copy,
  Database,
  FileText,
  Gauge,
  Layers,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Timer,
  Zap,
} from 'lucide-react'
import { EXAMPLE_QUERIES, SAMPLE_DOCS } from './data/sampleDocs'
import {
  buildCapsules,
  safeJsonParse,
  searchCapsules,
  simulateRag,
  summarizeCapsules,
  uid,
} from './lib/reflexEngine'

const STORAGE_KEYS = {
  docs: 'reflex_index_docs_v1',
  capsules: 'reflex_index_capsules_v1',
  queries: 'reflex_index_queries_v1',
}

const verdictMap = {
  'direct-hit': {
    label: 'Direct Hit',
    tone: 'text-emerald-300 bg-emerald-400/10 border-emerald-300/20',
    description: '置信度足夠，直接返回答案膠囊，不調用 LLM。',
  },
  'review-needed': {
    label: 'Review Needed',
    tone: 'text-amber-300 bg-amber-400/10 border-amber-300/20',
    description: '有候選答案，但建議人工或輕量 LLM 複核。',
  },
  'fallback-rag': {
    label: 'Fallback RAG',
    tone: 'text-rose-300 bg-rose-400/10 border-rose-300/20',
    description: '置信度不足，應回退到傳統 RAG 讀取原文。',
  },
}

function formatMs(value) {
  if (!Number.isFinite(value)) return '—'
  return `${Math.round(value).toLocaleString()} ms`
}

function percent(value) {
  return `${Math.round((value || 0) * 100)}%`
}

function loadState() {
  const docs = safeJsonParse(localStorage.getItem(STORAGE_KEYS.docs), SAMPLE_DOCS)
  const capsules = safeJsonParse(localStorage.getItem(STORAGE_KEYS.capsules), [])
  const queries = safeJsonParse(localStorage.getItem(STORAGE_KEYS.queries), [])
  return { docs, capsules, queries }
}

function MetricCard({ icon: Icon, label, value, helper }) {
  return (
    <div className="glass-panel rounded-2xl p-4">
      <div className="mb-3 flex items-center gap-2 text-slate-400">
        <Icon className="h-4 w-4" />
        <span className="text-xs uppercase tracking-[0.22em]">{label}</span>
      </div>
      <div className="text-2xl font-semibold text-white">{value}</div>
      {helper ? <div className="mt-1 text-sm text-slate-400">{helper}</div> : null}
    </div>
  )
}

function PipelineStep({ step, index }) {
  const tone =
    step.status === 'warn'
      ? 'border-amber-300/30 bg-amber-300/10 text-amber-200'
      : step.status === 'empty'
        ? 'border-slate-500/30 bg-slate-700/20 text-slate-300'
        : 'border-sky-300/30 bg-sky-300/10 text-sky-200'

  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-xs font-bold">{index + 1}</div>
          <div>
            <div className="font-medium">{step.label}</div>
            <div className="text-xs opacity-80">{step.value}</div>
          </div>
        </div>
        {index < 3 ? <ChevronRight className="h-4 w-4 opacity-70" /> : null}
      </div>
    </div>
  )
}

function ScoreBar({ label, value }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-slate-400">
        <span>{label}</span>
        <span>{percent(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-sky-300" style={{ width: `${Math.round((value || 0) * 100)}%` }} />
      </div>
    </div>
  )
}

function CapsuleCard({ capsule, rank }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay: rank * 0.04 }}
      className="rounded-3xl border border-sky-200/15 bg-slate-950/55 p-5 shadow-capsule"
    >
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1 text-xs text-sky-200">
            <Sparkles className="h-3.5 w-3.5" />
            Capsule #{rank + 1} · {percent(capsule.score)}
          </div>
          <h3 className="text-lg font-semibold text-white">{capsule.canonicalQuestion}</h3>
        </div>
        <div className="rounded-2xl bg-white/5 px-3 py-2 text-right text-xs text-slate-400">
          <div>{capsule.docTitle}</div>
          <div>{capsule.source}</div>
        </div>
      </div>

      <p className="leading-7 text-slate-200">{capsule.answer}</p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <ScoreBar label="Lexical" value={capsule.diagnostics.lexical} />
        <ScoreBar label="Semantic-lite" value={capsule.diagnostics.semanticLite} />
        <ScoreBar label="Entity overlap" value={capsule.diagnostics.entity} />
        <ScoreBar label="Source reliability" value={capsule.diagnostics.source} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {capsule.entities.slice(0, 8).map((entity) => (
          <span key={entity} className="rounded-full border border-slate-500/20 bg-slate-800/60 px-2.5 py-1 text-xs text-slate-300">
            {entity}
          </span>
        ))}
        {capsule.symbols.map((symbol) => (
          <span key={symbol} className="rounded-full border border-violet-300/20 bg-violet-300/10 px-2.5 py-1 text-xs text-violet-200">
            {symbol}
          </span>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-slate-700/70 bg-slate-900/70 p-3 text-sm text-slate-400">
        <span className="text-slate-300">Evidence:</span> {capsule.evidence}
      </div>
    </motion.div>
  )
}

function DocEditor({ docs, setDocs, rebuild }) {
  const [draft, setDraft] = useState('')
  const [title, setTitle] = useState('')

  const addDoc = () => {
    if (!draft.trim()) return
    const next = [
      ...docs,
      {
        id: uid('doc'),
        title: title.trim() || `自定義文檔 ${docs.length + 1}`,
        source: `local/doc-${docs.length + 1}.md`,
        updatedAt: new Date().toISOString().slice(0, 10),
        body: draft.trim(),
      },
    ]
    setDocs(next)
    setDraft('')
    setTitle('')
    rebuild(next)
  }

  return (
    <div className="glass-panel rounded-3xl p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Knowledge Sources</h2>
          <p className="text-sm text-slate-400">粘貼文檔，瀏覽器會離線構建答案膠囊。</p>
        </div>
        <button
          onClick={() => rebuild(docs)}
          className="inline-flex items-center gap-2 rounded-2xl border border-sky-300/20 bg-sky-300/10 px-4 py-2 text-sm text-sky-200 hover:bg-sky-300/15"
        >
          <RefreshCw className="h-4 w-4" />
          Rebuild
        </button>
      </div>

      <div className="mb-4 max-h-56 space-y-3 overflow-auto pr-1">
        {docs.map((doc) => (
          <div key={doc.id} className="rounded-2xl border border-slate-700/70 bg-slate-950/50 p-3">
            <div className="mb-1 flex items-center gap-2 text-sm font-medium text-white">
              <FileText className="h-4 w-4 text-slate-400" />
              {doc.title}
            </div>
            <div className="text-xs text-slate-500">{doc.source} · {doc.updatedAt}</div>
          </div>
        ))}
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="新文檔標題"
        className="mb-3 w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500"
      />
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="粘貼一段產品文檔、FAQ 或內部政策……"
        className="h-32 w-full resize-none rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm leading-6 text-white placeholder:text-slate-500"
      />
      <button
        onClick={addDoc}
        className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-sky-100"
      >
        Add document and compile capsules
      </button>
    </div>
  )
}

export default function App() {
  const initial = useMemo(() => loadState(), [])
  const [docs, setDocs] = useState(initial.docs)
  const [capsules, setCapsules] = useState(initial.capsules.length ? initial.capsules : buildCapsules(initial.docs))
  const [query, setQuery] = useState(EXAMPLE_QUERIES[0])
  const [result, setResult] = useState(null)
  const [rag, setRag] = useState(null)
  const [queries, setQueries] = useState(initial.queries)
  const [copied, setCopied] = useState(false)

  const summary = useMemo(() => summarizeCapsules(capsules), [capsules])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.docs, JSON.stringify(docs))
  }, [docs])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.capsules, JSON.stringify(capsules))
  }, [capsules])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.queries, JSON.stringify(queries))
  }, [queries])

  useEffect(() => {
    runSearch(EXAMPLE_QUERIES[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rebuild = (nextDocs = docs) => {
    const next = buildCapsules(nextDocs)
    setCapsules(next)
    if (query.trim()) runSearch(query, next)
  }

  const runSearch = (value = query, capsuleSet = capsules) => {
    const trimmed = value.trim()
    if (!trimmed) return
    const nextResult = searchCapsules(trimmed, capsuleSet)
    const ragResult = simulateRag(trimmed, docs)
    setQuery(trimmed)
    setResult(nextResult)
    setRag(ragResult)
    setQueries((prev) => [trimmed, ...prev.filter((item) => item !== trimmed)].slice(0, 8))
  }

  const resetDemo = () => {
    setDocs(SAMPLE_DOCS)
    const next = buildCapsules(SAMPLE_DOCS)
    setCapsules(next)
    setQueries([])
    runSearch(EXAMPLE_QUERIES[0], next)
  }

  const copyGitCommands = async () => {
    const commands = `npm install\nnpm run dev\n\ngit init\ngit add .\ngit commit -m "Initial Reflex Index prototype"\ngit branch -M main\ngh repo create reflex-index --public --source=. --remote=origin --push`
    await navigator.clipboard.writeText(commands)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const verdict = result ? verdictMap[result.verdict] : null
  const speedup = result && rag ? Math.max(1, Math.round(rag.latencyMs / result.reflexLatencyMs)) : 0

  return (
    <main className="min-h-screen px-4 py-8 text-slate-100 md:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-300/10 px-4 py-2 text-sm text-sky-200">
              <Zap className="h-4 w-4" />
              Reflex Index · Answer Capsule Retrieval
            </div>
            <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
              比 RAG 更快的 <span className="text-sky-300">預編譯答案檢索層</span>
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300 md:text-lg">
              這個原型把文檔離線編譯成答案膠囊。查詢時先命中膠囊，置信度足夠就直接返回答案和證據；不足時再回退到傳統 RAG。
            </p>
          </div>
          <div className="glass-panel rounded-3xl p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
              <Layers className="h-4 w-4 text-sky-300" />
              GitHub Ready
            </div>
            <p className="mb-4 text-sm leading-6 text-slate-400">
              專案已按 Vite + React + Tailwind 結構組織。README 內含本地啟動、提交 GitHub 和部署建議。
            </p>
            <button
              onClick={copyGitCommands}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-sky-100"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? '已複製 Git 命令' : '複製 GitHub 提交命令'}
            </button>
          </div>
        </header>

        <section className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard icon={Database} label="Capsules" value={summary.count} helper="已預編譯答案單元" />
          <MetricCard icon={Gauge} label="Avg Confidence" value={percent(summary.avgConfidence)} helper="基礎膠囊置信度" />
          <MetricCard icon={Timer} label="Speedup" value={speedup ? `${speedup}×` : '—'} helper="相對模擬 RAG 延遲" />
          <MetricCard icon={Brain} label="Tokens Read" value={result ? result.tokensRead.toLocaleString() : '—'} helper="Direct hit 通常為 0" />
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.4fr]">
          <div className="space-y-6">
            <div className="glass-panel rounded-3xl p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">Ask the capsule index</h2>
                  <p className="text-sm text-slate-400">輸入問題，觀察是否繞過 RAG。</p>
                </div>
                <button onClick={resetDemo} className="rounded-xl border border-slate-600 px-3 py-2 text-xs text-slate-300 hover:bg-white/5">
                  Reset
                </button>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-4 h-5 w-5 text-slate-500" />
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') runSearch()
                  }}
                  className="h-28 w-full resize-none rounded-3xl border border-slate-700 bg-slate-950/70 py-4 pl-12 pr-4 leading-7 text-white placeholder:text-slate-500"
                  placeholder="例如：Reflex Index 為什麼比 RAG 快？"
                />
              </div>

              <button
                onClick={() => runSearch()}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-300 px-4 py-3 font-semibold text-slate-950 hover:bg-sky-200"
              >
                <Zap className="h-4 w-4" />
                Search capsules
              </button>

              <div className="mt-4 flex flex-wrap gap-2">
                {EXAMPLE_QUERIES.map((item) => (
                  <button
                    key={item}
                    onClick={() => runSearch(item)}
                    className="rounded-full border border-slate-700 bg-slate-950/50 px-3 py-1.5 text-xs text-slate-300 hover:border-sky-300/40 hover:text-sky-200"
                  >
                    {item}
                  </button>
                ))}
              </div>

              {queries.length ? (
                <div className="mt-5 border-t border-slate-800 pt-4">
                  <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">Recent queries</div>
                  <div className="space-y-2">
                    {queries.slice(0, 4).map((item) => (
                      <button key={item} onClick={() => runSearch(item)} className="block text-left text-sm text-slate-400 hover:text-sky-200">
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <DocEditor docs={docs} setDocs={setDocs} rebuild={rebuild} />
          </div>

          <div className="space-y-6">
            {result && rag ? (
              <>
                <div className="glass-panel rounded-3xl p-5">
                  <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
                    <div>
                      <h2 className="text-lg font-semibold text-white">Runtime Decision</h2>
                      <p className="text-sm text-slate-400">置信度門控決定是否跳過傳統 RAG。</p>
                    </div>
                    <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${verdict.tone}`}>
                      <ShieldCheck className="h-4 w-4" />
                      {verdict.label} · {percent(result.confidence)}
                    </div>
                  </div>
                  <p className="mb-5 text-sm text-slate-400">{verdict.description}</p>

                  <div className="grid gap-3 md:grid-cols-4">
                    {result.steps.map((step, index) => (
                      <PipelineStep key={step.label} step={step} index={index} />
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl border border-emerald-300/15 bg-emerald-300/10 p-5">
                    <div className="mb-2 text-sm uppercase tracking-[0.22em] text-emerald-200">Reflex Index</div>
                    <div className="text-4xl font-semibold text-white">{formatMs(result.reflexLatencyMs)}</div>
                    <div className="mt-2 text-sm text-emerald-100/70">tokens read: {result.tokensRead.toLocaleString()}</div>
                  </div>
                  <div className="rounded-3xl border border-rose-300/15 bg-rose-300/10 p-5">
                    <div className="mb-2 text-sm uppercase tracking-[0.22em] text-rose-200">Traditional RAG</div>
                    <div className="text-4xl font-semibold text-white">{formatMs(rag.latencyMs)}</div>
                    <div className="mt-2 text-sm text-rose-100/70">tokens read: {rag.tokensRead.toLocaleString()}</div>
                  </div>
                </div>

                <div className="glass-panel capsule-grid rounded-3xl p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-sky-300" />
                    <h2 className="text-lg font-semibold text-white">Answer Capsules</h2>
                  </div>
                  <AnimatePresence mode="popLayout">
                    <div className="space-y-4">
                      {result.results.length ? (
                        result.results.map((capsule, index) => <CapsuleCard key={capsule.id} capsule={capsule} rank={index} />)
                      ) : (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-3xl border border-slate-700 bg-slate-950/60 p-8 text-center text-slate-400">
                          沒有高相關膠囊。這種情況應回退到傳統 RAG。
                        </motion.div>
                      )}
                    </div>
                  </AnimatePresence>
                </div>
              </>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  )
}
