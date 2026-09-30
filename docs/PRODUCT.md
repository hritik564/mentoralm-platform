# Product context

MentoraLM is one unified platform with four surfaces:

1. Main Public Website: discovery, company and program information, and entry points into platform journeys.
2. Student Dashboard / Portal: a student's account and operational overview.
3. LMS: learning delivery, progress, and assessment.
4. Admin Console: platform operations and governance.

## Current priority and boundaries

The first implementation milestone is a completely redesigned Main Public Website. W1/W2 implements the public frontend foundation and flagship homepage only. The Dashboard, LMS, and Admin Console remain future scope unless explicitly requested; listing their responsibilities does not authorize implementation.

This is a fresh implementation. Previous MentoraLM websites must not be assumed to determine its architecture, technology, or data model.

## Unified identity

The eventual experience is one MentoraLM account across Website → Dashboard → LMS. Administrators use shared platform identity infrastructure with separate roles and permissions. Identity continuity does not confer universal resource access.

Current architectural choices must preserve the ability to share identity, backend services, database infrastructure, storage, authorization, and domain models later, without coupling each surface to another surface's internals.

## Responsibility boundaries

Website owns public presentation. Dashboard aggregates student-facing information. Learning owns progress and learning outcomes. Admin invokes authorized operations rather than redefining domain rules. Shared capabilities require explicit ownership during approved architecture work.

See [Website](WEBSITE.md), [Future platform](FUTURE-PLATFORM.md), and [Decisions](DECISIONS.md). The public frontend stack is recorded in ADR-008. Enrollment policy, detailed program relationships, hosting, and organization/tenant structure remain unresolved.
