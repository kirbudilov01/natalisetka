export function getTelegramWebApp() {
  if (typeof window === 'undefined') return null
  return window.Telegram?.WebApp ?? null
}

export function getTelegramUserId(): string | null {
  const tg = getTelegramWebApp()
  const userId = tg?.initDataUnsafe?.user?.id
  return userId ? String(userId) : null
}

export function hapticSelection() {
  const tg = getTelegramWebApp()
  tg?.HapticFeedback?.selectionChanged()
}

export function hapticSuccess() {
  const tg = getTelegramWebApp()
  tg?.HapticFeedback?.notificationOccurred('success')
}

export function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'light') {
  const tg = getTelegramWebApp()
  tg?.HapticFeedback?.impactOccurred(style)
}
