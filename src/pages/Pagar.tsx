import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

const API = "";

type Profile = { id: string; email: string; nombre: string; negocio: string; activa: boolean };
type Suscripcion = { id: string | null; estado: string; plan: { nombre: string } | null; proximo_cobro: string | null };
type Pago = { id: string; monto_clp: number | null; estado: string; periodo_cobrado: string; es_legacy?: boolean };
type CuentaData = { tiene_suscripcion: boolean; profile: Profile; suscripcion: Suscripcion; pagos_pendientes: Pago[] };

function formatCLP(n: number) {
  return "$" + Math.round(n).toLocaleString("es-CL");
}
function formatFecha(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });
}

export default function Pagar() {
  const [searchParams] = useSearchParams();
  const resultadoPago = searchParams.get("pago");

  const [view, setView] = useState<"resultado" | "lookup" | "cuenta" | "nosub">(
    resultadoPago ? "resultado" : "lookup"
  );
  const [email, setEmail] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [cuenta, setCuenta] = useState<CuentaData | null>(null);
  const [noSubEmail, setNoSubEmail] = useState("");
  const [montoLegacy, setMontoLegacy] = useState<string>("Calculando...");
  const [pagandoLegacy, setPagandoLegacy] = useState(false);
  const [cuentaError, setCuentaError] = useState("");
  const perfilIdRef = useRef<string | null>(null);

  // Cargar hCaptcha script
  useEffect(() => {
    if (document.querySelector('script[src*="hcaptcha"]')) return;
    const script = document.createElement("script");
    script.src = "https://js.hcaptcha.com/1/api.js";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  // Fetch monto UF cuando se muestra el pago legacy
  useEffect(() => {
    if (view !== "cuenta" || !cuenta) return;
    const legacy = cuenta.pagos_pendientes.find((p) => p.es_legacy);
    if (!legacy) return;
    perfilIdRef.current = cuenta.profile.id;
    fetch(`${API}/api/uf-preview?uf=0.7`)
      .then((r) => r.json())
      .then((d) => { if (d.monto) setMontoLegacy(formatCLP(d.monto) + " aprox."); })
      .catch(() => {});
  }, [view, cuenta]);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setLookupError("");
    if (!email) { setLookupError("Ingresa tu email."); return; }

    let htoken = "";
    if ((window as any).hcaptcha) {
      try { htoken = (window as any).hcaptcha.getResponse(); } catch {}
    }

    setBuscando(true);
    try {
      const res = await fetch(`${API}/api/cuenta/estado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), hcaptcha_token: htoken }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLookupError(data.error || "Error al consultar la cuenta.");
        if ((window as any).hcaptcha) (window as any).hcaptcha.reset();
        return;
      }
      if (!data.tiene_suscripcion) {
        setNoSubEmail(email);
        setView("nosub");
        return;
      }
      setCuenta(data);
      setView("cuenta");
    } catch {
      setLookupError("No se pudo conectar con el servidor.");
      if ((window as any).hcaptcha) (window as any).hcaptcha.reset();
    } finally {
      setBuscando(false);
    }
  }

  async function pagarLegacy() {
    setCuentaError("");
    setPagandoLegacy(true);
    try {
      const res = await fetch(`${API}/api/pago-legacy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: perfilIdRef.current, plan_slug: "basico" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear el pago");
      window.location.href = data.init_point;
    } catch (err: any) {
      setCuentaError(err.message);
      setPagandoLegacy(false);
    }
  }

  async function pagarAhora(pagoId: string) {
    setCuentaError("");
    try {
      const res = await fetch(`${API}/api/crear-preferencia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pago_id: pagoId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear la preferencia de pago");
      window.location.href = data.init_point;
    } catch (err: any) {
      setCuentaError(err.message);
    }
  }

  function resetLookup() {
    setView("lookup");
    setEmail("");
    setLookupError("");
    setCuenta(null);
    if ((window as any).hcaptcha) (window as any).hcaptcha.reset();
  }

  const resultados: Record<string, { icon: string; titulo: string; desc: string }> = {
    exitoso: { icon: "✅", titulo: "¡Pago recibido!", desc: "Tu suscripción será activada en unos instantes. Recibirás un email de confirmación." },
    fallido: { icon: "❌", titulo: "Pago rechazado", desc: "No se pudo procesar tu pago. Puedes intentarlo de nuevo." },
    pendiente: { icon: "⏳", titulo: "Pago en proceso", desc: "Tu pago está siendo verificado. Te notificaremos cuando se confirme." },
  };
  const cfg = resultadoPago ? (resultados[resultadoPago] || resultados.pendiente) : null;

  const badgeClasses: Record<string, string> = {
    activa: "bg-emerald-100 text-emerald-800",
    en_gracia: "bg-red-100 text-red-800",
    bloqueada: "bg-red-100 text-red-800",
    pendiente: "bg-yellow-100 text-yellow-800",
  };
  const badgeLabels: Record<string, string> = {
    activa: "Activa", en_gracia: "En gracia", bloqueada: "Bloqueada", pendiente: "Pendiente",
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-start py-12 px-4"
      style={{ fontFamily: "'Manrope', sans-serif", backgroundColor: "#ffffff", backgroundImage: "radial-gradient(#a413ec 0.5px, transparent 0.5px)", backgroundSize: "24px 24px", backgroundAttachment: "fixed" }}>

      {/* Header */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-black"
            style={{ background: "linear-gradient(135deg,#a413ec,#7100a6)" }}>P</div>
          <span className="text-2xl font-extrabold text-gray-900">POS-Matic</span>
        </div>
        <p className="text-gray-500 text-sm">por Pudú Tecnología</p>
      </div>

      {/* Resultado de pago */}
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
              type="email" autoComplete="email" placeholder="correo@ejemplo.com" required
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm mb-5 transition-shadow focus:outline-none focus:ring-[3px] focus:ring-purple-200"
            />
            <div
              className="h-captcha mb-5"
              data-sitekey={import.meta.env.VITE_HCAPTCHA_SITE_KEY || "10000000-ffff-ffff-ffff-000000000001"}
              data-theme="light"
              data-size="normal"
            />
            {lookupError && <p className="text-red-600 text-sm mb-4">{lookupError}</p>}
            <button type="submit" disabled={buscando} className="btn-primary w-full justify-center">
              {buscando ? <span className="pagar-spinner" /> : "Buscar cuenta"}
            </button>
          </form>
        </div>
      )}

      {/* Estado cuenta */}
      {view === "cuenta" && cuenta && (
        <div className="pagar-card w-full max-w-md p-8">
          {/* Perfil */}
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
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${badgeClasses[cuenta.suscripcion.estado] || "bg-yellow-100 text-yellow-800"}`}>
                {badgeLabels[cuenta.suscripcion.estado] || cuenta.suscripcion.estado}
              </span>
            </div>
          </div>

          {/* Plan */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Plan activo</div>
            <div className="font-bold text-gray-900">{cuenta.suscripcion.plan?.nombre || "—"}</div>
            {cuenta.suscripcion.proximo_cobro && (
              <div className="text-sm text-gray-500">Próximo cobro: {formatFecha(cuenta.suscripcion.proximo_cobro)}</div>
            )}
          </div>

          {/* Pagos pendientes */}
          {cuenta.pagos_pendientes.length > 0 ? (
            <div>
              <h3 className="font-bold text-gray-800 mb-3">Pagos pendientes</h3>
              <div className="flex flex-col gap-3 mb-6">
                {cuenta.pagos_pendientes.map((pago) => (
                  <div key={pago.id} className="border border-gray-200 hover:border-purple-300 rounded-2xl p-5 transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        {pago.es_legacy
                          ? <><div className="font-bold text-gray-900 text-lg">{montoLegacy}</div><div className="text-xs text-gray-400">Plan Básico · 0.7 UF</div></>
                          : <div className="font-bold text-gray-900 text-lg">{pago.monto_clp ? formatCLP(pago.monto_clp) : "—"}</div>
                        }
                        <div className="text-xs text-gray-400 mt-0.5">Período: {pago.periodo_cobrado || "—"}</div>
                        <span className={`inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-bold ${pago.estado === "en_gracia" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}>
                          {pago.estado === "en_gracia" ? "En gracia" : "Pendiente"}
                        </span>
                      </div>
                      <div>
                        {pago.es_legacy
                          ? <button onClick={pagarLegacy} disabled={pagandoLegacy} className="btn-primary" style={{ padding: "10px 22px", fontSize: ".9rem" }}>
                              {pagandoLegacy ? <span className="pagar-spinner" /> : "Pagar ahora"}
                            </button>
                          : <button onClick={() => pagarAhora(pago.id)} className="btn-primary" style={{ padding: "10px 22px", fontSize: ".9rem" }}>
                              Pagar ahora
                            </button>
                        }
                      </div>
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

          {cuentaError && <p className="text-red-600 text-sm mt-4">{cuentaError}</p>}
          <button onClick={resetLookup} className="btn-outline mt-6 w-full justify-center">← Buscar otra cuenta</button>
        </div>
      )}

      {/* Sin suscripción */}
      {view === "nosub" && (
        <div className="pagar-card w-full max-w-md p-8 text-center">
          <div className="text-5xl mb-4">🔍</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No se encontró suscripción</h2>
          <p className="text-gray-500 text-sm mb-6">
            El email <strong>{noSubEmail}</strong> no tiene una suscripción activa.<br />
            ¿Quieres contratar un plan?
          </p>
          <a href="/#planes" className="btn-primary inline-flex justify-center mb-3">Ver planes</a>
          <br />
          <button onClick={resetLookup} className="btn-outline mt-3">← Volver</button>
        </div>
      )}

      <p className="text-gray-400 text-xs mt-8">
        ¿Necesitas ayuda? Escríbenos a{" "}
        <a href="https://wa.me/56959695940" className="text-purple-600 underline">WhatsApp</a>
      </p>
    </div>
  );
}
