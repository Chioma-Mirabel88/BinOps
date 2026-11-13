import { z } from "zod";

export const createFundingSchema = z.object({
  sourceType: z.enum([
    "subscription_allocation",
    "sponsorship",
    "csr",
    "grant",
    "provider_contribution",
    "other",
  ]),
  sourceReference: z.string().trim().min(1).max(255).optional(),
  amountFunded: z.number().positive().max(999999999999.99)
    .refine((value) => Number.isInteger(value * 100), {
      message: "Amount must have no more than two decimal places.",
    }),
}).strict();

export const issueHealthCreditsSchema = z.object({
  accountId: z.string().uuid(),
  fundingId: z.string().uuid(),
  amount: z.number().positive().max(999999999999.99)
    .refine((value) => Number.isInteger(value * 100), {
      message: "Amount must have no more than two decimal places.",
    }),
  idempotencyKey: z.string().trim().min(8).max(255),
  description: z.string().trim().max(500).optional(),
}).strict();

export const redeemHealthCreditsSchema = z.object({
  accountId: z.string().uuid(),
  amount: z.number().positive().max(999999999999.99)
    .refine((value) => Number.isInteger(value * 100), {
      message: "Amount must have no more than two decimal places.",
    }),
  idempotencyKey: z.string().trim().min(8).max(255),
  description: z.string().trim().max(500).optional(),
}).strict();
