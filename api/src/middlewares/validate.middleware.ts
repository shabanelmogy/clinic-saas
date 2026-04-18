import type { Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";
import { sendError } from "../utils/response.js";

type ZodSchema = z.ZodTypeAny;
type SchemaFactory = (t: (key: string, params?: Record<string, string | number>) => string) => ZodSchema;

interface ValidationTargets {
  body?: ZodSchema | SchemaFactory;
  params?: ZodSchema | SchemaFactory;
  query?: ZodSchema | SchemaFactory;
}

/**
 * Reusable validation middleware factory.
 * Pass in Zod schemas for body, params, and/or query.
 * On failure, returns a 422 with structured field errors.
 *
 * Supports localized schemas:
 * - Pass a schema directly: validate({ body: createUserSchema })
 * - Pass a factory function: validate({ body: (t) => createUserSchemas(t).create })
 *
 * Usage:
 *   router.post("/", validate({ body: createUserSchema }), controller.create)
 *   router.post("/", validate({ body: (t) => createUserSchemas(t).create }), controller.create)
 */
export const validate =
  (schemas: ValidationTargets) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const errors: Record<string, string[]> = {};

    const targets = ["body", "params", "query"] as const;

    for (const target of targets) {
      let schema = schemas[target];
      if (!schema) continue;

      // If schema is a factory function, call it with req.t
      if (typeof schema === "function") {
        schema = schema(req.t);
      }

      const result = schema.safeParse(req[target]);

      if (!result.success) {
        const fieldErrors = (result.error as ZodError).flatten()
          .fieldErrors as Record<string, string[]>;
        for (const [field, messages] of Object.entries(fieldErrors)) {
          errors[`${target}.${field}`] = messages as string[];
        }
      } else {
        // Replace with coerced/transformed values
        (req as unknown as Record<string, unknown>)[target] = result.data;
      }
    }

    if (Object.keys(errors).length > 0) {
      sendError(res, req.t("common.validationFailed"), 422, errors);
      return;
    }

    next();
  };

