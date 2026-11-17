'use client';
import Image from 'next/image';
import { useId, useState, type ReactNode } from 'react';
import type { HomepageProgram } from './programs';

type CarouselProgram = Pick<
  HomepageProgram,
  'id' | 'title' | 'subtitle' | 'image'
> & { content: ReactNode };
function CarouselArrow({ direction }: { direction: 'previous' | 'next' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={direction === 'previous' ? 'm14 5-7 7 7 7' : 'm10 5 7 7-7 7'}
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function ProgramCarousel({
  programs,
}: {
  programs: readonly CarouselProgram[];
}) {
  const [active, setActive] = useState(0);
  const stageId = useId(),
    next = (active + 1) % programs.length;
  function move(direction: number) {
    setActive(
      (value) => (value + direction + programs.length) % programs.length,
    );
  }
  return (
    <section
      className="homepage-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="MentoraLM programs"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          move(1);
        }
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          move(-1);
        }
      }}
    >
      <div className="homepage-carousel-track">
        <div className="homepage-carousel-main">
          <div className="homepage-carousel-stage" id={stageId}>
            {programs.map((program, index) => (
              <div
                key={program.id}
                className={`homepage-program-slide ${index === active ? 'is-active' : ''}`}
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${programs.length}: ${program.title}`}
                aria-hidden={index !== active}
                inert={index !== active}
              >
                {program.content}
              </div>
            ))}
          </div>
          <div className="homepage-carousel-controls">
            <button
              type="button"
              className="homepage-carousel-arrow is-previous"
              aria-label="Previous program"
              aria-controls={stageId}
              onClick={() => move(-1)}
            >
              <CarouselArrow direction="previous" />
            </button>
            <button
              type="button"
              className="homepage-carousel-arrow is-next"
              aria-label="Next program"
              aria-controls={stageId}
              onClick={() => move(1)}
            >
              <CarouselArrow direction="next" />
            </button>
          </div>
        </div>
        <button
          type="button"
          className="homepage-program-preview"
          aria-label={`Next program: ${programs[next].title}`}
          aria-controls={stageId}
          onClick={() => move(1)}
        >
          <span className="homepage-preview-copy">
            <span className="homepage-preview-eyebrow">Coming next</span>
            <strong>
              {programs[next].id === 'careerignite' ? (
                <>
                  Career<span>Ignite</span>
                </>
              ) : (
                <>
                  YoungMinds
                  <br />
                  AI <span>Lab</span>
                </>
              )}
            </strong>
            <span className="homepage-preview-subtitle">
              {programs[next].subtitle}
            </span>
          </span>
          <span className="homepage-preview-art">
            <Image
              src={programs[next].image}
              alt=""
              fill
              sizes="(max-width: 1100px) 180px, 17vw"
            />
          </span>
        </button>
      </div>
      <div
        className="homepage-carousel-indicators"
        aria-label="Choose a program"
      >
        {programs.map((program, index) => (
          <button
            key={program.id}
            type="button"
            aria-label={`Show ${program.title}`}
            aria-pressed={index === active}
            aria-controls={stageId}
            onClick={() => setActive(index)}
          >
            <span />
          </button>
        ))}
      </div>
      <p
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {active + 1} of {programs.length}: {programs[active].title}
      </p>
      <noscript>
        <style>{`.homepage-carousel-controls,.homepage-carousel-indicators,.homepage-program-preview {display:none !important}.homepage-carousel-track{grid-template-columns:minmax(0,1fr) !important}`}</style>
      </noscript>
    </section>
  );
}
