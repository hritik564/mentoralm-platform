'use client';
import { cloneElement, isValidElement, useId, useState } from 'react';
import Image from 'next/image';
import { AdminIcon } from '../AdminIcon';
import { useAdminData } from '../client';
import { State } from '../Primitives';
import { marketplaceLabel, marketplaceLocalDate } from './format';
import { marketplacePrice } from './format';
import {
  marketplacePriceInput,
  parseMarketplacePrice,
} from '@/lib/marketplace/price';
import type { MarketplaceCourseChoice, MarketplaceOffering } from './types';
import {
  availabilityStatuses,
  deliveryModes,
  marketplaceImages,
} from './types';

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="marketplace-field">
      <label htmlFor={id}>{label}</label>
      {isValidElement<{ id?: string; 'aria-describedby'?: string }>(children)
        ? cloneElement(children, {
            id,
            ...(help ? { 'aria-describedby': hintId } : {}),
          })
        : children}
      {help && <small id={hintId}>{help}</small>}
    </div>
  );
}

export function MarketplaceIdentityFields({
  offering,
}: {
  offering?: MarketplaceOffering;
}) {
  return (
    <section className="admin-card marketplace-form-section">
      <header>
        <h2>Identity</h2>
        <p className="admin-muted">
          The details visitors use to understand your offering.
        </p>
      </header>
      <Field label="Title">
        <input
          name="title"
          required
          maxLength={160}
          defaultValue={offering?.title}
          placeholder="e.g. CareerIgnite"
        />
      </Field>
      <div className="marketplace-fields-pair">
        <Field
          label="Slug"
          help="Lowercase letters, numbers and single hyphens."
        >
          <input
            name="slug"
            required
            maxLength={100}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            defaultValue={offering?.slug}
            placeholder="e.g. careerignite"
          />
        </Field>
        <Field label="Category" help="Required before publication.">
          <input
            name="category"
            maxLength={100}
            defaultValue={offering?.category}
            placeholder="e.g. Career development"
          />
        </Field>
      </div>
      <Field label="Short description" help="Required before publication.">
        <textarea
          name="shortDescription"
          maxLength={600}
          rows={4}
          defaultValue={offering?.shortDescription}
          placeholder="A concise introduction to the program and who it is for."
        />
      </Field>
    </section>
  );
}

