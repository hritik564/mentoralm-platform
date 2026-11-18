# Marketplace M1 exact change inventory

Compared with approved `51aa904`. Owner reference remains untracked, untouched and excluded. Ignored review artifacts are not source changes. No files were deleted.

80 files: 30 modified, 50 added.

| Change   | File                                                                                                                                                                                                      |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modified | [docs/ARCHITECTURE.md](</Users/hritikgupta/Desktop/MentoraLM 2/docs/ARCHITECTURE.md>)                                                                                                                     |
| Modified | [docs/DECISIONS.md](</Users/hritikgupta/Desktop/MentoraLM 2/docs/DECISIONS.md>)                                                                                                                           |
| Modified | [package.json](</Users/hritikgupta/Desktop/MentoraLM 2/package.json>)                                                                                                                                     |
| Modified | [playwright.homepage.config.ts](</Users/hritikgupta/Desktop/MentoraLM 2/playwright.homepage.config.ts>)                                                                                                   |
| Modified | [prisma/schema.prisma](</Users/hritikgupta/Desktop/MentoraLM 2/prisma/schema.prisma>)                                                                                                                     |
| Modified | [scripts/production/database.ts](</Users/hritikgupta/Desktop/MentoraLM 2/scripts/production/database.ts>)                                                                                                 |
| Modified | [src/app/page.tsx](</Users/hritikgupta/Desktop/MentoraLM 2/src/app/page.tsx>)                                                                                                                             |
| Modified | [src/components/admin/AdminIcon.tsx](</Users/hritikgupta/Desktop/MentoraLM 2/src/components/admin/AdminIcon.tsx>)                                                                                         |
| Modified | [src/components/layout/Footer.tsx](</Users/hritikgupta/Desktop/MentoraLM 2/src/components/layout/Footer.tsx>)                                                                                             |
| Modified | [src/components/navigation/DesktopNav.tsx](</Users/hritikgupta/Desktop/MentoraLM 2/src/components/navigation/DesktopNav.tsx>)                                                                             |
| Modified | [src/components/navigation/MobileNav.tsx](</Users/hritikgupta/Desktop/MentoraLM 2/src/components/navigation/MobileNav.tsx>)                                                                               |
| Modified | [src/components/navigation/ModulesDropdown.tsx](</Users/hritikgupta/Desktop/MentoraLM 2/src/components/navigation/ModulesDropdown.tsx>)                                                                   |
| Modified | [src/components/navigation/Navbar.tsx](</Users/hritikgupta/Desktop/MentoraLM 2/src/components/navigation/Navbar.tsx>)                                                                                     |
| Modified | [src/lib/admin/governance/access.ts](</Users/hritikgupta/Desktop/MentoraLM 2/src/lib/admin/governance/access.ts>)                                                                                         |
| Modified | [src/lib/admin/governance/audit-projection.ts](</Users/hritikgupta/Desktop/MentoraLM 2/src/lib/admin/governance/audit-projection.ts>)                                                                     |
| Modified | [src/lib/admin/governance/audit-targets.ts](</Users/hritikgupta/Desktop/MentoraLM 2/src/lib/admin/governance/audit-targets.ts>)                                                                           |
| Modified | [src/lib/admin/handles.ts](</Users/hritikgupta/Desktop/MentoraLM 2/src/lib/admin/handles.ts>)                                                                                                             |
| Modified | [src/lib/admin/navigation.ts](</Users/hritikgupta/Desktop/MentoraLM 2/src/lib/admin/navigation.ts>)                                                                                                       |
| Modified | [src/lib/admin/permissions.ts](</Users/hritikgupta/Desktop/MentoraLM 2/src/lib/admin/permissions.ts>)                                                                                                     |
| Modified | [src/lib/platform/domains.ts](</Users/hritikgupta/Desktop/MentoraLM 2/src/lib/platform/domains.ts>)                                                                                                       |
| Modified | [src/lib/production/migrations.ts](</Users/hritikgupta/Desktop/MentoraLM 2/src/lib/production/migrations.ts>)                                                                                             |
| Modified | [src/lib/production/upstash.ts](</Users/hritikgupta/Desktop/MentoraLM 2/src/lib/production/upstash.ts>)                                                                                                   |
| Modified | [tests/admin-navigation.test.ts](</Users/hritikgupta/Desktop/MentoraLM 2/tests/admin-navigation.test.ts>)                                                                                                 |
| Modified | [tests/admin-ui.spec.ts](</Users/hritikgupta/Desktop/MentoraLM 2/tests/admin-ui.spec.ts>)                                                                                                                 |
| Modified | [tests/helpers/admin-ui/data.ts](</Users/hritikgupta/Desktop/MentoraLM 2/tests/helpers/admin-ui/data.ts>)                                                                                                 |
| Modified | [tests/helpers/admin-ui/fixture.tsx](</Users/hritikgupta/Desktop/MentoraLM 2/tests/helpers/admin-ui/fixture.tsx>)                                                                                         |
| Modified | [tests/home.spec.ts](</Users/hritikgupta/Desktop/MentoraLM 2/tests/home.spec.ts>)                                                                                                                         |
| Modified | [tests/homepage-redesign.spec.ts](</Users/hritikgupta/Desktop/MentoraLM 2/tests/homepage-redesign.spec.ts>)                                                                                               |
| Modified | [tests/navigation.spec.ts](</Users/hritikgupta/Desktop/MentoraLM 2/tests/navigation.spec.ts>)                                                                                                             |
| Modified | [tests/production-p1.test.ts](</Users/hritikgupta/Desktop/MentoraLM 2/tests/production-p1.test.ts>)                                                                                                       |
| Added    | [docs/MARKETPLACE-M1-FILES.md](</Users/hritikgupta/Desktop/MentoraLM 2/docs/MARKETPLACE-M1-FILES.md>)                                                                                                     |
| Added    | [docs/MARKETPLACE-M1.md](</Users/hritikgupta/Desktop/MentoraLM 2/docs/MARKETPLACE-M1.md>)                                                                                                                 |
| Added    | [playwright.marketplace.config.ts](</Users/hritikgupta/Desktop/MentoraLM 2/playwright.marketplace.config.ts>)                                                                                             |
| Added    | [prisma/migrations/20261118090000_marketplace_m1/migration.sql](</Users/hritikgupta/Desktop/MentoraLM 2/prisma/migrations/20261118090000_marketplace_m1/migration.sql>)                                   |
| Added    | [prisma/migrations/20261118100000_marketplace_permission/migration.sql](</Users/hritikgupta/Desktop/MentoraLM 2/prisma/migrations/20261118100000_marketplace_permission/migration.sql>)                   |
| Added    | [prisma/migrations/20261118101000_marketplace_permission_capacity/migration.sql](</Users/hritikgupta/Desktop/MentoraLM 2/prisma/migrations/20261118101000_marketplace_permission_capacity/migration.sql>) |
| Added    | [scripts/marketplace/migrate-local.ts](</Users/hritikgupta/Desktop/MentoraLM 2/scripts/marketplace/migrate-local.ts>)                                                                                     |
| Added    | [scripts/marketplace/migrate-permission-local.ts](</Users/hritikgupta/Desktop/MentoraLM 2/scripts/marketplace/migrate-permission-local.ts>)                                                               |
| Added    | [scripts/marketplace/safety.ts](</Users/hritikgupta/Desktop/MentoraLM 2/scripts/marketplace/safety.ts>)                                                                                                   |
| Added    | [src/app/admin/marketplace/\[ref\]/page.tsx](</Users/hritikgupta/Desktop/MentoraLM 2/src/app/admin/marketplace/[ref]/page.tsx>)                                                                           |
| Added    | [src/app/admin/marketplace/layout.tsx](</Users/hritikgupta/Desktop/MentoraLM 2/src/app/admin/marketplace/layout.tsx>)                                                                                     |
| Added    | [src/app/admin/marketplace/new/page.tsx](</Users/hritikgupta/Desktop/MentoraLM 2/src/app/admin/marketplace/new/page.tsx>)                                                                                 |
| Added    | [src/app/admin/marketplace/page.tsx](</Users/hritikgupta/Desktop/MentoraLM 2/src/app/admin/marketplace/page.tsx>)                                                                                         |
| Added    | [src/app/api/admin/marketplace/\[\[...path\]\]/route.ts](</Users/hritikgupta/Desktop/MentoraLM 2/src/app/api/admin/marketplace/[[...path]]/route.ts>)                                                     |
| Added    | [src/app/courses/page.tsx](</Users/hritikgupta/Desktop/MentoraLM 2/src/app/courses/page.tsx>)                                                                                                             |
| Added    | [src/components/admin/marketplace/MarketplaceEditor.tsx](</Users/hritikgupta/Desktop/MentoraLM 2/src/components/admin/marketplace/MarketplaceEditor.tsx>)                                                 |
| Added    | [src/components/admin/marketplace/MarketplaceFields.tsx](</Users/hritikgupta/Desktop/MentoraLM 2/src/components/admin/marketplace/MarketplaceFields.tsx>)                                                 |
| Added    | [src/components/admin/marketplace/MarketplaceList.tsx](</Users/hritikgupta/Desktop/MentoraLM 2/src/components/admin/marketplace/MarketplaceList.tsx>)                                                     |
| Added    | [src/components/admin/marketplace/MarketplaceOfferingForm.tsx](</Users/hritikgupta/Desktop/MentoraLM 2/src/components/admin/marketplace/MarketplaceOfferingForm.tsx>)                                     |
| Added    | [src/components/admin/marketplace/MarketplacePublishingActions.tsx](</Users/hritikgupta/Desktop/MentoraLM 2/src/components/admin/marketplace/MarketplacePublishingActions.tsx>)                           |
| Added    | [src/components/admin/marketplace/MarketplaceStatusBadge.tsx](</Users/hritikgupta/Desktop/MentoraLM 2/src/components/admin/marketplace/MarketplaceStatusBadge.tsx>)                                       |
| Added    | [src/components/admin/marketplace/format.ts](</Users/hritikgupta/Desktop/MentoraLM 2/src/components/admin/marketplace/format.ts>)                                                                         |
| Added    | [src/components/admin/marketplace/types.ts](</Users/hritikgupta/Desktop/MentoraLM 2/src/components/admin/marketplace/types.ts>)                                                                           |
| Added    | [src/components/marketplace/MarketplaceCard.tsx](</Users/hritikgupta/Desktop/MentoraLM 2/src/components/marketplace/MarketplaceCard.tsx>)                                                                 |
| Added    | [src/components/marketplace/MarketplaceEmptyState.tsx](</Users/hritikgupta/Desktop/MentoraLM 2/src/components/marketplace/MarketplaceEmptyState.tsx>)                                                     |
| Added    | [src/components/marketplace/MarketplaceGrid.tsx](</Users/hritikgupta/Desktop/MentoraLM 2/src/components/marketplace/MarketplaceGrid.tsx>)                                                                 |
| Added    | [src/components/marketplace/MarketplacePreview.tsx](</Users/hritikgupta/Desktop/MentoraLM 2/src/components/marketplace/MarketplacePreview.tsx>)                                                           |
| Added    | [src/lib/marketplace/admin.ts](</Users/hritikgupta/Desktop/MentoraLM 2/src/lib/marketplace/admin.ts>)                                                                                                     |
| Added    | [src/lib/marketplace/cache.ts](</Users/hritikgupta/Desktop/MentoraLM 2/src/lib/marketplace/cache.ts>)                                                                                                     |
| Added    | [src/lib/marketplace/images.ts](</Users/hritikgupta/Desktop/MentoraLM 2/src/lib/marketplace/images.ts>)                                                                                                   |
| Added    | [src/lib/marketplace/mutation.ts](</Users/hritikgupta/Desktop/MentoraLM 2/src/lib/marketplace/mutation.ts>)                                                                                               |
| Added    | [src/lib/marketplace/price.ts](</Users/hritikgupta/Desktop/MentoraLM 2/src/lib/marketplace/price.ts>)                                                                                                     |
| Added    | [src/lib/marketplace/public.ts](</Users/hritikgupta/Desktop/MentoraLM 2/src/lib/marketplace/public.ts>)                                                                                                   |
| Added    | [src/lib/marketplace/queries.ts](</Users/hritikgupta/Desktop/MentoraLM 2/src/lib/marketplace/queries.ts>)                                                                                                 |
| Added    | [src/lib/marketplace/types.ts](</Users/hritikgupta/Desktop/MentoraLM 2/src/lib/marketplace/types.ts>)                                                                                                     |
| Added    | [src/lib/marketplace/validation.ts](</Users/hritikgupta/Desktop/MentoraLM 2/src/lib/marketplace/validation.ts>)                                                                                           |
| Added    | [src/lib/production/marketplace-generation.ts](</Users/hritikgupta/Desktop/MentoraLM 2/src/lib/production/marketplace-generation.ts>)                                                                     |
| Added    | [src/styles/admin-marketplace.css](</Users/hritikgupta/Desktop/MentoraLM 2/src/styles/admin-marketplace.css>)                                                                                             |
| Added    | [src/styles/marketplace.css](</Users/hritikgupta/Desktop/MentoraLM 2/src/styles/marketplace.css>)                                                                                                         |
| Added    | [tests/helpers/marketplace-cache.ts](</Users/hritikgupta/Desktop/MentoraLM 2/tests/helpers/marketplace-cache.ts>)                                                                                         |
| Added    | [tests/helpers/marketplace-generation.ts](</Users/hritikgupta/Desktop/MentoraLM 2/tests/helpers/marketplace-generation.ts>)                                                                               |
| Added    | [tests/helpers/marketplace-server.ts](</Users/hritikgupta/Desktop/MentoraLM 2/tests/helpers/marketplace-server.ts>)                                                                                       |
| Added    | [tests/marketplace-autoscale.test.ts](</Users/hritikgupta/Desktop/MentoraLM 2/tests/marketplace-autoscale.test.ts>)                                                                                       |
| Added    | [tests/marketplace-cache.test.ts](</Users/hritikgupta/Desktop/MentoraLM 2/tests/marketplace-cache.test.ts>)                                                                                               |
| Added    | [tests/marketplace-generation.test.ts](</Users/hritikgupta/Desktop/MentoraLM 2/tests/marketplace-generation.test.ts>)                                                                                     |
| Added    | [tests/marketplace-m1-domain.test.ts](</Users/hritikgupta/Desktop/MentoraLM 2/tests/marketplace-m1-domain.test.ts>)                                                                                       |
| Added    | [tests/marketplace-m1.spec.ts](</Users/hritikgupta/Desktop/MentoraLM 2/tests/marketplace-m1.spec.ts>)                                                                                                     |
| Added    | [tests/marketplace-price.test.ts](</Users/hritikgupta/Desktop/MentoraLM 2/tests/marketplace-price.test.ts>)                                                                                               |
| Added    | [tests/marketplace-scope.test.ts](</Users/hritikgupta/Desktop/MentoraLM 2/tests/marketplace-scope.test.ts>)                                                                                               |
| Added    | [tests/marketplace-validation.test.ts](</Users/hritikgupta/Desktop/MentoraLM 2/tests/marketplace-validation.test.ts>)                                                                                     |

