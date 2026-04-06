import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { getJob, listJobs } from '@/lib/api'
import { getTelegramUserId, hapticSelection } from '@/lib/telegram'

type JobItem = {
  id: string
  status: 'pending' | 'processing' | 'done' | 'error'
  requested_video_count: number
  actual_video_count: number | null
  estimated_cost_usd: number
  actual_cost_usd: number | null
  result: { videos: string[]; video_count: number; cost_usd: number } | null
  created_at: string
}

function StatusBadge({ status }: { status: JobItem['status'] }) {
  const cfg = {
    pending: { label: 'В очереди', cls: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30' },
    processing: { label: 'Генерация...', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
    done: { label: 'Готово ✓', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
    error: { label: 'Ошибка', cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
  }
  const { label, cls } = cfg[status] ?? cfg.error
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cls}`}>
      {label}
    </span>
  )
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function JobsPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<JobItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [pollingId, setPollingId] = useState<string | null>(null)

  async function load() {
    try {
      const chatId = getTelegramUserId()
      const data = await listJobs(chatId)
      setJobs(data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  // Poll active job until done/error
  useEffect(() => {
    const active = jobs.find((j) => j.status === 'pending' || j.status === 'processing')
    if (!active) {
      setPollingId(null)
      return
    }
    if (pollingId === active.id) return
    setPollingId(active.id)

    const timer = setInterval(async () => {
      try {
        const updated = await getJob(active.id)
        setJobs((prev) => prev.map((j) => (j.id === updated.id ? { ...j, ...updated } : j)))
        if (updated.status === 'done' || updated.status === 'error') {
          clearInterval(timer)
          setPollingId(null)
        }
      } catch {
        clearInterval(timer)
      }
    }, 4000)

    return () => clearInterval(timer)
  }, [jobs, pollingId])

  const toggleExpand = (id: string) => {
    hapticSelection()
    setExpanded((prev) => (prev === id ? null : id))
  }

  return (
    <>
      <Head>
        <title>История задач</title>
      </Head>

      <main className="tg-shell text-white">
        <div className="tg-content max-w-md mx-auto w-full px-4 py-4">
          {/* Header */}
          <div className="flex items-center gap-3 mb-5 sticky top-0 z-20 py-2 bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm">
            <button
              onClick={() => router.back()}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-surface border border-border text-gray-400 hover:text-white transition-colors"
            >
              ←
            </button>
            <div>
              <h1 className="text-lg font-bold text-white">История задач</h1>
              <p className="text-xs" style={{ color: 'var(--tg-hint)' }}>
                Все запуски генерации
              </p>
            </div>
            <button
              onClick={() => { load() }}
              className="ml-auto w-9 h-9 flex items-center justify-center rounded-full bg-surface border border-border text-gray-400 hover:text-white transition-colors text-base"
              title="Обновить"
            >
              ↻
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
            </div>
          )}

          {!loading && jobs.length === 0 && (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">📭</div>
              <p className="text-gray-400 text-sm">Нет задач</p>
              <p className="text-gray-600 text-xs mt-1">Запусти первую генерацию</p>
              <button
                onClick={() => router.push('/characters')}
                className="mt-6 px-6 py-3 rounded-2xl bg-sky-600 text-white text-sm font-semibold"
              >
                Перейти к генерации
              </button>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="bg-surface border border-border rounded-2xl overflow-hidden"
              >
                <button
                  onClick={() => toggleExpand(job.id)}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <StatusBadge status={job.status} />
                        <span className="text-xs text-gray-500">{formatDate(job.created_at)}</span>
                      </div>
                      <p className="text-white font-semibold text-sm">
                        {job.actual_video_count ?? job.requested_video_count} видео
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        ~${(job.actual_cost_usd ?? job.estimated_cost_usd ?? 0).toFixed(2)}
                      </p>
                    </div>
                    <span className="text-gray-500 text-sm shrink-0 mt-1">
                      {expanded === job.id ? '▲' : '▼'}
                    </span>
                  </div>
                </button>

                {expanded === job.id && (
                  <div className="border-t border-border px-4 pb-4">
                    {(job.status === 'pending' || job.status === 'processing') && (
                      <div className="flex items-center gap-2 py-4">
                        <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin shrink-0" />
                        <p className="text-sm text-gray-400">Генерируем видео, ожидайте...</p>
                      </div>
                    )}

                    {job.status === 'error' && (
                      <p className="text-sm text-red-400 py-4">Произошла ошибка при генерации.</p>
                    )}

                    {job.status === 'done' && job.result && (
                      <div className="pt-3 flex flex-col gap-2">
                        {job.result.videos.map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 rounded-xl bg-black/30 border border-border hover:border-sky-500 transition-colors"
                          >
                            <span className="text-xl shrink-0">🎬</span>
                            <span className="text-sm text-sky-400 truncate">Видео {i + 1}</span>
                            <span className="ml-auto text-gray-500 text-xs shrink-0">↗</span>
                          </a>
                        ))}
                        <p className="text-xs text-gray-600 font-mono mt-2 break-all">
                          ID: {job.id}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  )
}
