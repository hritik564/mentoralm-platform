-- Existing ACTIVE rows from the pre-learner M5 checkpoint retain their historical
-- default-NONE metadata. No backfill or rewrite: only new activations are guarded.
CREATE FUNCTION enforce_marketplace_delivery_activation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='ACTIVE' AND (TG_OP='INSERT' OR OLD.status<>'ACTIVE')
 AND (NEW."learnerIdentityProvenance"='NONE' OR NEW."lmsAccessProvenance"='NONE') THEN
  RAISE EXCEPTION 'New active delivery requires initialized learner and account provenance';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER marketplace_delivery_activation BEFORE INSERT OR UPDATE ON "MarketplaceDelivery"
 FOR EACH ROW EXECUTE FUNCTION enforce_marketplace_delivery_activation();
