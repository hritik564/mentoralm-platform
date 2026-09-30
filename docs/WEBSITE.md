# Main Public Website

The first implementation milestone is a completely redesigned public MentoraLM website. This document defines its intended responsibility; W1/W2 now implements its frontend foundation and homepage.

## Expected public areas

- Homepage and MentoraLM company/about information
- Modules / programs, including AI Career Counselling, CareerIgnite, GradLM Study Abroad, and additional MentoraLM modules
- Opportunities and Resources
- Contact
- Authentication entry points
- Application/enrollment entry points

These are anticipated areas, not approved route definitions, content, eligibility rules, or form specifications.

## Relationship to the platform

Website owns public presentation and discovery. Keep business rules outside its UI. Public program information should use deliberate public contracts without direct dependency on future LMS internals.

Authentication and application/enrollment entry points must remain compatible with the eventual one-account platform. An entry point does not authorize implementing authentication, APIs, enrollment processing, or future product surfaces. Define actual journey behavior and backing capabilities when specifically approved.

## Scope boundaries

Student profiles, My Courses, private reports, learning delivery, progress, assessment, grading, and admin operations belong to future surfaces and their domains. Do not implement them during the website phase unless explicitly requested.

Do not inherit architecture from previous MentoraLM websites. Visual design, content, routes, integrations, stack, and delivery approach require later decisions. See [Product](PRODUCT.md) and [Architecture](ARCHITECTURE.md).

## W1/W2 delivered composition

The homepage tells a connected story through: immersive hero; nonnumeric philosophy/credibility strip; seven-module ecosystem; why MentoraLM exists; Understand → Explore → Build → Move Forward journey; AI + human intelligence vision; editorial AI Career Counselling, CareerIgnite, and GradLM stories; planned Opportunities categories; a human-story structure without fabricated testimonials; final CTA; and comprehensive footer.

Navigation is sticky, light, and responsive. Programs, Opportunities, Resources, and About currently link to relevant homepage sections rather than nonexistent routes. Resources points to the resource/story availability section; it is not a resources library. Get Started and program discovery CTAs lead to the ecosystem. Three module cards link to their homepage editorial stories. Other pathways and program detail CTAs open honest availability notices. Two Coming Soon positions are non-actionable. No program list/detail route is implemented.

Menti and login open future-availability dialogs. Opportunities uses a native disclosure describing planned categories, not live offers. Human stories contains no invented quote, person, employer outcome, or metric. Support, privacy, and terms explain pending availability; social links and addresses are not fabricated.

## Owner review and remaining work

Review the editorial balance of navy/light sections, restrained accent palette, DM Sans with selective Newsreader italics, official-logo dark lockup within the R1 floating glass navigation, module copy, and illustrative photography. The supplied JPEG is faithfully displayed through CSS crops; a production vector/transparent horizontal logo is desirable for small-size clarity, without changing the official identity. Review and approve generated imagery or replace it with licensed/consented photography. See [Assets](ASSETS.md).

Approve detailed program claims and Career Counsellor certification wording before launch; the latter is owner-supplied positioning, not a newly verified accreditation claim. Provide approved contact/legal/social details, evidence-backed metrics/testimonials if desired, and the canonical domain. Public-page expansion, applications, login, Menti, and integrations are later tasks. No deployment is part of W1/W2.
