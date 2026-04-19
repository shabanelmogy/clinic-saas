import { describe, it, expect, beforeEach, vi } from "vitest";
import { patientService } from "./patient.service.js";
import { patientRepository } from "./patient.repository.js";
import { NotFoundError, ConflictError, ForbiddenError } from "../../utils/errors.js";
import { mockT } from "../../tests/setup.js";
import { createMockPatient, createMockContext } from "../../tests/factories.js";

// Mock dependencies
vi.mock("./patient.repository.js");
vi.mock("../../utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("PatientService - Multi-Tenant Isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Multi-Tenant Isolation", () => {
    it("should prevent staff from accessing other clinic's patients", async () => {
      // Arrange
      const clinicAContext = {
        clinicId: "clinic-a",
        userId: "staff-1",
        permissions: ["patients:view"],
      };
      const clinicBPatientId = "patient-in-clinic-b";

      // Mock repository returns undefined (patient not in clinic A)
      vi.mocked(patientRepository.findById).mockResolvedValue(undefined);

      // Act & Assert
      await expect(
        patientService.getPatientById(clinicBPatientId, clinicAContext, mockT)
      ).rejects.toThrow(NotFoundError);
      await expect(
        patientService.getPatientById(clinicBPatientId, clinicAContext, mockT)
      ).rejects.toThrow("patients.notFound");

      // Verify repository was called with correct clinicId
      expect(patientRepository.findById).toHaveBeenCalledWith(
        clinicBPatientId,
        "clinic-a"  // ← Must use clinic from context, not from request
      );
    });

    it("should only list patients from staff's clinic", async () => {
      // Arrange
      const clinicAContext = {
        clinicId: "clinic-a",
        userId: "staff-1",
        permissions: ["patients:view"],
      };

      const clinicAPatients = [
        createMockPatient({ id: "patient-1", clinicId: "clinic-a" }),
        createMockPatient({ id: "patient-2", clinicId: "clinic-a" }),
      ];

      vi.mocked(patientRepository.findAllForClinic).mockResolvedValue({
        data: clinicAPatients,
        total: 2,
      });

      // Act
      const result = await patientService.listPatients(
        { page: 1, limit: 10 },
        clinicAContext,
        mockT
      );

      // Assert
      expect(result.data).toHaveLength(2);
      expect(result.data.every(p => p.clinicId === "clinic-a")).toBe(true);
      expect(patientRepository.findAllForClinic).toHaveBeenCalledWith(
        "clinic-a",  // ← Must use clinic from context
        { page: 1, limit: 10 }
      );
    });

    it("should create patient in staff's clinic only", async () => {
      // Arrange
      const clinicAContext = {
        clinicId: "clinic-a",
        userId: "staff-1",
        permissions: ["patients:create"],
      };

      const input = {
        name: "John Doe",
        email: "john@example.com",
      };

      const createdPatient = createMockPatient({
        ...input,
        clinicId: "clinic-a",
      });

      vi.mocked(patientRepository.findByEmail).mockResolvedValue(undefined);
      vi.mocked(patientRepository.create).mockResolvedValue(createdPatient);

      // Act
      const result = await patientService.createPatient(input, clinicAContext, mockT);

      // Assert
      expect(result.clinicId).toBe("clinic-a");
      expect(patientRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          clinicId: "clinic-a",  // ← Must use clinic from context
        })
      );
    });
  });

  describe("Permission Checks", () => {
    it("should require permission to view patients", async () => {
      // Arrange
      const contextWithoutPermission = {
        clinicId: "clinic-1",
        userId: "staff-1",
        permissions: ["patients:create"],  // Missing "patients:view"
      };

      // Act & Assert
      await expect(
        patientService.listPatients({ page: 1, limit: 10 }, contextWithoutPermission, mockT)
      ).rejects.toThrow(ForbiddenError);
    });

    it("should require permission to create patient", async () => {
      // Arrange
      const contextWithoutPermission = {
        clinicId: "clinic-1",
        userId: "staff-1",
        permissions: ["patients:view"],  // Missing "patients:create"
      };

      const input = { name: "John Doe" };

      // Act & Assert
      await expect(
        patientService.createPatient(input, contextWithoutPermission, mockT)
      ).rejects.toThrow(ForbiddenError);
    });

    it("should require permission to update patient", async () => {
      // Arrange
      const contextWithoutPermission = {
        clinicId: "clinic-1",
        userId: "staff-1",
        permissions: ["patients:view"],  // Missing "patients:update"
      };

      // Act & Assert
      await expect(
        patientService.updatePatient("patient-1", {}, contextWithoutPermission, mockT)
      ).rejects.toThrow(ForbiddenError);
    });

    it("should require permission to delete patient", async () => {
      // Arrange
      const contextWithoutPermission = {
        clinicId: "clinic-1",
        userId: "staff-1",
        permissions: ["patients:view"],  // Missing "patients:delete"
      };

      // Act & Assert
      await expect(
        patientService.deletePatient("patient-1", contextWithoutPermission, mockT)
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("Business Logic", () => {
    it("should prevent duplicate email within clinic", async () => {
      // Arrange
      const context = {
        clinicId: "clinic-1",
        userId: "staff-1",
        permissions: ["patients:create"],
      };

      const existingPatient = createMockPatient({
        email: "test@example.com",
        clinicId: "clinic-1",
      });

      vi.mocked(patientRepository.findByEmail).mockResolvedValue(existingPatient);

      // Act & Assert
      await expect(
        patientService.createPatient(
          { name: "John Doe", email: "test@example.com" },
          context,
          mockT
        )
      ).rejects.toThrow(ConflictError);
      await expect(
        patientService.createPatient(
          { name: "John Doe", email: "test@example.com" },
          context,
          mockT
        )
      ).rejects.toThrow("patients.emailExists");
    });

    it("should prevent duplicate nationalId within clinic", async () => {
      // Arrange
      const context = {
        clinicId: "clinic-1",
        userId: "staff-1",
        permissions: ["patients:create"],
      };

      const existingPatient = createMockPatient({
        nationalId: "123456789",
        clinicId: "clinic-1",
      });

      vi.mocked(patientRepository.findByEmail).mockResolvedValue(undefined);
      vi.mocked(patientRepository.findByNationalId).mockResolvedValue(existingPatient);

      // Act & Assert
      await expect(
        patientService.createPatient(
          { name: "John Doe", nationalId: "123456789" },
          context,
          mockT
        )
      ).rejects.toThrow(ConflictError);
      await expect(
        patientService.createPatient(
          { name: "John Doe", nationalId: "123456789" },
          context,
          mockT
        )
      ).rejects.toThrow("patients.nationalIdExists");
    });

    it("should allow same email in different clinics", async () => {
      // Arrange
      const clinicAContext = {
        clinicId: "clinic-a",
        userId: "staff-1",
        permissions: ["patients:create"],
      };

      const clinicBContext = {
        clinicId: "clinic-b",
        userId: "staff-2",
        permissions: ["patients:create"],
      };

      const email = "john@example.com";

      // Patient exists in clinic A
      const clinicAPatient = createMockPatient({ email, clinicId: "clinic-a" });
      
      // Mock: email not found in clinic B
      vi.mocked(patientRepository.findByEmail)
        .mockResolvedValueOnce(undefined)  // First call (clinic B check)
        .mockResolvedValueOnce(clinicAPatient);  // Second call (clinic A check)

      vi.mocked(patientRepository.create).mockResolvedValue(
        createMockPatient({ email, clinicId: "clinic-b" })
      );

      // Act - Create patient with same email in clinic B
      const result = await patientService.createPatient(
        { name: "John Doe", email },
        clinicBContext,
        mockT
      );

      // Assert - Should succeed
      expect(result.email).toBe(email);
      expect(result.clinicId).toBe("clinic-b");
    });

    it("should normalize email to lowercase", async () => {
      // Arrange
      const context = {
        clinicId: "clinic-1",
        userId: "staff-1",
        permissions: ["patients:create"],
      };

      vi.mocked(patientRepository.findByEmail).mockResolvedValue(undefined);
      vi.mocked(patientRepository.create).mockResolvedValue(
        createMockPatient({ email: "john@example.com" })
      );

      // Act
      await patientService.createPatient(
        { name: "John Doe", email: "John@Example.COM" },
        context,
        mockT
      );

      // Assert
      expect(patientRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "john@example.com",  // ← Normalized to lowercase
        })
      );
    });

    it("should throw NotFoundError when updating non-existent patient", async () => {
      // Arrange
      const context = {
        clinicId: "clinic-1",
        userId: "staff-1",
        permissions: ["patients:update"],
      };

      vi.mocked(patientRepository.findById).mockResolvedValue(undefined);

      // Act & Assert
      await expect(
        patientService.updatePatient("non-existent-id", { name: "New Name" }, context, mockT)
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw NotFoundError when deleting non-existent patient", async () => {
      // Arrange
      const context = {
        clinicId: "clinic-1",
        userId: "staff-1",
        permissions: ["patients:delete"],
      };

      vi.mocked(patientRepository.findById).mockResolvedValue(undefined);

      // Act & Assert
      await expect(
        patientService.deletePatient("non-existent-id", context, mockT)
      ).rejects.toThrow(NotFoundError);
    });
  });
});
