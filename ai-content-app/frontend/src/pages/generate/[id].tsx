import Head from 'next/head'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import { generateConcept, generateVideos } from '@/lib/api'
import { characters } from '@/lib/characters'
import {
  getTelegramUserId,
  hapticImpact,
  hapticSelection,
  hapticSuccess,
} from '@/lib/telegram'

type Stage = 'setup' | 'prompts' | 'submitting' | 'done'

interface PromptCard {
  scene: string
  pose: string
}

function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3">
      <div className="w-9 h-9 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
      <p className="text-sm text-gray-400">GPT генерирует промты...</p>
    </div>
  )
}

export default function GeneratePage() {
  const router = useRouter()
  const { id } = router.query

  const character = characters.find((c) => c.id === Number(id))

  const [format, setFormat] = useState<'single' | 'series'>('single')
  const [videoCount, setVideoCount] = useState<number>(2)
  const [customCountInput, setCustomCountInput] = useState<string>('')
  const [stage, setStage] = useState<Stage>('setup')
  const [prompts, setPrompts] = useState<PromptCard[]>([])
  const [loadingConcept, setLoadingConcept] = useState(false)
  const [jobId, setJobId] = useState('')
  const [estimateUsd, setEstimateUsd] = useState<number | null>(null)
  const chatIdRef = useRef<string | null>(null)

  useEffect(() => {
    chatIdRef.current = getTelegramUserId()
  }, [])

  if (!character) return null

  async function handleGeneratePrompts() {
    hapticSelection()
    setLoadingConcept(true)
    try {
      const data = await generateConcept(character!.id, format, videoCount)
      setPrompts(data.prompts)
      setStage('prompts')
      hapticSuccess()
    } catch {
      alert('Ошибка генерации промтов')
    } finally {
      setLoadingConcept(false)
    }
  }

  async function handleSubmit() {
    hapticImpact('medium')
    setStage('submitting')
    try {
      const data = await generateVideos(
        character!.id,
        format,
        videoCount,
        prompts,
        chatIdRef.current,
      )
      setJobId(data.job_id)
      setEstimateUsd(data.estimated_cost_usd)
      setStage('done')
      hapticSuccess()
    } catch {
      alert('Ошибка отправки задачи')
      setStage('prompts')
    }
  }

  function updatePrompt(index: number, field: 'scene' | 'pose', value: string) {
    setPrompts((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)))
  }

  const stageIndex = { setup: 0, prompts: 1, submitting: 2, done: 2 }[stage]

  return (
    <>
      <Head>
        <title>Генерация — {character.name}</title>
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
              <h1 className="text-lg font-bold text-white">Генерация видео</h1>
              <p className="text-xs text-gray-500">{character.name}</p>
            </div>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2 mb-4">
            {[0, 1, 2].map((s) => (
              <span
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                  s <= stageIndex ? 'bg-purple-500' : 'bg-white/10'
                }`}
              />
            ))}
          </div>

          {/* Character hero */}
          <div className="bg-surface border border-border rounded-2xl overflow-hidden mb-5">
            <div className={`h-1 w-full bg-gradient-to-r ${character.color}`} />
            <div className="p-4 flex items-center gap-4">
              <div className="relative w-12 h-12 rounded-full overflow-hidden ring-2 ring-border shrink-0">
                <Image src={character.avatarUrl} alt={character.name} fill className="object-cover" unoptimized />
              </div>
              <div>
                <p className="font-bold text-white text-sm">{character.name}</p>
                <p className="text-xs text-gray-400">{character.niche}</p>
              </div>
            </div>
          </div>

          {/* === STAGE: setup === */}
          {stage === 'setup' && (
            <div className="flex flex-col gap-5">
              <div>
                <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wide">Формат</p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: 'single', label: '1 видео', icon: '🎬' },
                    { value: 'series', label: 'Серия', icon: '🎞️' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { hapticSelection(); setFormat(opt.value) }}
                      className={`py-3 rounded-xl border font-semibold text-sm transition-all
                        ${format === opt.value
                          ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                          : 'border-border bg-surface text-gray-400'}`}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wide">
                  Количество видео
                </p>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[1, 2, 5, 10].map((count) => (
                    <button
                      key={count}
                      onClick={() => { hapticSelection(); setVideoCount(count); setCustomCountInput('') }}
                      className={`py-3 rounded-xl border font-semibold text-sm transition-all
                        ${videoCount === count && !customCountInput
                          ? 'border-purple-500 bg-purple-500/10 text-purple-300'
                          : 'border-border bg-surface text-gray-400'}`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={customCountInput}
                  onChange={(e) => {
                    const next = e.target.value.replace(/[^0-9]/g, '')
                    setCustomCountInput(next)
                    const parsed = Number(next)
                    if (parsed >= 1 && parsed <= 20) setVideoCount(parsed)
                  }}
                  placeholder="Своё число (1–20)"
                  className="w-full py-3 px-3 rounded-xl bg-surface border border-border text-sm text-white focus:outline-none focus:border-purple-500"
                />
                <p className="text-xs mt-1.5 text-gray-500">
                  Будет сгенерировано промтов: <span className="text-white font-semibold">{videoCount}</span>
                </p>
              </div>

              {loadingConcept && <Spinner />}
            </div>
          )}

          {/* === STAGE: prompts === */}
          {stage === 'prompts' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-white">
                  {prompts.length} промтов от GPT
                </p>
                <button
                  onClick={() => { hapticSelection(); setStage('setup') }}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  ← Назад
                </button>
              </div>

              <p className="text-xs text-gray-500 -mt-2">
                Каждое поле можно отредактировать перед запуском
              </p>

              {prompts.map((p, i) => (
                <div key={i} className="bg-surface border border-border rounded-2xl overflow-hidden">
                  <div className={`h-0.5 w-full bg-gradient-to-r ${character.color}`} />
                  <div className="p-4 flex flex-col gap-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      Видео {i + 1}
                    </p>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">📝 Сцена</label>
                      <textarea
                        value={p.scene}
                        onChange={(e) => updatePrompt(i, 'scene', e.target.value)}
                        rows={3}
                        className="w-full bg-black/30 border border-border rounded-xl p-3 text-white text-sm
                          resize-none focus:outline-none focus:border-purple-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">🧍 Поза / движение</label>
                      <input
                        value={p.pose}
                        onChange={(e) => updatePrompt(i, 'pose', e.target.value)}
                        className="w-full bg-black/30 border border-border rounded-xl px-3 py-2.5 text-white text-sm
                          focus:outline-none focus:border-purple-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* === STAGE: submitting === */}
          {stage === 'submitting' && (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="w-12 h-12 rounded-full border-2 border-purple-600 border-t-transparent animate-spin" />
              <p className="text-gray-400 text-sm">Отправляю задачу...</p>
            </div>
          )}

          {/* === STAGE: done === */}
          {stage === 'done' && (
            <div className="bg-surface border border-border rounded-2xl p-6 text-center">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-xl font-bold text-white mb-2">Задача принята!</h2>
              <p className="text-gray-400 text-sm mb-1">
                Видео генерируются прямо сейчас.
              </p>
              <p className="text-gray-500 text-sm mb-4">
                Бот пришлёт уведомление когда будет готово 🤖
              </p>
              {estimateUsd !== null && (
                <p className="text-xs text-emerald-400 mb-2">
                  Оценка стоимости: ~${estimateUsd.toFixed(2)}
                </p>
              )}
              {jobId && (
                <p className="text-xs text-gray-600 font-mono bg-black/40 rounded-lg p-2 mb-4 break-all">
                  Job: {jobId}
                </p>
              )}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => { hapticSelection(); router.push('/jobs') }}
                  className="w-full py-3 rounded-xl border border-sky-500/40 bg-sky-500/10 text-sky-300 transition-colors text-sm font-semibold"
                >
                  📋 История задач
                </button>
                <button
                  onClick={() => { hapticSelection(); router.push('/') }}
                  className="w-full py-3 rounded-xl border border-border text-gray-400 hover:border-purple-500 hover:text-purple-400 transition-colors text-sm font-medium"
                >
                  На главную
                </button>
              </div>
            </div>
          )}
        </div>

        {stage === 'setup' && !loadingConcept && (
          <div className="tg-sticky-cta">
            <div className="max-w-md mx-auto w-full">
              <button
                onClick={handleGeneratePrompts}
                className="w-full py-4 rounded-2xl font-bold text-base transition-all duration-150 active:scale-[0.99]"
                style={{ background: 'var(--tg-button)', color: 'var(--tg-button-text)' }}
              >
                ✨ Сгенерировать промты
              </button>
            </div>
          </div>
        )}

        {stage === 'prompts' && (
          <div className="tg-sticky-cta">
            <div className="max-w-md mx-auto w-full">
              <button
                onClick={handleSubmit}
                className="w-full py-4 rounded-2xl font-bold text-base transition-all duration-150 active:scale-[0.99]
                  bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-900/30"
              >
                🚀 Запустить генерацию
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  )
}

