import type { AcademicAuthoring } from '@/lib/admin/academic/authoring';
export type Builder = Awaited<ReturnType<AcademicAuthoring['builder']>>;
export type ItemDetail = Awaited<ReturnType<AcademicAuthoring['item']>>;
export type Programs = Awaited<ReturnType<AcademicAuthoring['programs']>>;
export type Courses = Awaited<ReturnType<AcademicAuthoring['courses']>>;
export type Banks = Awaited<ReturnType<AcademicAuthoring['banks']>>;
export type Bank = Awaited<ReturnType<AcademicAuthoring['bank']>>;
export type Activities = Awaited<ReturnType<AcademicAuthoring['activities']>>;
export type Choices = { ref: string; label: string }[];
