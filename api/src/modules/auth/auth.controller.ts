import type { Request, Response, NextFunction } from "express";
import { authService } from "./auth.service.js";
import { sendSuccess } from "../../utils/response.js";
import type { LoginInput, RefreshTokenInput, ChangePasswordInput } from "./auth.validation.js";

export const authController = {
  /**
   * POST /auth/login
   * Returns accessToken + refreshToken + user summary.
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.login(req.body as LoginInput, req.t, {
        userAgent: req.headers["user-agent"],
        ipAddress: req.ip,
      });
      sendSuccess(res, result, req.t("auth.loginSuccess"));
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /auth/refresh
   * Rotates refresh token and issues new access token.
   */
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

  /**
   * POST /auth/logout
   * Revokes the provided refresh token.
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body as RefreshTokenInput;
      await authService.logout(refreshToken);
      sendSuccess(res, null, req.t("auth.logoutSuccess"));
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /auth/logout-all
   * Revokes all refresh tokens for the authenticated user.
   * Requires valid access token.
   */
  async logoutAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.logoutAll(req.user!.userId);
      sendSuccess(res, null, req.t("auth.logoutAllSuccess"));
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /auth/me
   * Returns the JWT payload of the authenticated user.
   * Useful for the frontend to read roles/permissions without decoding the JWT.
   */
  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Return safe subset — omit iat/exp
      const { iat: _iat, exp: _exp, ...payload } = req.user!;
      sendSuccess(res, payload, req.t("auth.loginSuccess"));
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /auth/change-password
   * Verifies current password, updates to new password, revokes all sessions.
   */
  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body as ChangePasswordInput;
      await authService.changePassword(
        req.user!.userId,
        currentPassword,
        newPassword,
        req.t
      );
      sendSuccess(res, null, req.t("staffUsers.passwordUpdated"));
    } catch (err) {
      next(err);
    }
  },
};
