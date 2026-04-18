import type { Request } from "express";
import en from "../locales/en.json" with { type: "json" };
import ar from "../locales/ar.json" with { type: "json" };
import fr from "../locales/fr.json" with { type: "json" };
import es from "../locales/es.json" with { type: "json" };
import de from "../locales/de.json" with { type: "json" };

// ─── Types ────────────────────────────────────────────────────────────────────

type TranslationKey = string;
type TranslationParams = Record<string, string | number>;
type Translations = typeof en;

// ─── Supported Languages ──────────────────────────────────────────────────────

export const SUPPORTED_LANGUAGES = ["en", "ar", "fr", "es", "de"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = "en";

// ─── Translation Store ────────────────────────────────────────────────────────

const translations: Record<SupportedLanguage, Translations> = {
  en,
  ar,
  fr,
  es,
  de,
};

// ─── Language Detection ───────────────────────────────────────────────────────

/**
 * Detect language from request headers
 * 
 * Checks in order:
 * 1. X-Language header (custom header)
 * 2. Accept-Language header (standard)
 * 3. Default language (en)
 * 
 * @param req - Express request object
 * @returns Detected language code
 */
export const detectLanguage = (req: Request): SupportedLanguage => {
  // 1. Check custom X-Language header
  const customLang = req.headers["x-language"] as string | undefined;
  if (customLang && isSupportedLanguage(customLang)) {
    return customLang;
  }

  // 2. Check Accept-Language header
  const acceptLanguage = req.headers["accept-language"];
  if (acceptLanguage) {
    // Parse Accept-Language header (e.g., "en-US,en;q=0.9,ar;q=0.8")
    const languages = acceptLanguage
      .split(",")
      .map((lang) => {
        const [code, priority] = lang.trim().split(";");
        const langCode = code.split("-")[0]; // Extract base language (en from en-US)
        const q = priority ? parseFloat(priority.split("=")[1]) : 1.0;
        return { code: langCode, priority: q };
      })
      .sort((a, b) => b.priority - a.priority); // Sort by priority

    // Find first supported language
    for (const { code } of languages) {
      if (isSupportedLanguage(code)) {
        return code;
      }
    }
  }

  // 3. Default language
  return DEFAULT_LANGUAGE;
};

/**
 * Check if language code is supported
 */
const isSupportedLanguage = (lang: string): lang is SupportedLanguage => {
  return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage);
};

// ─── Translation Function ─────────────────────────────────────────────────────

/**
 * Get nested translation value by key path
 * 
 * @param obj - Translation object
 * @param path - Dot-separated key path (e.g., "auth.loginSuccess")
 * @returns Translation value or undefined
 */
const getNestedValue = (obj: any, path: string): string | undefined => {
  return path.split(".").reduce((current, key) => current?.[key], obj);
};

/**
 * Replace placeholders in translation string
 * 
 * @param text - Translation text with placeholders (e.g., "Hello {{name}}")
 * @param params - Replacement values
 * @returns Text with replaced placeholders
 */
const replacePlaceholders = (text: string, params?: TranslationParams): string => {
  if (!params) return text;

  return Object.entries(params).reduce((result, [key, value]) => {
    return result.replace(new RegExp(`{{${key}}}`, "g"), String(value));
  }, text);
};

/**
 * Translate a key to the target language
 * 
 * @param key - Translation key (e.g., "auth.loginSuccess")
 * @param lang - Target language
 * @param params - Optional parameters for placeholder replacement
 * @returns Translated text
 * 
 * @example
 * translate("auth.loginSuccess", "en") // "Login successful"
 * translate("users.hasAppointments", "en", { count: 5 }) // "Cannot delete user: they have 5 appointment(s)..."
 */
export const translate = (
  key: TranslationKey,
  lang: SupportedLanguage = DEFAULT_LANGUAGE,
  params?: TranslationParams
): string => {
  const translation = translations[lang];
  const value = getNestedValue(translation, key);

  if (!value) {
    // Fallback to English if translation not found
    const fallback = getNestedValue(translations[DEFAULT_LANGUAGE], key);
    if (fallback) {
      return replacePlaceholders(fallback, params);
    }
    // Return key if no translation found
    return key;
  }

  return replacePlaceholders(value, params);
};

/**
 * Create a translation function bound to a specific language
 * 
 * @param lang - Target language
 * @returns Translation function
 * 
 * @example
 * const t = createTranslator("ar");
 * t("auth.loginSuccess") // "تم تسجيل الدخول بنجاح"
 */
export const createTranslator = (lang: SupportedLanguage) => {
  return (key: TranslationKey, params?: TranslationParams) => 
    translate(key, lang, params);
};

// ─── Express Middleware ───────────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      lang: SupportedLanguage;
      t: (key: TranslationKey, params?: TranslationParams) => string;
    }
  }
}

/**
 * i18n middleware - Detects language and attaches translator to request
 * 
 * Usage:
 * app.use(i18nMiddleware);
 * 
 * Then in routes:
 * req.t("auth.loginSuccess") // Translated based on request language
 */
export const i18nMiddleware = (
  req: Request,
  _res: any,
  next: any
): void => {
  const lang = detectLanguage(req);
  req.lang = lang;
  req.t = createTranslator(lang);
  next();
};
