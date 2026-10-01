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
            title="Chat"
            description="Messaging is not available yet. Use Support for help with your account."
          />
        );
      }}
    />
  );
}
