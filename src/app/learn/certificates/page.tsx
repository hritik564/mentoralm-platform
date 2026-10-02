import {
  getAcademics,
  getLmsRepository,
  getLearningRepository,
} from '@/lib/lms/services';
import { LmsBoundary } from '@/components/lms/LmsBoundary';
import { CertificateList } from '@/components/lms/CertificateList';
export default function Page() {
  return (
    <LmsBoundary
      load={async () => {
        await getLmsRepository();
        const [certificates, courses] = await Promise.all([
          (await getAcademics()).certificates(),
          (await getLearningRepository()).courses(),
        ]);
        return (
          <CertificateList certificates={certificates} courses={courses} />
        );
      }}
    />
  );
}
