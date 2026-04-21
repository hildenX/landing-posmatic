import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const sb = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

type Profile = { id: string; email: string; nombre: string; subscription_status: string; subscription_end_date: string | null; auth_status: string | null };
type Suscripcion = { id: string | null; estado: string; plan: { nombre: string } | null; proximo_cobro: string | null };
type Pago = { id: string; monto_clp: number | null; estado: string; periodo_cobrado: string; es_legacy?: boolean };
type CuentaData = { profile: Profile; suscripcion: Suscripcion; pagos_pendientes: Pago[] };

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");
const fmtFecha = (s: string | null) => s ? new Date(s).toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" }) : "—";

export default function Pagar() {
  const [searchParams] = useSearchParams();
  const resultadoPago = searchParams.get("pago");

  const [view, setView] = useState<"resultado" | "lookup" | "cuenta" | "nosub">(resultadoPago ? "resultado" : "lookup");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cuenta, setCuenta] = useState<CuentaData | null>(null);
  const [noSubEmail, setNoSubEmail] = useState("");
  const [montoLegacy, setMontoLegacy] = useState("Calculando...");
  const [pagando, setPagando] = useState(false);
  const [pagoError, setPagoError] = useState("");
  const perfilId = useRef<string | null>(null);

  // hCaptcha script
  useEffect(() => {
    if (document.querySelector('script[src*="hcaptcha"]')) return;
    const s = document.createElement("script");
    s.src = "https://js.hcaptcha.com/1/api.js";
    s.async = true; s.defer = true;
    document.head.appendChild(s);
  }, []);

  // Monto UF cuando llega un pago legacy
  useEffect(() => {
    if (view !== "cuenta" || !cuenta || !sb) return;
    const legacy = cuenta.pagos_pendientes.find(p => p.es_legacy);
    if (!legacy) return;
    perfilId.current = cuenta.profile.id;
    sb.rpc("get_uf_actual").then(({ data: uf }) => {
      if (uf) setMontoLegacy(fmt(Math.round(0.7 * uf)) + " aprox.");
    });
  }, [view, cuenta]);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email) { setError("Ingresa tu email."); return; }

    if (!sb) {
      setError("Conecta tu proyecto Supabase en Lovable (botón nube ☁️ arriba a la derecha).");
      return;
    }

    setLoading(true);
    try {
      const emailLower = email.trim().toLowerCase();

      const { data: profiles, error: profErr } = await sb
        .from("profiles")
        .select("id, email, nombre_completo, nombre_negocio, subscription_status, subscription_end_date, auth_status, suscripcion_activa")
        .eq("email", emailLower)
        .limit(1);

      if (profErr) throw new Error(profErr.message);
      if (!profiles || profiles.length === 0) {
        setNoSubEmail(email);
        setView("nosub");
        return;
      }

      const p = profiles[0];
      const profile: Profile = {
        id: p.id, email: p.email,
        nombre: p.nombre_completo || p.nombre_negocio || p.email,
        subscription_status: p.subscription_status,
        subscription_end_date: p.subscription_end_date,
        auth_status: p.auth_status,
      };

      // Buscar suscripción nueva
      const { data: subs } = await sb
        .from("suscripciones")
        .select("id, estado, proximo_cobro, plan:planes(id, nombre, uf_cantidad)")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (subs && subs.length > 0) {
        const sub = subs[0];
        const { data: pagos } = await sb.from("pagos")
          .select("id, monto_clp, estado, periodo_cobrado")
          .eq("suscripcion_id", sub.id)
          .in("estado", ["pendiente", "en_gracia"])
          .order("created_at", { ascending: false });
        setCuenta({ profile, suscripcion: { id: sub.id, estado: sub.estado, plan: sub.plan as any, proximo_cobro: sub.proximo_cobro }, pagos_pendientes: pagos || [] });
        setView("cuenta");
        return;
      }

      // Sistema legacy
      const suspendida = profile.subscription_status === "suspended" ||
        profile.auth_status === "suspended" ||
        (profile.subscription_end_date && new Date(profile.subscription_end_date) < new Date());

      setCuenta({
        profile,
        suscripcion: { id: null, estado: suspendida ? "bloqueada" : "activa", plan: { nombre: "POS-Matic" }, proximo_cobro: profile.subscription_end_date },
        pagos_pendientes: suspendida ? [{ id: "legacy-" + profile.id, monto_clp: null, estado: "pendiente", periodo_cobrado: new Date().toISOString().slice(0, 7), es_legacy: true }] : [],
      });
      setView("cuenta");

    } catch (err: any) {
      setError(err.message || "Error al consultar la cuenta.");
    } finally {
      setLoading(false);
    }
  }

  async function pagarLegacy() {
    setPagoError(""); setPagando(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/pago-legacy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ user_id: perfilId.current, plan_slug: "basico" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear el pago");
      window.location.href = data.init_point;
    } catch (err: any) { setPagoError(err.message); setPagando(false); }
  }

  async function pagarAhora(pagoId: string) {
    setPagoError("");
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/crear-preferencia`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ pago_id: pagoId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear la preferencia");
      window.location.href = data.init_point;
    } catch (err: any) { setPagoError(err.message); }
  }

  const badgeCls: Record<string, string> = { activa: "bg-emerald-100 text-emerald-800", en_gracia: "bg-red-100 text-red-800", bloqueada: "bg-red-100 text-red-800", pendiente: "bg-yellow-100 text-yellow-800" };
  const badgeLbl: Record<string, string> = { activa: "Activa", en_gracia: "En gracia", bloqueada: "Bloqueada", pendiente: "Pendiente" };
  const resultados: Record<string, { icon: string; titulo: string; desc: string }> = {
    exitoso: { icon: "✅", titulo: "¡Pago recibido!", desc: "Tu suscripción será activada en unos instantes." },
    fallido: { icon: "❌", titulo: "Pago rechazado", desc: "No se pudo procesar tu pago. Puedes intentarlo de nuevo." },
    pendiente: { icon: "⏳", titulo: "Pago en proceso", desc: "Tu pago está siendo verificado." },
  };
  const cfg = resultadoPago ? (resultados[resultadoPago] || resultados.pendiente) : null;

  const dotBg = { backgroundColor: "#ffffff", backgroundImage: "radial-gradient(#a413ec 0.5px, transparent 0.5px)", backgroundSize: "24px 24px", backgroundAttachment: "fixed" };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start py-12 px-4" style={dotBg}>

      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-black" style={{ background: "linear-gradient(135deg,#a413ec,#7100a6)" }}>P</div>
          <span className="text-2xl font-extrabold text-gray-900">POS-Matic</span>
        </div>
        <p className="text-gray-500 text-sm">por Pudú Tecnología</p>
      </div>

      {/* Resultado pago */}
      {view === "resultado" && cfg && (
        <div className="pagar-card w-full max-w-md p-8 text-center">
          <div className="text-6xl mb-4">{cfg.icon}</div>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">{cfg.titulo}</h2>
          <p className="text-gray-500 mb-8">{cfg.desc}</p>
          <a href="/pagar" className="btn-primary inline-flex items-center justify-center">Volver</a>
        </div>
      )}

      {/* Lookup */}
      {view === "lookup" && (
        <div className="pagar-card w-full max-w-md p-8">
          <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Paga tu cuenta</h1>
          <p className="text-gray-500 text-sm mb-7">Ingresa tu email para ver tus pagos pendientes.</p>
          <form onSubmit={handleLookup} noValidate>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Email de tu cuenta</label>
            <input
              type="email" autoComplete="email" placeholder="correo@ejemplo.com"
              value={email} onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm mb-5 focus:outline-none focus:ring-[3px] focus:ring-purple-200"
            />
            <div className="h-captcha mb-5"
              data-sitekey={import.meta.env.VITE_HCAPTCHA_SITE_KEY || "10000000-ffff-ffff-ffff-000000000001"}
              data-theme="light" data-size="normal" />
            {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? <span className="pagar-spinner" /> : "Buscar cuenta"}
            </button>
          </form>
        </div>
      )}

      {/* Estado cuenta */}
      {view === "cuenta" && cuenta && (
        <div className="pagar-card w-full max-w-md p-8">
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
            <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-xl"
              style={{ background: "linear-gradient(135deg,#a413ec,#7100a6)" }}>
              {(cuenta.profile.nombre || cuenta.profile.email).charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-bold text-gray-900">{cuenta.profile.nombre || "—"}</div>
              <div className="text-gray-400 text-sm">{cuenta.profile.email}</div>
            </div>
            <div className="ml-auto">
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${badgeCls[cuenta.suscripcion.estado] || "bg-yellow-100 text-yellow-800"}`}>
                {badgeLbl[cuenta.suscripcion.estado] || cuenta.suscripcion.estado}
              </span>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Plan activo</div>
            <div className="font-bold text-gray-900">{cuenta.suscripcion.plan?.nombre || "—"}</div>
            {cuenta.suscripcion.proximo_cobro && (
              <div className="text-sm text-gray-500">Próximo cobro: {fmtFecha(cuenta.suscripcion.proximo_cobro)}</div>
            )}
          </div>

          {cuenta.pagos_pendientes.length > 0 ? (
            <div>
              <h3 className="font-bold text-gray-800 mb-3">Pagos pendientes</h3>
              <div className="flex flex-col gap-3 mb-4">
                {cuenta.pagos_pendientes.map(pago => (
                  <div key={pago.id} className="border border-gray-200 hover:border-purple-300 rounded-2xl p-5 transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        {pago.es_legacy
                          ? <><div className="font-bold text-gray-900 text-lg">{montoLegacy}</div><div className="text-xs text-gray-400">Plan Básico · 0.7 UF</div></>
                          : <div className="font-bold text-gray-900 text-lg">{pago.monto_clp ? fmt(pago.monto_clp) : "—"}</div>}
                        <div className="text-xs text-gray-400 mt-0.5">Período: {pago.periodo_cobrado || "—"}</div>
                        <span className={`inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-bold ${pago.estado === "en_gracia" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}>
                          {pago.estado === "en_gracia" ? "En gracia" : "Pendiente"}
                        </span>
                      </div>
                      {pago.es_legacy
                        ? <button onClick={pagarLegacy} disabled={pagando} className="btn-primary" style={{ padding: "10px 22px", fontSize: ".9rem" }}>
                            {pagando ? <span className="pagar-spinner" /> : "Pagar ahora"}
                          </button>
                        : <button onClick={() => pagarAhora(pago.id)} className="btn-primary" style={{ padding: "10px 22px", fontSize: ".9rem" }}>Pagar ahora</button>
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-green-700 font-semibold">Tu cuenta está al día</p>
              <p className="text-gray-400 text-sm">No tienes pagos pendientes.</p>
            </div>
          )}

          {pagoError && <p className="text-red-600 text-sm mt-2">{pagoError}</p>}
          <button onClick={() => { setView("lookup"); setEmail(""); setError(""); setCuenta(null); }} className="btn-outline mt-6 w-full justify-center">
            ← Buscar otra cuenta
          </button>
        </div>
      )}

      {/* Sin suscripción */}
      {view === "nosub" && (
        <div className="pagar-card w-full max-w-md p-8 text-center">
          <div className="text-5xl mb-4">🔍</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No se encontró cuenta</h2>
          <p className="text-gray-500 text-sm mb-6">El email <strong>{noSubEmail}</strong> no tiene una suscripción activa.</p>
          <a href="/#planes" className="btn-primary inline-flex justify-center mb-3">Ver planes</a><br />
          <button onClick={() => { setView("lookup"); setEmail(""); }} className="btn-outline mt-3">← Volver</button>
        </div>
      )}

      <p className="text-gray-400 text-xs mt-8">
        ¿Necesitas ayuda? <a href="https://wa.me/56959695940" className="text-purple-600 underline">WhatsApp</a>
      </p>
    </div>
  );
}
