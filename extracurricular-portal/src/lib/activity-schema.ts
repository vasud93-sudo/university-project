import { z } from "zod";

// Form inputs arrive as "" for empty optional fields (from <input type="date">
// etc) rather than undefined/null - normalize those before the real check so
// z.coerce.date() doesn't choke on `new Date("")`.
const optionalDate = z.preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.date().optional().nullable());
const optionalString = z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().optional().nullable());

export const activityInputSchema = z.object({
  title: z.string().min(3),
  organizer: optionalString,
  summary: z.string().min(3),
  description: z.string().min(3),
  link: z.string().url(),
  fee: optionalString,
  mode: optionalString,
  location: optionalString,
  minGrade: z.coerce.number().int().min(1).max(12),
  maxGrade: z.coerce.number().int().min(1).max(12),
  registrationOpensOn: optionalDate,
  registrationDeadline: z.coerce.date(),
  eventDate: optionalDate,
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  clusterId: z.string().min(1),
  sourceNote: optionalString,
});

export type ActivityInput = z.infer<typeof activityInputSchema>;
