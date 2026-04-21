-- ================================================================
--  RPC pública para buscar cuenta por email desde la landing
--  SECURITY DEFINER → bypass RLS, anon key puede llamarla
-- ================================================================

CREATE OR REPLACE FUNCTION public.buscar_cuenta_por_email(email_input TEXT)
RETURNS JSON AS $$
DECLARE
  v_profile    RECORD;
  v_sub        RECORD;
  v_pagos      JSON;
  v_suspendida BOOLEAN;
BEGIN
  SELECT id, email,
         COALESCE(nombre_completo, nombre_negocio, email) AS nombre,
         subscription_status, subscription_end_date, auth_status
  INTO v_profile
  FROM public.profiles
  WHERE email = LOWER(TRIM(email_input))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('found', false);
  END IF;

  -- Sistema nuevo: buscar en suscripciones + planes
  SELECT s.id, s.estado, s.proximo_cobro::text, p.nombre AS plan_nombre
  INTO v_sub
  FROM public.suscripciones s
  JOIN public.planes p ON p.id = s.plan_id
  WHERE s.user_id = v_profile.id
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    SELECT json_agg(row_to_json(pg)) INTO v_pagos
    FROM (
      SELECT id::text, monto_clp, estado, periodo_cobrado
      FROM public.pagos
      WHERE suscripcion_id = v_sub.id
        AND estado = 'pendiente'
      ORDER BY created_at DESC
    ) pg;

    RETURN json_build_object(
      'found',    true,
      'profile',  json_build_object(
        'id',                  v_profile.id::text,
        'email',               v_profile.email,
        'nombre',              v_profile.nombre,
        'subscription_status', v_profile.subscription_status,
        'subscription_end_date', v_profile.subscription_end_date::text,
        'auth_status',         v_profile.auth_status
      ),
      'suscripcion', json_build_object(
        'id',           v_sub.id::text,
        'estado',       v_sub.estado,
        'plan',         json_build_object('nombre', v_sub.plan_nombre),
        'proximo_cobro', v_sub.proximo_cobro
      ),
      'pagos_pendientes', COALESCE(v_pagos, '[]'::json)
    );
  END IF;

  -- Sistema legacy
  v_suspendida := v_profile.subscription_status = 'suspended'
    OR v_profile.auth_status = 'suspended'
    OR (v_profile.subscription_end_date IS NOT NULL
        AND v_profile.subscription_end_date < NOW());

  RETURN json_build_object(
    'found',   true,
    'profile', json_build_object(
      'id',                  v_profile.id::text,
      'email',               v_profile.email,
      'nombre',              v_profile.nombre,
      'subscription_status', v_profile.subscription_status,
      'subscription_end_date', v_profile.subscription_end_date::text,
      'auth_status',         v_profile.auth_status
    ),
    'suscripcion', json_build_object(
      'id',           null,
      'estado',       CASE WHEN v_suspendida THEN 'bloqueada' ELSE 'activa' END,
      'plan',         json_build_object('nombre', 'POS-Matic'),
      'proximo_cobro', v_profile.subscription_end_date::text
    ),
    'pagos_pendientes', CASE WHEN v_suspendida THEN
      json_build_array(json_build_object(
        'id',             'legacy-' || v_profile.id::text,
        'monto_clp',      null,
        'estado',         'pendiente',
        'periodo_cobrado', TO_CHAR(CURRENT_DATE, 'YYYY-MM'),
        'es_legacy',      true
      ))
    ELSE '[]'::json END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permitir que el rol anon ejecute esta función
GRANT EXECUTE ON FUNCTION public.buscar_cuenta_por_email(TEXT) TO anon;
