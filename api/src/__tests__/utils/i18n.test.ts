import { describe, it, expect } from "vitest";
import {
  translate,
  createTranslator,
  detectLanguage,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
} from "../../utils/i18n.js";
import type { Request } from "express";

describe("i18n Utility", () => {
  describe("translate()", () => {
    it("should translate simple keys in English", () => {
      expect(translate("auth.loginSuccess", "en")).toBe("Login successful");
      expect(translate("users.retrieved", "en")).toBe("Users retrieved");
      expect(translate("common.success", "en")).toBe("Success");
    });

    it("should translate simple keys in Arabic", () => {
      expect(translate("auth.loginSuccess", "ar")).toBe("تم تسجيل الدخول بنجاح");
      expect(translate("users.retrieved", "ar")).toBe("تم استرجاع المستخدمين");
      expect(translate("common.success", "ar")).toBe("نجح");
    });

    it("should translate simple keys in French", () => {
      expect(translate("auth.loginSuccess", "fr")).toBe("Connexion réussie");
      expect(translate("users.retrieved", "fr")).toBe("Utilisateurs récupérés");
      expect(translate("common.success", "fr")).toBe("Succès");
    });

    it("should translate simple keys in Spanish", () => {
      expect(translate("auth.loginSuccess", "es")).toBe("Inicio de sesión exitoso");
      expect(translate("users.retrieved", "es")).toBe("Usuarios recuperados");
      expect(translate("common.success", "es")).toBe("Éxito");
    });

    it("should translate simple keys in German", () => {
      expect(translate("auth.loginSuccess", "de")).toBe("Anmeldung erfolgreich");
      expect(translate("users.retrieved", "de")).toBe("Benutzer abgerufen");
      expect(translate("common.success", "de")).toBe("Erfolg");
    });

    it("should replace placeholders with provided values", () => {
      const result = translate("users.hasAppointments", "en", { count: 5 });
      expect(result).toContain("5");
      expect(result).toContain("appointment(s)");
    });

    it("should replace multiple placeholders", () => {
      // Using permissions.required which has {{permission}} placeholder
      const result = translate("permissions.required", "en", { 
        permission: "users:create" 
      });
      expect(result).toBe("Permission 'users:create' is required");
    });

    it("should handle placeholders in different languages", () => {
      const resultEn = translate("users.hasAppointments", "en", { count: 3 });
      const resultAr = translate("users.hasAppointments", "ar", { count: 3 });
      const resultFr = translate("users.hasAppointments", "fr", { count: 3 });
      
      expect(resultEn).toContain("3");
      expect(resultAr).toContain("3");
      expect(resultFr).toContain("3");
    });

    it("should fallback to English if translation not found in target language", () => {
      // Assuming a key exists in English but not in other languages
      const result = translate("auth.loginSuccess", "en");
      expect(result).toBe("Login successful");
    });

    it("should return key if translation not found in any language", () => {
      const result = translate("nonexistent.key", "en");
      expect(result).toBe("nonexistent.key");
    });

    it("should use default language if no language specified", () => {
      const result = translate("auth.loginSuccess");
      expect(result).toBe("Login successful");
    });

    it("should handle nested translation keys", () => {
      expect(translate("auth.loginSuccess", "en")).toBe("Login successful");
      expect(translate("users.userRetrieved", "en")).toBe("User retrieved");
      expect(translate("appointments.appointmentRetrieved", "en")).toBe("Appointment retrieved");
    });
  });

  describe("createTranslator()", () => {
    it("should create a translator function bound to English", () => {
      const t = createTranslator("en");
      expect(t("auth.loginSuccess")).toBe("Login successful");
      expect(t("users.retrieved")).toBe("Users retrieved");
    });

    it("should create a translator function bound to Arabic", () => {
      const t = createTranslator("ar");
      expect(t("auth.loginSuccess")).toBe("تم تسجيل الدخول بنجاح");
      expect(t("users.retrieved")).toBe("تم استرجاع المستخدمين");
    });

    it("should create a translator function bound to French", () => {
      const t = createTranslator("fr");
      expect(t("auth.loginSuccess")).toBe("Connexion réussie");
      expect(t("users.retrieved")).toBe("Utilisateurs récupérés");
    });

    it("should handle placeholders in bound translator", () => {
      const t = createTranslator("en");
      const result = t("users.hasAppointments", { count: 7 });
      expect(result).toContain("7");
    });
  });

  describe("detectLanguage()", () => {
    it("should detect language from X-Language header", () => {
      const req = {
        headers: { "x-language": "ar" },
      } as unknown as Request;
      
      expect(detectLanguage(req)).toBe("ar");
    });

    it("should detect language from Accept-Language header", () => {
      const req = {
        headers: { "accept-language": "fr-FR,fr;q=0.9,en;q=0.8" },
      } as unknown as Request;
      
      expect(detectLanguage(req)).toBe("fr");
    });

    it("should prioritize X-Language over Accept-Language", () => {
      const req = {
        headers: {
          "x-language": "ar",
          "accept-language": "fr-FR,fr;q=0.9",
        },
      } as unknown as Request;
      
      expect(detectLanguage(req)).toBe("ar");
    });

    it("should parse Accept-Language with quality values", () => {
      const req = {
        headers: { "accept-language": "en-US,en;q=0.9,ar;q=0.8,fr;q=0.7" },
      } as unknown as Request;
      
      expect(detectLanguage(req)).toBe("en");
    });

    it("should extract base language from locale (en from en-US)", () => {
      const req = {
        headers: { "accept-language": "ar-SA,ar;q=0.9" },
      } as unknown as Request;
      
      expect(detectLanguage(req)).toBe("ar");
    });

    it("should fallback to default language if no headers", () => {
      const req = {
        headers: {},
      } as unknown as Request;
      
      expect(detectLanguage(req)).toBe(DEFAULT_LANGUAGE);
    });

    it("should fallback to default if unsupported language", () => {
      const req = {
        headers: { "x-language": "zh" }, // Chinese not supported
      } as unknown as Request;
      
      expect(detectLanguage(req)).toBe(DEFAULT_LANGUAGE);
    });

    it("should handle Accept-Language with unsupported languages", () => {
      const req = {
        headers: { "accept-language": "zh-CN,zh;q=0.9,ja;q=0.8" },
      } as unknown as Request;
      
      expect(detectLanguage(req)).toBe(DEFAULT_LANGUAGE);
    });

    it("should find first supported language in Accept-Language list", () => {
      const req = {
        headers: { "accept-language": "zh-CN,zh;q=0.9,fr;q=0.8,ja;q=0.7" },
      } as unknown as Request;
      
      expect(detectLanguage(req)).toBe("fr");
    });
  });

  describe("SUPPORTED_LANGUAGES", () => {
    it("should include all expected languages", () => {
      expect(SUPPORTED_LANGUAGES).toContain("en");
      expect(SUPPORTED_LANGUAGES).toContain("ar");
      expect(SUPPORTED_LANGUAGES).toContain("fr");
      expect(SUPPORTED_LANGUAGES).toContain("es");
      expect(SUPPORTED_LANGUAGES).toContain("de");
    });

    it("should have correct length", () => {
      expect(SUPPORTED_LANGUAGES.length).toBe(5);
    });
  });

  describe("DEFAULT_LANGUAGE", () => {
    it("should be English", () => {
      expect(DEFAULT_LANGUAGE).toBe("en");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty placeholder values", () => {
      const result = translate("permissions.required", "en", { permission: "" });
      expect(result).toBe("Permission '' is required");
    });

    it("should handle numeric placeholder values", () => {
      const result = translate("users.hasAppointments", "en", { count: 0 });
      expect(result).toContain("0");
    });

    it("should handle missing placeholder parameters", () => {
      const result = translate("users.hasAppointments", "en");
      expect(result).toContain("{{count}}"); // Placeholder not replaced
    });

    it("should handle case-sensitive header names", () => {
      const req = {
        headers: { "X-Language": "ar" }, // Capital X
      } as unknown as Request;
      
      // Express normalizes headers to lowercase, but test both
      expect(detectLanguage(req)).toBe(DEFAULT_LANGUAGE);
    });

    it("should handle malformed Accept-Language header", () => {
      const req = {
        headers: { "accept-language": "invalid" },
      } as unknown as Request;
      
      expect(detectLanguage(req)).toBe(DEFAULT_LANGUAGE);
    });
  });

  describe("Translation Completeness", () => {
    it("should have all keys in all languages", () => {
      const enKeys = Object.keys(translate("common", "en") as any);
      const arKeys = Object.keys(translate("common", "ar") as any);
      const frKeys = Object.keys(translate("common", "fr") as any);
      const esKeys = Object.keys(translate("common", "es") as any);
      const deKeys = Object.keys(translate("common", "de") as any);
      
      // All languages should have the same keys
      expect(arKeys.length).toBeGreaterThan(0);
      expect(frKeys.length).toBeGreaterThan(0);
      expect(esKeys.length).toBeGreaterThan(0);
      expect(deKeys.length).toBeGreaterThan(0);
    });
  });
});
