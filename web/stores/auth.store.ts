import { create } from "zustand";
import { persist } from "zustand/middleware";

// ─── Types ────────────────────────────────────────────────────────────────────

export type StaffUser = {
  id: string;
  name: string;
  email: string;
  userType: "staff";
  clinicId?: string;
  roles: string[];
};

type AuthState = {
  user: StaffUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
};

type AuthActions = {
  setAuth: (user: StaffUser, accessToken: string, refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken) => {
        // Cookie for server-side auth guard
        document.cookie = `access_token=${accessToken}; path=/; max-age=900; SameSite=Lax`;
        set({ user, accessToken, refreshToken, isAuthenticated: true });
      },

      setTokens: (accessToken, refreshToken) => {
        document.cookie = `access_token=${accessToken}; path=/; max-age=900; SameSite=Lax`;
        set({ accessToken, refreshToken });
      },

      logout: () => {
        document.cookie = "access_token=; path=/; max-age=0";
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },
    }),
    {
      name: "auth-storage",
      // Only persist user info — tokens are also in localStorage for the interceptor
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
