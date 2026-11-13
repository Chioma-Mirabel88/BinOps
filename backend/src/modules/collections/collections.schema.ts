import { z } from "zod";

export const collectionRequestSchema = z.object({
  serviceAddress: z.string().trim().min(5).max(1000),
  serviceArea: z.string().trim().min(2).max(150),
  wasteCategory: z.enum([
    "general",
    "recyclable",
    "organic",
    "other",
  ]),
  binFullness: z.enum([
    "low",
    "medium",
    "high",
    "full",
  ]),
}).strict();

export type CollectionRequestInput = z.infer<
  typeof collectionRequestSchema
>;

export const assignCollectionRequestSchema = z.object({
  pspOrganisationId: z.string().uuid(),
}).strict();

export type AssignCollectionRequestInput = z.infer<
  typeof assignCollectionRequestSchema
>;

export const updatePspCollectionStatusSchema = z.object({
  status: z.enum(["scheduled", "in_progress", "collected"]),
  scheduledFor: z.string().datetime().optional(),
  collectedWeightKg: z.number().positive().multipleOf(0.01).max(99999999999.99).optional(),
}).strict()
  .refine(
    (data) => data.status !== "scheduled" || data.scheduledFor !== undefined,
    {
      message: "A scheduled date and time are required.",
      path: ["scheduledFor"],
    },
  )
  .refine(
    (data) => data.status !== "collected" || data.collectedWeightKg !== undefined,
    {
      message: "Actual collected weight in kilograms is required.",
      path: ["collectedWeightKg"],
    },
  );

export type UpdatePspCollectionStatusInput = z.infer<
  typeof updatePspCollectionStatusSchema
>;

export const createWasteHandoverSchema = z.object({
  facilityId: z.string().uuid(),
  wasteCategory: z.enum(["general", "recyclable", "organic", "other"]),
  quantity: z.number().positive().max(99999999999.999),
  quantityUnit: z.enum(["kg", "tonne", "litre", "bag"]),
  evidenceHash: z.string().regex(/^[a-fA-F0-9]{64}$/).optional(),
}).strict();

export type CreateWasteHandoverInput = z.infer<
  typeof createWasteHandoverSchema
>;
