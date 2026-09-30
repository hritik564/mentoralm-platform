# Brand and imagery assets

## R3 module thumbnails

`Reference/Modules.png` was inspected for centered ecosystem/orbit composition only. Its character is not shipped or recreated: R3 renders the existing Hero `Menti` component unchanged. All thumbnails are local, illustrative campaign imagery rather than real students, outcomes, partner institutions or testimonials.

The centralized featured module records map GradLM → `campus.webp`, AI Career Counselling → `learner.webp`, CareerIgnite → `collaboration.webp`, Entrepreneurship → `entrepreneurship.webp`, and Career Counsellor Program → `counsellor.webp`. The three earlier files remain unchanged. Next Image lazy loading, responsive sizing, reserved media dimensions and CSS object positioning supply card crops without new remote URLs. Coming Soon uses code-native abstract ring art with a lock indicator.

Two new assets were generated with the built-in `image_gen` tool using the imagegen skill, visually inspected, then resized to 768×512 WebP at quality 80 with existing Sharp. The selected files are saved in the project:

| Asset                                 | Source ID                                       | Size         |
| ------------------------------------- | ----------------------------------------------- | ------------ |
| `public/images/entrepreneurship.webp` | `exec-7c6dd17e-6f2b-4f52-aef1-1a3aac1854c0.png` | 53,444 bytes |
| `public/images/counsellor.webp`       | `exec-57599bbf-d66d-4e6c-86ec-a6a03947341b.png` | 40,872 bytes |

Original PNGs remain under `/Users/hritikgupta/.codex/generated_images/01a0ee8f-8e9e-7a92-86e8-2a99619b9b7c/`. The website references only the project WebP files. Owner review of these illustrative scenes remains part of asset approval before launch.

### Final R3 generation prompts

**Entrepreneurship**

> Use case: photorealistic-natural. Asset type: landscape 1536x1024 thumbnail for MentoraLM entrepreneurship module. Scene: a thoughtful contemporary innovation studio, two Indian young adult founders discussing a small physical product prototype and sketchbook at a workbench, laptop in the background. Premium candid editorial photography with authentic textures, natural side light, subtle cyan/teal and navy atmosphere, warm human skin tones. Medium wide composition with subjects and prototype in central area, legible when cropped to a shallow landscape thumbnail. Communicate building an idea, innovation and creation; grounded education/career context. No text, logos, watermark, badges, fake UI or neon. Fictional illustrative campaign scene, not real participants or evidence of results.

**Career Counsellor Program**

> Use case: photorealistic-natural. Asset type: landscape 1536x1024 thumbnail for MentoraLM professional career counsellor training module. Scene: a professional Indian woman mentor in her thirties and a young adult learner sitting together in a quiet modern counselling studio, discussing a notebook on a desk. Calm attentive listening, relaxed warm expressions, candid rather than posed. Premium editorial photograph, natural side lighting, navy and soft violet/blue background, warm skin tones, authentic fabric and paper textures. Medium wide composition, both people centrally composed, recognizable in a shallow landscape thumbnail. Communicate professional guidance, mentorship and counselling. No text, logos, watermark, accreditation badges, fake UI or dramatic neon. Fictional illustrative campaign scene, not real participants or testimonials.

## Official owner-provided references

- `Reference/WhatsApp Image 2026-05-21 at 15.20.06.jpeg`: authoritative official MentoraLM logo, 1320×864. Copied unchanged to `public/brand/mentoralm-logo.jpeg`. Navbar and footer use CSS crops of the original symbol and wordmark, with no relettering, recoloring, or temporary identity. `public/favicon.png` is a resized crop of the same official symbol.
- `Reference/ChatGPT Image Sep 30, 2026, 12_59_33 AM.png`: approved visual direction. It is a reference only, not shipped as homepage imagery. Its sample numbers, quote, extra pages, and unsupported program claims are not copied.

An official vector/transparent horizontal logo would improve small-size flexibility. Do not replace the logo with a fabricated mark while waiting for that asset.

## Local illustrative photographs

These three original assets were created with the built-in imagegen tool, visually inspected, and exported to local WebP for the website. The originals remain in the generator output folder; the project does not depend on that folder. They are fictional campaign illustrations, not real MentoraLM students, testimonials, outcomes, or partner campuses. Review for brand fit and approve or replace with licensed/consented production photography before launch.

