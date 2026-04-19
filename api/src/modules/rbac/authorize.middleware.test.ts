import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { authorize, authorizeAny, authorizeAll, requirePermission, hasPermission } from "./authorize.middleware.js";
import { sendError } from "../../utils/response.js";
import { ForbiddenError } from "../../utils/errors.js";
import { mockT } from "../../tests/setup.js";
import { createMockJwtPayload } from "../../tests/factories.js";

// Mock dependencies
vi.mock("../../utils/response.js");
vi.mock("../../utils/logger.js", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

describe("authorize.middleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    
    req = {
      t: mockT,
      path: "/api/v1/test",
      method: "POST",
    };
    
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    
    next = vi.fn();
  });

  describe("authorize", () => {
    it("should allow request with required permission", () => {
      // Arrange
      req.user = createMockJwtPayload({
        permissions: ["appointments:create", "appointments:view_all"],
      });

      const middleware = authorize("appointments:create");

      // Act
      middleware(req as Request, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(sendError).not.toHaveBeenCalled();
    });

    it("should deny request without required permission", () => {
      // Arrange
      req.user = createMockJwtPayload({
        permissions: ["appointments:view_own"],
      });

      const middleware = authorize("appointments:delete");

      // Act
      middleware(req as Request, res as Response, next);

      // Assert
      expect(sendError).toHaveBeenCalledWith(
        res,
        expect.stringContaining("appointments:delete"),
        403
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 when user is not authenticated", () => {
      // Arrange
      req.user = undefined;

      const middleware = authorize("appointments:create");

      // Act
      middleware(req as Request, res as Response, next);

      // Assert
      expect(sendError).toHaveBeenCalledWith(res, "common.unauthorized", 401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("authorizeAny", () => {
    it("should allow if user has any of the required permissions", () => {
      // Arrange
      req.user = createMockJwtPayload({
        permissions: ["appointments:view_own"],
      });

      const middleware = authorizeAny(["appointments:view_all", "appointments:view_own"]);

      // Act
      middleware(req as Request, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(sendError).not.toHaveBeenCalled();
    });

    it("should allow if user has all of the required permissions", () => {
      // Arrange
      req.user = createMockJwtPayload({
        permissions: ["appointments:view_all", "appointments:view_own"],
      });

      const middleware = authorizeAny(["appointments:view_all", "appointments:view_own"]);

      // Act
      middleware(req as Request, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(sendError).not.toHaveBeenCalled();
    });

    it("should deny if user has none of the required permissions", () => {
      // Arrange
      req.user = createMockJwtPayload({
        permissions: ["patients:view"],
      });

      const middleware = authorizeAny(["appointments:view_all", "appointments:view_own"]);

      // Act
      middleware(req as Request, res as Response, next);

      // Assert
      expect(sendError).toHaveBeenCalledWith(
        res,
        expect.stringContaining("appointments:view_all, appointments:view_own"),
        403
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 when user is not authenticated", () => {
      // Arrange
      req.user = undefined;

      const middleware = authorizeAny(["appointments:view_all"]);

      // Act
      middleware(req as Request, res as Response, next);

      // Assert
      expect(sendError).toHaveBeenCalledWith(res, "common.unauthorized", 401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("authorizeAll", () => {
    it("should allow if user has all required permissions", () => {
      // Arrange
      req.user = createMockJwtPayload({
        permissions: ["clinic:update", "system:manage_settings", "users:view"],
      });

      const middleware = authorizeAll(["clinic:update", "system:manage_settings"]);

      // Act
      middleware(req as Request, res as Response, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(sendError).not.toHaveBeenCalled();
    });

    it("should deny if user is missing any required permission", () => {
      // Arrange
      req.user = createMockJwtPayload({
        permissions: ["clinic:update"],
      });

      const middleware = authorizeAll(["clinic:update", "system:manage_settings"]);

      // Act
      middleware(req as Request, res as Response, next);

      // Assert
      expect(sendError).toHaveBeenCalledWith(
        res,
        expect.stringContaining("system:manage_settings"),
        403
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should deny if user has none of the required permissions", () => {
      // Arrange
      req.user = createMockJwtPayload({
        permissions: ["patients:view"],
      });

      const middleware = authorizeAll(["clinic:update", "system:manage_settings"]);

      // Act
      middleware(req as Request, res as Response, next);

      // Assert
      expect(sendError).toHaveBeenCalledWith(
        res,
        expect.stringContaining("clinic:update, system:manage_settings"),
        403
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 401 when user is not authenticated", () => {
      // Arrange
      req.user = undefined;

      const middleware = authorizeAll(["clinic:update"]);

      // Act
      middleware(req as Request, res as Response, next);

      // Assert
      expect(sendError).toHaveBeenCalledWith(res, "common.unauthorized", 401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("requirePermission (service helper)", () => {
    it("should not throw when user has permission", () => {
      // Arrange
      const permissions = ["users:delete", "users:view"];

      // Act & Assert
      expect(() => {
        requirePermission(permissions, "users:delete", mockT);
      }).not.toThrow();
    });

    it("should throw ForbiddenError when user lacks permission", () => {
      // Arrange
      const permissions = ["users:view"];

      // Act & Assert
      expect(() => {
        requirePermission(permissions, "users:delete", mockT);
      }).toThrow(ForbiddenError);
    });
  });

  describe("hasPermission (service helper)", () => {
    it("should return true when user has permission", () => {
      // Arrange
      const permissions = ["appointments:view_all", "appointments:create"];

      // Act
      const result = hasPermission(permissions, "appointments:view_all");

      // Assert
      expect(result).toBe(true);
    });

    it("should return false when user lacks permission", () => {
      // Arrange
      const permissions = ["appointments:view_own"];

      // Act
      const result = hasPermission(permissions, "appointments:view_all");

      // Assert
      expect(result).toBe(false);
    });
  });
});
