import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { useEffect } from 'react'
import { getTelegramWebApp } from '@/lib/telegram'

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    const tg = getTelegramWebApp()
    if (!tg) return

    tg.ready()
    tg.expand()

    const root = document.documentElement
    const theme = tg.themeParams

    if (theme.bg_color) root.style.setProperty('--tg-bg', theme.bg_color)
    if (theme.text_color) root.style.setProperty('--tg-text', theme.text_color)
    if (theme.hint_color) root.style.setProperty('--tg-hint', theme.hint_color)
    if (theme.button_color) root.style.setProperty('--tg-button', theme.button_color)
    if (theme.button_text_color) {
      root.style.setProperty('--tg-button-text', theme.button_text_color)
    }
    if (theme.secondary_bg_color) root.style.setProperty('--tg-card', theme.secondary_bg_color)
  }, [])

  return <Component {...pageProps} />
}
