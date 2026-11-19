-- Additive capabilities and audit kinds; no grants or backfill.
ALTER TYPE "AdminPermission" ADD VALUE 'DELIVERY_MANAGE';
ALTER TYPE "MarketplaceCommerceEventKind" ADD VALUE 'MarketplaceDeliveryRevoked';
ALTER TYPE "MarketplaceCommerceEventKind" ADD VALUE 'MarketplaceDeliveryRevocationStarted';
ALTER TYPE "MarketplaceCommerceEventKind" ADD VALUE 'MarketplaceDeliveryReusedEnrollment';
ALTER TYPE "MarketplaceCommerceEventKind" ADD VALUE 'MarketplaceDeliveryProvisioningFailed';
ALTER TYPE "MarketplaceCommerceEventKind" ADD VALUE 'MarketplaceDeliveryProvisioned';
ALTER TYPE "MarketplaceCommerceEventKind" ADD VALUE 'MarketplaceDeliveryProvisioningStarted';
ALTER TYPE "MarketplaceCommerceEventKind" ADD VALUE 'MarketplaceDeliveryCreated';
