import { z } from "zod";

const commonFields = {
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  phone: z.string().trim().max(30).optional(),
  password: z
    .string()
    .min(12, "Password must contain at least 12 characters.")
    .refine(
      (value) => Buffer.byteLength(value, "utf8") <= 72,
      "Password must not exceed 72 bytes."
    ),
};

const organisationFields = {
  ...commonFields,
  organisationName: z.string().trim().min(2).max(255),
  serviceArea: z.string().trim().max(255).optional(),
};

export const registrationSchema = z.discriminatedUnion("accountType", [
  z.object({
    accountType: z.literal("individual"),
    ...commonFields,
  }),
  z.object({
    accountType: z.literal("business"),
    ...organisationFields,
  }),
  z.object({
    accountType: z.literal("psp"),
    ...organisationFields,
  }),
  z.object({
    accountType: z.literal("recycler"),
    ...organisationFields,
  }),
  z.object({
    accountType: z.literal("hospital"),
    ...organisationFields,
  }),
  z.object({
    accountType: z.literal("pharmacy"),
    ...organisationFields,
  }),
]);

export type RegistrationInput = z.infer<typeof registrationSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email().max(255)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(72),
});

export type LoginInput = z.infer<typeof loginSchema>;
