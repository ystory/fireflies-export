import { ZodError, type ZodType, z } from "zod";

const nullableStringSchema = z.string().nullish();
const normalizedStringSchema = z
  .string()
  .nullish()
  .transform((value) => value ?? "");
const normalizedStringArraySchema = z
  .array(z.string())
  .nullish()
  .transform((value) => value ?? []);

export const manifestEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.number(),
  duration: z.number(),
  host_email: z.string(),
  organizer_email: z.string(),
  participants: z.array(z.string()),
  transcript_url: z.string(),
  collected: z.boolean(),
  collected_at: z.string().nullable(),
});

export const manifestSchema = z.object({
  last_full_sync: z.string().nullable(),
  entries: z.array(manifestEntrySchema),
});

export const requestCounterSchema = z.object({
  date: z.iso.date(),
  count: z.number().int().nonnegative(),
  blocked_until: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
});

const meetingAttendeeSchema = z
  .object({
    displayName: normalizedStringSchema,
    email: normalizedStringSchema,
    name: normalizedStringSchema,
  })
  .passthrough();

export const transcriptListItemSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    date: z.number(),
    duration: z.number(),
    host_email: normalizedStringSchema,
    organizer_email: normalizedStringSchema,
    participants: normalizedStringArraySchema,
    transcript_url: normalizedStringSchema,
    meeting_attendees: z.array(meetingAttendeeSchema).default([]),
  })
  .passthrough();

export const listTranscriptsResponseSchema = z.object({
  transcripts: z.array(transcriptListItemSchema),
});

const speakerSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    name: nullableStringSchema,
  })
  .passthrough();

const sentenceSchema = z
  .object({
    index: z.number(),
    speaker_name: nullableStringSchema,
    speaker_id: z.union([z.string(), z.number()]).nullish(),
    text: z.string(),
    raw_text: nullableStringSchema,
    start_time: z.number().nullish(),
    end_time: z.number().nullish(),
  })
  .passthrough();

const transcriptAttendeeSchema = z
  .object({
    displayName: nullableStringSchema,
    email: nullableStringSchema,
    phoneNumber: nullableStringSchema,
    name: nullableStringSchema,
    location: nullableStringSchema,
  })
  .passthrough();

const transcriptAttendanceSchema = z
  .object({
    name: nullableStringSchema,
    join_time: z.number().nullish(),
    leave_time: z.number().nullish(),
  })
  .passthrough();

export const transcriptSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    date: z.number(),
    dateString: nullableStringSchema,
    duration: z.number(),
    host_email: nullableStringSchema,
    organizer_email: nullableStringSchema,
    participants: z.array(z.string()).nullish(),
    transcript_url: nullableStringSchema,
    speakers: z.array(speakerSchema).default([]),
    sentences: z.array(sentenceSchema).default([]),
    meeting_attendees: z.array(transcriptAttendeeSchema).default([]),
    meeting_attendance: z.array(transcriptAttendanceSchema).default([]),
  })
  .passthrough();

export const transcriptDetailResponseSchema = z.object({
  transcript: transcriptSchema,
});

export type ManifestEntry = z.infer<typeof manifestEntrySchema>;
export type Manifest = z.infer<typeof manifestSchema>;
export type RequestCounter = z.infer<typeof requestCounterSchema>;
export type TranscriptListItem = z.infer<typeof transcriptListItemSchema>;
export type ListTranscriptsResponse = z.infer<
  typeof listTranscriptsResponseSchema
>;
export type Transcript = z.infer<typeof transcriptSchema>;
export type TranscriptDetailResponse = z.infer<
  typeof transcriptDetailResponseSchema
>;

function formatSchemaIssues(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

export function parseWithSchema<T>(
  schema: ZodType<T>,
  input: unknown,
  label: string,
): T {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(
        `${label} failed schema validation: ${formatSchemaIssues(error)}`,
      );
    }

    throw error;
  }
}