## Autoscale correction only

Compared with the approved M1 state immediately before this topology request (the captured631-file baseline). This current task changed only the shared-generation adapter, cache/mutation boundary, focused tests, npm commands and documentation. Schema, migrations, permissions, lifecycle/audit implementation, price input, Admin/public UI, cards, hero/navbar and LMS sources are unchanged.

16 files: 10 modified, 6 added.

| Change   | File                                                                                                                                                  |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modified | [docs/ARCHITECTURE.md](</Users/hritikgupta/Desktop/MentoraLM 2/docs/ARCHITECTURE.md>)                                                                 |
| Modified | [docs/DECISIONS.md](</Users/hritikgupta/Desktop/MentoraLM 2/docs/DECISIONS.md>)                                                                       |
| Modified | [docs/MARKETPLACE-M1-FILES.md](</Users/hritikgupta/Desktop/MentoraLM 2/docs/MARKETPLACE-M1-FILES.md>)                                                 |
| Modified | [docs/MARKETPLACE-M1.md](</Users/hritikgupta/Desktop/MentoraLM 2/docs/MARKETPLACE-M1.md>)                                                             |
| Modified | [package.json](</Users/hritikgupta/Desktop/MentoraLM 2/package.json>)                                                                                 |
| Modified | [src/app/api/admin/marketplace/\[\[...path\]\]/route.ts](</Users/hritikgupta/Desktop/MentoraLM 2/src/app/api/admin/marketplace/[[...path]]/route.ts>) |
| Modified | [src/lib/marketplace/cache.ts](</Users/hritikgupta/Desktop/MentoraLM 2/src/lib/marketplace/cache.ts>)                                                 |
| Added    | [src/lib/marketplace/mutation.ts](</Users/hritikgupta/Desktop/MentoraLM 2/src/lib/marketplace/mutation.ts>)                                           |
| Modified | [src/lib/marketplace/public.ts](</Users/hritikgupta/Desktop/MentoraLM 2/src/lib/marketplace/public.ts>)                                               |
| Added    | [src/lib/production/marketplace-generation.ts](</Users/hritikgupta/Desktop/MentoraLM 2/src/lib/production/marketplace-generation.ts>)                 |
| Modified | [src/lib/production/upstash.ts](</Users/hritikgupta/Desktop/MentoraLM 2/src/lib/production/upstash.ts>)                                               |
| Added    | [tests/helpers/marketplace-cache.ts](</Users/hritikgupta/Desktop/MentoraLM 2/tests/helpers/marketplace-cache.ts>)                                     |
| Added    | [tests/helpers/marketplace-generation.ts](</Users/hritikgupta/Desktop/MentoraLM 2/tests/helpers/marketplace-generation.ts>)                           |
| Added    | [tests/marketplace-autoscale.test.ts](</Users/hritikgupta/Desktop/MentoraLM 2/tests/marketplace-autoscale.test.ts>)                                   |
| Modified | [tests/marketplace-cache.test.ts](</Users/hritikgupta/Desktop/MentoraLM 2/tests/marketplace-cache.test.ts>)                                           |
| Added    | [tests/marketplace-generation.test.ts](</Users/hritikgupta/Desktop/MentoraLM 2/tests/marketplace-generation.test.ts>)                                 |
