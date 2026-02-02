import { createContext, useContext, createSignal, ParentComponent, Accessor, createEffect } from 'solid-js';
import { translations, Language, TranslationKey, SUPPORTED_LANGUAGES } from '../lang';

interface I18nContextType {
  locale: Accessor<Language>;
  setLocale: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextType>();

const LOCALE_TO_HTML: Record<Language, string> = {
  en: 'en',
  zh: 'zh-Hans',
  zhHant: 'zh-Hant',
  ja: 'ja',
  ko: 'ko',
};

function isValidLanguage(lang: string): lang is Language {
  return SUPPORTED_LANGUAGES.includes(lang as Language);
}

export const I18nProvider: ParentComponent = (props) => {
  const raw = localStorage.getItem('lang');
  const savedLang = raw && isValidLanguage(raw) ? raw : 'en';
  const [locale, setLocaleState] = createSignal<Language>(savedLang);

  createEffect(() => {
    const lang = locale();
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = LOCALE_TO_HTML[lang] || 'en';
    }
  });

  const setLocale = (lang: Language) => {
    setLocaleState(lang);
    localStorage.setItem('lang', lang);
  };

  const t = (key: TranslationKey): string => {
    const lang = locale();
    const keys = key.split('.');
    let value: any = translations[lang];
    
    for (const k of keys) {
      value = value?.[k];
    }
    
    return value || key;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {props.children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
};
