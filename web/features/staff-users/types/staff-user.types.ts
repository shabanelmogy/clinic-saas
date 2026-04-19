export type StaffUserRecord = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateStaffUserInput = {
  name: string;
  email: string;
  password: string;
  phone?: string;
};

export type UpdateStaffUserInput = {
  name?: string;
  email?: string;
  phone?: string;
  isActive?: boolean;
  password?: string;
};

export type ListStaffUsersParams = {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
};
