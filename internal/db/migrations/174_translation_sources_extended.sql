-- Migracion 174: Fuentes de traduccion para contenido historico y operativo

DO $$
DECLARE
  default_lang VARCHAR(10) := 'es';
  rec RECORD;
BEGIN
  SELECT COALESCE(
    (SELECT code FROM languages WHERE is_default = true LIMIT 1),
    (SELECT default_language FROM node_config WHERE initialized = true LIMIT 1),
    'es'
  ) INTO default_lang;

  FOR rec IN SELECT id::text AS id, node_domain, title, COALESCE(description, '') AS description FROM assembly_sessions LOOP
    PERFORM upsert_content_translation_source(rec.node_domain, 'assembly_session', rec.id, 'title', default_lang, rec.title);
    PERFORM upsert_content_translation_source(rec.node_domain, 'assembly_session', rec.id, 'description', default_lang, rec.description);
  END LOOP;

  FOR rec IN SELECT id::text AS id, node_domain, title, COALESCE(description, '') AS description, COALESCE(minutes, '') AS minutes FROM assembly_sessions_scoped LOOP
    PERFORM upsert_content_translation_source(rec.node_domain, 'assembly_session_scoped', rec.id, 'title', default_lang, rec.title);
    PERFORM upsert_content_translation_source(rec.node_domain, 'assembly_session_scoped', rec.id, 'description', default_lang, rec.description);
    PERFORM upsert_content_translation_source(rec.node_domain, 'assembly_session_scoped', rec.id, 'minutes', default_lang, rec.minutes);
  END LOOP;

  FOR rec IN SELECT d.id::text AS id, s.node_domain, d.description FROM assembly_decisions d JOIN assembly_sessions s ON s.id = d.assembly_id LOOP
    PERFORM upsert_content_translation_source(rec.node_domain, 'assembly_decision', rec.id, 'description', default_lang, rec.description);
  END LOOP;

  FOR rec IN SELECT d.id::text AS id, s.node_domain, d.description FROM assembly_decisions_scoped d JOIN assembly_sessions_scoped s ON s.id = d.session_id LOOP
    PERFORM upsert_content_translation_source(rec.node_domain, 'assembly_decision_scoped', rec.id, 'description', default_lang, rec.description);
  END LOOP;

  FOR rec IN SELECT id::text AS id, title, description, COALESCE(admin_notes, '') AS admin_notes FROM public_proposals LOOP
    PERFORM upsert_content_translation_source('__GLOBAL__', 'public_proposal', rec.id, 'title', default_lang, rec.title);
    PERFORM upsert_content_translation_source('__GLOBAL__', 'public_proposal', rec.id, 'description', default_lang, rec.description);
    PERFORM upsert_content_translation_source('__GLOBAL__', 'public_proposal', rec.id, 'admin_notes', default_lang, rec.admin_notes);
  END LOOP;

  FOR rec IN SELECT id::text AS id, node_domain, title, COALESCE(message, '') AS message FROM notifications LOOP
    PERFORM upsert_content_translation_source(rec.node_domain, 'notification', rec.id, 'title', default_lang, rec.title);
    PERFORM upsert_content_translation_source(rec.node_domain, 'notification', rec.id, 'message', default_lang, rec.message);
  END LOOP;

  FOR rec IN SELECT id::text AS id, node_domain, name, COALESCE(description, '') AS description FROM departments LOOP
    PERFORM upsert_content_translation_source(rec.node_domain, 'department', rec.id, 'name', default_lang, rec.name);
    PERFORM upsert_content_translation_source(rec.node_domain, 'department', rec.id, 'description', default_lang, rec.description);
  END LOOP;

  FOR rec IN SELECT id::text AS id, node_domain, COALESCE(display_name, username) AS display_name
             FROM users WHERE account_type IN ('organization', 'public_institution') LOOP
    PERFORM upsert_content_translation_source(rec.node_domain, 'organization', rec.id, 'display_name', default_lang, rec.display_name);
  END LOOP;

  FOR rec IN SELECT dr.id::text AS id, d.node_domain, dr.name, COALESCE(dr.description, '') AS description
             FROM department_roles dr JOIN departments d ON d.id = dr.department_id LOOP
    PERFORM upsert_content_translation_source(rec.node_domain, 'department_role', rec.id, 'name', default_lang, rec.name);
    PERFORM upsert_content_translation_source(rec.node_domain, 'department_role', rec.id, 'description', default_lang, rec.description);
  END LOOP;

  FOR rec IN SELECT id::text AS id, node_domain, name, COALESCE(description, '') AS description,
                    COALESCE(obligations, '') AS obligations, COALESCE(rights, '') AS rights,
                    COALESCE(duties, '') AS duties
             FROM organization_services LOOP
    PERFORM upsert_content_translation_source(rec.node_domain, 'organization_service', rec.id, 'name', default_lang, rec.name);
    PERFORM upsert_content_translation_source(rec.node_domain, 'organization_service', rec.id, 'description', default_lang, rec.description);
    PERFORM upsert_content_translation_source(rec.node_domain, 'organization_service', rec.id, 'obligations', default_lang, rec.obligations);
    PERFORM upsert_content_translation_source(rec.node_domain, 'organization_service', rec.id, 'rights', default_lang, rec.rights);
    PERFORM upsert_content_translation_source(rec.node_domain, 'organization_service', rec.id, 'duties', default_lang, rec.duties);
  END LOOP;

  FOR rec IN SELECT id::text AS id, node_domain, product_name, COALESCE(description, '') AS description,
                    COALESCE(extra_description, '') AS extra_description
             FROM store_items LOOP
    PERFORM upsert_content_translation_source(rec.node_domain, 'store_item', rec.id, 'product_name', default_lang, rec.product_name);
    PERFORM upsert_content_translation_source(rec.node_domain, 'store_item', rec.id, 'description', default_lang, rec.description);
    PERFORM upsert_content_translation_source(rec.node_domain, 'store_item', rec.id, 'extra_description', default_lang, rec.extra_description);
  END LOOP;

  FOR rec IN SELECT id, name, description, default_rules FROM node_faith_profiles LOOP
    PERFORM upsert_content_translation_source('__GLOBAL__', 'node_faith_profile', rec.id, 'name', default_lang, rec.name);
    PERFORM upsert_content_translation_source('__GLOBAL__', 'node_faith_profile', rec.id, 'description', default_lang, rec.description);
    PERFORM upsert_content_translation_source('__GLOBAL__', 'node_faith_profile', rec.id, 'default_rules', default_lang, rec.default_rules);
  END LOOP;

  FOR rec IN SELECT id::text AS id, node_domain, product_name, COALESCE(product_category, '') AS product_category, COALESCE(reason, '') AS reason FROM profile_product_prohibitions LOOP
    PERFORM upsert_content_translation_source(rec.node_domain, 'profile_product_prohibition', rec.id, 'product_name', default_lang, rec.product_name);
    PERFORM upsert_content_translation_source(rec.node_domain, 'profile_product_prohibition', rec.id, 'product_category', default_lang, rec.product_category);
    PERFORM upsert_content_translation_source(rec.node_domain, 'profile_product_prohibition', rec.id, 'reason', default_lang, rec.reason);
  END LOOP;

  FOR rec IN SELECT id::text AS id, node_domain, name, COALESCE(description, '') AS description FROM catalog_labels LOOP
    PERFORM upsert_content_translation_source(rec.node_domain, 'catalog_label', rec.id, 'name', default_lang, rec.name);
    PERFORM upsert_content_translation_source(rec.node_domain, 'catalog_label', rec.id, 'description', default_lang, rec.description);
  END LOOP;

  FOR rec IN SELECT id::text AS id, node_domain, category_name, COALESCE(reason, '') AS reason FROM catalog_dietary_rules LOOP
    PERFORM upsert_content_translation_source(rec.node_domain, 'catalog_dietary_rule', rec.id, 'category_name', default_lang, rec.category_name);
    PERFORM upsert_content_translation_source(rec.node_domain, 'catalog_dietary_rule', rec.id, 'reason', default_lang, rec.reason);
  END LOOP;

  FOR rec IN SELECT id::text AS id, node_domain, name, block_message FROM commerce_schedule LOOP
    PERFORM upsert_content_translation_source(rec.node_domain, 'commerce_schedule', rec.id, 'name', default_lang, rec.name);
    PERFORM upsert_content_translation_source(rec.node_domain, 'commerce_schedule', rec.id, 'block_message', default_lang, rec.block_message);
  END LOOP;

  FOR rec IN SELECT node_domain, COALESCE(commerce_hours_message, '') AS commerce_hours_message FROM public_settings LOOP
    PERFORM upsert_content_translation_source(rec.node_domain, 'public_settings', rec.node_domain, 'commerce_hours_message', default_lang, rec.commerce_hours_message);
  END LOOP;

  FOR rec IN SELECT id::text AS id, display_name, description, manufacturer FROM nfc_card_drivers LOOP
    PERFORM upsert_content_translation_source('__GLOBAL__', 'nfc_card_driver', rec.id, 'display_name', default_lang, rec.display_name);
    PERFORM upsert_content_translation_source('__GLOBAL__', 'nfc_card_driver', rec.id, 'description', default_lang, rec.description);
    PERFORM upsert_content_translation_source('__GLOBAL__', 'nfc_card_driver', rec.id, 'manufacturer', default_lang, rec.manufacturer);
  END LOOP;
END $$;
