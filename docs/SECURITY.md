# Security principles and trust boundaries

These requirements apply when relevant functionality is implemented. W1/W2 implements public presentation only, with no authentication, authorization service, data collection, or protected resources.

## Trust boundaries

| Boundary                                    | Required treatment                                                                                                                |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Browser or other client → backend           | Treat requests and identifiers as untrusted; validate input, authenticate protected requests, and authorize actions on the server |
| Authenticated identity → protected resource | Verify ownership or permission for every resource; login alone is insufficient                                                    |
| Public website → private platform data      | Expose only intentionally public data through approved contracts                                                                  |
| Backend → database or storage               | Enforce intended access and relationships; do not treat shared infrastructure as unrestricted access                              |
| Admin interface → sensitive mutation        | Check backend permissions and produce audit events                                                                                |
| External input/integrations → platform      | Validate input at the boundary; design integration-specific controls when selected                                                |

## Authorization and student isolation

Client-side hiding, route guards, and disabled buttons are usability measures, never authorization. Prevent cross-student access and IDOR even when a caller changes a URL, request body, or resource identifier. Protected reads, writes, downloads, and learning access must verify applicable ownership or permissions on the server.

Enrollment controls learning access under an explicitly designed policy. Unified identity across surfaces does not grant access to every course, record, or admin action. Test denied as well as allowed actions, including attempts to access another student's resources.

## Secrets and input

Never hardcode production credentials, commit secrets, or expose secrets in client bundles. Keep environment-specific secrets in an approved mechanism once infrastructure is selected. Validate untrusted input at trust boundaries. API errors should be structured and avoid leaking internal implementation details or sensitive data.

## Administration and integrity

Backend permissions protect admin actions. Sensitive mutations must produce audit events when implemented; define event content, access, and retention during design. Roles should evolve toward granular permissions. Preserve assessment history and plan safe published-content versioning.

Identity provider, session design, privacy/retention requirements, tenant model, and audit infrastructure remain unresolved. This document does not select them. See [Decisions](DECISIONS.md).

## Public frontend boundary

The current homepage uses local editorial content and assets. Native dialogs communicate future availability; they do not submit information or simulate backend success. The only form uses `method="dialog"` to close a dialog locally. No secrets or personal records are needed. `NEXT_PUBLIC_SITE_URL` is explicitly public configuration and is validated as an origin before canonical metadata is emitted. No external fonts, third-party analytics, tracking scripts, or remote image hosts are used. Production security headers and privacy policy must be designed with the eventual hosting and integrations before launch.