| Website asset                      | Placement                                    | Source ID                                       |
| ---------------------------------- | -------------------------------------------- | ----------------------------------------------- |
| `public/images/learner.webp`       | Hero and career counselling editorial story  | `exec-2ec63cd2-e45f-44e3-8037-4f2699565cc5.png` |
| `public/images/collaboration.webp` | CareerIgnite story and human-story structure | `exec-5538e714-fdc0-4a04-ace8-f1459bf0ea92.png` |
| `public/images/campus.webp`        | GradLM editorial story                       | `exec-3a1cbfc3-a5d8-496b-a8da-540dd029be76.png` |

WebP assets are approximately 127 KB, 161 KB, and 203 KB respectively. `next/image` supplies responsive optimized variants; the hero image is prioritized and lower images use lazy loading with reserved aspect ratios. No external image URLs are used. No social-sharing image is fabricated; metadata title/description are ready for a later approved sharing asset.

### Final generation prompts

**Learner**

> Use case: photorealistic-natural. Asset type: premium education website hero editorial photograph, portrait 1024x1536. A confident Indian young adult woman with shoulder-length dark wavy hair, wearing a warm ivory t-shirt with a light blue open overshirt, carrying a notebook tucked at her side, looking slightly upward with a calm optimistic smile. Waist-up candid natural human portrait, no cheesy posing. Set in a quiet modern university courtyard at blue hour with soft blurred architectural background, cool midnight navy and muted blue tones with warm light gently touching face. Premium magazine photography, real skin texture, film grain, restrained cinematic lighting, elegant human ambition. Subject centered with room around shoulders. No text, logos, badges, interface, watermarks, or artificial neon. This is fictional illustrative campaign imagery, not a testimonial.

**Collaboration**

> Use case: photorealistic-natural. Asset type: premium education website editorial program story image, landscape 1536x1024. Three Indian young adult learners, two women and a man, in a warm sunlit contemporary creative studio, collaborating over a notebook and laptop at a wood table, candid mid-conversation, engaged and relaxed. Modern casual clothes in warm cream, muted blue and terracotta. Natural daylight, subtle grain, authentic magazine editorial photography, sophisticated composition, close enough to feel human, not a corporate handshake photo. Background with books and subtle architectural interest. No text, logos, watermarks or interface. Fictional illustrative imagery, not actual MentoraLM participants.

**Campus**

> Use case: photorealistic-natural. Asset type: global education website editorial story image, landscape 1536x1024. Indian young adult student wearing a navy jacket and small backpack walking through an elegant historic university campus courtyard, looking toward the sunlit stone architecture. Thoughtful independent mood, aspirational but grounded, cinematic editorial travel photography, architectural framing, warm sandstone and clean sky blue with greenery, natural afternoon light, fine film grain, spacious composition. No identifiable university signs, no text, logos, watermarks or interface. Fictional illustrative imagery, not a real MentoraLM placement or partner university.

## Content awaiting approval

No numerical metrics, testimonial quotes, live opportunity listings, partner logos, legal address, email, phone, or social URL was invented. Menti, login, contact, policies, program details/enrollment, future resources, and future opportunities are explicitly pending. The Career Counsellor certification positioning comes directly from the owner; accreditation, eligibility, duration, pricing, and outcomes have not been assumed. Provide approved facts before expanding those areas.

## Fonts

DM Sans and Newsreader are bundled from Fontsource packages. Their package licenses are included with installed dependencies. Preserve the font license notices when repackaging assets.

## R2 hero references and character

`Reference/hero-desktop-approved.png` and `Reference/hero-mobile-approved.png` were visually inspected alongside `Reference/mentoralm-approved-visual-direction.png` and the authoritative logo. They guide composition and character direction; none is shipped as a flattened hero. The existing `learner.webp` is reused unchanged through responsive Next.js image optimization.

Menti is a new reusable code-native SVG under `src/components/menti`, with rounded five-point geometry, expressive eyes, a blue/violet/magenta body with cyan highlights, and a small graduation cap. This is a product character, not a replacement brand mark. Speech explicitly presents it as an upcoming AI guide. Body colors and size can be themed through CSS variables. Decorative intelligence paths and the conceptual global horizon are local SVG/CSS; no additional raster asset or external image URL is introduced. Owner review should confirm the vector character’s personality and the continuing use of the documented illustrative learner photography.

## R2.1 authoritative Menti reference

`Reference/Menti.png` is the authoritative character specification. Its central/front view guides the rounded silhouette, luminous cyan/blue/violet/magenta body, glossy deep irises, subtle smile, dimensional navy graduation cap and gold star tassel. The sheet was inspected with both approved hero references. It is not copied to `public`, cropped, embedded, or used as a raster mascot. Menti remains SVG/React, with independent body, face/eyes and cap layers; the official MentoraLM identity and local learner photograph remain unchanged.
