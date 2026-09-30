'use client';
import { useState } from 'react';
import {
  filterResources,
  resourceFilters,
  resolveResourceTarget,
  safeResourcePreview,
  type Resource,
  type ResourceCategory,
  type ResourceRegistry,
} from '../../../lib/dashboard/resources';
import { DashboardDialog } from '../DashboardDialog';
import { DashboardPageHeader } from '../DashboardPageHeader';
import { DashboardIcon } from '../DashboardIcon';

export function ResourcePreview({
  resource,
  registry,
  onClose,
}: {
  resource: Resource;
  registry?: ResourceRegistry;
  onClose: () => void;
}) {
  const preview = safeResourcePreview(resource, registry);
  return (
    <DashboardDialog title={resource.title} onClose={onClose}>
      <p className="d3-muted">{resource.fileName}</p>
      {preview?.kind === 'image' ? (
        // Authorized resource delivery must bypass the public image optimizer/cache.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="d3-preview-image"
          src={preview.url}
          alt={resource.description || resource.title}
          referrerPolicy="no-referrer"
        />
      ) : preview?.kind === 'pdf' ? (
        <>
          <iframe
            className="d3-preview-pdf"
            title={`PDF preview: ${resource.title}`}
            src={preview.url}
            sandbox=""
            referrerPolicy="no-referrer"
          />
          <p className="d3-muted">
            If your browser cannot display this PDF, use the permitted download
            action.
          </p>
        </>
      ) : preview?.kind === 'text' ? (
        <pre className="d3-preview-text">{preview.text}</pre>
      ) : (
        <p>Preview is unavailable for this resource.</p>
      )}
      {resolveResourceTarget(resource.access.downloadTargetId, registry) && (
        <a
          className="d3-button"
          href={resolveResourceTarget(
            resource.access.downloadTargetId,
            registry,
          )!}
          download={resource.fileName}
        >
          Download
        </a>
      )}
    </DashboardDialog>
  );
}
export function ResourceCard({
  resource,
  registry,
  onPreview,
}: {
  resource: Resource;
  registry?: ResourceRegistry;
  onPreview: () => void;
}) {
  const download = resolveResourceTarget(
    resource.access.downloadTargetId,
    registry,
  );
  const preview = safeResourcePreview(resource, registry);
  const category = resourceFilters.find(
    (filter) => filter.value === resource.category,
  )?.label;
  const size =
    resource.sizeBytes !== null && resource.sizeBytes >= 0
      ? `${(resource.sizeBytes / 1024).toFixed(0)} KB`
      : null;
  return (
    <article className="d3-resource-card">
      <span className="d3-surface-icon" aria-hidden="true">
        <DashboardIcon name="resources" />
      </span>
      <p className="dashboard-eyebrow">{category}</p>
      <h2>{resource.title}</h2>
      <p>{resource.description}</p>
      <p className="d3-file-meta">
        {resource.fileName}
        {size ? ` · ${size}` : ''}
      </p>
      {resource.program && <p className="d3-muted">{resource.program}</p>}
      <div className="d3-actions">
        {preview && (
          <button
            type="button"
            className="d3-secondary"
            onClick={onPreview}
            aria-label={`Preview ${resource.title}`}
          >
            Preview
          </button>
        )}
        {download && (
          <a
            className="d3-button"
            href={download}
            download={resource.fileName}
            aria-label={`Download ${resource.title}`}
          >
            Download
          </a>
        )}
        {!preview && !download && (
          <span className="d3-muted">Access is not available yet.</span>
        )}
      </div>
    </article>
  );
}
export function ResourceLibrary({
  resources,
  registry,
}: {
  resources: readonly Resource[];
  registry?: ResourceRegistry;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ResourceCategory | 'all'>('all');
  const [selected, setSelected] = useState<Resource | null>(null);
  const filtered = filterResources(resources, query, category);
  return (
    <section className="d3-page">
      <DashboardPageHeader
        title="Resources"
        description="A curated space for resources shared with you."
      />
      <div className="d3-library-tools">
        <label className="d3-search">
          Search resources
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title or program"
          />
        </label>
        <fieldset className="d3-filters">
          <legend>Resource category</legend>
          {resourceFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              aria-pressed={category === filter.value}
              onClick={() => setCategory(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </fieldset>
      </div>
      {filtered.length ? (
        <div className="d3-resource-grid">
          {filtered.map((resource) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              registry={registry}
              onPreview={() => setSelected(resource)}
            />
          ))}
        </div>
      ) : (
        <div className="d3-empty">
          <span className="d3-surface-icon" aria-hidden="true">
            <DashboardIcon name="resources" />
          </span>
          <h2>
            {resources.length
              ? 'No matching resources.'
              : 'No resources available yet.'}
          </h2>
          <p>
            {resources.length
              ? 'Try another search or category.'
              : 'Resources shared with you by MentoraLM will appear here.'}
          </p>
          {query || category !== 'all' ? (
            <button
              className="d3-secondary"
              onClick={() => {
                setQuery('');
                setCategory('all');
              }}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      )}
      <p className="d3-page-note" role="status">
        {resources.length
          ? `${filtered.length} resources shown.`
          : 'Your library is ready for resources shared by MentoraLM.'}
      </p>
      {selected && (
        <ResourcePreview
          resource={selected}
          registry={registry}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
