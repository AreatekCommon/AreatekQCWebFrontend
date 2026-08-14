import { en } from "./dictionaries/en";
import { ru } from "./dictionaries/ru";
import type { TranslationSchema } from "./schema";

export const dictionaries = {
    ru,
    en,
} as const satisfies Record<"ru" | "en", TranslationSchema>;

export type Locale = keyof typeof dictionaries;
export type { TranslationSchema };
