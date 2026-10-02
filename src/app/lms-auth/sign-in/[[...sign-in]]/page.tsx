import { LmsAuthEntry } from '@/components/lms/LmsAuthEntry';
export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <LmsAuthEntry mode="sign-in" searchParams={searchParams} />;
}
