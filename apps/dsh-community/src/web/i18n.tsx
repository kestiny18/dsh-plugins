import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type Language = 'zh' | 'en'
interface I18nValue { language: Language; zh: boolean; setLanguage: (language: Language) => void }
const I18nContext = createContext<I18nValue | undefined>(undefined)

function initialLanguage(): Language {
  const saved = window.localStorage.getItem('dsh-community-language')
  if (saved === 'zh' || saved === 'en') return saved
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(initialLanguage)
  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'
    window.localStorage.setItem('dsh-community-language', language)
    document.title = language === 'zh' ? 'DSH Community — Token 使用排行榜' : 'DSH Community — Token Usage Leaderboard'
  }, [language])
  const value = useMemo(() => ({ language, zh: language === 'zh', setLanguage }), [language])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext)
  if (value === undefined) throw new Error('I18nProvider is missing')
  return value
}
