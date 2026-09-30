/** Opt-in decoration only; place inside a positioned, isolated scene. */
export function AmbientField({
  stars = false,
  orbit = false,
  className = '',
}: {
  stars?: boolean;
  orbit?: boolean;
  className?: string;
}) {
  return (
    <div className={`ambient-field ${className}`} aria-hidden="true">
      {stars && <span className="ambient-field__stars" />}
      {orbit && <span className="ambient-field__orbit" />}
    </div>
  );
}