export function MarketplacePresentationFields({
  offering,
}: {
  offering?: MarketplaceOffering;
}) {
  const [cardImage, setCardImage] = useState(offering?.cardImage || '');
  return (
    <section className="admin-card marketplace-form-section">
      <header>
        <h2>Presentation</h2>
        <p className="admin-muted">
          Leave images blank to use the default Marketplace artwork.
        </p>
      </header>
      <Field
        label="Card image (optional)"
        help="Choose an existing approved public asset or use the default artwork."
      >
        <select
          name="cardImage"
          value={cardImage}
          onChange={(event) => setCardImage(event.target.value)}
        >
          <option value="">Default Marketplace artwork</option>
          {marketplaceImages.map((path) => (
            <option key={path} value={path}>
              {path}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Hero image (optional)"
        help="Stored for future program pages."
      >
        <select name="heroImage" defaultValue={offering?.heroImage || ''}>
          <option value="">No hero image</option>
          {marketplaceImages.map((path) => (
            <option key={path} value={path}>
              {path}
            </option>
          ))}
        </select>
      </Field>
      <div className="marketplace-image-preview">
        {cardImage ? (
          <Image
            src={cardImage}
            alt="Selected Marketplace card image"
            fill
            sizes="(max-width: 600px) 100vw, 700px"
          />
        ) : (
          <>
            <AdminIcon name="courses" />
            <span>Marketplace artwork</span>
          </>
        )}
      </div>
      <p className="marketplace-inline-note">
        Image uploads are not configured. Remote image URLs are not accepted.
      </p>
    </section>
  );
}

export function MarketplaceCommerceFields({
  offering,
}: {
  offering?: MarketplaceOffering;
}) {
  const [currency, setCurrency] = useState(offering?.currency || 'INR');
  const [price, setPrice] = useState(() =>
    marketplacePriceInput(
      offering?.priceMinor ?? null,
      offering?.currency || 'INR',
    ),
  );
  let preview: string;
  try {
    preview = marketplacePrice(
      parseMarketplacePrice(price, currency),
      currency,
    );
  } catch (error) {
    preview = error instanceof Error ? error.message : 'Enter a valid price.';
  }
  return (
    <section className="admin-card marketplace-form-section">
      <header>
        <h2>Price</h2>
        <p className="admin-muted">
          Catalogue pricing only. Checkout is not available yet.
        </p>
      </header>
      <div className="marketplace-fields-pair">
        <Field
          label="Price"
          help={`Amount in ${currency || 'the selected currency'}. Leave blank for “To be announced”.`}
        >
          <input
            name="price"
            type="text"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            inputMode="decimal"
            placeholder="e.g. 15000.00"
          />
        </Field>
        <Field label="Currency" help="Three-letter currency code.">
          <input
            name="currency"
            required
            maxLength={3}
            pattern="[A-Z]{3}"
            value={currency}
            onChange={(event) => setCurrency(event.target.value.toUpperCase())}
            placeholder="INR"
          />
        </Field>
      </div>
      <output
        aria-label="Price preview"
        aria-live="polite"
        className="marketplace-inline-note"
      >
        {preview}
      </output>
    </section>
  );
}

export function MarketplaceDeliveryFields({
  offering,
}: {
  offering?: MarketplaceOffering;
}) {
  return (
    <section className="admin-card marketplace-form-section">
      <header>
        <h2>Delivery &amp; availability</h2>
        <p className="admin-muted">
          Availability is independent of whether the offering is published.
        </p>
      </header>
      <div className="marketplace-fields-pair">
        <Field label="Delivery mode">
          <select
            name="deliveryMode"
            defaultValue={offering?.deliveryMode || 'ONLINE'}
          >
            {deliveryModes.map((mode) => (
              <option value={mode} key={mode}>
                {marketplaceLabel(mode)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Duration" help="Required before publication.">
          <input
            name="durationLabel"
            maxLength={120}
            defaultValue={offering?.durationLabel}
            placeholder="e.g. 8 weeks"
          />
        </Field>
      </div>
      <div className="marketplace-fields-pair">
        <Field label="Enrollment availability">
          <select
            name="availabilityStatus"
            defaultValue={offering?.availabilityStatus || 'COMING_SOON'}
          >
            {availabilityStatuses.map((status) => (
              <option value={status} key={status}>
                {marketplaceLabel(status)}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Cohort / start date (optional)"
          help="Entered in your local time zone."
        >
          <input
            name="cohortStartsAt"
            type="datetime-local"
            defaultValue={marketplaceLocalDate(offering?.cohortStartsAt)}
          />
        </Field>
      </div>
    </section>
  );
}

export function MarketplaceLmsFields({
  offering,
}: {
  offering?: MarketplaceOffering;
}) {
  const [enabled, setEnabled] = useState(offering?.lmsEnabled || false),
    [course, setCourse] = useState(offering?.courseRef || ''),
    [query, setQuery] = useState('');
  const choices = useAdminData<MarketplaceCourseChoice[]>(
    enabled ? `marketplace/courses?${new URLSearchParams({ q: query })}` : null,
  );
  return (
    <section className="admin-card marketplace-form-section">
      <header>
        <h2>LMS configuration</h2>
        <p className="admin-muted">
          Offerings can exist independently of the LMS.
        </p>
      </header>
      <label className="marketplace-check">
        <input
          type="checkbox"
          name="lmsEnabled"
          checked={enabled}
          onChange={(event) => {
            setEnabled(event.target.checked);
            if (!event.target.checked) setCourse('');
          }}
        />
        <span>
          <strong>LMS enabled</strong>
          <small>
            Optionally connect this offering to an existing learning course.
          </small>
        </span>
      </label>
      {enabled && (
        <>
          <Field label="Find an existing LMS course">
            <input
              maxLength={100}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search course titles…"
            />
          </Field>
          <Field
            label="Linked LMS course (optional for drafts)"
            help="Link an existing course before publishing an LMS-enabled offering."
          >
            <select
              name="courseRef"
              value={course}
              onChange={(event) => setCourse(event.target.value)}
            >
              <option value="">No course linked yet</option>
              {course &&
                !choices.data?.some((choice) => choice.ref === course) && (
                  <option value={course}>Currently linked course</option>
                )}
              {choices.data?.map((choice) => (
                <option key={choice.ref} value={choice.ref}>
                  {choice.label}
                </option>
              ))}
            </select>
          </Field>
          <State {...choices} />
        </>
      )}
      <p className="marketplace-inline-note">
        This configuration does not enroll students or grant LMS access.
      </p>
    </section>
  );
}

export function MarketplacePlacementFields({
  offering,
}: {
  offering?: MarketplaceOffering;
}) {
  return (
    <section className="admin-card marketplace-form-section">
      <header>
        <h2>Marketplace placement</h2>
        <p className="admin-muted">
          Only published offerings can appear in public views.
        </p>
      </header>
      <label className="marketplace-check">
        <input
          type="checkbox"
          name="featured"
          defaultChecked={offering?.featured || false}
        />
        <span>
          <strong>Feature on the homepage</strong>
          <small>
            Eligible published offerings may appear in the homepage preview.
          </small>
        </span>
      </label>
      <Field label="Sort order" help="Lower numbers appear first.">
        <input
          name="sortOrder"
          type="number"
          min={0}
          max={100000}
          step={1}
          defaultValue={offering?.sortOrder || 0}
          inputMode="numeric"
        />
      </Field>
    </section>
  );
}
