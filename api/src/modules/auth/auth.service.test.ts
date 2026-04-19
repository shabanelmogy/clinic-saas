import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { authService } from "./auth.service.js";
import { staffUserRepository } from "../staff-users/staff-user.repository.js";
import { rbacRepository } from "../rbac/rbac.repository.js";
import { authRepository } from "./auth.repository.js";
import { signAccessToken } from "../rbac/jwt-rbac.js";
import { UnauthorizedError, BadRequestError } from "../../utils/errors.js";
import { mockT } from "../../tests/setup.js";
import { createMockStaffUser, createMockRefreshToken } from "../../../tests/factories.js";
import bcrypt from "bcrypt";

// Mock all dependencies
vi.mock("../staff-users/staff-user.repository.js");
vi.mock("../rbac/rbac.repository.js");
vi.mock("./auth.repository.js");
vi.mock("../rbac/jwt-rbac.js");
vi.mock("bcrypt");
vi.mock("../../utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("AuthService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("login", () => {
    const validInput = {
      email: "doctor@clinic.com",
      password: "SecurePass1",
    };

    const mockStaffUser = createMockStaffUser({
      email: "doctor@clinic.com",
      isActive: true,
      deletedAt: null,
    });

    const mockRbacData = {
      staffUser: mockStaffUser,
      roles: [{ id: "role-1", name: "Doctor", description: null, clinicId: null, createdAt: new Date(), updatedAt: new Date() }],
      permissions: [
        { id: "perm-1", key: "appointments:create", name: "Create Appointments", description: null, category: "appointments", createdAt: new Date() },
        { id: "perm-2", key: "appointments:view_all", name: "View All Appointments", description: null, category: "appointments", createdAt: new Date() },
      ],
    };

    it("should return tokens and user data for valid credentials", async () => {
      // Arrange
      vi.mocked(staffUserRepository.findByEmail).mockResolvedValue(mockStaffUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(rbacRepository.getStaffUserWithRolesAndPermissions).mockResolvedValue(mockRbacData);
      vi.mocked(signAccessToken).mockReturnValue("mock-access-token");
      vi.mocked(authRepository.create).mockResolvedValue("mock-refresh-token");

      // Act
      const result = await authService.login(validInput, mockT);

      // Assert
      expect(result).toEqual({
        accessToken: "mock-access-token",
        refreshToken: "mock-refresh-token",
        user: {
          id: mockStaffUser.id,
          name: mockStaffUser.name,
          email: mockStaffUser.email,
          userType: "staff",
          clinicId: undefined,
          roles: ["Doctor"],
        },
      });

      expect(staffUserRepository.findByEmail).toHaveBeenCalledWith("doctor@clinic.com");
      expect(bcrypt.compare).toHaveBeenCalledWith("SecurePass1", mockStaffUser.passwordHash);
      expect(rbacRepository.getStaffUserWithRolesAndPermissions).toHaveBeenCalledWith(
        mockStaffUser.id,
        undefined
      );
    });

    it("should include clinicId when provided (clinic-scoped login)", async () => {
      // Arrange
      const clinicId = "clinic-123";
      const inputWithClinic = { ...validInput, clinicId };

      vi.mocked(staffUserRepository.findByEmail).mockResolvedValue(mockStaffUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(rbacRepository.getStaffUserWithRolesAndPermissions).mockResolvedValue(mockRbacData);
      vi.mocked(signAccessToken).mockReturnValue("mock-access-token");
      vi.mocked(authRepository.create).mockResolvedValue("mock-refresh-token");

      // Act
      const result = await authService.login(inputWithClinic, mockT);

      // Assert
      expect(result.user.clinicId).toBe(clinicId);
      expect(rbacRepository.getStaffUserWithRolesAndPermissions).toHaveBeenCalledWith(
        mockStaffUser.id,
        clinicId
      );
      expect(signAccessToken).toHaveBeenCalledWith(
        expect.objectContaining({ clinicId })
      );
    });

    it("should throw UnauthorizedError for non-existent user", async () => {
      // Arrange
      vi.mocked(staffUserRepository.findByEmail).mockResolvedValue(undefined);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never); // Dummy hash comparison

      // Act & Assert
      await expect(authService.login(validInput, mockT)).rejects.toThrow(UnauthorizedError);
      await expect(authService.login(validInput, mockT)).rejects.toThrow("auth.invalidCredentials");
    });

    it("should throw UnauthorizedError for invalid password", async () => {
      // Arrange
      vi.mocked(staffUserRepository.findByEmail).mockResolvedValue(mockStaffUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      // Act & Assert
      await expect(authService.login(validInput, mockT)).rejects.toThrow(UnauthorizedError);
      await expect(authService.login(validInput, mockT)).rejects.toThrow("auth.invalidCredentials");
    });

    it("should throw UnauthorizedError for inactive user", async () => {
      // Arrange
      const inactiveUser = createMockStaffUser({ isActive: false });
      vi.mocked(staffUserRepository.findByEmail).mockResolvedValue(inactiveUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      // Act & Assert
      await expect(authService.login(validInput, mockT)).rejects.toThrow(UnauthorizedError);
      await expect(authService.login(validInput, mockT)).rejects.toThrow("auth.accountDeactivated");
    });

    it("should throw UnauthorizedError for soft-deleted user", async () => {
      // Arrange
      const deletedUser = createMockStaffUser({ deletedAt: new Date() });
      vi.mocked(staffUserRepository.findByEmail).mockResolvedValue(deletedUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      // Act & Assert
      await expect(authService.login(validInput, mockT)).rejects.toThrow(UnauthorizedError);
      await expect(authService.login(validInput, mockT)).rejects.toThrow("auth.accountDeactivated");
    });

    it("should perform constant-time password comparison (timing attack prevention)", async () => {
      // Arrange - user not found
      vi.mocked(staffUserRepository.findByEmail).mockResolvedValue(undefined);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      // Act
      await expect(authService.login(validInput, mockT)).rejects.toThrow();

      // Assert - bcrypt.compare should still be called with dummy hash
      expect(bcrypt.compare).toHaveBeenCalledWith(
        "SecurePass1",
        expect.stringContaining("$2b$12$")
      );
    });

    it("should store user agent and IP address in refresh token", async () => {
      // Arrange
      vi.mocked(staffUserRepository.findByEmail).mockResolvedValue(mockStaffUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(rbacRepository.getStaffUserWithRolesAndPermissions).mockResolvedValue(mockRbacData);
      vi.mocked(signAccessToken).mockReturnValue("mock-access-token");
      vi.mocked(authRepository.create).mockResolvedValue("mock-refresh-token");

      const meta = {
        userAgent: "Mozilla/5.0",
        ipAddress: "192.168.1.1",
      };

      // Act
      await authService.login(validInput, mockT, meta);

      // Assert
      expect(authRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userAgent: "Mozilla/5.0",
          ipAddress: "192.168.1.1",
        })
      );
    });
  });

  describe("refresh", () => {
    const rawToken = "raw-refresh-token";
    const mockStaffUser = createMockStaffUser();
    const mockStoredToken = createMockRefreshToken({
      staffUserId: mockStaffUser.id,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    });

    const mockRbacData = {
      staffUser: mockStaffUser,
      roles: [{ id: "role-1", name: "Doctor", description: null, clinicId: null, createdAt: new Date(), updatedAt: new Date() }],
      permissions: [
        { id: "perm-1", key: "appointments:create", name: "Create Appointments", description: null, category: "appointments", createdAt: new Date() },
      ],
    };

    it("should issue new tokens for valid refresh token", async () => {
      // Arrange
      vi.mocked(authRepository.findByRawToken).mockResolvedValue(mockStoredToken);
      vi.mocked(rbacRepository.getStaffUserWithRolesAndPermissions).mockResolvedValue(mockRbacData);
      vi.mocked(authRepository.revoke).mockResolvedValue(undefined);
      vi.mocked(signAccessToken).mockReturnValue("new-access-token");
      vi.mocked(authRepository.create).mockResolvedValue("new-refresh-token");

      // Act
      const result = await authService.refresh(rawToken, mockT);

      // Assert
      expect(result).toEqual({
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
      });

      expect(authRepository.findByRawToken).toHaveBeenCalledWith(rawToken);
      expect(authRepository.revoke).toHaveBeenCalledWith(mockStoredToken.id);
      expect(authRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          staffUserId: mockStaffUser.id,
          familyId: mockStoredToken.familyId, // Same family
        })
      );
    });

    it("should throw UnauthorizedError for non-existent token", async () => {
      // Arrange
      vi.mocked(authRepository.findByRawToken).mockResolvedValue(undefined);

      // Act & Assert
      await expect(authService.refresh(rawToken, mockT)).rejects.toThrow(UnauthorizedError);
      await expect(authService.refresh(rawToken, mockT)).rejects.toThrow("auth.invalidRefreshToken");
    });

    it("should revoke entire family on reused token (stolen token detection)", async () => {
      // Arrange
      const revokedToken = createMockRefreshToken({
        revokedAt: new Date(), // Already revoked
      });
      vi.mocked(authRepository.findByRawToken).mockResolvedValue(revokedToken);
      vi.mocked(authRepository.revokeFamilyAll).mockResolvedValue(undefined);

      // Act & Assert
      await expect(authService.refresh(rawToken, mockT)).rejects.toThrow(UnauthorizedError);
      await expect(authService.refresh(rawToken, mockT)).rejects.toThrow("auth.refreshTokenReused");

      expect(authRepository.revokeFamilyAll).toHaveBeenCalledWith(revokedToken.familyId);
    });

    it("should throw UnauthorizedError for expired token", async () => {
      // Arrange
      const expiredToken = createMockRefreshToken({
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        revokedAt: null,
      });
      vi.mocked(authRepository.findByRawToken).mockResolvedValue(expiredToken);
      vi.mocked(authRepository.revoke).mockResolvedValue(undefined);

      // Act & Assert
      await expect(authService.refresh(rawToken, mockT)).rejects.toThrow(UnauthorizedError);
      await expect(authService.refresh(rawToken, mockT)).rejects.toThrow("auth.refreshTokenExpired");

      expect(authRepository.revoke).toHaveBeenCalledWith(expiredToken.id);
    });

    it("should throw UnauthorizedError for inactive staff user", async () => {
      // Arrange
      const inactiveStaffUser = createMockStaffUser({ isActive: false });
      const rbacDataInactive = { ...mockRbacData, staffUser: inactiveStaffUser };

      vi.mocked(authRepository.findByRawToken).mockResolvedValue(mockStoredToken);
      vi.mocked(rbacRepository.getStaffUserWithRolesAndPermissions).mockResolvedValue(rbacDataInactive);
      vi.mocked(authRepository.revoke).mockResolvedValue(undefined);

      // Act & Assert
      await expect(authService.refresh(rawToken, mockT)).rejects.toThrow(UnauthorizedError);
      await expect(authService.refresh(rawToken, mockT)).rejects.toThrow("auth.accountNotFound");

      expect(authRepository.revoke).toHaveBeenCalledWith(mockStoredToken.id);
    });

    it("should throw UnauthorizedError for soft-deleted staff user", async () => {
      // Arrange
      const deletedStaffUser = createMockStaffUser({ deletedAt: new Date() });
      const rbacDataDeleted = { ...mockRbacData, staffUser: deletedStaffUser };

      vi.mocked(authRepository.findByRawToken).mockResolvedValue(mockStoredToken);
      vi.mocked(rbacRepository.getStaffUserWithRolesAndPermissions).mockResolvedValue(rbacDataDeleted);
      vi.mocked(authRepository.revoke).mockResolvedValue(undefined);

      // Act & Assert
      await expect(authService.refresh(rawToken, mockT)).rejects.toThrow(UnauthorizedError);
      await expect(authService.refresh(rawToken, mockT)).rejects.toThrow("auth.accountNotFound");
    });

    it("should load fresh permissions from database", async () => {
      // Arrange
      vi.mocked(authRepository.findByRawToken).mockResolvedValue(mockStoredToken);
      vi.mocked(rbacRepository.getStaffUserWithRolesAndPermissions).mockResolvedValue(mockRbacData);
      vi.mocked(authRepository.revoke).mockResolvedValue(undefined);
      vi.mocked(signAccessToken).mockReturnValue("new-access-token");
      vi.mocked(authRepository.create).mockResolvedValue("new-refresh-token");

      // Act
      await authService.refresh(rawToken, mockT);

      // Assert - should fetch fresh RBAC data
      expect(rbacRepository.getStaffUserWithRolesAndPermissions).toHaveBeenCalledWith(
        mockStaffUser.id
      );
    });
  });

  describe("logout", () => {
    it("should revoke the refresh token", async () => {
      // Arrange
      const rawToken = "raw-refresh-token";
      const mockStoredToken = createMockRefreshToken({ revokedAt: null });
      vi.mocked(authRepository.findByRawToken).mockResolvedValue(mockStoredToken);
      vi.mocked(authRepository.revoke).mockResolvedValue(undefined);

      // Act
      await authService.logout(rawToken);

      // Assert
      expect(authRepository.findByRawToken).toHaveBeenCalledWith(rawToken);
      expect(authRepository.revoke).toHaveBeenCalledWith(mockStoredToken.id);
    });

    it("should not throw error for non-existent token", async () => {
      // Arrange
      const rawToken = "non-existent-token";
      vi.mocked(authRepository.findByRawToken).mockResolvedValue(undefined);

      // Act & Assert - should not throw
      await expect(authService.logout(rawToken)).resolves.toBeUndefined();
    });

    it("should not revoke already-revoked token", async () => {
      // Arrange
      const rawToken = "raw-refresh-token";
      const revokedToken = createMockRefreshToken({ revokedAt: new Date() });
      vi.mocked(authRepository.findByRawToken).mockResolvedValue(revokedToken);
      vi.mocked(authRepository.revoke).mockResolvedValue(undefined);

      // Act
      await authService.logout(rawToken);

      // Assert - should not call revoke again
      expect(authRepository.revoke).not.toHaveBeenCalled();
    });
  });

  describe("logoutAll", () => {
    it("should revoke all tokens for the staff user", async () => {
      // Arrange
      const staffUserId = "staff-user-123";
      vi.mocked(authRepository.revokeAllForUser).mockResolvedValue(undefined);

      // Act
      await authService.logoutAll(staffUserId);

      // Assert
      expect(authRepository.revokeAllForUser).toHaveBeenCalledWith(staffUserId);
    });
  });

  describe("changePassword", () => {
    const staffUserId = "staff-user-123";
    const currentPassword = "OldPass123";
    const newPassword = "NewPass456";
    const mockStaffUser = createMockStaffUser({ id: staffUserId });

    it("should change password and revoke all sessions", async () => {
      // Arrange
      vi.mocked(staffUserRepository.findById).mockResolvedValue(mockStaffUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(bcrypt.hash).mockResolvedValue("new-hashed-password" as never);
      vi.mocked(staffUserRepository.update).mockResolvedValue(mockStaffUser);
      vi.mocked(authRepository.revokeAllForUser).mockResolvedValue(undefined);

      // Act
      await authService.changePassword(staffUserId, currentPassword, newPassword, mockT);

      // Assert
      expect(staffUserRepository.findById).toHaveBeenCalledWith(staffUserId);
      expect(bcrypt.compare).toHaveBeenCalledWith(currentPassword, mockStaffUser.passwordHash);
      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 12);
      expect(staffUserRepository.update).toHaveBeenCalledWith(staffUserId, {
        passwordHash: "new-hashed-password",
      });
      expect(authRepository.revokeAllForUser).toHaveBeenCalledWith(staffUserId);
    });

    it("should throw UnauthorizedError for non-existent user", async () => {
      // Arrange
      vi.mocked(staffUserRepository.findById).mockResolvedValue(undefined);

      // Act & Assert
      await expect(
        authService.changePassword(staffUserId, currentPassword, newPassword, mockT)
      ).rejects.toThrow(UnauthorizedError);
      await expect(
        authService.changePassword(staffUserId, currentPassword, newPassword, mockT)
      ).rejects.toThrow("auth.accountNotFound");
    });

    it("should throw BadRequestError for incorrect current password", async () => {
      // Arrange
      vi.mocked(staffUserRepository.findById).mockResolvedValue(mockStaffUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      // Act & Assert
      await expect(
        authService.changePassword(staffUserId, currentPassword, newPassword, mockT)
      ).rejects.toThrow(BadRequestError);
      await expect(
        authService.changePassword(staffUserId, currentPassword, newPassword, mockT)
      ).rejects.toThrow("staffUsers.incorrectPassword");
    });
  });
});
