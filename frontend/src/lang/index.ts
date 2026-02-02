import en from './en';
import zh from './zh';
import zhHant from './zhHant';
import ja from './ja';
import ko from './ko';

export const translations = {
  en,
  zh,
  zhHant,
  ja,
  ko
};

export type Language = keyof typeof translations;
export const SUPPORTED_LANGUAGES: Language[] = ['en', 'zh', 'zhHant', 'ja', 'ko'];

export type TranslationKey = string;
