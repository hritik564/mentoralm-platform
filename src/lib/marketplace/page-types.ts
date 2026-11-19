import type { PublicOffering } from './types';

export const programSectionTypes = [
  'OVERVIEW',
  'OUTCOMES',
  'CURRICULUM',
  'ELIGIBILITY',
  'WHO_IS_IT_FOR',
  'HIGHLIGHTS',
  'FAQ',
  'TEXT',
] as const;
export type ProgramSectionType = (typeof programSectionTypes)[number];
export type ProgramPageSettings = {
  eyebrow: string | null;
  heroHeadline: string | null;
  heroSummary: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
};
type SectionContent =
  | { type: 'OVERVIEW' | 'TEXT'; content: { body: string } }
  | {
      type: 'OUTCOMES' | 'ELIGIBILITY' | 'WHO_IS_IT_FOR' | 'HIGHLIGHTS';
      content: { items: string[] };
    }
  | {
      type: 'CURRICULUM';
      content: { modules: { title: string; description: string }[] };
    }
  | { type: 'FAQ'; content: { items: { question: string; answer: string }[] } };
export type PublicProgramSection = SectionContent & {
  title: string;
  subtitle: string | null;
};
export type ProgramSectionInput = PublicProgramSection & { enabled: boolean };
export type ProgramPageSnapshot = {
  schemaVersion: 1;
  settings: ProgramPageSettings;
  sections: ProgramSectionInput[];
};
export type ProgramEditorialStatus =
  | 'NO_PUBLISHED_CONTENT'
  | 'DRAFT_CHANGES'
  | 'PUBLISHED'
  | 'DRAFT_CHANGES_SINCE_PUBLISH';
export type AdminProgramSection = ProgramSectionInput & {
  ref: string;
  position: number;
  createdAt: string;
  updatedAt: string;
};
export type AdminProgramPage = ProgramPageSettings & {
  offeringRef: string;
  revision: string | null;
  publishedRevision: string | null;
  publishedAt: string | null;
  hasDraftChanges: boolean;
  editorialStatus: ProgramEditorialStatus;
  sections: AdminProgramSection[];
};
export type PublicProgram = PublicOffering & {
  page: ProgramPageSettings & { sections: PublicProgramSection[] };
};
export type PublicProgramResult =
  | { status: 'ready'; program: PublicProgram | null }
  | { status: 'unavailable' };
