import 'server-only';
import { cache } from 'react';
import { getCurrentStudent } from '../student/session';
import { getDatabase } from '../db/client';
import { LmsRepository } from './repository';
import { currentBatch } from './batches';
export const getLmsRepository = cache(async () => {
  const repo = new LmsRepository(getDatabase(), await getCurrentStudent());
  await repo.authorize();
  return repo;
});
export const getLmsIdentity = cache(async () => {
  const repo = await getLmsRepository();
  const [studentId, batches] = await Promise.all([
    repo.studentId(),
    repo.batches(),
  ]);
  return { studentId, batches, currentBatch: currentBatch(batches) };
});
export async function getAuthorizedCourses() {
  return (await getLmsRepository()).courses();
}
export async function getCourseStructure(courseId: string) {
  return (await getLmsRepository()).courseStructure(courseId);
}

export async function getLearningRepository() {
  const { LearningRepository } = await import('./learning');
  return new LearningRepository(getDatabase(), await getCurrentStudent());
}
export async function getAcademics() {
  const { Academics } = await import('./academics');
  return new Academics(getDatabase(), await getCurrentStudent());
}
