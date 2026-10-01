'use client';
import { useState } from 'react';
export function PrivateMedia({
  src,
  title,
  format,
  alt,
  captions,
}: {
  src: string;
  title: string;
  format: 'VIDEO' | 'IMAGE';
  alt: string;
  captions: string | null;
}) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <section className="l2-unavailable">
        <h3>Lesson media unavailable</h3>
        <p>
          The lesson file could not be loaded. Please try again later or contact
          Support.
        </p>
      </section>
    );
  return format === 'IMAGE' ? (
    <picture>
      <img
        src={src}
        alt={alt}
        ref={(node) => {
          if (node?.complete && node.naturalWidth === 0) setFailed(true);
        }}
        onError={() => setFailed(true)}
      />
    </picture>
  ) : (
    <>
      <video
        controls
        ref={(node) => {
          if (node && (node.error || node.networkState === 3)) setFailed(true);
        }}
        preload="metadata"
        aria-label={title}
        onError={() => setFailed(true)}
      >
        <source src={src} onError={() => setFailed(true)} />
        {captions && (
          <track
            kind="captions"
            src={captions}
            srcLang="en"
            label="English"
            default
          />
        )}
        Your browser cannot play this video.
      </video>
      {!captions && (
        <p className="l2-caption-note">
          Captions are not available for this lesson yet.
        </p>
      )}
    </>
  );
}
