INSERT INTO public.email_templates (key, name, subject, body_html, body_text, category, variables, active)
VALUES (
  'welcome',
  'Welcome',
  'Welcome to {{store_name}}',
  '<p>Hi {{customer_name}}, welcome to {{store_name}}.</p><p>We are happy to have you here.</p>',
  'Hi {{customer_name}}, welcome to {{store_name}}.',
  'account',
  '["customer_name","store_name"]'::jsonb,
  true
)
ON CONFLICT (key) DO UPDATE
SET
  name = COALESCE(public.email_templates.name, EXCLUDED.name),
  subject = COALESCE(NULLIF(public.email_templates.subject, ''), EXCLUDED.subject),
  body_html = COALESCE(NULLIF(public.email_templates.body_html, ''), EXCLUDED.body_html),
  body_text = COALESCE(NULLIF(public.email_templates.body_text, ''), EXCLUDED.body_text),
  category = COALESCE(NULLIF(public.email_templates.category, ''), EXCLUDED.category),
  variables = CASE
    WHEN public.email_templates.variables IS NULL OR public.email_templates.variables = '[]'::jsonb
      THEN EXCLUDED.variables
    ELSE public.email_templates.variables
  END,
  active = true,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.queue_welcome_email_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(coalesce(NEW.email, '')));
  v_name text := trim(coalesce(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(coalesce(NEW.email, ''), '@', 1),
    'there'
  ));
BEGIN
  IF v_email = '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.customer_profiles (
    user_id,
    full_name,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NULLIF(v_name, ''), 'there'),
    now(),
    now()
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.email_queue (
    recipient,
    user_id,
    template_key,
    subject,
    variables,
    status,
    next_attempt_at,
    idempotency_key,
    max_attempts
  )
  VALUES (
    v_email,
    NEW.id,
    'welcome',
    'Welcome to Superb Creations',
    jsonb_build_object(
      'customer_name', COALESCE(NULLIF(v_name, ''), 'there'),
      'store_name', 'Superb Creations',
      'user_email', v_email
    ),
    'queued',
    now(),
    'welcome:' || NEW.id::text,
    5
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    IF to_regclass('public.system_error_logs') IS NOT NULL THEN
      INSERT INTO public.system_error_logs(source, severity, message, stack, user_id, request_path, metadata)
      VALUES (
        'server',
        'warning',
        'Welcome email queueing failed',
        SQLERRM,
        NEW.id,
        'auth.users.after_insert',
        jsonb_build_object('email_present', v_email <> '')
      )
      ON CONFLICT DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_queue_welcome_email_for_new_user ON auth.users;
CREATE TRIGGER trg_queue_welcome_email_for_new_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_welcome_email_for_new_user();
