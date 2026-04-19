import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { authenticate, requireClinic } from "./auth.middleware.js";
import { verifyAccessToken } from "../modules/rbac/jwt-rbac.js";
import { sendError } from "../utils/response.js";
import { UnauthorizedError } from "../utils/errors.js";
import { mockT } from "../tests/setup.js";
import { createMockJwtPayload } from "../tests/factories.js";

// Mock dependencies
vi.mock("../modules/rbac/jwt-rbac.js");
vi.mock("../utils/response.js");

describe("auth.middleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    
    req = {
      headers: {},
      t: mockT,
    };
    
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    
    next = vi.fn();
  });

  describe("authenticate", () => {
    it("should attach user to request for valid JWT", () => {
      // Arrange
      const mockPayload = createMockJwtPayload({
        userId: "user-123",
        email: "test@example.com",
        clinicId: "clinic-123",
      });

      req.headers = { authorization: "Bearer valid-token" };
      vi.mocked(verifyAccessToken).mockReturnValue(mockPayload);

      // Act
      authenticate(req as Request, res as Response, next);

      // Assert
      expect(req.user).toEqual(mockPayload);
      expect(req.clinicId).toBe("clinic-123");
      expect(next).toHaveBeenCalled();
      expect(sendError).not.toHaveBeenCalled();
    });

    it("should set clinicId for clinic-scoped tokens", () => {
      // Arrange
      const mockPayload = createMockJwtPayload({ clinicId: "clinic-456" });
      req.headers = { authorization: "Bearer valid-token" };
      vi.mocked(verifyAccessToken).mockReturnValue(mockPayload);

      // Act
      authenticate(req as Request, res as Response, next);

      // Assert
      expect(req.clinicId).toBe("clinic-456");
    });

    it("should not set clinicId for global tokens", () => {
      // Arrange
      const mockPayload = createMockJwtPayload({ clinicId: undefined });
      req.headers = { authorization: "Bearer valid-token" };
      vi.mocked(verifyAccessToken).mockReturnValue(mockPayload);

      // Act
      authenticate(req as Request, res as Response, next);

      // Assert
      expect(req.clinicId).toBeUndefined();
    });

    it("should return 401 for missing authorization header", () => {
      // Arrange
      req.headers = {};

      // Act
      authenticate(req as Request, res as Response, next);

      // Assert
      expect(sendError).toHaveBeenCalledWith(res, "auth.invalidToken", 401);
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 for malformed authorization header", () => {
      // Arrange
      req.headers = { authorization: "InvalidFormat token" };

      // Act
      authenticate(req as Request, res as Response, next);

      // Assert
      expect(sendError).toHaveBeenCalledWith(res, "auth.invalidToken", 401);
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 for invalid token", () => {
      // Arrange
      req.headers = { authorization: "Bearer invalid-token" };
      vi.mocked(verifyAccessToken).mockImplementation(() => {
        throw new UnauthorizedError("Invalid token");
      });

      // Act
      authenticate(req as Request, res as Response, next);

      // Assert
      expect(sendError).toHaveBeenCalledWith(res, "Invalid token", 401);
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 for expired token", () => {
      // Arrange
      req.headers = { authorization: "Bearer expired-token" };
      vi.mocked(verifyAccessToken).mockImplementation(() => {
        throw new UnauthorizedError("Token expired");
      });

      // Act
      authenticate(req as Request, res as Response, next);

      // Assert
      expect(sendError).toHaveBeenCalledWith(res, "Token expired", 401);
      expect(next).not.toHaveBeenCalled();
    });

    it("should pass non-UnauthorizedError to error handler", () => {
      // Arrange
      req.headers = { authorization: "Bearer token" };
      const unexpectedError = new Error("Unexpected error");
      vi.mocked(verifyAccessToken).mockImplementation(() => {
        throw unexpectedError;
      });

      // Act
      authenticate(req as Request, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalledWith(unexpectedError);
      expect(sendError).not.toHaveBeenCalled();
    });
  });

  describe("requireClinic", () => {
    it("should pass for clinic-scoped tokens", () => {
      // Arrange
      req.user = createMockJwtPayload({ clinicId: "clinic-123" });

      // Act
      requireClinic(req as Request, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(sendError).not.toHaveBeenCalled();
    });

    it("should return 403 for global tokens (no clinicId)", () => {
      // Arrange
      req.user = createMockJwtPayload({ clinicId: undefined });

      // Act
      requireClinic(req as Request, res as Response, next);

      // Assert
      expect(sendError).toHaveBeenCalledWith(res, "auth.clinicRequired", 403);
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 403 when user is not authenticated", () => {
      // Arrange
      req.user = undefined;

      // Act
      requireClinic(req as Request, res as Response, next);

      // Assert
      expect(sendError).toHaveBeenCalledWith(res, "auth.clinicRequired", 403);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
