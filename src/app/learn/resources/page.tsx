import { FutureSurface } from '@/components/lms/LmsViews';
import { LmsBoundary } from '@/components/lms/LmsBoundary';
import { getLmsRepository } from '@/lib/lms/services';
export default function Page() {
  return (
    <LmsBoundary
      load={async () => {
        await getLmsRepository();
        return (
          <FutureSurface
            title="Resources"
            description="Course learning resources will be introduced here later. Your existing student resources remain in the Dashboard."
          />
        );
      }}
    />
  );
}
