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
            title="Discussions"
            description="Course discussions will be introduced in a later phase."
          />
        );
      }}
    />
  );
}
