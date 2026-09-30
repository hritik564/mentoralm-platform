import { Icon } from '@/components/ui/Icon';

export function ModuleCarousel({
  current,
  count,
  onMove,
}: {
  current: number;
  count: number;
  onMove: (direction: number) => void;
}) {
  return (
    <div
      className="module-carousel-controls"
      aria-label="Module discovery controls"
    >
      <button
        type="button"
        aria-label="Previous module"
        aria-controls="module-discovery"
        disabled={current === 1}
        onClick={() => onMove(-1)}
      >
        <Icon name="arrow" />
      </button>
      <span
        className="module-carousel-status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="sr-only">Current module </span>
        {String(current).padStart(2, '0')}
        <span aria-hidden="true"> / </span>
        <span className="sr-only"> of </span>
        {String(count).padStart(2, '0')}
      </span>
      <button
        type="button"
        aria-label="Next module"
        aria-controls="module-discovery"
        disabled={current === count}
        onClick={() => onMove(1)}
      >
        <Icon name="arrow" />
      </button>
      <span className="module-carousel-hint">Swipe to discover</span>
    </div>
  );
}
