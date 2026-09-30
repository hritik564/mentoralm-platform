'use client';
import { useId, useRef } from 'react';
import { Icon } from './Icon';
export function NoticeButton({
  children,
  title,
  description,
  className = 'text-link',
  arrow = false,
  href,
  accessibleName,
  dataAttributes,
}: {
  children: React.ReactNode;
  title: string;
  description: string;
  className?: string;
  arrow?: boolean;
  href?: string;
  accessibleName?: string;
  dataAttributes?: Record<`data-${string}`, string>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const continueButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  return (
    <>
      {href ? (
        <a
          href={href}
          className={className}
          aria-label={accessibleName}
          {...dataAttributes}
          aria-haspopup="dialog"
          onClick={(event) => {
            if (
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey
            )
              return;
            event.preventDefault();
            dialog.current?.showModal();
          }}
        >
          {children}
          {arrow && <Icon name="arrow" />}
        </a>
      ) : (
        <button
          type="button"
          className={className}
          aria-haspopup="dialog"
          onClick={() => dialog.current?.showModal()}
        >
          {children}
          {arrow && <Icon name="arrow" />}
        </button>
      )}
      <dialog
        ref={dialog}
        className="notice-dialog"
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return;
          if (
            event.shiftKey &&
            document.activeElement === closeButton.current
          ) {
            event.preventDefault();
            continueButton.current?.focus();
          } else if (
            !event.shiftKey &&
            document.activeElement === continueButton.current
          ) {
            event.preventDefault();
            closeButton.current?.focus();
          }
        }}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <div className="notice-dialog__content">
          <button
            type="button"
            ref={closeButton}
            className="icon-button notice-dialog__close"
            aria-label="Close dialog"
            onClick={() => dialog.current?.close()}
            autoFocus
          >
            <Icon name="close" />
          </button>
          <span className="eyebrow">The next chapter</span>
          <h2 id={titleId}>{title}</h2>
          <p id={descriptionId}>{description}</p>
          <form method="dialog">
            <button
              ref={continueButton}
              className="button button--primary"
              type="submit"
            >
              Keep exploring
              <Icon name="arrow" />
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}
