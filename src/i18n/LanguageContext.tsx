import { createContext, ReactNode, useContext } from 'react';
import { AppLanguage } from '../types/story';
import { getTranslations, TranslationBundle } from './translations';

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  t: TranslationBundle;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: () => {},
  t: getTranslations('en'),
});

export function LanguageProvider({
  language,
  onChangeLanguage,
  children,
}: {
  language: AppLanguage;
  onChangeLanguage: (lang: AppLanguage) => void;
  children: ReactNode;
}) {
  const value: LanguageContextValue = {
    language,
    setLanguage: onChangeLanguage,
    t: getTranslations(language),
  };

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useI18n(): LanguageContextValue {
  return useContext(LanguageContext);
}
