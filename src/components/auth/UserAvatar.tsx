import Image from 'next/image';
export type AccountIdentity = {
  name: string;
  firstName: string | null;
  email: string;
  imageUrl: string | null;
};

export function UserAvatar({ user }: { user: AccountIdentity }) {
  const initials = (user.name || user.email || 'M')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  return (
    <span className="account-avatar" aria-hidden="true">
      {/* Provider-controlled profile images may originate from Clerk or a connected identity provider. */}
      {user.imageUrl ? (
        <Image
          src={user.imageUrl}
          alt=""
          width={38}
          height={38}
          unoptimized
          referrerPolicy="no-referrer"
        />
      ) : (
        initials
      )}
    </span>
  );
}
