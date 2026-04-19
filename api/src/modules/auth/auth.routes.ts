import { Router } from "express";
import { authController } from "./auth.controller.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { authRateLimiter } from "../../config/rate-limit.js";
import { createAuthSchemas } from "./auth.validation.js";

const router = Router();

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login
 *     description: |
 *       Authenticates a staff user and returns a short-lived JWT access token
 *       and a long-lived opaque refresh token.
 *
 *       - `clinicId` optional: if provided, issues a clinic-scoped token.
 *       - Without `clinicId`: issues a global token (Super Admin only).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *               clinicId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Login successful — returns accessToken + refreshToken
 *       401:
 *         description: Invalid credentials or deactivated account
 *       422:
 *         description: Validation error
 *       429:
 *         description: Too many login attempts
 */
router.post(
  "/login",
  authRateLimiter,
  validate({ body: (t) => createAuthSchemas(t).login }),
  authController.login
);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Rotate refresh token
 *     description: |
 *       Validates the refresh token, revokes it, and issues a new token pair.
 *       If a revoked token is presented (reuse detected), the entire session family is revoked.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: New accessToken + refreshToken pair
 *       401:
 *         description: Invalid, expired, or reused refresh token
 *       429:
 *         description: Too many requests
 */
router.post(
  "/refresh",
  authRateLimiter,
  validate({ body: (t) => createAuthSchemas(t).refreshToken }),
  authController.refresh
);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout — revoke current session
 *     description: Soft-revokes the provided refresh token. Access token remains valid until expiry.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post(
  "/logout",
  authRateLimiter,
  validate({ body: (t) => createAuthSchemas(t).refreshToken }),
  authController.logout
);

/**
 * @openapi
 * /auth/logout-all:
 *   post:
 *     tags: [Auth]
 *     summary: Logout all devices
 *     description: Revokes ALL refresh tokens for the authenticated user. Forces re-login on all devices.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All sessions revoked
 *       401:
 *         description: Not authenticated
 */
router.post("/logout-all", authenticate, authController.logoutAll);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user context
 *     description: Returns the JWT payload (userId, clinicId, roles, permissions) without DB query.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user context
 *       401:
 *         description: Not authenticated
 */
router.get("/me", authenticate, authController.me);

/**
 * @openapi
 * /auth/change-password:
 *   post:
 *     tags: [Auth]
 *     summary: Change password
 *     description: Verifies current password, updates to new password, and revokes all active sessions.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: Password changed, all sessions revoked
 *       400:
 *         description: Current password incorrect
 *       401:
 *         description: Not authenticated
 */
router.post(
  "/change-password",
  authenticate,
  validate({ body: (t) => createAuthSchemas(t).changePassword }),
  authController.changePassword
);

export default router;
