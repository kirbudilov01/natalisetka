import Head from 'next/head'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { CharacterAPI, getCharacters, uploadTrainingImages, triggerLoraTraining } from '@/lib/api'
import { hapticImpact } from '@/lib/telegram'

const LORA_STATUS_LABEL: Record<string, string> = {
  none: 'LoRA не обучена',
  training: 'Обучение...',
  ready: 'LoRA готова ✓',
  error: 'Ошибка обучения',
}

const LORA_STATUS_COLOR: Record<string, string> = {
  none: 'text-gray-400',
  training: 'text-yellow-400',
  ready: 'text-green-400',
  error: 'text-red-400',
}

export default function Characters() {
  const router = useRouter()
  const [characters, setCharacters] = useState<CharacterAPI[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadingId, setUploadingId] = useState<number | null>(null)
  const [trainingId, setTrainingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingUploadId = useRef<number | null>(null)

  useEffect(() => {
    getCharacters()
      .then(setCharacters)
      .catch(() => setError('Не удалось загрузить персонажей'))
      .finally(() => setLoading(false))
  }, [])

  // Poll until training finishes
  useEffect(() => {
    const trainingChars = characters.filter((c) => c.lora_status === 'training')
    if (trainingChars.length === 0) return

    const timer = setInterval(async () => {
      try {
        const fresh = await getCharacters()
        setCharacters(fresh)
        if (fresh.every((c) => c.lora_status !== 'training')) {
          clearInterval(timer)
        }
      } catch {
        // ignore polling errors
      }
    }, 8000)

    return () => clearInterval(timer)
  }, [characters])

  const handleUploadClick = (charId: number) => {
    pendingUploadId.current = charId
    fileInputRef.current?.click()
  }

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const charId = pendingUploadId.current
    if (!files.length || charId === null) return

    setUploadingId(charId)
    setError(null)
    try {
      const result = await uploadTrainingImages(charId, files)
      alert(`Загружено ${result.saved} фото. Теперь запустите обучение.`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploadingId(null)
      e.target.value = ''
    }
  }

  const handleTrain = async (charId: number) => {
    setTrainingId(charId)
    setError(null)
    try {
      await triggerLoraTraining(charId)
      setCharacters((prev) =>
        prev.map((c) => (c.id === charId ? { ...c, lora_status: 'training' } : c))
      )
    } catch (err: any) {
      setError(err.message)
    } finally {
      setTrainingId(null)
    }
  }

  const firstChar = characters[0]

  return (
    <>
      <Head>
        <title>Выбор персонажа</title>
      </Head>

      {/* Hidden file input for training image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={handleFilesSelected}
      />

      <main className="tg-shell text-white">
        <div className="tg-content max-w-md mx-auto w-full px-4 py-4">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4 sticky top-0 z-20 py-2 bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm">
            <button
              onClick={() => router.back()}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-surface border border-border text-gray-400 hover:text-white transition-colors"
            >
              ←
            </button>
            <div>
              <h1 className="text-lg font-bold text-white">Персонажи</h1>
              <p className="text-xs" style={{ color: 'var(--tg-hint)' }}>Выбери героя для генерации</p>
            </div>
          </div>

          {error && (
            <div className="mb-3 px-4 py-2 rounded-xl bg-red-900/40 border border-red-700 text-sm text-red-300">
              {error}
            </div>
          )}

          {loading && (
            <p className="text-center text-gray-400 py-12">Загрузка...</p>
          )}

          {/* Character cards */}
          <div className="flex flex-col gap-4">
            {characters.map((char) => (
              <div
                key={char.id}
                className="bg-surface border border-border rounded-2xl overflow-hidden"
              >
                {/* Gradient banner */}
                <div className={`h-2 w-full bg-gradient-to-r ${char.color}`} />

                <div className="p-4 flex items-center gap-4">
                  {/* Avatar */}
                  <div className="relative w-16 h-16 rounded-full overflow-hidden shrink-0 ring-2 ring-border">
                    {char.avatar_url ? (
                      <Image
                        src={char.avatar_url}
                        alt={char.name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${char.color} flex items-center justify-center text-2xl font-bold`}>
                        {char.name[0]}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-base">{char.name}</p>
                    <p className="text-sm text-gray-400 mb-1">{char.niche}</p>
                    {char.instagram && (
                      <a
                        href={char.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        📸 Instagram →
                      </a>
                    )}
                  </div>

                  {/* Action */}
                  <button
                    onClick={() => {
                      hapticImpact('light')
                      router.push(`/generate/${char.id}`)
                    }}
                    disabled={char.lora_status === 'training'}
                    className={`shrink-0 px-4 py-2 rounded-xl bg-gradient-to-r ${char.color}
                      text-white text-sm font-semibold
                      hover:opacity-90 active:scale-95 transition-all duration-150
                      disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    Выбрать
                  </button>
                </div>

                {/* LoRA Training Section */}
                <div className="px-4 pb-4 pt-0 border-t border-border/50 mt-0">
                  <div className="flex items-center justify-between mt-3">
                    <span className={`text-xs font-medium ${LORA_STATUS_COLOR[char.lora_status]}`}>
                      {LORA_STATUS_LABEL[char.lora_status]}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUploadClick(char.id)}
                        disabled={uploadingId === char.id || char.lora_status === 'training'}
                        className="text-xs px-3 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {uploadingId === char.id ? 'Загрузка...' : '📁 Фото'}
                      </button>
                      <button
                        onClick={() => handleTrain(char.id)}
                        disabled={
                          trainingId === char.id ||
                          char.lora_status === 'training'
                        }
                        className="text-xs px-3 py-1 rounded-lg bg-violet-700 hover:bg-violet-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {char.lora_status === 'training' ? '⏳ Обучение' : '🚀 Обучить LoRA'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {firstChar && (
          <div className="tg-sticky-cta">
            <div className="max-w-md mx-auto w-full">
              <button
                onClick={() => {
                  hapticImpact('medium')
                  router.push(`/generate/${firstChar.id}`)
                }}
                className="w-full py-4 rounded-2xl font-bold text-base transition-all duration-150 active:scale-[0.99]"
                style={{
                  background: 'var(--tg-button)',
                  color: 'var(--tg-button-text)',
                }}
              >
                Перейти к генерации
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
