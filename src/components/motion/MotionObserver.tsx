'use client';
import { useEffect } from 'react';
export function MotionObserver() {
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let observer: IntersectionObserver | undefined;
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>('[data-reveal]'),
    );
    const reset = () => {
      observer?.disconnect();
      elements.forEach((element) => element.classList.remove('reveal-pending'));
    };
    const setup = () => {
      reset();
      if (media.matches || !('IntersectionObserver' in window)) return;
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.remove('reveal-pending');
              observer?.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.08 },
      );
      elements.forEach((element) => {
        if (element.getBoundingClientRect().top > window.innerHeight) {
          element.classList.add('reveal-pending');
          observer?.observe(element);
        }
      });
    };
    setup();
    media.addEventListener('change', setup);
    return () => {
      reset();
      media.removeEventListener('change', setup);
    };
  }, []);
  return null;
}
