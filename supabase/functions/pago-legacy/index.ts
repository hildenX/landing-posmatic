import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PLANES: Record<string, { nombre: string; uf: number }> = {
  basico:   { nombre: "Plan Básico",   uf: 0.7 },
  estandar: { nombre: "Plan Estándar", uf: 1.4 },
  pro:      { nombre: "Plan Pro",      uf: 2.0 },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { user_id, plan_slug = "basico" } = await req.json();
    if (!user_id) return new Response(JSON.stringify({ error: "user_id requerido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const plan = PLANES[plan_slug];
    if (!plan) return new Response(JSON.stringify({ error: "plan inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Obtener UF
    let uf = 40000;
    try {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data } = await supabase.rpc("get_uf_actual");
      if (data) uf = data;
    } catch {
      try {
        const r = await fetch("https://mindicador.cl/api/uf");
        const j = await r.json();
        uf = j.serie?.[0]?.valor ?? uf;
      } catch {}
    }

    // Cuentas de prueba
    const TEST_ACCOUNTS: Record<string, number> = { "a@a.cl": 300 };
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: perfil } = await supabase.from("profiles").select("email").eq("id", user_id).single();
    const montoTest = perfil?.email && TEST_ACCOUNTS[perfil.email];
    const monto = montoTest || Math.round(plan.uf * uf);

    const landingUrl = Deno.env.get("LANDING_URL") || "https://posmatic-landing.vercel.app";

    // Crear preferencia MercadoPago
    const mpToken = Deno.env.get("MP_ACCESS_TOKEN")?.trim();
    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mpToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{ title: `${plan.nombre} - POS-Matic`, quantity: 1, unit_price: monto, currency_id: "CLP" }],
        external_reference: `legacy:${user_id}:${plan_slug}`,
        back_urls: {
          success: `${landingUrl}/pagar?pago=exitoso`,
          failure: `${landingUrl}/pagar?pago=fallido`,
          pending: `${landingUrl}/pagar?pago=pendiente`,
        },
        notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/webhook-mp`,
        statement_descriptor: "POS-Matic Pudu",
        payment_methods: { installments: 1 },
      }),
    });

    if (!mpRes.ok) {
      const err = await mpRes.text();
      throw new Error(`MP error: ${err}`);
    }

    const mpData = await mpRes.json();
    return new Response(
      JSON.stringify({ init_point: mpData.init_point, monto, uf, plan: plan.nombre }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("pago-legacy error:", err);
    return new Response(
      JSON.stringify({ error: "Error creando preferencia de pago" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
