import { useState, useEffect, useRef } from "react";
import {
  Sparkles, CreditCard, LogIn, Menu, X, CheckCircle2, Cloud, Store,
  Warehouse, Zap, MousePointer2, WifiOff, RefreshCw, Shield,
  Package, LayoutGrid, TrendingUp, Check, Star, Share2, Globe2,
  AlertTriangle, Utensils, ShoppingCart, FileText,
} from "lucide-react";

function useReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const siblings = entry.target.parentElement?.querySelectorAll(".reveal");
            siblings?.forEach((el, idx) => {
              if (!el.classList.contains("visible")) {
                setTimeout(() => el.classList.add("visible"), idx * 120);
              }
            });
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  useReveal();

  const closeMenu = () => setMenuOpen(false);

  async function pagarPlan(plan: string, btn: HTMLButtonElement) {
    const texto = btn.querySelector(".btn-text") as HTMLElement;
    const loader = btn.querySelector(".btn-loader") as HTMLElement;
    btn.disabled = true;
    texto.classList.add("hidden");
    loader.classList.remove("hidden");
    try {
      const API = import.meta.env.VITE_API_URL || "https://posmatic-landing.vercel.app";
      const res = await fetch(`${API}/api/create-preference`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) throw new Error("Error del servidor");
      const data = await res.json();
      window.location.href = data.init_point;
    } catch {
      alert("Hubo un error al procesar el pago. Intenta de nuevo.");
      btn.disabled = false;
      texto.classList.remove("hidden");
      loader.classList.add("hidden");
    }
  }

  function submitContact(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const success = document.getElementById("contact-success");
    if (success) {
      success.classList.remove("hidden");
      (e.target as HTMLFormElement).reset();
      setTimeout(() => success.classList.add("hidden"), 6000);
    }
  }

  return (
    <div className="text-on-background selection:bg-primary-container selection:text-on-primary-container">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-sm font-sans antialiased">
        <div className="flex justify-between items-center w-full px-4 sm:px-6 py-3 max-w-7xl mx-auto">
          <a href="#" className="text-lg sm:text-xl font-black tracking-tight text-slate-900">
            Pudú<span className="text-primary">Tecnología</span>
          </a>
          <div className="hidden md:flex items-center space-x-6">
            {["productos", "caracteristicas", "planes", "contacto"].map((s) => (
              <a key={s} className="text-slate-600 text-sm font-medium hover:text-primary transition-colors duration-200" href={`#${s}`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <a href="/pagar" className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 border-2 border-primary text-primary rounded-full font-bold hover:bg-purple-50 transition-colors text-sm">
              <CreditCard size={15} />
              Pagar cuenta
            </a>
            <a href="https://rextech.cl/login" className="hidden sm:inline-flex items-center gap-1.5 px-5 py-2 bg-primary text-white rounded-full font-bold hover:opacity-90 transition-opacity text-sm shadow-md shadow-primary/25">
              <LogIn size={16} />
              Solicitar Demo
            </a>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden flex flex-col justify-center items-center w-9 h-9 rounded-lg hover:bg-purple-100 transition-colors"
            >
              {menuOpen ? <X size={20} className="text-slate-700" /> : <Menu size={20} className="text-slate-700" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white/95 backdrop-blur-md px-5 py-4 flex flex-col space-y-1">
            {["productos", "caracteristicas", "planes", "contacto"].map((s) => (
              <a key={s} onClick={closeMenu} className="py-3 px-2 text-slate-700 font-semibold rounded-lg hover:bg-purple-50 hover:text-primary transition-colors" href={`#${s}`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </a>
            ))}
            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
              <a href="/pagar" className="block w-full text-center py-3 border-2 border-primary text-primary rounded-full font-bold hover:bg-purple-50 transition-colors">Pagar cuenta</a>
              <a href="https://rextech.cl/login" className="block w-full text-center py-3 bg-primary text-white rounded-full font-bold hover:opacity-90 transition-opacity">Solicitar Demo</a>
            </div>
          </div>
        )}
      </nav>

      <main className="pt-24">
        {/* Hero */}
        <section className="max-w-7xl mx-auto px-6 py-10 md:py-24 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="order-2 lg:order-1 reveal">
            <div className="inline-flex items-center space-x-2 bg-primary-container px-4 py-1 rounded-full mb-6">
              <Sparkles size={14} className="text-on-primary-fixed" />
              <span className="text-xs font-bold text-on-primary-fixed tracking-wide uppercase">Nueva Versión 2.0</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold text-on-background tracking-tight leading-[1.1] mb-6">
              Optimiza tu Negocio con <span className="text-primary">Pudú</span>
            </h1>
            <p className="text-xl text-on-surface-variant mb-10 max-w-xl leading-relaxed">
              El sistema POS más versátil del mercado. Gestiona ventas, inventarios y atención al cliente desde una sola plataforma intuitiva y potente.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button className="px-8 py-4 bg-primary text-on-primary rounded-full font-bold text-lg shadow-lg shadow-primary/25 hover:scale-105 transition-transform">
                Empieza Gratis
              </button>
              <button className="px-8 py-4 bg-surface border-2 border-outline-variant text-on-surface rounded-full font-bold text-lg hover:bg-surface-container transition-colors">
                Ver Demo
              </button>
            </div>
          </div>
          <div className="order-1 lg:order-2 flex justify-center reveal">
            <div className="relative group">
              <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full -z-10 group-hover:bg-primary/30 transition-colors" />
              <img className="w-48 h-48 sm:w-64 sm:h-64 md:w-96 md:h-96 object-contain drop-shadow-2xl hover:rotate-3 transition-transform duration-500" alt="Logotipo de Pudú Tecnología" src="/assets/img/logo.png" />
            </div>
          </div>
        </section>

        {/* Dashboard preview */}
        <section className="max-w-7xl mx-auto px-6 py-12 reveal">
          <div className="rounded-xl overflow-hidden border border-outline-variant/30">
            <img className="w-full aspect-video object-cover float-anim" alt="Interfaz del sistema POS Pudú" src="/assets/img/dashboard.jpg" />
          </div>
        </section>

        {/* Productos */}
        <section id="productos" className="max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-24">
          <div className="text-center mb-12 reveal">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-3">Soluciones para <span className="text-primary">cada negocio</span></h2>
            <p className="text-on-surface-variant text-lg max-w-xl mx-auto">Tres productos diseñados para cubrir las necesidades específicas de restaurantes, comercios y empresas.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl border border-slate-100 p-7 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 reveal">
              <div className="w-12 h-12 bg-primary-container rounded-xl flex items-center justify-center mb-5"><Utensils className="text-primary" size={24} /></div>
              <h3 className="text-lg font-bold mb-1 text-slate-900">PUDU Gourmet</h3>
              <p className="text-xs text-primary font-semibold uppercase tracking-widest mb-4">Para Restaurantes</p>
              <ul className="space-y-2.5">
                {["Control de mesas", "Comandas digitales", "Registro de propinas", "Pre-cuentas y cuentas por cobrar", "Gestión de pedidos", "Optimización de atención"].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-600"><CheckCircle2 className="text-primary mt-0.5 flex-shrink-0" size={16} />{f}</li>
                ))}
              </ul>
            </div>
            <div className="bg-primary rounded-2xl p-7 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 relative reveal">
              <div className="absolute top-0 right-7 -translate-y-1/2 bg-white text-primary px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest shadow">Más popular</div>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-5"><ShoppingCart className="text-white" size={24} /></div>
              <h3 className="text-lg font-bold mb-1 text-white">PUDU Punto de Venta</h3>
              <p className="text-xs text-primary-container font-semibold uppercase tracking-widest mb-4">POS Comercial</p>
              <ul className="space-y-2.5">
                {["Control de caja", "Boletas y facturas electrónicas", "Creación de vendedores", "Cuentas por cobrar", "Ventas rápidas e intuitivas"].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-white/90"><CheckCircle2 className="text-primary-container mt-0.5 flex-shrink-0" size={16} />{f}</li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-7 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 reveal">
              <div className="w-12 h-12 bg-secondary-container rounded-xl flex items-center justify-center mb-5"><FileText className="text-secondary" size={24} /></div>
              <h3 className="text-lg font-bold mb-1 text-slate-900">PUDU Factura</h3>
              <p className="text-xs text-secondary font-semibold uppercase tracking-widest mb-4">Administrativo</p>
              <ul className="space-y-2.5">
                {["Gestión administrativa integral", "Documentos tributarios electrónicos", "Control de clientes y ventas", "Ideal para empresas no gastronómicas"].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-600"><CheckCircle2 className="text-secondary mt-0.5 flex-shrink-0" size={16} />{f}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Características */}
        <section id="caracteristicas" className="bg-slate-50/80 py-12 md:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12 reveal">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-3">Características <span className="text-primary">destacadas</span></h2>
              <p className="text-on-surface-variant text-lg">Tecnología de punta para que tu negocio funcione sin interrupciones.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                { icon: <Cloud className="text-primary" size={24} />, title: "En la nube", desc: "Acceso desde cualquier dispositivo, en cualquier lugar" },
                { icon: <Store className="text-primary" size={24} />, title: "Multi-sucursal", desc: "Gestiona múltiples sucursales desde un solo panel" },
                { icon: <Warehouse className="text-primary" size={24} />, title: "Multi-bodega", desc: "Controla inventarios en múltiples bodegas" },
                { icon: <Zap className="text-primary" size={24} />, title: "Alta velocidad", desc: "Procesamiento ultra-rápido para operaciones fluidas" },
                { icon: <MousePointer2 className="text-primary" size={24} />, title: "Interfaz intuitiva", desc: "Fácil de usar, sin curva de aprendizaje", extra: "col-span-2 sm:col-span-1" },
              ].map(({ icon, title, desc, extra }) => (
                <div key={title} className={`bg-white rounded-2xl p-5 flex flex-col items-center text-center shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 reveal ${extra || ""}`}>
                  <div className="w-12 h-12 bg-primary-container rounded-xl flex items-center justify-center mb-3">{icon}</div>
                  <h4 className="font-bold text-sm text-slate-800 mb-1">{title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contingencia */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-20">
          <div className="bg-gradient-to-br from-[#5b21b6] to-[#a413ec] rounded-3xl p-8 md:p-12 relative overflow-hidden reveal">
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(#ffffff 0.5px, transparent 0.5px)", backgroundSize: "20px 20px" }} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center relative z-10">
              <div>
                <div className="inline-flex items-center gap-2 bg-white/15 px-3 py-1 rounded-full mb-5">
                  <AlertTriangle size={16} className="text-yellow-300" />
                  <span className="text-white text-xs font-bold uppercase tracking-widest">Módulo de Contingencia</span>
                </div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white mb-4 leading-tight">Sigue vendiendo incluso <span className="text-yellow-300">sin Internet</span></h2>
                <p className="text-white/80 text-base leading-relaxed">Nuestro módulo de contingencia permite que tu negocio continúe operando normalmente durante cortes de conexión. Cuando se restablece, la sincronización es automática.</p>
              </div>
              <div className="space-y-4">
                {[
                  { icon: <WifiOff className="text-white" size={20} />, title: "Operación offline", desc: "Continúa vendiendo sin conexión a Internet" },
                  { icon: <RefreshCw className="text-white" size={20} />, title: "Sincronización automática", desc: "Los datos se sincronizan al volver la conexión" },
                  { icon: <Shield className="text-white" size={20} />, title: "Sin pérdida de datos", desc: "Toda la información queda respaldada" },
                ].map(({ icon, title, desc }) => (
                  <div key={title} className="flex items-start gap-4 bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">{icon}</div>
                    <div><h4 className="font-bold text-white mb-1">{title}</h4><p className="text-white/70 text-sm">{desc}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Funciones */}
        <section id="funciones" className="max-w-7xl mx-auto px-6 py-12 md:py-24">
          <div className="text-center mb-16 reveal">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-4">Todo lo que necesitas para crecer</h2>
            <div className="h-1.5 w-24 bg-primary mx-auto rounded-full" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: <ShoppingCart className="text-primary" size={30} />, bg: "bg-primary-container", title: "Punto de Venta", desc: "Vende más rápido con una interfaz optimizada para pantallas táctiles. Procesamiento de pagos en segundos." },
              { icon: <Package className="text-secondary" size={30} />, bg: "bg-secondary-container", title: "Gestión de Inventario", desc: "Controla tu stock en tiempo real. Alertas de bajo inventario y reportes automáticos de reposición." },
              { icon: <LayoutGrid className="text-tertiary" size={30} />, bg: "bg-tertiary-container", title: "Plano de Mesas", desc: "Diseña el mapa de tu restaurante de forma interactiva. Gestiona pedidos por mesa con total facilidad." },
            ].map(({ icon, bg, title, desc }) => (
              <div key={title} className="glass-card p-6 md:p-8 rounded-lg flex flex-col items-start hover:-translate-y-2 transition-transform duration-300 reveal">
                <div className={`w-14 h-14 ${bg} rounded-xl flex items-center justify-center mb-6`}>{icon}</div>
                <h3 className="text-2xl font-bold mb-3">{title}</h3>
                <p className="text-on-surface-variant leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Tablet section */}
        <section className="bg-surface-container py-12 md:py-24">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 relative reveal">
              <img className="rounded-lg" alt="Tablet con lector de tarjetas mostrando Pudú" src="/assets/img/tablet.jpg" />
              <div className="absolute -bottom-4 -right-4 bg-white p-4 md:p-6 rounded-lg shadow-xl hidden sm:block">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-on-surface">+24% Ventas</p>
                    <p className="text-xs text-on-surface-variant">Este mes vs anterior</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2 reveal">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-6 tracking-tight">Diseñado para la eficiencia operativa</h2>
              <p className="text-lg text-on-surface-variant mb-8">Pudú Tecnología no es solo un software, es el corazón de tu operación. Reduce tiempos de espera y elimina errores humanos.</p>
              <ul className="space-y-4">
                {["Sincronización multi-dispositivo", "Reportes fiscales configurables", "Modo Offline garantizado"].map((f) => (
                  <li key={f} className="flex items-center space-x-3">
                    <CheckCircle2 className="text-primary" size={20} style={{ fill: "#a413ec", color: "white" }} />
                    <span className="font-medium">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Planes */}
        <section id="planes" className="max-w-7xl mx-auto px-6 py-12 md:py-24">
          <div className="text-center mb-16 reveal">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-4">Planes para cada etapa</h2>
            <p className="text-on-surface-variant">Escala tu negocio con la tecnología correcta.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 md:p-10 rounded-lg border border-outline-variant flex flex-col h-full shadow-sm plan-card reveal">
              <h3 className="text-xl font-bold mb-2">Emprendedor</h3>
              <div className="flex items-baseline mb-6"><span className="text-4xl font-black">$0</span><span className="text-on-surface-variant ml-1">/mes</span></div>
              <ul className="space-y-4 mb-10 flex-grow">
                {["Hasta 50 ventas/día", "Inventario básico", "1 Usuario"].map((f) => (
                  <li key={f} className="flex items-center text-sm text-on-surface-variant"><Check className="text-primary mr-2" size={18} />{f}</li>
                ))}
              </ul>
              <button onClick={(e) => pagarPlan("emprendedor", e.currentTarget)} className="w-full py-3 border-2 border-primary text-primary rounded-full font-bold hover:bg-primary-container transition-colors flex items-center justify-center gap-2">
                <span className="btn-text">Empezar Ahora</span>
                <span className="btn-loader hidden">Cargando...</span>
              </button>
            </div>
            <div className="bg-primary p-6 md:p-10 rounded-lg border-4 border-primary-container flex flex-col h-full shadow-2xl relative md:scale-105 z-10 plan-card popular mt-4 md:mt-0">
              <div className="absolute top-0 right-10 -translate-y-1/2 bg-on-primary-fixed text-on-primary-fixed-variant px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest border border-primary-container">Popular</div>
              <h3 className="text-xl font-bold mb-2 text-on-primary">Negocio</h3>
              <div className="flex items-baseline mb-6"><span className="text-4xl font-black text-on-primary">$0</span><span className="text-primary-container ml-1">/mes</span></div>
              <ul className="space-y-4 mb-10 flex-grow">
                {["Ventas ilimitadas", "Plano de mesas interactivo", "Gestión multi-almacén", "Usuarios ilimitados"].map((f) => (
                  <li key={f} className="flex items-center text-sm text-on-primary"><Check className="text-primary-container mr-2" size={18} />{f}</li>
                ))}
              </ul>
              <button onClick={(e) => pagarPlan("negocio", e.currentTarget)} className="w-full py-3 bg-on-primary text-primary rounded-full font-bold shadow-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                <span className="btn-text">Elegir Plan</span>
                <span className="btn-loader hidden">Cargando...</span>
              </button>
            </div>
            <div className="bg-white p-6 md:p-10 rounded-lg border border-outline-variant flex flex-col h-full shadow-sm plan-card reveal">
              <h3 className="text-xl font-bold mb-2">Empresa</h3>
              <div className="flex items-baseline mb-6"><span className="text-4xl font-black">$0</span><span className="text-on-surface-variant ml-1">/mes</span></div>
              <ul className="space-y-4 mb-10 flex-grow">
                {["Todo en Plan Negocio", "Integraciones API", "Soporte 24/7 VIP", "Formación presencial"].map((f) => (
                  <li key={f} className="flex items-center text-sm text-on-surface-variant"><Check className="text-primary mr-2" size={18} />{f}</li>
                ))}
              </ul>
              <button onClick={(e) => pagarPlan("empresa", e.currentTarget)} className="w-full py-3 border-2 border-outline text-on-surface rounded-full font-bold hover:bg-surface-container transition-colors flex items-center justify-center gap-2">
                <span className="btn-text">Contactar Ventas</span>
                <span className="btn-loader hidden">Cargando...</span>
              </button>
            </div>
          </div>
        </section>

        {/* Testimonios */}
        <section className="max-w-7xl mx-auto px-6 py-12 md:py-24 border-t border-outline-variant/20">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-center mb-10 md:mb-16 tracking-tight">Lo que dicen nuestros clientes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { initials: "RM", bg: "bg-primary-container", color: "text-primary", name: "Ricardo Méndez", role: "Dueño de 'La Table'", text: '"Pudú cambió por completo la forma en que gestionamos las reservas de nuestro bistró. El plano de mesas es increíblemente intuitivo."', stars: 5 },
              { initials: "CS", bg: "bg-secondary-container", color: "text-secondary", name: "Carla Soto", role: "Gerente de Retail", text: '"La gestión de inventario en tiempo real nos ha ahorrado miles de dólares en mermas y productos vencidos."', stars: 5 },
              { initials: "JP", bg: "bg-tertiary-container", color: "text-tertiary", name: "Juan Pablo", role: "Café del Parque", text: '"Sencillo de usar. Mis meseros aprendieron a usarlo en 10 minutos. Es la herramienta definitiva para POS."', stars: 4.5, extra: "md:col-span-2 lg:col-span-1" },
            ].map(({ initials, bg, color, name, role, text, stars, extra }) => (
              <div key={name} className={`bg-surface-container-low p-8 rounded-lg reveal ${extra || ""}`}>
                <div className="flex text-primary mb-4">
                  {[...Array(Math.floor(stars))].map((_, i) => <Star key={i} size={20} fill="#a413ec" />)}
                  {stars % 1 ? <Star size={20} fill="#a413ec" strokeWidth={0} style={{ clipPath: "inset(0 50% 0 0)", marginRight: -20 }} /> : null}
                </div>
                <p className="italic text-on-surface mb-6 text-lg">{text}</p>
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-full ${bg} flex items-center justify-center font-bold ${color}`}>{initials}</div>
                  <div><p className="font-bold text-sm">{name}</p><p className="text-xs text-on-surface-variant">{role}</p></div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Contacto */}
        <section id="contacto" className="max-w-7xl mx-auto px-6 py-12 md:py-24 mb-12">
          <div className="bg-on-primary-fixed rounded-2xl overflow-hidden relative">
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: "radial-gradient(#ffffff 0.5px, transparent 0.5px)", backgroundSize: "20px 20px" }} />
            <div className="grid grid-cols-1 lg:grid-cols-2 relative z-10">
              <div className="p-6 sm:p-8 lg:p-12 flex flex-col justify-center reveal">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white mb-6 leading-tight">¿Listo para transformar tu negocio?</h2>
                <p className="text-primary-fixed text-lg mb-8 leading-relaxed">Únete a cientos de empresas que ya confían en Pudú Tecnología para potenciar sus operaciones diarias.</p>
                <ul className="space-y-3 mb-8">
                  {["Sin tarjeta de crédito requerida", "Configuración en menos de 10 minutos", "Soporte en español incluido"].map((f) => (
                    <li key={f} className="flex items-center space-x-3 text-primary-fixed">
                      <CheckCircle2 size={20} fill="#f5d9ff" className="text-primary-container" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-6 sm:p-8 lg:p-12 bg-white/10 backdrop-blur-sm flex flex-col justify-center reveal">
                <h3 className="text-2xl font-bold text-white mb-6">Contáctanos</h3>
                <form id="contact-form" className="space-y-4" onSubmit={submitContact}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-primary-fixed mb-1" htmlFor="c-nombre">Nombre</label>
                      <input id="c-nombre" type="text" required placeholder="Tu nombre" className="w-full px-4 py-3 rounded-xl bg-white/15 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/40 transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-primary-fixed mb-1" htmlFor="c-empresa">Empresa</label>
                      <input id="c-empresa" type="text" placeholder="Tu empresa" className="w-full px-4 py-3 rounded-xl bg-white/15 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/40 transition-all" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-primary-fixed mb-1" htmlFor="c-email">Correo electrónico</label>
                    <input id="c-email" type="email" required placeholder="tu@correo.com" className="w-full px-4 py-3 rounded-xl bg-white/15 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/40 transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-primary-fixed mb-1" htmlFor="c-telefono">Teléfono (opcional)</label>
                    <input id="c-telefono" type="tel" placeholder="+56 9 1234 5678" className="w-full px-4 py-3 rounded-xl bg-white/15 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/40 transition-all" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-primary-fixed mb-1" htmlFor="c-mensaje">Mensaje</label>
                    <textarea id="c-mensaje" required rows={3} placeholder="¿En qué podemos ayudarte?" className="w-full px-4 py-3 rounded-xl bg-white/15 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/40 transition-all resize-none" />
                  </div>
                  <button type="submit" className="w-full py-4 bg-primary text-on-primary rounded-full font-bold text-lg hover:opacity-90 hover:scale-[1.02] transition-all shadow-xl">
                    Enviar mensaje
                  </button>
                  <div id="contact-success" className="hidden text-center py-3 px-4 bg-green-400/20 border border-green-400/30 rounded-xl text-green-200 font-semibold">
                    ¡Mensaje enviado! Te contactaremos pronto.
                  </div>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-50 border-t border-purple-100 w-full py-12 font-sans text-sm">
        <div className="flex flex-col md:flex-row justify-between items-center px-8 max-w-7xl mx-auto gap-8">
          <div className="flex flex-col items-center md:items-start space-y-4">
            <div className="text-lg font-bold text-purple-700">Pudú Tecnología</div>
            <p className="text-slate-500 text-center md:text-left max-w-xs">Elevando el estándar de la gestión comercial en Latinoamérica.</p>
            <div className="flex space-x-4">
              <a className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 hover:bg-purple-600 hover:text-white transition-all" href="#"><Share2 size={14} /></a>
              <a className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 hover:bg-purple-600 hover:text-white transition-all" href="#"><Globe2 size={14} /></a>
              <a className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 hover:bg-green-500 hover:text-white transition-all" href="https://wa.me/56959695940" target="_blank" rel="noopener" aria-label="WhatsApp">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                </svg>
              </a>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-8 md:gap-16">
            <div className="flex flex-col space-y-3">
              <span className="font-bold text-slate-800 uppercase tracking-widest text-xs">Recursos</span>
              <a className="text-slate-500 hover:text-purple-500 underline transition-all" href="#">Soporte</a>
              <a className="text-slate-500 hover:text-purple-500 underline transition-all" href="#">Ventas</a>
            </div>
            <div className="flex flex-col space-y-3">
              <span className="font-bold text-slate-800 uppercase tracking-widest text-xs">Legal</span>
              <a className="text-slate-500 hover:text-purple-500 underline transition-all" href="/privacy">Privacidad</a>
              <a className="text-slate-500 hover:text-purple-500 underline transition-all" href="/terms">Términos</a>
            </div>
          </div>
        </div>
        <div className="mt-12 text-center text-slate-500 border-t border-slate-200 pt-8 px-8">
          © 2024 Pudú Tecnología. Todos los derechos reservados.
        </div>
      </footer>

      {/* WhatsApp FAB */}
      <a
        href="https://wa.me/56959695940?text=Hola%2C%20quiero%20m%C3%A1s%20informaci%C3%B3n%20sobre%20POS-Matic"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contáctate por WhatsApp"
        className="fixed bottom-7 right-7 z-50 flex items-center justify-end cursor-pointer group"
      >
        <span className="flex items-center gap-2.5 bg-[#25D366] text-white font-bold px-5 py-3.5 rounded-full shadow-lg whitespace-nowrap max-w-0 overflow-hidden opacity-0 group-hover:max-w-xs group-hover:opacity-100 transition-all duration-300 pointer-events-none group-hover:pointer-events-auto text-sm">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="white" style={{ flexShrink: 0 }}>
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          Contáctate con un ejecutivo ahora
        </span>
        <span className="relative w-14 h-14 bg-[#25D366] rounded-full flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
          <span className="absolute inset-0 rounded-full bg-[#25D366]/30" style={{ animation: "wsp-pulse 2s ease-out infinite" }} />
          <svg viewBox="0 0 24 24" width="28" height="28" fill="white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        </span>
      </a>
    </div>
  );
}
