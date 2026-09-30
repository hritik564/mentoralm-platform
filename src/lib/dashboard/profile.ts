import type { AccountIdentity } from '../../components/auth/UserAvatar';
export interface StudentProfile extends AccountIdentity {
  lastName: string | null;
  phone: string | null;
  education: {
    level: string | null;
    institution: string | null;
    graduationYear: number | null;
    interests: readonly string[];
    careerGoals: string | null;
  } | null;
}
