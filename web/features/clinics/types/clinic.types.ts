export type Clinic = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo: string | null;
  isActive: boolean;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UpdateClinicInput = {
  name?: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  isActive?: boolean;
  isPublished?: boolean;
};

export type ListClinicsParams = { page?: number; limit?: number; search?: string };
