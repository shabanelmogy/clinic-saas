import type { Request, Response, NextFunction } from "express";
import { authService } from "./auth.service.js";
import { sendSuccess } from "../../utils/response.js";
import type { LoginInput, RefreshTokenInput } from "./auth.validation.js";

export const authController = {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const input = req.body as LoginInput;
      // ✅ No clinicId — global user login
      const result = await authService.login(input, req.t, {
        userAgent: req.headers["user-agent"],
        ipAddress: req.ip,
      });
      sendSuccess(res, result, req.t("auth.loginSuccess"));
    } catch (err) {
      next(err);
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body as RefreshTokenInput;
      const result = await authService.refresh(refreshToken, req.t, {
        userAgent: req.headers["user-agent"],
        ipAddress: req.ip,
      });
      sendSuccess(res, result, req.t("auth.tokenRefreshed"));
    } catch (err) {
      next(err);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body as RefreshTokenInput;
      await authService.logout(refreshToken);
      sendSuccess(res, null, req.t("auth.logoutSuccess"));
    } catch (err) {
      next(err);
    }
  },

  async logoutAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.logoutAll(req.user!.userId);
      sendSuccess(res, null, req.t("auth.logoutAllSuccess"));
    } catch (err) {
      next(err);
    }
  },

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, req.user, "Authenticated user");
    } catch (err) {
      next(err);
    }
  },
};
