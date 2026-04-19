import type { Response } from "express";

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  meta?: Record<string, unknown>;
  errors?: unknown;
}

/**
 * Send success response
 * 
 * @param res - Express response
 * @param data - Response data
 * @param message - Success message (can be translation key or plain text)
 * @param statusCode - HTTP status code
 * @param meta - Optional metadata (pagination, etc.)
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = "Success",
  statusCode = 200,
  meta?: Record<string, unknown>
): Response => {
  const body: ApiResponse<T> = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
};

export const sendCreated = <T>(
  res: Response,
  data: T,
  message = "Created successfully"
): Response => sendSuccess(res, data, message, 201);

export const sendAccepted = <T>(
  res: Response,
  data: T,
  message = "Request accepted"
): Response => sendSuccess(res, data, message, 202);

export const sendNoContent = (res: Response): Response => 
  res.status(204).send();

/**
 * Send error response
 * 
 * @param res - Express response
 * @param message - Error message (can be translation key or plain text)
 * @param statusCode - HTTP status code
 * @param errors - Optional error details
 */
export const sendError = (
  res: Response,
  message: string,
  statusCode = 500,
  errors?: unknown
): Response => {
  const body: ApiResponse = { success: false, message };
  if (errors !== undefined) body.errors = errors;
  return res.status(statusCode).json(body);
};


