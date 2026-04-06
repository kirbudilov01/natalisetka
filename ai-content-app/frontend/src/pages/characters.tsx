import Head from 'next/head'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { characters } from '@/lib/characters'
import { hapticImpact } from '@/lib/telegram'

export default function Characters() {
  const router = useRouter()
  const firstCharacter = characters[0]

  return (
    <>
      <Head>
        <title>Выбор персонажа</title>
      </Head>

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
                    <Image
                      src={char.avatarUrl}
                      alt={char.name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-base">{char.name}</p>
                    <p className="text-sm text-gray-400 mb-1">{char.niche}</p>
                    <a
                      href={char.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      📸 Instagram →
                    </a>
                  </div>

                  {/* Action */}
                  <button
                    onClick={() => {
                      hapticImpact('light')
                      router.push(`/generate/${char.id}`)
                    }}
                    className={`shrink-0 px-4 py-2 rounded-xl bg-gradient-to-r ${char.color}
                      text-white text-sm font-semibold
                      hover:opacity-90 active:scale-95 transition-all duration-150`}
                  >
                    Выбрать
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {firstCharacter && (
          <div className="tg-sticky-cta">
            <div className="max-w-md mx-auto w-full">
              <button
                onClick={() => {
                  hapticImpact('medium')
                  router.push(`/generate/${firstCharacter.id}`)
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
