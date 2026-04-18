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
 *     summary: Login with email and password
 *     description: Returns a short-lived JWT access token and an opaque refresh token stored in DB.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email, example: jane@example.com }
 *               password: { type: string, example: SecurePass1 }
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials or deactivated account
 *       422:
 *         description: Validation error
 *       429:
 *         description: Too many login attempts
 */
router.post("/login", authRateLimiter, validate({ body: (t) => createAuthSchemas(t).login }), authController.login);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Rotate refresh token and get new access token
 *     description: |
 *       Validates the refresh token against the DB, revokes it, and issues a new pair.
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
 *         description: New access + refresh token pair
 *       401:
 *         description: Invalid, expired, or reused refresh token
 */
router.post("/refresh", authRateLimiter, validate({ body: (t) => createAuthSchemas(t).refreshToken }), authController.refresh);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout — revoke current refresh token
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
router.post("/logout", authRateLimiter, validate({ body: (t) => createAuthSchemas(t).refreshToken }), authController.logout);

/**
 * @openapi
 * /auth/logout-all:
 *   post:
 *     tags: [Auth]
 *     summary: Logout from all devices — revoke all refresh tokens for this user
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
 *     summary: Get current authenticated user from access token
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: JWT payload of current user
 *       401:
 *         description: Not authenticated
 */
router.get("/me", authenticate, authController.me);

export default router;
