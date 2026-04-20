-- ================================================================
--  SISTEMA DE PAGOS POS-MATIC — Migración 001
--  Tablas · Stored Procedures · Triggers · RLS · pg_cron
--  No toca ninguna tabla existente de ventas/inventario
-- ================================================================

-- ── EXTENSIONES ─────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- pg_cron debe estar habilitada en Supabase Dashboard > Extensions

-- ================================================================
--  TABLAS NUEVAS
-- ================================================================

-- Cache del valor UF (se actualiza diariamente desde el backend)
CREATE TABLE IF NOT EXISTS public.uf_cache (
  id         SERIAL PRIMARY KEY,
  valor      NUMERIC(12,2) NOT NULL,
  fecha      DATE NOT NULL DEFAULT CURRENT_DATE,
  fuente     TEXT DEFAULT 'mindicador.cl',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_uf_cache_fecha ON public.uf_cache(fecha);

-- Planes de suscripción (precio en UF, nunca en CLP hardcodeado)
CREATE TABLE IF NOT EXISTS public.planes (
  id           SERIAL PRIMARY KEY,
  nombre       TEXT NOT NULL,
  slug         TEXT UNIQUE NOT NULL,
  uf_cantidad  NUMERIC(4,2) NOT NULL,
  descripcion  TEXT,
  features     JSONB DEFAULT '[]',
  activo       BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.planes (nombre, slug, uf_cantidad, descripcion, features) VALUES
  ('Básico',   'basico',   0.7, 'Ideal para emprendedores',
   '["1 caja registradora","Boletas electrónicas","Inventario básico","Soporte por email"]'),
  ('Estándar', 'estandar', 1.4, 'Para negocios en crecimiento',
   '["3 cajas registradoras","Boletas y facturas","Inventario avanzado","Reportes","Soporte prioritario"]'),
  ('Pro',      'pro',      2.0, 'Para empresas establecidas',
   '["Cajas ilimitadas","Todos los DTE","Multi-bodega","API access","Soporte 24/7"]')
ON CONFLICT (slug) DO NOTHING;

-- Una suscripción por cliente
CREATE TABLE IF NOT EXISTS public.suscripciones (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id           INTEGER NOT NULL REFERENCES public.planes(id),
  estado            TEXT NOT NULL DEFAULT 'trial'
                      CHECK (estado IN ('trial','activa','gracia','bloqueada','cancelada')),
  fecha_inicio      DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_primer_pago DATE,
  proximo_cobro     DATE,
  bloqueada_en      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)
);

-- Historial de pagos
CREATE TABLE IF NOT EXISTS public.pagos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suscripcion_id   UUID NOT NULL REFERENCES public.suscripciones(id),
  mp_payment_id    TEXT UNIQUE,          -- UNIQUE evita doble procesamiento
  mp_preference_id TEXT,
  monto_uf         NUMERIC(4,2),
  monto_clp        INTEGER NOT NULL DEFAULT 0,
  valor_uf_usado   NUMERIC(12,2),
  estado           TEXT NOT NULL DEFAULT 'pendiente'
                     CHECK (estado IN ('pendiente','aprobado','rechazado','reembolsado')),
  periodo_cobrado  TEXT,                 -- 'YYYY-MM'
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pagos_suscripcion ON public.pagos(suscripcion_id);
CREATE INDEX IF NOT EXISTS idx_pagos_mp_id       ON public.pagos(mp_payment_id);

-- Boletas electrónicas generadas
CREATE TABLE IF NOT EXISTS public.boletas_pago (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pago_id        UUID UNIQUE NOT NULL REFERENCES public.pagos(id),
  folio          INTEGER,
  numero_boleta  TEXT,
  pdf_url        TEXT,
  email_destino  TEXT,
  enviada_email  BOOLEAN DEFAULT FALSE,
  fecha_emision  TIMESTAMPTZ DEFAULT NOW(),
  datos_json     JSONB DEFAULT '{}'
);

-- Columna en profiles para que pos-matic sepa si hay acceso
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suscripcion_activa BOOLEAN DEFAULT FALSE;

-- ================================================================
--  STORED PROCEDURES
-- ================================================================

-- ── Obtener UF actual ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_uf_actual()
RETURNS NUMERIC AS $$
DECLARE v_valor NUMERIC;
BEGIN
  SELECT valor INTO v_valor FROM public.uf_cache
  ORDER BY fecha DESC LIMIT 1;
  IF v_valor IS NULL THEN
    RAISE EXCEPTION 'Sin valor UF en caché. Actualizar desde el backend.';
  END IF;
  RETURN v_valor;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ── Calcular próximo cobro según regla de días ───────────────────
-- Si primer pago > día 15 → cobrar mes +2 · Si <= día 15 → mes +1
-- Ventana siempre el día 5 del mes correspondiente
CREATE OR REPLACE FUNCTION public.calcular_proximo_cobro(
  p_fecha_referencia DATE
) RETURNS DATE AS $$
BEGIN
  IF EXTRACT(DAY FROM p_fecha_referencia) > 15 THEN
    RETURN DATE_TRUNC('month', p_fecha_referencia) + INTERVAL '2 months' + INTERVAL '4 days';
  ELSE
    RETURN DATE_TRUNC('month', p_fecha_referencia) + INTERVAL '1 month'  + INTERVAL '4 days';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER;

-- ── Crear pago pendiente al generar preferencia MP ───────────────
CREATE OR REPLACE FUNCTION public.crear_pago_pendiente(
  p_user_id        UUID,
  p_preference_id  TEXT,
  p_plan_slug      TEXT
) RETURNS JSON AS $$
DECLARE
  v_sub   public.suscripciones%ROWTYPE;
  v_plan  public.planes%ROWTYPE;
  v_uf    NUMERIC;
  v_monto INTEGER;
  v_id    UUID;
BEGIN
  SELECT * INTO v_sub  FROM public.suscripciones WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok',false,'error','sin_suscripcion');
  END IF;

  SELECT * INTO v_plan FROM public.planes WHERE slug = p_plan_slug AND activo = TRUE;
  IF NOT FOUND THEN
    RETURN json_build_object('ok',false,'error','plan_invalido');
  END IF;

  v_uf    := public.get_uf_actual();
  v_monto := ROUND(v_plan.uf_cantidad * v_uf);

  INSERT INTO public.pagos
    (suscripcion_id, mp_preference_id, monto_uf, monto_clp,
     valor_uf_usado, estado, periodo_cobrado)
  VALUES
    (v_sub.id, p_preference_id, v_plan.uf_cantidad, v_monto,
     v_uf, 'pendiente', TO_CHAR(CURRENT_DATE,'YYYY-MM'))
  RETURNING id INTO v_id;

  RETURN json_build_object(
    'ok',true,'pago_id',v_id,
    'monto_clp',v_monto,'monto_uf',v_plan.uf_cantidad,'valor_uf',v_uf
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Procesar webhook de MercadoPago (TRANSACCIÓN ATÓMICA) ────────
CREATE OR REPLACE FUNCTION public.procesar_pago_mp(
  p_mp_payment_id  TEXT,
  p_mp_status      TEXT,
  p_monto_recibido INTEGER,
  p_preference_id  TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  v_pago        public.pagos%ROWTYPE;
  v_sub         public.suscripciones%ROWTYPE;
  v_plan        public.planes%ROWTYPE;
  v_uf          NUMERIC;
  v_esperado    INTEGER;
BEGIN
  -- 1. Idempotencia: si ya fue aprobado, retornar OK sin hacer nada
  SELECT * INTO v_pago FROM public.pagos
  WHERE mp_payment_id = p_mp_payment_id;

  IF FOUND AND v_pago.estado = 'aprobado' THEN
    RETURN json_build_object('ok',true,'ya_procesado',true,'pago_id',v_pago.id);
  END IF;

  -- 2. Buscar por preference_id si no tiene mp_payment_id aún
  IF NOT FOUND THEN
    SELECT * INTO v_pago FROM public.pagos
    WHERE mp_preference_id = p_preference_id AND estado = 'pendiente'
    ORDER BY created_at DESC LIMIT 1;

    IF NOT FOUND THEN
      RETURN json_build_object('ok',false,'error','pago_no_encontrado');
    END IF;

    UPDATE public.pagos SET mp_payment_id = p_mp_payment_id
    WHERE id = v_pago.id;
    v_pago.mp_payment_id := p_mp_payment_id;
  END IF;

  -- 3. Lock de fila para evitar race condition
  SELECT s.* INTO v_sub FROM public.suscripciones s
  WHERE s.id = v_pago.suscripcion_id FOR UPDATE;

  SELECT p.* INTO v_plan FROM public.planes p
  WHERE p.id = v_sub.plan_id;

  -- 4. Validar monto contra el plan (tolerancia $50 por redondeo UF)
  v_uf       := public.get_uf_actual();
  v_esperado := ROUND(v_plan.uf_cantidad * v_uf);

  IF p_monto_recibido < (v_esperado - 50) THEN
    UPDATE public.pagos
    SET estado = 'rechazado', updated_at = NOW(),
        metadata = metadata || jsonb_build_object(
          'motivo','monto_insuficiente',
          'esperado',v_esperado,'recibido',p_monto_recibido)
    WHERE id = v_pago.id;
    RETURN json_build_object('ok',false,'error','monto_insuficiente');
  END IF;

  -- 5. Actualizar estado → TRIGGER activa cuenta automáticamente
  UPDATE public.pagos
  SET estado         = CASE WHEN p_mp_status='approved' THEN 'aprobado' ELSE 'rechazado' END,
      monto_clp      = p_monto_recibido,
      valor_uf_usado = v_uf,
      updated_at     = NOW()
  WHERE id = v_pago.id;

  IF p_mp_status != 'approved' THEN
    RETURN json_build_object('ok',false,'error','no_aprobado','estado_mp',p_mp_status);
  END IF;

  -- 6. Registrar primer pago
  IF v_sub.fecha_primer_pago IS NULL THEN
    UPDATE public.suscripciones
    SET fecha_primer_pago = CURRENT_DATE WHERE id = v_sub.id;
  END IF;

  -- 7. Retornar datos para generar boleta
  RETURN json_build_object(
    'ok',            true,
    'ya_procesado',  false,
    'pago_id',       v_pago.id,
    'user_id',       v_sub.user_id,
    'plan_nombre',   v_plan.nombre,
    'plan_slug',     v_plan.slug,
    'monto_clp',     p_monto_recibido,
    'monto_uf',      v_plan.uf_cantidad,
    'valor_uf',      v_uf,
    'periodo',       v_pago.periodo_cobrado
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Verificar acceso (pos-matic lo llama al login) ───────────────
CREATE OR REPLACE FUNCTION public.verificar_acceso(p_user_id UUID)
RETURNS JSON AS $$
DECLARE v_sub public.suscripciones%ROWTYPE;
BEGIN
  SELECT * INTO v_sub FROM public.suscripciones WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('acceso',false,'motivo','sin_suscripcion');
  END IF;
  RETURN json_build_object(
    'acceso',        v_sub.estado IN ('activa','trial'),
    'estado',        v_sub.estado,
    'proximo_cobro', v_sub.proximo_cobro,
    'plan_id',       v_sub.plan_id
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ── Bloquear suscripciones vencidas (corre pg_cron día 8) ────────
CREATE OR REPLACE FUNCTION public.bloquear_vencidas()
RETURNS INTEGER AS $$
DECLARE v_count INTEGER;
BEGIN
  WITH bloqueadas AS (
    UPDATE public.suscripciones
    SET estado = 'bloqueada', bloqueada_en = NOW(), updated_at = NOW()
    WHERE estado IN ('activa','gracia')
      AND proximo_cobro < DATE_TRUNC('month', CURRENT_DATE)
      AND NOT EXISTS (
        SELECT 1 FROM public.pagos
        WHERE suscripcion_id = suscripciones.id
          AND estado = 'aprobado'
          AND periodo_cobrado = TO_CHAR(CURRENT_DATE,'YYYY-MM')
      )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM bloqueadas;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Poner en gracia (recordatorio días 2-4) ──────────────────────
CREATE OR REPLACE FUNCTION public.marcar_en_gracia()
RETURNS INTEGER AS $$
DECLARE v_count INTEGER;
BEGIN
  WITH en_gracia AS (
    UPDATE public.suscripciones
    SET estado = 'gracia', updated_at = NOW()
    WHERE estado = 'activa'
      AND proximo_cobro <= CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 FROM public.pagos
        WHERE suscripcion_id = suscripciones.id
          AND estado = 'aprobado'
          AND periodo_cobrado = TO_CHAR(CURRENT_DATE,'YYYY-MM')
      )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM en_gracia;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
--  TRIGGERS
-- ================================================================

-- TRIGGER 1: Pago aprobado → activar suscripción + profiles
CREATE OR REPLACE FUNCTION public.fn_pago_aprobado()
RETURNS TRIGGER AS $$
DECLARE v_user_id UUID;
BEGIN
  IF NEW.estado = 'aprobado' AND (OLD.estado IS DISTINCT FROM 'aprobado') THEN
    SELECT user_id INTO v_user_id
    FROM public.suscripciones WHERE id = NEW.suscripcion_id;

    UPDATE public.suscripciones
    SET estado        = 'activa',
        proximo_cobro = public.calcular_proximo_cobro(
          COALESCE(fecha_primer_pago, CURRENT_DATE)),
        updated_at    = NOW()
    WHERE id = NEW.suscripcion_id;

    UPDATE public.profiles
    SET suscripcion_activa = TRUE
    WHERE id = v_user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_pago_aprobado ON public.pagos;
CREATE TRIGGER trg_pago_aprobado
  AFTER UPDATE ON public.pagos
  FOR EACH ROW EXECUTE FUNCTION public.fn_pago_aprobado();

-- TRIGGER 2: Suscripción bloqueada → bloquear en profiles
CREATE OR REPLACE FUNCTION public.fn_suscripcion_bloqueada()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado = 'bloqueada' AND (OLD.estado IS DISTINCT FROM 'bloqueada') THEN
    UPDATE public.profiles
    SET suscripcion_activa = FALSE WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_suscripcion_bloqueada ON public.suscripciones;
CREATE TRIGGER trg_suscripcion_bloqueada
  AFTER UPDATE ON public.suscripciones
  FOR EACH ROW EXECUTE FUNCTION public.fn_suscripcion_bloqueada();

-- TRIGGER 3: updated_at automático en pagos
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pagos_updated_at ON public.pagos;
CREATE TRIGGER trg_pagos_updated_at
  BEFORE UPDATE ON public.pagos
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_subs_updated_at ON public.suscripciones;
CREATE TRIGGER trg_subs_updated_at
  BEFORE UPDATE ON public.suscripciones
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ================================================================
--  ROW LEVEL SECURITY
-- ================================================================

ALTER TABLE public.uf_cache       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suscripciones  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boletas_pago   ENABLE ROW LEVEL SECURITY;

-- UF: lectura pública
CREATE POLICY "uf_lectura_publica" ON public.uf_cache
  FOR SELECT USING (TRUE);

-- Planes: lectura pública (el precio CLP lo calcula el servidor)
CREATE POLICY "planes_lectura_publica" ON public.planes
  FOR SELECT USING (activo = TRUE);

-- Suscripciones: usuario ve solo la suya
CREATE POLICY "subs_propia_select" ON public.suscripciones
  FOR SELECT USING (user_id = auth.uid());

-- Pagos: usuario ve solo los suyos · NADIE escribe directo
CREATE POLICY "pagos_propios_select" ON public.pagos
  FOR SELECT USING (
    suscripcion_id IN (
      SELECT id FROM public.suscripciones WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "pagos_no_insert_directo" ON public.pagos
  FOR INSERT WITH CHECK (FALSE);
CREATE POLICY "pagos_no_update_directo" ON public.pagos
  FOR UPDATE USING (FALSE);

-- Boletas: usuario ve solo las suyas
CREATE POLICY "boletas_propias" ON public.boletas_pago
  FOR SELECT USING (
    pago_id IN (
      SELECT p.id FROM public.pagos p
      JOIN public.suscripciones s ON s.id = p.suscripcion_id
      WHERE s.user_id = auth.uid()
    )
  );

-- ================================================================
--  pg_cron JOBS (habilitar extensión primero en Dashboard)
-- ================================================================

-- Día 2 del mes 09:00 → poner en gracia (aviso de pago pendiente)
SELECT cron.schedule(
  'posmatic-marcar-gracia',
  '0 9 2 * *',
  $$ SELECT public.marcar_en_gracia() $$
) ON CONFLICT DO NOTHING;

-- Día 8 del mes 00:05 → bloquear si no pagaron
SELECT cron.schedule(
  'posmatic-bloquear-vencidas',
  '5 0 8 * *',
  $$ SELECT public.bloquear_vencidas() $$
) ON CONFLICT DO NOTHING;
