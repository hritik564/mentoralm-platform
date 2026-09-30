import Image from 'next/image';
// Both crops display the original official JPEG, without replacement lettering or recoloring.
export function Brand() {
  return (
    <a href="#top" className="brand" aria-label="MentoraLM home">
      <span className="brand__mark" aria-hidden="true">
        <Image
          src="/brand/mentoralm-logo.jpeg"
          alt=""
          width={1320}
          height={864}
        />
      </span>
      <span className="brand__wordmark" aria-hidden="true">
        <Image
          src="/brand/mentoralm-logo.jpeg"
          alt=""
          width={1320}
          height={864}
        />
      </span>
    </a>
  );
}
