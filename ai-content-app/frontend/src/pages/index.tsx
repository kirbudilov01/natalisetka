import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { getBalance, getStats } from '@/lib/api'
import { hapticImpact } from '@/lib/telegram'

interface Stats {
  total_videos: number
  tokens_gpt: number
  tokens_sd: number
  days_until_payment: number
  total_cost_usd?: number
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: string
  label: string
  value: string | number
}) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-4 flex flex-col gap-1">
      <span className="text-2xl">{icon}</span>
      <span className="text-xl font-bold text-white">{value}</span>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  )
}

export default function Dashboard() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats>({
    total_videos: 0,
    tokens_gpt: 0,
    tokens_sd: 0,
    days_until_payment: 14,
    total_cost_usd: 0,
  })
  const [balance, setBalance] = useState<{ usd_remaining: number; label: string } | null>(null)

  useEffect(() => {
    getStats().then(setStats).catch(() => {})
    getBalance().then(setBalance).catch(() => {})
  }, [])

  return (
    <>
      <Head>
        <title>AI Content Generator</title>
      </Head>

      <main className="tg-shell text-white flex flex-col">
        <div className="tg-content max-w-md mx-auto w-full px-4 py-4 flex flex-col flex-1">
          {/* Header */}
          <div className="mb-6">
            <span className="text-[11px] uppercase tracking-[0.2em] text-sky-300/80">
              AI Video Suite
            </span>
            <h1 className="text-[28px] leading-tight font-black mt-1 bg-gradient-to-r from-sky-300 to-blue-500 bg-clip-text text-transparent">
              AI Content Generator
            </h1>
            <p className="text-sm mt-2" style={{ color: 'var(--tg-hint)' }}>
              Все метрики в одном месте
            </p>
          </div>

          <div className="rounded-2xl p-4 border border-white/10 mb-4 bg-black/20">
            <p className="text-sm text-white/80">Статус сервиса</p>
            <p className="text-xl font-semibold mt-1">Система активна, генерация доступна</p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <StatCard icon="🎬" label="Видео сделано" value={stats.total_videos} />
            <StatCard
              icon="🧠"
              label="Токены GPT"
              value={stats.tokens_gpt.toLocaleString('ru-RU')}
            />
            <StatCard icon="🎨" label="Кредиты SD" value={stats.tokens_sd} />
            <StatCard
              icon="📅"
              label="До оплаты сервера"
              value={`${stats.days_until_payment} дн.`}
            />
            <StatCard
              icon="💸"
              label="Потрачено (USD)"
              value={`$${(stats.total_cost_usd ?? 0).toFixed(2)}`}
            />
            <StatCard
              icon="💰"
              label="Остаток баланса"
              value={
                balance
                  ? balance.usd_remaining > 0
                    ? `$${balance.usd_remaining.toFixed(2)}`
                    : balance.label
                  : '—'
              }
            />
          </div>

        </div>

        <div className="tg-sticky-cta">
          <div className="max-w-md mx-auto w-full grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                hapticImpact('light')
                router.push('/accesses')
              }}
              className="w-full py-4 rounded-2xl font-semibold text-sm tracking-wide transition-all duration-150 active:scale-[0.99] border border-white/20 bg-white/10 text-white"
            >
              Доступы
            </button>
            <button
              onClick={() => {
                hapticImpact('light')
                router.push('/jobs')
              }}
              className="w-full py-4 rounded-2xl font-semibold text-sm tracking-wide transition-all duration-150 active:scale-[0.99] border border-white/20 bg-white/10 text-white"
            >
              История
            </button>
            <button
              onClick={() => {
                hapticImpact('medium')
                router.push('/characters')
              }}
              className="col-span-2 w-full py-4 rounded-2xl font-bold text-sm tracking-wide transition-all duration-150 active:scale-[0.99]"
              style={{
                background: 'var(--tg-button)',
                color: 'var(--tg-button-text)',
                boxShadow: '0 14px 28px rgba(0, 0, 0, 0.28)',
              }}
            >
              Генерация
            </button>
          </div>
        </div>
      </main>
    </>
  )
}
