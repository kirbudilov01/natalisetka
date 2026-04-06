// Telegram Web App types
export {}

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string
        initDataUnsafe: {
          user?: {
            id: number
            first_name: string
            last_name?: string
            username?: string
          }
        }
        ready(): void
        expand(): void
        close(): void
        colorScheme: 'light' | 'dark'
        themeParams: {
          bg_color?: string
          text_color?: string
          hint_color?: string
          secondary_bg_color?: string
          button_color?: string
          button_text_color?: string
        }
        MainButton: {
          text: string
          show(): void
          hide(): void
          setText(text: string): void
          onClick(fn: () => void): void
        }
        BackButton: {
          show(): void
          hide(): void
          onClick(fn: () => void): void
        }
        HapticFeedback: {
          impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void
          notificationOccurred(type: 'error' | 'success' | 'warning'): void
          selectionChanged(): void
        }
      }
    }
  }
}
