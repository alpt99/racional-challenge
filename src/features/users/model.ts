import { z } from "zod";

const nameSchema = z.string().trim().min(1).max(255);
const phoneSchema = z
  .string()
  .trim()
  .regex(/^[\d+().\-\s]+$/, "Invalid phone format")
  .min(6)
  .max(32);

export const createUserSchema = z.object({
  email: z.string().email(),
  name: nameSchema.optional(),
  phone: phoneSchema.optional(),
  birthDate: z.coerce.date().optional(),
});

export const updateUserSchema = createUserSchema.partial().extend({
  id: z.number().int().positive(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
