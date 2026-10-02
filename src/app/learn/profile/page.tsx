import { requireStudentProfile } from '@/lib/dashboard/profile-server';
import { getLmsIdentity, getLmsRepository } from '@/lib/lms/services';
import { LmsBoundary } from '@/components/lms/LmsBoundary';
import { LmsProfile } from '@/components/lms/LmsProfile';
export const metadata = { title: 'Profile | MentoraLM Learning' };
export default function Page() {
  return (
    <LmsBoundary
      load={async () => {
        const repo = await getLmsRepository();
        const [profile, identity, courses] = await Promise.all([
          requireStudentProfile(),
          getLmsIdentity(),
          repo.courses(),
        ]);
        return (
          <LmsProfile
            profile={profile}
            identity={identity}
            courses={courses.map(({ id, title, program }) => ({
              id,
              title,
              program,
            }))}
          />
        );
      }}
    />
  );
}
