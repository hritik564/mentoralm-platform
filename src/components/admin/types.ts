import type { AdminRepository } from '@/lib/admin/repository';
export type StudentList = Awaited<ReturnType<AdminRepository['students']>>;
export type StudentDetail = Awaited<ReturnType<AdminRepository['student']>>;
export type BatchList = Awaited<ReturnType<AdminRepository['batches']>>;
export type BatchDetail = Awaited<ReturnType<AdminRepository['batch']>>;
export type Overview = Awaited<ReturnType<AdminRepository['overview']>>;
export type Choice = { ref: string; label: string };
