import { createContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setUiLocale } from "../api/client";
import { dictionaries, type Locale, type TranslationSchema } from "./index";

type I18nContextValue = {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    t: TranslationSchema;
};

export const I18nContext = createContext<I18nContextValue | null>(null);

type I18nProviderProps = {
    children: ReactNode;
};

export function I18nProvider({ children }: I18nProviderProps) {
    const [locale, setLocale] = useState<Locale>("ru");

    useEffect(() => {
        void setUiLocale(locale).catch(() => {});
    }, [locale]);

    const value = useMemo(
        () => ({
            locale,
            setLocale,
            t: dictionaries[locale],
        }),
        [locale],
    );

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
