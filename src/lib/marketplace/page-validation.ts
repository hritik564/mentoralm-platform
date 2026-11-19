import { z } from 'zod';

export const MAX_PROGRAM_SECTIONS = 20;
const plain = (max: number, required = false) =>
  z
    .string()
    .trim()
    .max(max)
    .refine(
      (value) =>
        !/[<>]/.test(value) &&
        [...value].every(
          (character) =>
            character.charCodeAt(0) >= 32 ||
            ['\n', '\r', '\t'].includes(character),
        ),
    )
    .refine((value) => !required || value.length > 0);
const optionalText = (max: number) =>
  plain(max)
    .nullable()
    .transform((value) => value || null);
export const programPagePresentationInput = z
  .object({
    eyebrow: optionalText(100),
    heroHeadline: optionalText(200),
    heroSummary: optionalText(1200),
    seoTitle: optionalText(160),
    seoDescription: optionalText(320),
  })
  .strict();
export const pageSettingsInput = programPagePresentationInput
  .extend({
    revision: z.string().uuid().nullable(),
  })
  .strict();
const sectionFields = {
  title: plain(160, true),
  subtitle: optionalText(300),
  enabled: z.boolean(),
};
const body = z.object({ body: plain(6000) }).strict();
const list = z.object({ items: z.array(plain(300, true)).max(20) }).strict();
export const programSectionInput = z.discriminatedUnion('type', [
  z
    .object({ ...sectionFields, type: z.literal('OVERVIEW'), content: body })
    .strict(),
  z
    .object({ ...sectionFields, type: z.literal('TEXT'), content: body })
    .strict(),
  z
    .object({ ...sectionFields, type: z.literal('OUTCOMES'), content: list })
    .strict(),
  z
    .object({ ...sectionFields, type: z.literal('ELIGIBILITY'), content: list })
    .strict(),
  z
    .object({
      ...sectionFields,
      type: z.literal('WHO_IS_IT_FOR'),
      content: list,
    })
    .strict(),
  z
    .object({ ...sectionFields, type: z.literal('HIGHLIGHTS'), content: list })
    .strict(),
  z
    .object({
      ...sectionFields,
      type: z.literal('CURRICULUM'),
      content: z
        .object({
          modules: z
            .array(
              z
                .object({
                  title: plain(160, true),
                  description: plain(1200),
                })
                .strict(),
            )
            .max(12),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...sectionFields,
      type: z.literal('FAQ'),
      content: z
        .object({
          items: z
            .array(
              z
                .object({
                  question: plain(240, true),
                  answer: plain(2000, true),
                })
                .strict(),
            )
            .max(12),
        })
        .strict(),
    })
    .strict(),
]);
function sectionWithRevision<T extends z.ZodType>(revision: T) {
  const options = programSectionInput.options;
  return z.discriminatedUnion('type', [
    options[0].extend({ revision }),
    options[1].extend({ revision }),
    options[2].extend({ revision }),
    options[3].extend({ revision }),
    options[4].extend({ revision }),
    options[5].extend({ revision }),
    options[6].extend({ revision }),
    options[7].extend({ revision }),
  ]);
}
export const createProgramSectionInput = sectionWithRevision(
  z.string().uuid().nullable(),
);
export const updateProgramSectionInput = sectionWithRevision(z.string().uuid());
export const programPageSnapshotInput = z
  .object({
    schemaVersion: z.literal(1),
    settings: programPagePresentationInput,
    sections: z.array(programSectionInput).max(MAX_PROGRAM_SECTIONS),
  })
  .strict();
export const publishProgramPageInput = z
  .object({ revision: z.string().uuid() })
  .strict();

/** Validation fixes object-key order while preserving editorial section/item order. */
export function canonicalProgramPageSnapshot(value: unknown) {
  return JSON.stringify(programPageSnapshotInput.parse(value));
}
export const programSectionEnabledInput = z
  .object({
    revision: z.string().uuid(),
    enabled: z.boolean(),
  })
  .strict();
export const reorderProgramSectionsInput = z
  .object({
    revision: z.string().uuid(),
    sectionRefs: z
      .array(z.string().regex(/^[a-zA-Z0-9_-]{35,500}$/))
      .max(MAX_PROGRAM_SECTIONS),
  })
  .strict()
  .refine(
    (value) => new Set(value.sectionRefs).size === value.sectionRefs.length,
  );
export const publicProgramSlugInput = z
  .string()
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export function programSectionHasContent(
  section: z.infer<typeof programSectionInput>,
) {
  if (section.type === 'OVERVIEW' || section.type === 'TEXT')
    return !!section.content.body;
  if (section.type === 'CURRICULUM') return section.content.modules.length > 0;
  return section.content.items.length > 0;
}
