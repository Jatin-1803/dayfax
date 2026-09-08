import { z } from 'zod';

export const createSynonymGroupSchema = z.object({
  canonicalTerm: z.string().trim().min(1).max(120),
  terms: z.array(z.string().trim().min(1).max(120)).max(50).optional(),
  isActive: z.boolean().optional(),
});

export type CreateSynonymGroupInput = z.infer<typeof createSynonymGroupSchema>;

export const updateSynonymGroupSchema = z.object({
  canonicalTerm: z.string().trim().min(1).max(120).optional(),
  isActive: z.boolean().optional(),
});

export type UpdateSynonymGroupInput = z.infer<typeof updateSynonymGroupSchema>;

export const addSynonymTermSchema = z.object({
  term: z.string().trim().min(1).max(120),
});

export type AddSynonymTermInput = z.infer<typeof addSynonymTermSchema>;

export const synonymGroupIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const synonymTermParamsSchema = z.object({
  id: z.string().uuid(),
  termId: z.string().uuid(),
});

export const productIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const putProductAliasesSchema = z.object({
  aliases: z.array(z.string().trim().min(1).max(120)).max(50),
});

export type PutProductAliasesInput = z.infer<typeof putProductAliasesSchema>;

export const zeroResultsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
  days: z.coerce.number().int().positive().max(90).optional(),
});

export type ZeroResultsQuery = z.infer<typeof zeroResultsQuerySchema>;
