import { getAcademics } from '@/lib/lms/services';
import { LmsBoundary } from '@/components/lms/LmsBoundary';
import { AttendanceView } from '@/components/lms/AttendanceView';
export default function Page() {
  return (
    <LmsBoundary
      load={async () => (
        <AttendanceView
          attendance={await (await getAcademics()).attendance()}
        />
      )}
    />
  );
}
