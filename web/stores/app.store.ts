import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Locale } from "@/lib/constants";
import { RTL_LOCALES } from "@/lib/constants";

type AppState = {
  theme: "light" | "dark" | "system";
  locale: Locale;
  direction: "ltr" | "rtl";
};

type AppActions = {
  setTheme: (theme: AppState["theme"]) => void;
  setLocale: (locale: Locale) => void;
};

export const useAppStore = create<AppState & AppActions>()(
  persist(
    (set) => ({
      theme: "system",
      locale: "en",
      direction: "ltr",

      setTheme: (theme) => set({ theme }),

      setLocale: (locale) =>
        set({
          locale,
          direction: RTL_LOCALES.includes(locale) ? "rtl" : "ltr",
        }),
    }),
    { name: "app-storage" }
  )
);
