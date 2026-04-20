function sanitizeProfile(p) {
  return {
    id: p.id,
    email: p.email,
    nombre: p.nombre_completo || p.nombre_negocio || p.email,
    negocio: p.nombre_negocio,
    activa: p.suscripcion_activa ?? (p.subscription_status === "active"),
  };
}

async function verificarHcaptcha(token) {
  if (!token) return false;
  try {
    const params = new URLSearchParams({
      response: token,
      secret: process.env.HCAPTCHA_SECRET,
    });
    const r = await fetch("https://hcaptcha.com/siteverify", { method: "POST", body: params });
    const json = await r.json();
    return json.success === true;
  } catch {
    return false;
  }
}

async function fetchUFDirecto() {
  const r = await fetch("https://mindicador.cl/api/uf");
  const json = await r.json();
  return json.serie?.[0]?.valor ?? null;
}

module.exports = { sanitizeProfile, verificarHcaptcha, fetchUFDirecto };
