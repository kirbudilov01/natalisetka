import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { createAccess, deleteAccess, listAccesses, revealAccess } from '@/lib/api'
import { hapticImpact, hapticSelection } from '@/lib/telegram'

type AccessItem = {
  id: string
  service_name: string
  account_login: string
  password_masked: string
  notes?: string
}

export default function AccessesPage() {
  const router = useRouter()

  const [items, setItems] = useState<AccessItem[]>([])
  const [loading, setLoading] = useState(false)
  const [revealed, setRevealed] = useState<Record<string, string>>({})

  const [serviceName, setServiceName] = useState('')
  const [accountLogin, setAccountLogin] = useState('')
  const [password, setPassword] = useState('')
  const [notes, setNotes] = useState('')

  async function refresh() {
    setLoading(true)
    try {
      const data = await listAccesses()
      setItems(data)
    } catch {
      alert('Ошибка загрузки доступов')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleCreate() {
    if (!serviceName.trim() || !accountLogin.trim() || !password.trim()) {
      alert('Заполни service, login и password')
      return
    }

    try {
      await createAccess({
        service_name: serviceName.trim(),
        account_login: accountLogin.trim(),
        password: password.trim(),
        notes: notes.trim(),
      })
      setServiceName('')
      setAccountLogin('')
      setPassword('')
      setNotes('')
      await refresh()
      hapticImpact('medium')
    } catch {
      alert('Ошибка сохранения доступа')
    }
  }

  async function handleReveal(id: string) {
    try {
      const data = await revealAccess(id)
      setRevealed((prev) => ({ ...prev, [id]: data.password }))
      hapticSelection()
    } catch {
      alert('Не удалось расшифровать пароль')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteAccess(id)
      setItems((prev) => prev.filter((x) => x.id !== id))
      setRevealed((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    } catch {
      alert('Ошибка удаления')
    }
  }

  return (
    <>
      <Head>
        <title>Доступы</title>
      </Head>

      <main className="tg-shell text-white">
        <div className="tg-content max-w-md mx-auto w-full px-4 py-4">
          <div className="flex items-center gap-3 mb-5 sticky top-0 z-20 py-2 bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm">
            <button
              onClick={() => router.back()}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-surface border border-border text-gray-400 hover:text-white transition-colors"
            >
              ←
            </button>
            <div>
              <h1 className="text-lg font-bold text-white">Доступы</h1>
              <p className="text-xs" style={{ color: 'var(--tg-hint)' }}>
                Пароли хранятся в БД в зашифрованном виде
              </p>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-2xl p-4 mb-4 space-y-3">
            <p className="text-sm font-semibold">Добавить доступ</p>
            <input
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder="Сервис (Runway, Pika, SD...)"
              className="w-full py-3 px-3 rounded-xl bg-[#0b0b12] border border-border text-sm text-white focus:outline-none focus:border-purple-500"
            />
            <input
              value={accountLogin}
              onChange={(e) => setAccountLogin(e.target.value)}
              placeholder="Логин / email"
              className="w-full py-3 px-3 rounded-xl bg-[#0b0b12] border border-border text-sm text-white focus:outline-none focus:border-purple-500"
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль"
              type="password"
              className="w-full py-3 px-3 rounded-xl bg-[#0b0b12] border border-border text-sm text-white focus:outline-none focus:border-purple-500"
            />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Комментарий"
              rows={2}
              className="w-full py-3 px-3 rounded-xl bg-[#0b0b12] border border-border text-sm text-white focus:outline-none focus:border-purple-500 resize-none"
            />
            <button
              onClick={handleCreate}
              className="w-full py-3 rounded-xl bg-sky-600 text-white font-semibold"
            >
              Сохранить доступ
            </button>
          </div>

          <div className="space-y-3">
            {loading && <p className="text-sm text-gray-400">Загрузка...</p>}
            {!loading && items.length === 0 && (
              <p className="text-sm text-gray-500">Пока нет сохраненных доступов</p>
            )}
            {items.map((item) => (
              <div key={item.id} className="bg-surface border border-border rounded-2xl p-4">
                <p className="text-sm text-gray-400">{item.service_name}</p>
                <p className="font-semibold text-white mt-1">{item.account_login}</p>
                <p className="text-xs text-gray-500 mt-2 break-all">
                  Пароль: {revealed[item.id] || item.password_masked}
                </p>
                {item.notes && <p className="text-xs text-gray-500 mt-1">{item.notes}</p>}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleReveal(item.id)}
                    className="flex-1 py-2 rounded-xl border border-white/20 bg-white/10 text-white text-sm"
                  >
                    Показать
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="flex-1 py-2 rounded-xl border border-red-400/30 bg-red-500/10 text-red-200 text-sm"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  )
}
