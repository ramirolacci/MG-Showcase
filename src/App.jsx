import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { sorted, categories, images, companyMilestones, seniorityProgression } from './projects';
import './App.css';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MONTHS_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Audio deshabilitado
const playSfx = () => {};

// Formatea YYYY-MM-DD a "Ddd Mmm AAAA" (ej: "27 May 2025")
const fmtDate = (dStr) => {
  if (!dStr) return '';
  const [y, m, d] = dStr.split('-');
  return `${+d} ${MONTHS[+m - 1]} ${y}`;
};

// Formatea el mes inicial para la portada
const fmtMonthYear = (dStr) => {
  if (!dStr) return '';
  const [y, m] = dStr.split('-');
  return `${MONTHS_FULL[+m - 1]} ${y}`;
};

// Calcula la duración en días/semanas/meses/años (formato legible: ej. "1 año - 4 meses")
const calcDuration = (startStr, endStr) => {
  if (!startStr || !endStr) return '';
  const [y1, m1, d1] = startStr.split('-').map(Number);
  const [y2, m2, d2] = endStr.split('-').map(Number);
  const start = new Date(y1, m1 - 1, d1, 0, 0, 0);
  const end = new Date(y2, m2 - 1, d2, 23, 59, 59);
  const diffDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));

  if (diffDays === 1) return '1 día';
  if (diffDays < 30) {
    if (diffDays % 7 === 0) {
      const weeks = diffDays / 7;
      return `${weeks} semana${weeks > 1 ? 's' : ''}`;
    }
    return `${diffDays} días`;
  }

  let totalMonths = (y2 - y1) * 12 + (m2 - m1);
  if (d2 - d1 >= 15) totalMonths += 1;
  else if (d1 - d2 >= 15) totalMonths -= 1;
  totalMonths = Math.max(1, totalMonths);

  const years = Math.floor(totalMonths / 12);
  const remMonths = totalMonths % 12;

  if (years >= 1) {
    if (remMonths > 0) {
      return `${years} año${years > 1 ? 's' : ''} - ${remMonths} mes${remMonths > 1 ? 'es' : ''}`;
    }
    return `${years} año${years > 1 ? 's' : ''}`;
  }

  return `${totalMonths} mes${totalMonths > 1 ? 'es' : ''}`;
};

// Contador numérico animado suave y visible estilo GSAP / Motion con delay y curva natural
function AnimatedNumber({ value, duration = 0.95, delay = 0.1, prefix = '', suffix = '' }) {
  const [displayValue, setDisplayValue] = useState(0);
  const targetNum = typeof value === 'number' 
    ? value 
    : parseFloat(String(value).replace(/[^0-9.-]/g, '')) || 0;

  useEffect(() => {
    // Si se pasa en ms (> 10) se utiliza directo, si no en segundos
    const durMs = duration > 10 ? Math.min(duration, 1300) : Math.max(350, duration * 1000);
    const delMs = delay > 10 ? Math.min(delay, 300) : Math.max(0, delay * 1000);

    let startTime = null;
    let animationFrame = null;
    const timeout = setTimeout(() => {
      const step = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / durMs, 1);
        // easeOutCubic natural: velocidad visible y fluida, frena suave en el valor final
        const ease = 1 - Math.pow(1 - progress, 3);
        const rounded = targetNum % 1 !== 0 
          ? (targetNum * ease).toFixed(1) 
          : Math.round(targetNum * ease);
        const display = Math.abs(rounded) >= 1000 
          ? Number(rounded).toLocaleString('es-AR') 
          : rounded;
        setDisplayValue(display);
        if (progress < 1) {
          animationFrame = requestAnimationFrame(step);
        }
      };
      animationFrame = requestAnimationFrame(step);
    }, delMs);

    return () => {
      clearTimeout(timeout);
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [targetNum, duration, delay]);

  return <>{prefix}{displayValue}{suffix}</>;
}

// Rango temporal global del timeline (desde 1 de Mayo 2025 hasta 30 de Noviembre 2026)
const timelineStart = new Date('2025-05-01T00:00:00').getTime();
const timelineEnd = new Date('2026-11-30T23:59:59').getTime();
const totalTimelineSpan = timelineEnd - timelineStart;

// Timeline helpers
const toTime = (d, endOfDay) => new Date(d + (endOfDay ? 'T23:59:59' : 'T00:00:00')).getTime();
const toPct = (t) => ((t - timelineStart) / totalTimelineSpan) * 100;

const axisMonths = Array.from({ length: 19 }, (_, i) => {
  const d = new Date(2025, 4 + i, 1);
  return { key: i, label: MONTHS[d.getMonth()], left: toPct(d.getTime()), isJan: d.getMonth() === 0 };
}).map((m, i, arr) => ({ ...m, width: (arr[i + 1]?.left ?? 100) - m.left }));
const yearDivider = toPct(new Date(2026, 0, 1).getTime());
const todayPct = toPct(Date.now());
const showToday = todayPct > 0 && todayPct < 100;

const indexById = Object.fromEntries(sorted.map((p, i) => [p.id, i]));
const catCounts = Object.fromEntries(Object.keys(categories).map((k) => [k, sorted.filter((p) => p.cat === k).length]));

const LABEL_CHAR = 0.52;
const LABEL_PAD = 1.8;

function layoutItem(p) {
  const s = toTime(p.start);
  const e = toTime(p.end, true);
  const left = toPct(s);
  const actualW = toPct(e) - left;
  const barW = Math.max(0.7, actualW);
  const labelW = (p.name.length + 3) * LABEL_CHAR + LABEL_PAD;

  const vStart = left;
  const flip = left + labelW > 98.5;
  const vEnd = flip ? (left + barW) : (left + Math.max(barW, labelW));
  const packedStart = flip ? Math.max(0, left - labelW) : vStart;

  return { p, left, actualW, barW, flip, vStart: packedStart, vEnd };
}

function pack(items) {
  const rows = [];
  items.forEach((it) => {
    let row = rows.find((r) => r.end + 0.8 < it.vStart);
    if (!row) { row = { end: -Infinity, items: [] }; rows.push(row); }
    row.items.push(it);
    row.end = it.vEnd;
  });
  return rows;
}

const tlItems = sorted.map(layoutItem);
const laneRows = Object.fromEntries(Object.keys(categories).map((k) => [k, pack(tlItems.filter((it) => it.p.cat === k))]));

// Paleta de colores oficiales por tecnología para hover interactivo
export const techColors = {
  'React': '#61DAFB',
  'Supabase': '#3ECF8E',
  'Tailwind CSS': '#38BDF8',
  'TypeScript': '#3178C6',
  'GSAP': '#88CE02',
  'Vite': '#bd34fe',
  'Python': '#4B8BBE',
  'SMTP': '#5aa9ff',
  'Framer Motion': '#FF0055',
  'Lucide': '#F56565',
  'Bootstrap': '#7952B3',
  'Three.js': '#049EF4',
  'EmailJS': '#FF7F00',
  'Mailchimp': '#FFE01B',
  'Web Speech API': '#FF4D4D',
  'Speech Synthesis': '#FFB020',
  'GUI': '#3dd6a5',
  'Tkinter GUI': '#00A8E8',
  'HTML Editor': '#E34F26',
  'CustomTkinter': '#1F6AA5',
  'Pandas': '#130754',
  'Threading': '#A0AEC0',
  'IMAP/SMTP': '#5aa9ff',
  'Phaser': '#8E44AD',
  'Howler.js': '#E67E22',
  'WebSockets': '#FF6B6B',
  'Offline Sync': '#3DD6A5',
  'Recharts': '#22B5BF',
  'Leaflet': '#199900',
  'BPM': '#FFB020',
  'React 19': '#61DAFB',
  'Tailwind CSS v4': '#38BDF8',
  'Google Sheets API': '#34A853',
  'Web Audio API': '#FF4D4D',
  'Offline-First': '#3DD6A5',
  'Analytics': '#FFB020',
};

// SLIDES INDEX:
// 0: Portada
// 1: Línea de tiempo interactiva
// 2: Hitos Clave de la Empresa
// 3 .. 12: Desarrollos 2025 (Fichas individuales de proyectos 2025)
// 13 .. 35: Desarrollos 2026 (Fichas individuales de proyectos 2026)
// 33: Retorno de Inversión (ROI) & Ahorro Operativo para Mi Gusto
// 34: Seniority & Evolución de Liderazgo (Semi Senior Technical Lead)
// 35: Visión 2026—2027 & Cierre de Negocio
// 36: Agradecimiento & Fin de la Presentación
const FIRST_2025_INDEX = 3;
const FIRST_2026_INDEX = FIRST_2025_INDEX + sorted.filter((p) => p.start.startsWith('2025')).length; // 13
const ROI_INDEX = FIRST_2025_INDEX + sorted.length; // 33
const SENIORITY_INDEX = ROI_INDEX + 1; // 34
const VISION_INDEX = SENIORITY_INDEX + 1; // 35 (Visión 2026—2027 & Cierre de Negocio)
const THANKS_INDEX = VISION_INDEX + 1; // 36
const TOTAL = THANKS_INDEX + 1; // 37
const PROJECT_OFFSET = FIRST_2025_INDEX; // 3

// 4 Casos Estrella para el Pitch Ejecutivo (Fase 3):
export const FLAGSHIP_PROJECTS = [
  {
    id: 'site',
    num: '01',
    name: 'Mi Gusto Web',
    emoji: '🌐',
    color: '#ff4d4d',
    pillar: 'Marca & Presencia Digital',
    tagline: 'Web institucional oficial',
    highlight: '+120k Visitas / Mes · Identidad Unificada',
  },
  {
    id: 'lolla',
    num: '02',
    name: 'Lollapalooza Order Caller',
    emoji: '📣',
    color: '#3dd6a5',
    pillar: 'Operaciones & Resiliencia',
    tagline: 'Offline-First masivo sin caídas',
    highlight: '100% Operatividad Offline · Zero Caídas',
  },
  {
    id: 'mes',
    num: '03',
    name: 'MES System MG',
    emoji: '🏭',
    color: '#ffb020',
    pillar: 'Industria 4.0 & Fábrica',
    tagline: 'Manufacturing Execution System',
    highlight: '-30% Tiempos de Reporte · Telemetría en Planta',
  },
  {
    id: 'audit',
    num: '04',
    name: 'MG AuditApp',
    emoji: '📋',
    color: '#5aa9ff',
    pillar: 'Gobierno Operativo & Calidad',
    tagline: 'Planilla operativa & auditoría de sucursales',
    highlight: '-60% Tiempo de Auditoría · Scoring en Vivo',
  },
];

export const FLAGSHIP_IDS = new Set(FLAGSHIP_PROJECTS.map((f) => f.id));
export const FLAGSHIP_SLIDES = FLAGSHIP_PROJECTS.map((f) => FIRST_2025_INDEX + (indexById[f.id] ?? 0));

// Secuencia curada para el Pitch Ejecutivo (11 slides de alto impacto)
export const EXEC_SLIDES = [
  0, // Portada
  1, // Línea de tiempo interactiva
  2, // Hitos Clave de la Empresa
  ...FLAGSHIP_SLIDES, // 4 Casos Estrella
  ROI_INDEX, // Retorno de Inversión (ROI) & Ahorro
  SENIORITY_INDEX, // Seniority & Liderazgo
  VISION_INDEX, // Visión 2026—2027 & Cierre de Negocio
  THANKS_INDEX, // Agradecimiento & Cierre
];

function Cover({ go }) {
  const totalProjects = sorted.length;
  const counts = Object.keys(categories).map((k) => {
    const count = sorted.filter((p) => p.cat === k).length;
    const pct = Math.round((count / totalProjects) * 100);
    return {
      key: k,
      count,
      pct,
      ...categories[k],
    };
  });
  return (
    <section className="slide cover">
      <motion.div
        className="cover-content"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="brand-badge">
          <span className="brand-dot-pulse">
            <span className="brand-dot-core" />
            <span className="brand-dot-ring" />
          </span>
          <span className="brand-badge-company">Mi Gusto</span>
          <span className="brand-badge-divider">·</span>
          <span className="brand-badge-label">Desarrollos digitales & de infraestructura</span>
        </div>
        <h1>
          <AnimatedNumber value={sorted.length} delay={0.15} /> proyectos.<br />
          <span>Ecosistema & Resultados.</span>
        </h1>
        <p className="lead">De soluciones puntuales a la digitalización integral de planta, marketing y sucursales ({fmtMonthYear(sorted[0].start)} → Actualidad).</p>
        
        <div className="cover-quick-actions">
          <button className="btn-brand" onClick={() => { playSfx('click'); go(ROI_INDEX); }}>
            💰 Retorno de Inversión (ROI)
          </button>
          <button className="btn-secondary" onClick={() => { playSfx('click'); go(SENIORITY_INDEX); }}>
            ⭐ Ver Seniority
          </button>
          <button className="btn-secondary" onClick={() => { playSfx('click'); go(FIRST_2025_INDEX); }}>
            📅 Desarrollos
          </button>
        </div>

        <div className="stats">
          {counts.map((cat, idx) => (
            <motion.div
              key={cat.key}
              className="stat"
              style={{ '--c': cat.color }}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.28 + idx * 0.08, ease: [0.16, 1, 0.3, 1] }}
              onMouseEnter={() => playSfx('hover')}
            >
              <div className="stat-top">
                <strong><AnimatedNumber value={cat.count} delay={0.35 + idx * 0.08} /></strong>
                <span className="stat-icon">{cat.icon}</span>
              </div>
              <div className="stat-info">
                <span className="stat-label">{cat.label}</span>
                <span className="stat-desc">{cat.desc}</span>
              </div>
              <div className="stat-bar-wrap">
                <div className="stat-bar-bg">
                  <motion.div
                    className="stat-bar-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${cat.pct}%` }}
                    transition={{ duration: 1.1, delay: 0.45 + idx * 0.08, ease: [0.16, 1, 0.3, 1] }}
                    style={{ background: cat.color }}
                  />
                </div>
                <span className="stat-pct">
                  <AnimatedNumber value={cat.pct} suffix="%" delay={0.35 + idx * 0.08} />
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
      <motion.div
        className="cover-visual"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.65, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="cover-logo-wrapper">
          <img src="/logo.png" alt="Mi Gusto Logo" className="cover-logo" />
          <div className="glow-sphere" />
        </div>
      </motion.div>
    </section>
  );
}

function TlItem({ it, go, onHover, onLeave, active }) {
  const { p, barW, flip } = it;
  const idx = indexById[p.id];
  return (
    <button
      type="button"
      id={`tl-${p.id}`}
      className={`tl-item bar${flip ? ' is-flip' : ''}${active ? ' is-hover' : ''}`}
      style={{
        left: `${it.left}%`,
        width: `${barW}%`,
        '--c': categories[p.cat].color,
        animationDelay: `${Math.min(idx * 12, 180)}ms`,
      }}
      onMouseEnter={(e) => { playSfx('hover'); onHover(p, e); }}
      onMouseMove={(e) => onHover(p, e)}
      onMouseLeave={onLeave}
      onFocus={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        onHover(p, { clientX: r.left, clientY: r.bottom });
      }}
      onBlur={onLeave}
      onClick={() => { playSfx('click'); go(idx + PROJECT_OFFSET); }}
      aria-label={`${p.name}: ${fmtDate(p.start)} a ${fmtDate(p.end)}`}
    >
      <span className="tl-label">{p.emoji} {p.name}</span>
    </button>
  );
}

function TlTooltip({ hover }) {
  const { p, x, y } = hover;
  const c = categories[p.cat];
  const W = 330;
  const H = 280;
  const left = x + W + 24 > window.innerWidth ? Math.max(12, x - W - 16) : x + 16;
  const top = y + H + 24 > window.innerHeight ? Math.max(12, y - H - 12) : y + 16;
  return (
    <div className="tl-tip" style={{ left, top, '--c': c.color }}>
      <span className="tl-tip-cat">{c.icon} {c.label}</span>
      <h4>{p.emoji} {p.name}</h4>
      <p>{p.tagline}</p>
      {p.impact && (
        <div className="tl-tip-impact">
          <b>📈 Impacto:</b> {p.impact}
        </div>
      )}
      <div className="tl-tip-dates">
        <span>📅 {fmtDate(p.start)}{p.end !== p.start ? ` → ${fmtDate(p.end)}` : ''}</span>
        <b>{calcDuration(p.start, p.end)}</b>
      </div>
      <div className="tl-tip-stack">{p.stack.slice(0, 5).map((s) => <span key={s}>{s}</span>)}</div>
      <div className="tl-tip-cta">Click para abrir ficha técnica y arquitectura →</div>
    </div>
  );
}

function Timeline({ go }) {
  const [view, setView] = useState('lanes');
  const [filter, setFilter] = useState('all');
  const [hover, setHover] = useState(null);
  const [showMilestones, setShowMilestones] = useState(true);

  const visible = filter === 'all' ? tlItems : tlItems.filter((it) => it.p.cat === filter);
  const onHover = (p, e) => setHover({ p, x: e.clientX, y: e.clientY });
  const onLeave = () => setHover(null);
  const renderItem = (it) => (
    <TlItem key={it.p.id} it={it} go={go} onHover={onHover} onLeave={onLeave} active={hover?.p.id === it.p.id} />
  );

  return (
    <section className="slide timeline">
      <header className="tl-head">
        <div>
          <p className="eyebrow">Visión Temporal 2025 — 2026</p>
          <h2>Línea de tiempo de entregables</h2>
        </div>
        <div className="tl-actions">
          <LayoutGroup id="tlViewLavaGroup">
            <div className="tl-toggle" role="tablist" aria-label="Tipo de vista">
              <button
                id="tl-view-lanes"
                role="tab"
                aria-selected={view === 'lanes'}
                className={view === 'lanes' ? 'on' : ''}
                onClick={() => { playSfx('click'); setView('lanes'); }}
              >
                {view === 'lanes' && (
                  <motion.div
                    layoutId="tlViewLavaBubble"
                    className="tl-lava-bubble"
                    transition={{ type: 'spring', stiffness: 350, damping: 26, mass: 0.75 }}
                  />
                )}
                <span className="tl-tab-label"><span>☰</span> Por carriles</span>
              </button>
              <button
                id="tl-view-chrono"
                role="tab"
                aria-selected={view === 'chrono'}
                className={view === 'chrono' ? 'on' : ''}
                onClick={() => { playSfx('click'); setView('chrono'); }}
              >
                {view === 'chrono' && (
                  <motion.div
                    layoutId="tlViewLavaBubble"
                    className="tl-lava-bubble"
                    transition={{ type: 'spring', stiffness: 350, damping: 26, mass: 0.75 }}
                  />
                )}
                <span className="tl-tab-label"><span>↘</span> Cronológica</span>
              </button>
            </div>
          </LayoutGroup>
        </div>
      </header>

      <div className="tl-filters">
        <button id="tl-filter-all" className={`tl-chip ${filter === 'all' ? 'on' : ''}`} onClick={() => { playSfx('click'); setFilter('all'); }}>
          ✨ Todos <b>{sorted.length}</b>
        </button>
        {Object.entries(categories).map(([k, c]) => (
          <button key={k} id={`tl-filter-${k}`} className={`tl-chip ${filter === k ? 'on' : ''}`} style={{ '--c': c.color }} onClick={() => { playSfx('click'); setFilter(k); }}>
            {c.icon} {c.label} <b>{catCounts[k]}</b>
          </button>
        ))}
        <span className="tl-total">{visible.length} proyectos · Mayo 2025 → Noviembre 2026</span>
      </div>

      <div className="tl-board">
        <div className="tl-scroll">
          <div className="tl-axis">
            <div className="tl-axis-inner">
              <span className="tl-year" style={{ left: 0 }}>2025</span>
              <span className="tl-year" style={{ left: `${yearDivider}%` }}>2026</span>
              {showToday && <span className="tl-today-tag" style={{ left: `${todayPct}%` }}>Hoy</span>}
              {axisMonths.map((m) => (
                <span key={m.key} className={`tl-month ${m.isJan ? 'jan' : ''}`} style={{ left: `${m.left}%`, width: `${m.width}%` }}>{m.label}</span>
              ))}
            </div>
          </div>

          <div className={`tl-canvas tl-${view}${hover ? ' has-hover' : ''}`} key={`${view}-${filter}`}>
            <div className="tl-grid" aria-hidden="true">
              <div className="tl-zone-2026" style={{ left: `${yearDivider}%` }} />
              {axisMonths.slice(1).map((m) => <i key={m.key} className={m.isJan ? 'year' : ''} style={{ left: `${m.left}%` }} />)}
              {showToday && <div className="tl-today" style={{ left: `${todayPct}%` }} />}
            </div>

            {/* Marcadores de hitos estratégicos superpuestos */}
            {showMilestones && companyMilestones.map((m) => {
              const pos = toPct(toTime(m.date));
              return (
                <div
                  key={m.id}
                  className="tl-milestone-marker"
                  style={{ left: `${pos}%` }}
                  title={`${m.title} (${fmtDate(m.date)})`}
                  onClick={() => { playSfx('click'); go(2); }}
                >
                  <span className="marker-dot">{m.icon}</span>
                  <span className="marker-name">{m.title}</span>
                </div>
              );
            })}

            {view === 'lanes'
              ? Object.entries(categories)
                .filter(([k]) => filter === 'all' || filter === k)
                .map(([k, c]) => (
                  <div className="tl-lane" key={k} style={{ '--c': c.color }}>
                    <div className="tl-lane-head">
                      <span>{c.icon} {c.label}</span>
                      <small>{catCounts[k]} proyectos</small>
                    </div>
                    {laneRows[k].map((r, ri) => <div className="tl-row" key={ri}>{r.items.map(renderItem)}</div>)}
                  </div>
                ))
              : visible.map((it) => <div className="tl-row" key={it.p.id}>{renderItem(it)}</div>)}
          </div>
        </div>
      </div>

      {hover && <TlTooltip key={hover.p.id} hover={hover} />}
    </section>
  );
}

// Slide: Retorno de Inversión (ROI) & Ahorro Operativo para Mi Gusto
function RoiSlide({ go }) {
  const roiKpis = [
    {
      color: '#3dd6a5',
      category: 'Desarrollo a Medida',
      icon: '💼',
      value: 55000,
      prefix: '+$',
      suffix: ' USD',
      equiv: '≈ $65.000.000 ARS',
      title: 'Ahorro en Fábricas de Software',
      desc: 'Costo promedio de mercado para diseñar, programar e integrar 30 plataformas web, móviles y tótems.',
      tag: '100% In-House sin Deuda',
    },
    {
      color: '#ffb020',
      category: 'Licencias & SaaS',
      icon: '🛡️',
      value: 5400,
      prefix: '+$',
      suffix: ' USD/año',
      equiv: '≈ $450 USD mensuales',
      title: 'Suscripciones SaaS Eliminadas',
      desc: 'Cartelería local por local (ScreenFlow), envíos masivos (MultiMail) y protocolos de cata (INF-D003).',
      tag: '$0 de Gasto Recurrente',
    },
    {
      color: '#38bdf8',
      category: 'Tiempo Operativo',
      icon: '⚡',
      value: 2400,
      prefix: '+',
      suffix: ' hs/año',
      equiv: '≈ 200 hs de trabajo / mes',
      title: 'Horas de Personal Optimizadas',
      desc: 'Facturación B2B automática (IAE), respuesta inicial (AutoAnswers) y reportes de planta central.',
      tag: 'Productividad Automatizada',
    },
    {
      color: '#ff4d4d',
      category: 'Time-to-Market',
      icon: '🚀',
      value: 3,
      prefix: '',
      suffix: 'x',
      equiv: '1 a 3 semanas por entrega',
      title: 'Agilidad de Despliegue en Vivo',
      desc: 'Frente a 3 a 6 meses de licitaciones, burocracia de contratos y demoras de proveedores externos.',
      tag: 'Soporte Directo Inmediato',
    },
  ];

  return (
    <section className="slide roi-slide">
      <header className="roi-header">
        <div className="brand-badge">
          <span className="brand-dot-pulse">
            <span className="brand-dot-core" style={{ background: '#3dd6a5', boxShadow: '0 0 8px #3dd6a5' }} />
            <span className="brand-dot-ring" style={{ background: 'rgba(61, 214, 165, 0.45)' }} />
          </span>
          <span className="brand-badge-company">Mi Gusto</span>
          <span className="brand-badge-divider">·</span>
          <span className="brand-badge-label">Eficiencia Financiera & Retorno de Inversión</span>
        </div>
        <h1>
          Retorno de Inversión (ROI) <span>& Ahorro Directo</span>
        </h1>
        <p className="lead">
          Cómo el desarrollo 100% in-house transformó costos operativos externos en activos tecnológicos propios, alta rentabilidad y soberanía digital.
        </p>
      </header>

      {/* 4 Métricas de Gran Impacto */}
      <div className="roi-grid-kpis">
        {roiKpis.map((kpi, idx) => (
          <motion.article
            key={idx}
            className="roi-kpi-card"
            style={{ '--c': kpi.color }}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08 + idx * 0.07, ease: [0.16, 1, 0.3, 1] }}
            onMouseEnter={() => playSfx('hover')}
          >
            <div>
              <div className="roi-card-top">
                <span className="roi-category-badge">
                  <span>●</span> {kpi.category}
                </span>
                <div className="roi-card-icon">{kpi.icon}</div>
              </div>

              <div className="roi-metric-row">
                <span className="roi-big-metric">
                  <AnimatedNumber value={kpi.value} prefix={kpi.prefix} suffix={kpi.suffix} delay={0.12 + idx * 0.07} duration={0.9} />
                </span>
                <span className="roi-equiv-pill">{kpi.equiv}</span>
              </div>

              <h3 className="roi-card-title">{kpi.title}</h3>
              <p className="roi-card-desc">{kpi.desc}</p>
            </div>

            <div className="roi-card-tag">
              <span>✓</span> {kpi.tag}
            </div>
          </motion.article>
        ))}
      </div>

      {/* Comparativa Estratégica: Tercerizado vs In-House */}
      <div className="roi-comparison-wrapper">
        <motion.div
          className="roi-model-card external"
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, delay: 0.3 }}
        >
          <div className="model-card-header">
            <span className="model-badge red">MODELO TERCERIZADO (AGENCIA)</span>
            <h4>Software Factory Externa</h4>
          </div>
          <ul className="model-list">
            <li>
              <span className="cross-icon">✕</span>
              <div>
                <strong>Costos Variables en Dólares:</strong> Cobro por hora, adicionales por cada ajuste menor y fees de mantenimiento mensual obligado.
              </div>
            </li>
            <li>
              <span className="cross-icon">✕</span>
              <div>
                <strong>Burocracia & Espera:</strong> Semanas para cotizar, demoras en tickets y nula respuesta en fines de semana o eventos.
              </div>
            </li>
            <li>
              <span className="cross-icon">✕</span>
              <div>
                <strong>Código Cautivo:</strong> Dependencia técnica forzada, servidores ajenos y falta de conocimiento de la cultura Mi Gusto.
              </div>
            </li>
          </ul>
        </motion.div>

        <motion.div
          className="roi-model-card inhouse"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45, delay: 0.35 }}
        >
          <div className="model-card-header">
            <span className="model-badge green">MODELO PROPIO (EQUIPO IN-HOUSE)</span>
            <h4>Desarrollo Interno Mi Gusto</h4>
          </div>
          <ul className="model-list">
            <li>
              <span className="check-icon">✓</span>
              <div>
                <strong>Inversión Fija y Predecible:</strong> Desarrollo ilimitado de 30 plataformas con amortización directa sobre la estructura interna.
              </div>
            </li>
            <li>
              <span className="check-icon">✓</span>
              <div>
                <strong>Velocidad & Respuesta Viva:</strong> Despliegues en 1 a 3 semanas, soporte inmediato en planta, aperturas y eventos masivos (Lolla).
              </div>
            </li>
            <li>
              <span className="check-icon">✓</span>
              <div>
                <strong>Soberanía Tecnológica 100%:</strong> Todo el código fuente, datos y sistemas son propiedad exclusiva de Mi Gusto.
              </div>
            </li>
          </ul>
        </motion.div>
      </div>

      {/* Banner inferior de conclusión ejecutiva */}
      <motion.div
        className="roi-banner-modern"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.42 }}
      >
        <div className="banner-badge-terminal">
          <span className="terminal-dot" style={{ background: '#3dd6a5', boxShadow: '0 0 8px #3dd6a5' }} />
          <span style={{ color: '#3dd6a5' }}>BALANCE FINANCIERO POSITIVO</span>
        </div>
        <p className="roi-banner-statement">
          El equipo no representa un costo operativo, sino una <strong>unidad de alto retorno</strong> que amortizó con creces la inversión operativa de la empresa, generando ahorro permanente y soberanía tecnológica.
        </p>
        <div className="roi-quick-actions">
          <button className="btn-brand" onClick={() => { playSfx('click'); go(SENIORITY_INDEX); }}>
            ⭐ Ver Seniority →
          </button>
        </div>
      </motion.div>
    </section>
  );
}

// Slide: Evolución del Rol & Seniority (Semi Senior Technical Lead)
function SenioritySlide({ go }) {
  const [tab, setTab] = useState('phases');

  return (
    <section className="slide seniority-slide">
      <div className="seniority-header">
        <div className="seniority-header-left">
          <div className="brand-badge">
            <span className="brand-dot-pulse">
              <span className="brand-dot-core" style={{ background: '#b070ff', boxShadow: '0 0 8px #b070ff' }} />
              <span className="brand-dot-ring" style={{ background: 'rgba(176, 112, 255, 0.45)' }} />
            </span>
            <span className="brand-badge-company">Mi Gusto</span>
            <span className="brand-badge-divider">·</span>
            <span className="brand-badge-label">Desarrollo Profesional & Estructura de Roles</span>
          </div>
          <h1>
            Progresión hacia <span>Semi Senior Technical Lead</span>
          </h1>
          <p className="seniority-subtitle">
            {tab === 'phases'
              ? 'Trayectoria documentada de responsabilidades, autonomía técnica y aporte directo a los objetivos del negocio.'
              : 'Estructura operativa del equipo de dos: complementariedad técnica, autonomía plena y criterios de liderazgo de RR.HH.'}
          </p>
        </div>

        <div className="seniority-view-switcher">
          <button
            className={`seniority-view-btn ${tab === 'phases' ? 'active' : ''}`}
            onClick={() => { playSfx('click'); setTab('phases'); }}
          >
            <span>📈</span> 1. Fases de Crecimiento
          </button>
          <button
            className={`seniority-view-btn ${tab === 'team' ? 'active' : ''}`}
            onClick={() => { playSfx('click'); setTab('team'); }}
          >
            <span>👥</span> 2. El Equipo & Criterios RR.HH.
          </button>
        </div>
      </div>

      {tab === 'phases' ? (
        <div className="seniority-grid">
          {seniorityProgression.map((item, idx) => (
            <motion.article
              key={idx}
              className="seniority-card"
              style={{ '--c': item.color }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.08 + idx * 0.08, ease: [0.16, 1, 0.3, 1] }}
              onMouseEnter={() => playSfx('hover')}
            >
              <div className="seniority-card-header">
                <div className="seniority-phase-row">
                  <div className="seniority-phase-badge">
                    <span className="phase-num">FASE {item.phase || `0${idx + 1}`}</span>
                    <span className="phase-year">{item.period}</span>
                  </div>
                  <div className="seniority-icon-wrap">{item.icon || '⭐'}</div>
                </div>
                <h3 className="seniority-role">{item.role}</h3>
                <div className="seniority-tag-pill">{item.tag || item.stage}</div>
              </div>

              <div className="seniority-card-body">
                <div className="seniority-scope-box">
                  <span className="scope-label">FOCO & ALCANCE</span>
                  <p>{item.scope}</p>
                </div>

                <div className="seniority-achievements-title">Aportes Clave:</div>
                <ul className="seniority-achievements-list">
                  {item.achievements?.map((ach, ai) => (
                    <li key={ai}>
                      <span className="achievement-check">✓</span>
                      <span>{ach}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.article>
          ))}
        </div>
      ) : (
        <div className="seniority-team-wrapper">
          {/* El Dúo Técnico de Alto Rendimiento */}
          <div className="team-duo-grid">
            <motion.div
              className="team-profile-card profile-backend"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.08 }}
            >
              <div>
                <div className="profile-top">
                  <span className="profile-badge">PILAR TÉCNICO 01</span>
                  <div className="profile-avatar-icon">⚙️</div>
                </div>
                <h3 className="profile-name">Arquitectura, Backend & Procesos de Planta</h3>
                <div className="profile-specialty-pill">Sistemas Críticos & Escalabilidad</div>
                <div className="profile-stack-chips">
                  <span>Supabase</span>
                  <span>PostgreSQL</span>
                  <span>Python</span>
                  <span>APIs REST</span>
                  <span>Offline Sync</span>
                </div>
                <ul className="profile-duties-list">
                  <li><strong>Bases de Datos & Soberanía:</strong> Modelo relacional unificado para locales, franquicias y fábrica.</li>
                  <li><strong>Industria 4.0 & Procesos:</strong> MES de planta, balanzas y protocolos de calidad bromatológica (INF-D003).</li>
                  <li><strong>Automatización B2B:</strong> Facturación electrónica desasistida (IAE) y ahorro de cientos de horas de gestión.</li>
                </ul>
              </div>
              <div className="profile-footer-tag">
                <span>✓</span> Cobertura de Infraestructura & Datos Centrales
              </div>
            </motion.div>

            <motion.div
              className="team-profile-card profile-frontend"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.14 }}
            >
              <div>
                <div className="profile-top">
                  <span className="profile-badge">PILAR TÉCNICO 02</span>
                  <div className="profile-avatar-icon">💻</div>
                </div>
                <h3 className="profile-name">Frontend Avanzado, UX & Hardware en Tiendas</h3>
                <div className="profile-specialty-pill">Experiencia de Usuario & Omnicanalidad</div>
                <div className="profile-stack-chips">
                  <span>React</span>
                  <span>TypeScript</span>
                  <span>Tailwind CSS</span>
                  <span>GSAP / Motion</span>
                  <span>Hardware Táctil</span>
                </div>
                <ul className="profile-duties-list">
                  <li><strong>Ecosistema Web Oficial:</strong> Plataforma institucional (+120k visitas/mes) y campañas de alta concurrencia.</li>
                  <li><strong>Hardware en Tienda:</strong> Cartelería digital local (ScreenFlow) y tótems interactivos táctiles (MG Games).</li>
                  <li><strong>Portales de Gestión:</strong> AuditApp con scoring en sucursales y tableros operativos de fácil adopción.</li>
                </ul>
              </div>
              <div className="profile-footer-tag">
                <span>✓</span> Cobertura de Cliente, Local & Marca
              </div>
            </motion.div>
          </div>

          {/* 4 Criterios y Competencias Clave de RR.HH. */}
          <div className="hr-competencies-grid">
            <motion.div
              className="hr-competency-card"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.2 }}
            >
              <div className="hr-icon-badge" style={{ color: '#3dd6a5' }}>🎯</div>
              <div>
                <h4>Autonomía Plena (Ownership)</h4>
                <p>Cero supervisión técnica: detección de necesidades del negocio y entrega de punta a punta.</p>
              </div>
            </motion.div>

            <motion.div
              className="hr-competency-card"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.25 }}
            >
              <div className="hr-icon-badge" style={{ color: '#38bdf8' }}>🔄</div>
              <div>
                <h4>Cobertura Cruzada (Cero Cuello de Botella)</h4>
                <p>Ambos dominan la base completa; cualquier urgencia en fábrica o sucursal se atiende de inmediato.</p>
              </div>
            </motion.div>

            <motion.div
              className="hr-competency-card"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.3 }}
            >
              <div className="hr-icon-badge" style={{ color: '#ffb020' }}>🛡️</div>
              <div>
                <h4>Resolución de Contingencias en Vivo</h4>
                <p>Soporte presencial y remoto en momentos críticos: Lollapalooza, caídas de red y aperturas comerciales.</p>
              </div>
            </motion.div>

            <motion.div
              className="hr-competency-card"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.35 }}
            >
              <div className="hr-icon-badge" style={{ color: '#ff4d4d' }}>📈</div>
              <div>
                <h4>Visión Estratégica de Negocio</h4>
                <p>Software alineado a la rentabilidad, ahorro en licencias externas y eficiencia de los franquiciados.</p>
              </div>
            </motion.div>
          </div>
        </div>
      )}

      {/* Footer Banner */}
      <div className="seniority-banner-modern">
        <div className="banner-badge-terminal">
          <span className="terminal-dot" style={{ background: '#b070ff', boxShadow: '0 0 8px #b070ff' }} />
          <span style={{ color: '#b070ff' }}>
            {tab === 'phases' ? 'CRECIMIENTO & ROI' : 'JUSTIFICACIÓN FORMAL DE CATEGORÍA'}
          </span>
        </div>
        <p className="banner-statement">
          {tab === 'phases' ? (
            <>
              Evolución sostenida de <strong>ejecutor fullstack a referente técnico</strong>: capacidad probada para transformar requerimientos de negocio en software productivo robusto sin dependencias externas.
            </>
          ) : (
            <>
              El equipo ya no opera como ejecutores juniors que reciben tareas: <strong>diseña la arquitectura, toma decisiones de negocio, resuelve contingencias y lidera el ecosistema digital propio de Mi Gusto</strong>.
            </>
          )}
        </p>
        <div className="banner-kpi-chip" style={{ background: 'rgba(176, 112, 255, 0.1)', borderColor: 'rgba(176, 112, 255, 0.3)', color: '#b070ff' }}>
          <span>{tab === 'phases' ? 'AUTONOMÍA INTEGRAL COMPROBADA' : 'PROPUESTA: SEMI SENIOR TECHNICAL LEAD'}</span>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// Visión 2026—2027 & Cierre de Negocio (Fase 4)
// ============================================================
export const roadmapPillars = [
  {
    id: 'app',
    num: '01',
    title: 'App Mi Gusto Lovers',
    subtitle: 'Venta Directa & Fidelización',
    icon: '📱',
    color: '#ff4d4d',
    horizon: 'Q1—Q2 2027',
    kpi: '+18% Margen',
    kpiLabel: 'Sin comisiones a apps externas',
    desc: 'App móvil oficial (iOS/Android/PWA) con pedidos directos en 1-click, catálogo geolocalizado en vivo y billetera digital de Golden Tickets.',
    deliverables: [
      'Eliminación de comisiones de intermediarios',
      'Push notifications por geocercas cerca de locales',
      'Fidelización cautiva y acumulación de puntos',
      'Sincronización instantánea con carta y precios',
    ],
    tech: ['React Native', 'Supabase Realtime', 'Push API', 'MercadoPago'],
  },
  {
    id: 'pos',
    num: '02',
    title: 'Integración POS / ERP & Red',
    subtitle: 'Omnicanalidad en Tiempo Real',
    icon: '⚡',
    color: '#ffb020',
    horizon: 'Q2—Q3 2027',
    kpi: '< 200ms',
    kpiLabel: 'Sincronización local ↔ fábrica',
    desc: 'Conexión automática de comandas, stock central y facturación entre la planta de producción y cada sucursal de la marca en tiempo real.',
    deliverables: [
      'Conexión directa entre salón, web y app',
      'Descarga automática de stock en fábrica por orden',
      'Actualización masiva de precios en 1 clic',
      'Arquitectura Offline-First tolerante a cortes de red',
    ],
    tech: ['WebSockets', 'Supabase Edge', 'PostgreSQL RLS', 'Electron'],
  },
  {
    id: 'ai',
    num: '03',
    title: 'IA Predictiva de Demanda',
    subtitle: 'Machine Learning en Fábrica & Tiendas',
    icon: '🧠',
    color: '#3dd6a5',
    horizon: 'Q3—Q4 2027',
    kpi: '-25% Mermas',
    kpiLabel: 'Optimización de materias primas',
    desc: 'Modelos predictivos que anticipan la cantidad exacta de empanadas a elaborar y hornear según clima, feriados, partidos y estacionalidad.',
    deliverables: [
      'Pronóstico diario por variedad de empanada',
      'Sugerencias automáticas de compras de insumos',
      'Disminución drástica de producto no vendido',
      'Alertas tempranas de quiebre de stock en locales',
    ],
    tech: ['Python FastAPI', 'Pandas', 'Scikit-Learn', 'Supabase Vector'],
  },
  {
    id: 'b2b',
    num: '04',
    title: 'Portal Franquicias 360°',
    subtitle: 'Escala para +50 Nuevos Locales',
    icon: '🏢',
    color: '#5aa9ff',
    horizon: '2027 Continuo',
    kpi: '50+ Locales',
    kpiLabel: 'Mismo costo operativo central',
    desc: 'Plataforma unificada para franquiciados: pedidos mayoristas a fábrica, seguimiento GPS de camiones (MG Orbital), scoring de calidad y liquidaciones.',
    deliverables: [
      'Autogestión de compras mayoristas a planta',
      'Trazabilidad en tiempo real de despachos y flota',
      'Auditorías continuas de calidad y scoring bromatológico',
      'Tablero de analítica y facturación unificado',
    ],
    tech: ['React 19', 'TypeScript', 'Tailwind', 'PDF Executive Engine'],
  },
];

function VisionSlide({ go }) {
  const [activePillar, setActivePillar] = useState(null);

  return (
    <section className="slide vision-slide">
      <header className="vision-header">
        <div className="brand-badge">
          <span className="brand-dot-pulse">
            <span className="brand-dot-core" style={{ background: '#3dd6a5', boxShadow: '0 0 8px #3dd6a5' }} />
            <span className="brand-dot-ring" style={{ background: 'rgba(61, 214, 165, 0.45)' }} />
          </span>
          <span className="brand-badge-company">Mi Gusto</span>
          <span className="brand-badge-divider">·</span>
          <span className="brand-badge-label">Hoja de Ruta Tecnológica 2026 – 2027</span>
        </div>
        <h1>
          Visión 2026—2027: <span>El Próximo Salto de Escala</span>
        </h1>
        <p className="vision-subtitle">
          De herramientas operativas a una plataforma omnicanal líder: 4 pilares estratégicos diseñados para multiplicar la rentabilidad, eliminar intermediarios externos y acompañar la expansión nacional de Mi Gusto.
        </p>
      </header>

      {/* 4 Pilares del Roadmap */}
      <div className="vision-pillars-grid">
        {roadmapPillars.map((p, idx) => {
          const isSelected = activePillar === p.id;
          return (
            <motion.div
              key={p.id}
              className={`vision-pillar-card ${isSelected ? 'selected' : ''}`}
              style={{ '--c': p.color }}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.42, delay: 0.08 + idx * 0.07, ease: [0.2, 0.8, 0.2, 1] }}
              onClick={() => {
                playSfx('click');
                setActivePillar((prev) => (prev === p.id ? null : p.id));
              }}
              onMouseEnter={() => playSfx('hover')}
            >
              <div className="vpc-header">
                <div className="vpc-num-badge">
                  <span>PILAR {p.num}</span>
                  <span className="vpc-horizon">{p.horizon}</span>
                </div>
                <div className="vpc-icon-box">{p.icon}</div>
              </div>

              <div className="vpc-title-box">
                <h3>{p.title}</h3>
                <span className="vpc-subtitle">{p.subtitle}</span>
              </div>

              <div className="vpc-kpi-chip">
                <span className="vpc-kpi-value">{p.kpi}</span>
                <span className="vpc-kpi-label">{p.kpiLabel}</span>
              </div>

              <p className="vpc-desc">{p.desc}</p>

              <div className="vpc-deliverables-box">
                <div className="vpc-box-title">Entregables Clave:</div>
                <ul className="vpc-deliverables-list">
                  {p.deliverables.map((d, dIdx) => (
                    <li key={dIdx}>
                      <span className="vpc-bullet" style={{ color: p.color }}>✓</span>
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="vpc-tech-tags">
                {p.tech.map((t) => (
                  <span key={t} className="vpc-tag">{t}</span>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Strategic Call to Action / Cierre de Negocio */}
      <motion.div
        className="vision-executive-banner"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.4 }}
      >
        <div className="veb-left">
          <div className="banner-badge-terminal">
            <span className="terminal-dot" style={{ background: '#ffb020', boxShadow: '0 0 8px #ffb020' }} />
            <span style={{ color: '#ffb020' }}>LIDERAZGO TÉCNICO & CONTINUIDAD DE NEGOCIO</span>
          </div>
          <p className="veb-statement">
            Ejecutar esta visión mediante agencias externas costaría <strong>+$120.000 USD</strong> y meses de inducción con alto riesgo de desvío. El equipo actual posee el <strong>know-how operativo integral</strong>, la <strong>confianza de las áreas clave</strong> y la <strong>velocidad probada (30 sistemas en producción)</strong> para liderar esta transformación como <strong>Semi Senior Technical Leads</strong>.
          </p>
        </div>

        <div className="veb-kpis">
          <div className="veb-kpi-item">
            <span className="veb-kpi-val">3x</span>
            <span className="veb-kpi-sub">Velocidad frente a agencias</span>
          </div>
          <div className="veb-kpi-item highlight">
            <span className="veb-kpi-val">$0</span>
            <span className="veb-kpi-sub">Fricción de inducción</span>
          </div>
          <div className="veb-kpi-item">
            <span className="veb-kpi-val">100%</span>
            <span className="veb-kpi-sub">Alineación con Mi Gusto</span>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

const milestoneMeta = [
  {
    year: '2025',
    phase: '01',
    color: '#ff4d4d',
    tag: 'Web & Marca',
    highlights: ['Sitio Web Oficial React', 'Identidad & CDN Global'],
    scope: 'Fundación del ecosistema digital',
    kpi: '+120k visitas/mes',
  },
  {
    year: '2025',
    phase: '02',
    color: '#ffb020',
    tag: 'Marketing Masivo',
    highlights: ['Alianza Flamin Hot & IAE', 'Tráfico masivo concurrente'],
    scope: 'Tráfico viral & co-branding',
    kpi: 'Alta concurrencia',
  },
  {
    year: '2026',
    phase: '03',
    color: '#b070ff',
    tag: 'Innovación en Tiendas',
    highlights: ['Tótems táctiles MG Games', 'Llamadores realtime cocina'],
    scope: 'Hardware táctil & interactivos',
    kpi: 'Hardware en local',
  },
  {
    year: '2026',
    phase: '04',
    color: '#3dd6a5',
    tag: 'Industria 4.0',
    highlights: ['MES de planta industrial', 'Logística Orbital con GPS'],
    scope: 'Producción nuclear & stock',
    kpi: 'Industria & Logística',
  },
  {
    year: '2026',
    phase: '05',
    color: '#38bdf8',
    tag: 'Calidad & Personas',
    highlights: ['MG Capacitaciones BPM', 'AuditApp scoring sucursales'],
    scope: 'Auditoría en vivo y calidad',
    kpi: 'Gobierno operativo',
  },
];

// Slide 3: Hitos Estratégicos de la Empresa (2025 - 2026)
function MilestonesSlide() {
  return (
    <section className="slide milestones-slide">
      <header className="milestones-header">
        <div className="brand-badge">
          <span className="brand-dot-pulse">
            <span className="brand-dot-core" />
            <span className="brand-dot-ring" />
          </span>
          <span className="brand-badge-company">Mi Gusto</span>
          <span className="brand-badge-divider">·</span>
          <span className="brand-badge-label">Alineación Estratégica & Impacto Organizacional</span>
        </div>
        <h1>Hitos Clave de Mi Gusto <span>(2025 – 2026)</span></h1>
        <p className="lead">
          De soluciones puntuales a la digitalización integral: cómo el desarrollo in-house acompañó y potenció cada meta estratégica.
        </p>
      </header>

      <div className="milestones-track-wrapper">
        <div className="milestones-years-bar">
          <div className="year-capsule y2025">
            <span className="brand-dot-pulse">
              <span className="brand-dot-core" style={{ background: '#ff4d4d', boxShadow: '0 0 8px #ff4d4d' }} />
              <span className="brand-dot-ring" style={{ background: 'rgba(255, 77, 77, 0.45)' }} />
            </span>
            <span className="capsule-title"><strong>2025</strong> · Ecosistema Digital & Marketing Masivo</span>
            <span className="capsule-count">2 Hitos</span>
          </div>
          <div className="year-capsule y2026">
            <span className="brand-dot-pulse">
              <span className="brand-dot-core" style={{ background: '#3dd6a5', boxShadow: '0 0 8px #3dd6a5' }} />
              <span className="brand-dot-ring" style={{ background: 'rgba(61, 214, 165, 0.45)' }} />
            </span>
            <span className="capsule-title"><strong>2026</strong> · Escalamiento, Industria 4.0 & Operaciones en Vivo</span>
            <span className="capsule-count">3 Hitos</span>
          </div>
        </div>

        <div className="milestones-grid">
          {companyMilestones.map((m, idx) => {
            const meta = milestoneMeta[idx] || {};
            return (
              <motion.article
                key={m.id}
                className="milestone-card"
                style={{ '--c': meta.color }}
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.12 + idx * 0.08, ease: [0.16, 1, 0.3, 1] }}
                onMouseEnter={() => playSfx('hover')}
              >
                <div className="milestone-card-body">
                  <div className="milestone-top">
                    <div className="milestone-phase">
                      <span className="phase-num">{meta.phase}</span>
                      <span className="phase-year">{meta.year}</span>
                    </div>
                    <div className="milestone-icon-wrap">
                      <span className="milestone-icon">{m.icon}</span>
                    </div>
                  </div>

                  <div className="milestone-meta">
                    <span className="milestone-cat" style={{ color: meta.color }}>
                      {m.category}
                    </span>
                    <span className="milestone-date">📅 {fmtDate(m.date)}</span>
                  </div>

                  <h3 className="milestone-title">{m.title}</h3>
                  <p className="milestone-desc">{m.desc}</p>

                  {meta.highlights && (
                    <ul className="milestone-deliverables">
                      {meta.highlights.map((h, hi) => (
                        <li key={hi}>
                          <span className="deliverable-bullet" style={{ color: meta.color }}>✓</span>
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="milestone-footer">
                  <div className="milestone-scope">
                    <span className="scope-dot" style={{ background: meta.color }} />
                    <span>{meta.scope}</span>
                  </div>
                  {meta.kpi && <span className="milestone-kpi">{meta.kpi}</span>}
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>

      <div className="milestones-banner-modern">
        <div className="banner-badge-terminal">
          <span className="terminal-dot" />
          <span>MODELO OPERATIVO</span>
        </div>
        <p className="banner-statement">
          Cada hito se sostuvo en software desarrollado <strong>100% in-house</strong>: autonomía arquitectónica, cero costo de licencias externas y adaptabilidad inmediata al ritmo de la empresa.
        </p>
        <div className="banner-kpi-chip">
          <span>AGILIDAD & CONTROL TOTAL</span>
        </div>
      </div>
    </section>
  );
}

// Diccionario de métricas y gráficos para cada proyecto (Impacto de Negocio & Eficiencia)
export const projectKpis = {
  site: { value: 95, metric: '+120k', label: 'Visitas mensuales', type: 'donut', sublabel: 'Alcance Nacional' },
  autoanswers: { value: 75, metric: '-75%', label: 'Tiempo de respuesta', type: 'bar', sublabel: 'Automatizado' },
  translate: { value: 100, metric: '$0', label: 'Costo APIs cloud', type: 'donut', sublabel: 'Web Speech API' },
  flamin: { value: 92, metric: '+25.000', label: 'Usuarios semana 1', type: 'bar', sublabel: 'Co-Branding 3D' },
  multimail: { value: 100, metric: '100%', label: 'Ahorro en SaaS', type: 'donut', sublabel: 'Multi-SMTP' },
  massivemail: { value: 99.8, metric: '99.8%', label: 'Entregabilidad', type: 'bar', sublabel: '+5.000 emails' },
  crunchy: { value: 100, metric: '< 5s', label: 'Validación en caja', type: 'donut', sublabel: 'Zero Duplicados' },
  iae: { value: 100, metric: '100%', label: 'Automatización B2B', type: 'bar', sublabel: 'End-to-End' },
  influencers: { value: 95, metric: '100%', label: 'Trazabilidad canjes', type: 'donut', sublabel: 'Control PIN' },
  rooms: { value: 90, metric: '100%', label: 'In-house colaborativo', type: 'bar', sublabel: 'Tiempo Real' },
  games: { value: 96, metric: '+18.000', label: 'Partidas jugadas', type: 'bar', sublabel: 'Engagement Tótems' },
  ordercaller: { value: 75, metric: '3x', label: 'Velocidad mostrador', type: 'donut', sublabel: 'Zero Demoras' },
  golden: { value: 90, metric: '+90%', label: 'Retención Mi Gusto Lovers', type: 'bar', sublabel: 'Fidelización' },
  qr: { value: 100, metric: '$0', label: 'Costo de suscripción', type: 'donut', sublabel: 'Vectorial SVG' },
  lolla: { value: 100, metric: '100%', label: 'Operatividad Offline', type: 'donut', sublabel: 'Zero Downtime' },
  mes: { value: 30, metric: '-30%', label: 'Tiempos de reporte', type: 'bar', sublabel: 'Industria 4.0' },
  orbital: { value: 100, metric: '24/7', label: 'Trazabilidad GPS', type: 'donut', sublabel: 'Flota & Stock' },
  day: { value: 95, metric: '+10.000', label: 'Leads en 24hs', type: 'bar', sublabel: 'Alta Demanda' },
  degu: { value: 100, metric: '100%', label: 'Cupos cubiertos', type: 'donut', sublabel: 'Zero Sobreventa' },
  tech: { value: 98, metric: '+500', label: 'Activos IT auditados', type: 'bar', sublabel: 'Control Central' },
  sagrada: { value: 90, metric: '+85%', label: 'Engagement viral', type: 'bar', sublabel: 'Lanzamiento' },
  copa: { value: 98, metric: '98%', label: 'Participación BPM', type: 'donut', sublabel: 'Certificación Planta' },
  carta: { value: 100, metric: 'Instantáneo', label: 'Sincronización menú', type: 'donut', sublabel: 'Toda la Red' },
  capa: { value: 95, metric: '100%', label: 'Autogestión operarios', type: 'bar', sublabel: 'Onboarding' },
  roulette: { value: 92, metric: '+8.000', label: 'Clientes captados', type: 'bar', sublabel: 'Aperturas' },
  screenflow: { value: 100, metric: '$0', label: 'Costo cloud & software', type: 'donut', sublabel: 'Edición Local' },
  audit: { value: 60, metric: '-60%', label: 'Tiempo de auditoría', type: 'bar', sublabel: 'Calidad Sucursales' },
  consolidado: { value: 100, metric: '100%', label: 'Consolidación diaria', type: 'bar', sublabel: 'Directorio' },
  mgops: { value: 100, metric: '1 Hub', label: 'Portal unificado', type: 'donut', sublabel: 'Centralización' },
  sensorial: { value: 100, metric: '100%', label: 'Protocolo INF-D003', type: 'donut', sublabel: 'Catas Bromatología' },
  kpicentral: { value: 95, metric: 'Multi-Canal', label: 'Monitoreo en tiempo real', type: 'bar', sublabel: 'Delivery & Reseñas' },
  halloween: { value: 100, metric: '100%', label: 'Cupos cubiertos', type: 'donut', sublabel: 'Viernes 13' },
  iae2026: { value: 100, metric: 'Offline-First', label: 'Sync en tiempo real', type: 'bar', sublabel: 'Evento IAE 2026' },
};

// Mini Gráfico Donut (Torta circular animada con Motion)
function MiniDonut({ value, color = '#3dd6a5', size = 46 }) {
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;

  return (
    <div className="mini-donut-wrap" style={{ width: size, height: size }} title={`${value}% de meta alcanzada`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: targetOffset }}
          transition={{ duration: 0.95, ease: [0.22, 1, 0.36, 1], delay: 0.12 }}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="mini-donut-text">
        <AnimatedNumber value={value} suffix="%" delay={0.12} duration={0.95} />
      </span>
    </div>
  );
}

// Mini Barra de Progreso con animación de carga fluida
function MiniProgressBar({ value, color = '#3dd6a5' }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="mini-bar-wrap" title={`${value}% de eficiencia`}>
      <div className="mini-bar-labels">
        <span className="mini-bar-pct">
          <AnimatedNumber value={value} suffix="%" delay={0.12} duration={0.95} />
        </span>
        <span className="mini-bar-target">Meta alcanzada</span>
      </div>
      <div className="mini-bar-track">
        <motion.div
          className="mini-bar-fill"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.95, ease: [0.22, 1, 0.36, 1], delay: 0.12 }}
          style={{ background: color }}
        />
      </div>
    </div>
  );
}


// Proyectos con capturas verticales/celular nativas
// Detección precisa de capturas con formato vertical (celular / móvil)
const VERTICAL_SHOT_EXACT = new Set([
  // Games (Arcade móvil)
  '/shots/Games/BubbleShooterGame.png',
  '/shots/Games/CatchGame.png',
  '/shots/Games/CrushGame.png',
  '/shots/Games/MemoryGame.png',
  '/shots/Games/Menu2.png',
  '/shots/Games/PacmanGame.png',
  '/shots/Games/PuzzleGame.png',
  // Copa Mundial de Inocuidad
  '/shots/CopaInocuidad/screenshot_1.png',
  '/shots/CopaInocuidad/screenshot_2.png',
  '/shots/CopaInocuidad/screenshot_3.png',
  '/shots/CopaInocuidad/screenshot_4.png',
  // Degustación
  '/shots/degu/1.jpeg',
  // IAE
  '/shots/IAE/Screenshot_5.png',
  // Ruleta Apertura
  '/shots/RuletaApertura/form.png',
  '/shots/RuletaApertura/landing.png',
  '/shots/RuletaApertura/roulette.png',
  '/shots/RuletaApertura/start.png',
  // Sensorial (image1 a 4 móviles; 5 a 7 son web horizontales)
  '/shots/Sensorial/image1.png',
  '/shots/Sensorial/image2.png',
  '/shots/Sensorial/image3.png',
  '/shots/Sensorial/image4.png',
  // Validador Crunchy
  '/shots/ValidadorCrunchy/Screenshot_5.png',
  '/shots/ValidadorCrunchy/Screenshot_6.png',
  '/shots/ValidadorCrunchy/Screenshot_7.png',
]);

const dynamicVerticalRatios = new Map();

export const isShotVertical = (src) => {
  if (!src) return false;
  // Todas las imágenes de Reminders Rooms son tratadas como horizontales
  if (src.includes('RemindersRooms')) return false;
  if (VERTICAL_SHOT_EXACT.has(src)) return true;
  if (dynamicVerticalRatios.has(src)) return dynamicVerticalRatios.get(src);
  return false;
};

// Slide de cada proyecto (Ficha ejecutiva interactiva en pantalla completa)
function ProjectSlide({ p, i, go, execMode }) {
  const c = categories[p.cat];
  const shots = images[p.id] || [];
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(null);
  const [, setAspectTrigger] = useState(0);
  const activeShot = shots.length > 0 ? ((step % shots.length) + shots.length) % shots.length : 0;
  const year = p.start.slice(0, 4);
  const kpi = projectKpis[p.id];
  const isFlagship = execMode && FLAGSHIP_IDS.has(p.id);
  const flagshipData = isFlagship ? FLAGSHIP_PROJECTS.find((f) => f.id === p.id) : null;
  const lastWheelRef = useRef(0);

  // Reiniciar el carrusel al cambiar de proyecto
  useEffect(() => {
    setStep(0);
    setDirection(1);
    setIsPaused(false);
    setZoomIndex(null);
  }, [p.id]);

  const onImgLoad = (src, e) => {
    if (src.includes('RemindersRooms')) return;
    if (e.target && e.target.naturalHeight > e.target.naturalWidth * 1.15) {
      if (!dynamicVerticalRatios.has(src)) {
        dynamicVerticalRatios.set(src, true);
        setAspectTrigger((v) => v + 1);
      }
    }
  };

  // Atajos de teclado en el lightbox (Esc para salir, flechas para navegar fotos)
  useEffect(() => {
    if (zoomIndex === null) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setZoomIndex(null);
      } else if (e.key === 'ArrowLeft') {
        setZoomIndex((cur) => (cur === 0 ? shots.length - 1 : cur - 1));
      } else if (e.key === 'ArrowRight') {
        setZoomIndex((cur) => (cur === shots.length - 1 ? 0 : cur + 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [zoomIndex, shots.length]);

  // Autoplay de rotación: el contenedor superior rota al medio y el del medio al inferior cada 3.8s
  useEffect(() => {
    if (shots.length <= 1 || isPaused) return;
    const timer = setInterval(() => {
      setDirection(1);
      setStep((prev) => prev + 1);
    }, 3800);
    return () => clearInterval(timer);
  }, [shots.length, isPaused]);

  // Navegación fluida con rueda del mouse
  const handleWheel = (e) => {
    if (shots.length <= 1) return;
    if (e.stopPropagation) e.stopPropagation();
    const now = Date.now();
    if (now - lastWheelRef.current < 200) return;
    lastWheelRef.current = now;
    if (e.deltaY > 0) {
      setDirection(1);
      setStep((s) => s + 1);
    } else if (e.deltaY < 0) {
      setDirection(-1);
      setStep((s) => s - 1);
    }
  };

  // Posiciones de los 3 slots en el arco circular con amplia separación vertical
  const getSlotProps = (slot, paused, isVert) => {
    if (isVert) {
      switch (slot) {
        case 'top':
          return {
            x: paused ? 24 : 16,
            y: paused ? -235 : -220,
            rotate: paused ? 5 : 3.5,
            scale: paused ? 0.86 : 0.82,
            opacity: paused ? 0.72 : 0.45,
            zIndex: 2,
          };
        case 'center':
          return {
            x: 0,
            y: 0,
            rotate: 0,
            scale: paused ? 1.02 : 1,
            opacity: 1,
            zIndex: 10,
          };
        case 'bottom':
          return {
            x: paused ? -12 : -8,
            y: paused ? 235 : 220,
            rotate: paused ? -4 : -2.5,
            scale: paused ? 0.86 : 0.82,
            opacity: paused ? 0.72 : 0.45,
            zIndex: 2,
          };
        default:
          return {};
      }
    }
    switch (slot) {
      case 'top':
        return {
          x: paused ? 32 : 24,
          y: paused ? -270 : -250,
          rotate: paused ? 5.5 : 4,
          scale: paused ? 0.88 : 0.84,
          opacity: paused ? 0.72 : 0.45,
          zIndex: 2,
        };
      case 'center':
        return {
          x: 8,
          y: 0,
          rotate: 1,
          scale: paused ? 1.02 : 1,
          opacity: 1,
          zIndex: 10,
        };
      case 'bottom':
        return {
          x: paused ? -8 : -4,
          y: paused ? 270 : 250,
          rotate: paused ? -3 : -2,
          scale: paused ? 0.88 : 0.84,
          opacity: paused ? 0.72 : 0.45,
          zIndex: 2,
        };
      default:
        return {};
    }
  };

  // Lista de items visibles con IDs virtuales persistentes para que las tarjetas se trasladen físicamente de un slot a otro
  const visibleItems = useMemo(() => {
    if (shots.length === 0) return [];
    const makeItem = (shotIdx, virtualIdx, slot) => {
      const src = shots[shotIdx];
      return {
        virtualIndex: virtualIdx,
        shotIndex: shotIdx,
        src,
        slot,
        isVertical: isShotVertical(src),
      };
    };

    if (shots.length === 1) {
      return [makeItem(0, step, 'center')];
    }
    if (shots.length === 2) {
      const centerIdx = ((step % 2) + 2) % 2;
      const topIdx = (((step + 1) % 2) + 2) % 2;
      return [
        makeItem(topIdx, step + 1, 'top'),
        makeItem(centerIdx, step, 'center'),
      ];
    }

    const len = shots.length;
    const topIdx = (((step + 1) % len) + len) % len;
    const centerIdx = ((step % len) + len) % len;
    const bottomIdx = (((step - 1) % len) + len) % len;

    return [
      makeItem(topIdx, step + 1, 'top'),
      makeItem(centerIdx, step, 'center'),
      makeItem(bottomIdx, step - 1, 'bottom'),
    ];
  }, [shots, step]);

  return (
    <section className="slide project" style={{ '--c': c.color }}>
      <div className="num">{String(i + 1).padStart(2, '0')}</div>

      <motion.div
        className="info"
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
      >
        <div className="project-tags-row">
          <div className="project-category-tag">
            <span>{c.icon}</span>
            <span>{c.label}</span>
          </div>
          <span className="project-year-pill">{year}</span>
          {p.start && p.end && (
            <span className="project-delivery-text" title={`Período: ${fmtDate(p.start)} → ${fmtDate(p.end)}`}>
              <span className="delivery-icon">⚡</span>
              <span>Tiempo récord de entrega: <strong>{calcDuration(p.start, p.end)}</strong></span>
            </span>
          )}
          {isFlagship && flagshipData && (
            <div className="flagship-badge-glow" title="Proyecto Estratégico Seleccionado para el Pitch Ejecutivo">
              <span className="flagship-star">⭐</span>
              <span className="flagship-label">CASO ESTRELLA</span>
              <span className="flagship-sep">·</span>
              <span className="flagship-pillar-text">{flagshipData.pillar}</span>
            </div>
          )}
        </div>

        {/* Selector Rápido de Casos Estrella (Solo en Modo Ejecutivo) */}
        {isFlagship && flagshipData && (
          <div className="flagship-switcher-bar">
            <div className="flagship-switcher-label">
              <span className="star-icon">⭐</span>
              <span>PITCH EJECUTIVO ({flagshipData.num}/04):</span>
            </div>
            <div className="flagship-pills-row">
              {FLAGSHIP_PROJECTS.map((f) => {
                const slideTarget = FIRST_2025_INDEX + (indexById[f.id] ?? 0);
                const isCurrent = f.id === p.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    className={`flagship-nav-pill ${isCurrent ? 'active' : ''}`}
                    style={{ '--pill-c': f.color }}
                    onClick={() => { go(slideTarget); }}
                    title={`Ir al caso: ${f.name} (${f.pillar})`}
                  >
                    <span className="pill-badge-num">{f.num}</span>
                    <span className="pill-emoji">{f.emoji}</span>
                    <span className="pill-name">{f.name}</span>
                    {isCurrent && <span className="pill-active-dot" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <h2>{p.name}</h2>
        <p className="tagline">{p.tagline}</p>
        <p className="desc">{p.desc}</p>

        {/* Tarjeta Ejecutiva: Impacto de Negocio & Eficiencia */}
        {p.impact && (
          <div className="project-callout impact-callout modern-impact-card">
            <div className="impact-card-top">
              <div className="callout-label">
                <span className="impact-icon-badge">📈</span>
                <strong>Impacto de Negocio & Eficiencia:</strong>
              </div>
              {kpi?.sublabel && (
                <span className="impact-sublabel-pill">{kpi.sublabel}</span>
              )}
            </div>

            <div className="impact-card-content">
              {kpi && (
                <div className="impact-visual-container">
                  {kpi.type === 'bar' ? (
                    <MiniProgressBar value={kpi.value} color="#3dd6a5" />
                  ) : (
                    <MiniDonut value={kpi.value} color="#3dd6a5" size={46} />
                  )}
                </div>
              )}

              <div className="impact-text-container">
                {kpi?.metric && (
                  <div className="impact-metric-row">
                    <span className="impact-metric-pill">{kpi.metric}</span>
                    <span className="impact-metric-title">{kpi.label}</span>
                  </div>
                )}
                <p className="impact-desc-text">{p.impact}</p>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Visual: Stack 3D Interactivo con Autoplay y Scroll */}
      <motion.div
        className="visual project-deck-visual"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.16 }}
      >
        {shots.length > 0 ? (
          <div
            className="project-stack-wrapper"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onWheel={handleWheel}
          >
            <div className="project-stack-deck">
              <AnimatePresence initial={false}>
                {visibleItems.map((item) => (
                  <motion.div
                    key={item.virtualIndex}
                    className={`stack-card ${item.isVertical ? 'is-vertical' : 'is-horizontal'} ${
                      item.slot === 'center'
                        ? 'card-layer-center'
                        : item.slot === 'top'
                        ? 'card-layer-top'
                        : 'card-layer-bottom'
                    }`}
                    initial={
                      item.isVertical
                        ? (direction > 0
                            ? { x: 20, y: -340, rotate: 5, scale: 0.72, opacity: 0 }
                            : { x: -10, y: 340, rotate: -4, scale: 0.72, opacity: 0 })
                        : (direction > 0
                            ? { x: 36, y: -380, rotate: 6, scale: 0.72, opacity: 0 }
                            : { x: -14, y: 380, rotate: -4, scale: 0.72, opacity: 0 })
                    }
                    animate={getSlotProps(item.slot, isPaused, item.isVertical)}
                    exit={
                      item.isVertical
                        ? (direction > 0
                            ? { x: -10, y: 340, rotate: -4, scale: 0.72, opacity: 0 }
                            : { x: 20, y: -340, rotate: 5, scale: 0.72, opacity: 0 })
                        : (direction > 0
                            ? { x: -14, y: 380, rotate: -4, scale: 0.72, opacity: 0 }
                            : { x: 36, y: -380, rotate: 6, scale: 0.72, opacity: 0 })
                    }
                    whileHover={
                      item.slot !== 'center'
                        ? {
                            scale: item.isVertical ? 0.94 : 0.88,
                            opacity: 0.85,
                            transition: { duration: 0.2 },
                          }
                        : undefined
                    }
                    transition={{ type: 'spring', stiffness: 220, damping: 24, mass: 0.8 }}
                    onClick={() => {
                      if (item.slot === 'top') {
                        setDirection(1);
                        setStep((s) => s + 1);
                      } else if (item.slot === 'bottom') {
                        setDirection(-1);
                        setStep((s) => s - 1);
                      } else {
                        setZoomIndex(item.shotIndex);
                      }
                    }}
                    title={
                      item.slot === 'center'
                        ? 'Clic para pantalla completa'
                        : 'Clic para rotar al centro'
                    }
                  >
                    <img
                      className="hero-shot-stacked"
                      src={item.src}
                      alt={`${p.name} - Captura ${item.shotIndex + 1}`}
                      loading="lazy"
                      onLoad={(e) => onImgLoad(item.src, e)}
                    />
                    {item.slot !== 'center' && <div className="card-layer-sheen" />}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <div className="orb">{p.emoji}</div>
        )}
      </motion.div>

      {/* Lightbox / Pantalla Completa con Fondo Blur, Controles y Botón Cerrar (X) */}
      <AnimatePresence>
        {zoomIndex !== null && shots[zoomIndex] && (
          <motion.div
            className="lightbox-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={() => setZoomIndex(null)}
          >
            {/* Botón de Cerrar (X) */}
            <button
              type="button"
              className="lightbox-btn-close"
              onClick={(e) => {
                e.stopPropagation();
                setZoomIndex(null);
              }}
              title="Cerrar pantalla completa (Esc)"
              aria-label="Cerrar"
            >
              ✕
            </button>

            {/* Escenario central de la foto con flechas laterales */}
            <div className="lightbox-stage" onClick={(e) => e.stopPropagation()}>
              {shots.length > 1 && (
                <button
                  type="button"
                  className="lightbox-arrow-btn prev"
                  onClick={(e) => {
                    e.stopPropagation();
                    setZoomIndex((cur) => (cur === 0 ? shots.length - 1 : cur - 1));
                  }}
                  title="Foto anterior (←)"
                  aria-label="Foto anterior"
                >
                  ←
                </button>
              )}

              <div className={`lightbox-image-wrapper ${isShotVertical(shots[zoomIndex]) ? 'is-vertical' : ''}`}>
                <AnimatePresence mode="wait">
                  <motion.img
                    key={shots[zoomIndex]}
                    src={shots[zoomIndex]}
                    alt={`${p.name} - Foto ${zoomIndex + 1}`}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="lightbox-active-img"
                  />
                </AnimatePresence>
              </div>

              {shots.length > 1 && (
                <button
                  type="button"
                  className="lightbox-arrow-btn next"
                  onClick={(e) => {
                    e.stopPropagation();
                    setZoomIndex((cur) => (cur === shots.length - 1 ? 0 : cur + 1));
                  }}
                  title="Foto siguiente (→)"
                  aria-label="Foto siguiente"
                >
                  →
                </button>
              )}
            </div>

            {/* Píldora inferior de estado y atajos */}
            <div className="lightbox-status-pill" onClick={(e) => e.stopPropagation()}>
              <span className="lightbox-counter-text">
                {zoomIndex + 1} / {shots.length}
              </span>
              <span className="lightbox-sep">·</span>
              <span className="lightbox-project-name">{p.name}</span>
              <span className="lightbox-sep">·</span>
              <span className="lightbox-keyboard-hint">Esc para salir</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}


// Slide Final: Agradecimiento por el espacio & Cierre de la Presentación
function ThankYouSlide({ go }) {
  return (
    <section className="slide thank-slide">
      <motion.div
        className="thank-content"
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
      >
        <div className="brand-badge">
          <span className="brand-dot-pulse">
            <span className="brand-dot-core" />
            <span className="brand-dot-ring" />
          </span>
          <span className="brand-badge-company">Mi Gusto</span>
          <span className="brand-badge-divider">·</span>
          <span className="brand-badge-label">Fin de la Presentación</span>
        </div>

        <h1>
          ¡Muchas gracias por <span>el espacio!</span>
        </h1>
        <p className="thank-lead">
          Comprometido con seguir impulsando la digitalización integral, la autonomía arquitectónica y soluciones ágiles de alto impacto para todo el ecosistema Mi Gusto.
        </p>

        <div className="thank-cards-grid">
          <motion.div
            className="thank-card"
            style={{ '--c': '#ff4d4d' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.2 }}
            onMouseEnter={() => playSfx('hover')}
          >
            <div className="thank-card-icon">🚀</div>
            <h3>Innovación Continua</h3>
            <p>Evolución tecnológica constante adaptada a la velocidad y crecimiento comercial.</p>
          </motion.div>

          <motion.div
            className="thank-card"
            style={{ '--c': '#ffb020' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.3 }}
            onMouseEnter={() => playSfx('hover')}
          >
            <div className="thank-card-icon">🛡️</div>
            <h3>Autonomía & Robustez</h3>
            <p>Sistemas 100% in-house, sin costos de licenciamiento externo y control total.</p>
          </motion.div>

          <motion.div
            className="thank-card"
            style={{ '--c': '#3dd6a5' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.4 }}
            onMouseEnter={() => playSfx('hover')}
          >
            <div className="thank-card-icon">🎯</div>
            <h3>Foco en el Negocio</h3>
            <p>Software alineado directamente con la eficiencia en planta, locales y ventas.</p>
          </motion.div>
        </div>

        <motion.div
          className="thank-footer-banner"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.48 }}
        >
          <div className="banner-badge-terminal">
            <span className="terminal-dot" />
            <span>DISPONIBILIDAD & COMPROMISO</span>
          </div>
          <p className="banner-statement">
            Espacio abierto para responder preguntas, profundizar en detalles técnicos de cualquier sistema o coordinar los próximos pasos.
          </p>
        </motion.div>

        <div className="thank-actions">
          <button className="btn-brand" onClick={() => { playSfx('click'); go(0); }}>
            🏠 Volver a la Portada
          </button>
          <button className="btn-secondary" onClick={() => { playSfx('click'); go(1); }}>
            📊 Ver Línea de Tiempo
          </button>
          <button className="btn-secondary" onClick={() => { playSfx('click'); go(SENIORITY_INDEX); }}>
            ⭐ Repasar Seniority
          </button>
          <button className="btn-secondary" onClick={() => { playSfx('click'); go(VISION_INDEX); }}>
            🚀 Visión 2027
          </button>
        </div>
      </motion.div>

      <motion.div
        className="thank-visual"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
      >
        <div className="cover-logo-wrapper">
          <img src="/logo.png" alt="Mi Gusto Logo" className="thank-logo" />
          <div className="glow-sphere" />
        </div>
      </motion.div>
    </section>
  );
}

export default function App() {
  const [idx, setIdx] = useState(0);
  const [grid, setGrid] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [execMode, setExecMode] = useState(false);

  const go = useCallback((n) => {
    setIdx(Math.max(0, Math.min(TOTAL - 1, n)));
    setGrid(false);
    playSfx('slide');
  }, []);

  const goNext = useCallback(() => {
    if (execMode) {
      const currPos = EXEC_SLIDES.indexOf(idx);
      if (currPos !== -1 && currPos < EXEC_SLIDES.length - 1) {
        go(EXEC_SLIDES[currPos + 1]);
      } else if (currPos === -1) {
        const nextSlide = EXEC_SLIDES.find((s) => s > idx);
        go(nextSlide !== undefined ? nextSlide : EXEC_SLIDES[EXEC_SLIDES.length - 1]);
      } else {
        go(EXEC_SLIDES[0]);
      }
    } else {
      go(idx + 1);
    }
  }, [execMode, idx, go]);

  const goPrev = useCallback(() => {
    if (execMode) {
      const currPos = EXEC_SLIDES.indexOf(idx);
      if (currPos > 0) {
        go(EXEC_SLIDES[currPos - 1]);
      } else if (currPos === -1) {
        const prevSlide = [...EXEC_SLIDES].reverse().find((s) => s < idx);
        go(prevSlide !== undefined ? prevSlide : EXEC_SLIDES[0]);
      } else {
        go(EXEC_SLIDES[0]);
      }
    } else {
      go(idx - 1);
    }
  }, [execMode, idx, go]);

  useEffect(() => {
    const onKey = (e) => {
      if (['ArrowRight', ' '].includes(e.key)) { e.preventDefault(); goNext(); }
      else if (e.key === 'ArrowLeft') goPrev();
      else if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        document.querySelector('.scroller')?.scrollBy({ top: (e.key === 'ArrowDown' ? 1 : -1) * window.innerHeight * 0.8, behavior: 'smooth' });
      }
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(TOTAL - 1);
      else if (e.key.toLowerCase() === 't') go(1);
      else if (e.key.toLowerCase() === 'h') go(2);
      else if (e.key === '1') go(FIRST_2025_INDEX);
      else if (e.key === '2') go(FIRST_2026_INDEX);
      else if (e.key.toLowerCase() === 'c') {
        if (!FLAGSHIP_SLIDES.includes(idx)) {
          go(FLAGSHIP_SLIDES[0]);
        } else {
          const curF = FLAGSHIP_SLIDES.indexOf(idx);
          go(FLAGSHIP_SLIDES[(curF + 1) % FLAGSHIP_SLIDES.length]);
        }
      }
      else if (e.key.toLowerCase() === 'e') {
        setExecMode((prev) => {
          const next = !prev;
          playSfx('click');
          return next;
        });
      }
      else if (e.key.toLowerCase() === 'r') go(ROI_INDEX);
      else if (e.key.toLowerCase() === 's') go(SENIORITY_INDEX);
      else if (e.key.toLowerCase() === 'v') go(VISION_INDEX);
      else if (e.key.toLowerCase() === 'g' || e.key === 'Escape') setGrid((g) => !g);
      else if (e.key.toLowerCase() === 'f') {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          document.documentElement.requestFullscreen();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [idx, go, goNext, goPrev]);

  let content;
  if (idx === 0) content = <Cover go={go} />;
  else if (idx === 1) content = <Timeline go={go} />;
  else if (idx === 2) content = <MilestonesSlide go={go} />;
  else if (idx >= FIRST_2025_INDEX && idx < ROI_INDEX) {
    const pIdx = idx - FIRST_2025_INDEX;
    content = <ProjectSlide p={sorted[pIdx]} i={pIdx} go={go} execMode={execMode} />;
  }
  else if (idx === ROI_INDEX) content = <RoiSlide go={go} />;
  else if (idx === SENIORITY_INDEX) content = <SenioritySlide go={go} />;
  else if (idx === VISION_INDEX) content = <VisionSlide go={go} />;
  else if (idx === THANKS_INDEX) content = <ThankYouSlide go={go} />;
  else content = <Cover go={go} />;

  return (
    <main className="deck">
      <div className="bg" />

      {/* Floating Executive Mode Switch (Top Right) */}
      <div className="exec-mode-switch-container">
        <button
          type="button"
          className={`brand-badge exec-toggle-button ${execMode ? 'is-active' : ''}`}
          onClick={() => {
            setExecMode((v) => !v);
          }}
          title="Alternar Modo Ejecutivo. Atajo de teclado: [E]"
        >
          <span className="brand-dot-pulse">
            <span className={`brand-dot-core ${execMode ? 'dot-active' : 'dot-inactive'}`} />
            <span className={`brand-dot-ring ${execMode ? 'dot-active' : 'dot-inactive'}`} />
          </span>
          <span className="brand-badge-company exec-btn-title">Modo Ejecutivo</span>
          <span className="exec-shortcut-badge">E</span>
        </button>
      </div>

      <div className="stage">
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            className="stage-motion-wrap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            {content}
          </motion.div>
        </AnimatePresence>
      </div>

      {grid && (
        <div className="grid-overlay" onClick={() => setGrid(false)}>
          <div className="grid">
            <button className="grid-special-btn" onClick={() => go(0)}>
              <span>🏠</span>Portada
            </button>
            <button className="grid-special-btn highlight" onClick={() => go(1)}>
              <span>📊</span>Línea de Tiempo
            </button>
            <button className="grid-special-btn highlight" onClick={() => go(2)}>
              <span>🎯</span>Hitos de la Empresa
            </button>
            <button className="grid-special-btn highlight" onClick={() => go(FIRST_2025_INDEX)}>
              <span>📅</span>Desarrollos 2025 ({sorted.filter((p) => p.start.startsWith('2025')).length})
            </button>
            <button className="grid-special-btn highlight" onClick={() => go(FIRST_2026_INDEX)}>
              <span>🚀</span>Desarrollos 2026 ({sorted.filter((p) => p.start.startsWith('2026')).length})
            </button>
            <button className="grid-special-btn highlight" onClick={() => go(ROI_INDEX)}>
              <span>💰</span>Retorno de Inversión (ROI) & Ahorro
            </button>
            <button className="grid-special-btn highlight" onClick={() => go(SENIORITY_INDEX)}>
              <span>⭐</span>Seniority & Liderazgo
            </button>
            <button className="grid-special-btn highlight" onClick={() => go(VISION_INDEX)}>
              <span>🚀</span>Visión 2026—2027 & Cierre
            </button>
            <button className="grid-special-btn highlight" onClick={() => go(THANKS_INDEX)}>
              <span>🤝</span>Agradecimiento & Cierre
            </button>

            {/* VIP Flagships Section in Grid */}
            <div className="grid-vip-header">
              <div className="grid-vip-title">
                <span>⭐</span>
                <strong>4 CASOS ESTRELLA · PITCH EJECUTIVO</strong>
              </div>
              <button
                className={`grid-vip-exec-toggle ${execMode ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  playSfx('click');
                  setExecMode((v) => !v);
                }}
              >
                {execMode ? `✓ Modo Ejecutivo Activado (${EXEC_SLIDES.length} slides)` : '⚡ Activar Modo Ejecutivo'}
              </button>
            </div>
            {FLAGSHIP_PROJECTS.map((f) => {
              const slideIdx = FIRST_2025_INDEX + (indexById[f.id] ?? 0);
              return (
                <button
                  key={`flagship-${f.id}`}
                  className="grid-flagship-vip-card"
                  style={{ '--c': f.color }}
                  onClick={() => go(slideIdx)}
                >
                  <div className="vip-badge-row">
                    <span className="vip-pill">⭐ CASO {f.num}</span>
                    <span className="vip-cat">{f.pillar}</span>
                  </div>
                  <span className="vip-emoji">{f.emoji}</span>
                  <strong>{f.name}</strong>
                  <small>{f.highlight}</small>
                </button>
              );
            })}

            <div className="grid-all-divider">
              <span>CATÁLOGO COMPLETO DE DESARROLLOS ({sorted.length})</span>
            </div>

            {sorted.map((p, i) => (
              <button key={p.id} style={{ '--c': categories[p.cat].color }} onClick={() => go(i + FIRST_2025_INDEX)}>
                <span>{p.emoji}</span>{p.name}<small>{fmtDate(p.start)}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      <LayoutGroup id="dockLavaTracker">
        <nav className="controls">
          <button id="prev" className="btn-nav" onClick={goPrev} aria-label="Anterior">←</button>
          <button id="timeline" className={idx === 1 ? 'active' : ''} onClick={() => go(1)}>
            {idx === 1 && (
              <motion.div
                layoutId="dockLavaBubble"
                className="dock-lava-bubble"
                transition={{ type: 'spring', stiffness: 350, damping: 26, mass: 0.75 }}
              />
            )}
            <span className="dock-btn-label"><span>📊</span> Timeline</span>
          </button>
          <button id="milestones" className={idx === 2 ? 'active' : ''} onClick={() => go(2)}>
            {idx === 2 && (
              <motion.div
                layoutId="dockLavaBubble"
                className="dock-lava-bubble"
                transition={{ type: 'spring', stiffness: 350, damping: 26, mass: 0.75 }}
              />
            )}
            <span className="dock-btn-label"><span>🎯</span> Hitos</span>
          </button>
          <AnimatePresence initial={false}>
            {execMode && (
              <motion.div
                key="flagship-dock-group"
                className="controls-flagship-group"
                initial={{ opacity: 0, width: 0, scale: 0.9 }}
                animate={{ opacity: 1, width: 'auto', scale: 1 }}
                exit={{ opacity: 0, width: 0, scale: 0.9 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              >
                <button
                  id="btn-flagships"
                  className={FLAGSHIP_SLIDES.includes(idx) ? 'active flagship-active' : ''}
                  onClick={() => {
                    if (!FLAGSHIP_SLIDES.includes(idx)) {
                      go(FLAGSHIP_SLIDES[0]);
                    } else {
                      const curF = FLAGSHIP_SLIDES.indexOf(idx);
                      go(FLAGSHIP_SLIDES[(curF + 1) % FLAGSHIP_SLIDES.length]);
                    }
                  }}
                  title="Ver los 4 Casos Estrella de Alto Impacto (Atajo: C)"
                >
                  {FLAGSHIP_SLIDES.includes(idx) && (
                    <motion.div
                      layoutId="dockLavaBubble"
                      className="dock-lava-bubble"
                      transition={{ type: 'spring', stiffness: 350, damping: 26, mass: 0.75 }}
                    />
                  )}
                  <span className="dock-btn-label"><span>⭐</span> Casos Estrella</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence initial={false}>
            {!execMode && (
              <motion.div
                key="years-dock-group"
                className="controls-years-group"
                initial={{ opacity: 0, width: 0, scale: 0.9 }}
                animate={{ opacity: 1, width: 'auto', scale: 1 }}
                exit={{ opacity: 0, width: 0, scale: 0.9 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              >
                <button
                  id="btn-2025"
                  className={idx >= FIRST_2025_INDEX && idx < FIRST_2026_INDEX ? 'active' : ''}
                  onClick={() => go(FIRST_2025_INDEX)}
                >
                  {idx >= FIRST_2025_INDEX && idx < FIRST_2026_INDEX && (
                    <motion.div
                      layoutId="dockLavaBubble"
                      className="dock-lava-bubble"
                      transition={{ type: 'spring', stiffness: 350, damping: 26, mass: 0.75 }}
                    />
                  )}
                  <span className="dock-btn-label"><span>📅</span> 2025</span>
                </button>
                <button
                  id="btn-2026"
                  className={idx >= FIRST_2026_INDEX && idx < ROI_INDEX ? 'active' : ''}
                  onClick={() => go(FIRST_2026_INDEX)}
                >
                  {idx >= FIRST_2026_INDEX && idx < ROI_INDEX && (
                    <motion.div
                      layoutId="dockLavaBubble"
                      className="dock-lava-bubble"
                      transition={{ type: 'spring', stiffness: 350, damping: 26, mass: 0.75 }}
                    />
                  )}
                  <span className="dock-btn-label"><span>🚀</span> 2026</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          <button id="btn-roi" className={idx === ROI_INDEX ? 'active' : ''} onClick={() => go(ROI_INDEX)}>
            {idx === ROI_INDEX && (
              <motion.div
                layoutId="dockLavaBubble"
                className="dock-lava-bubble"
                transition={{ type: 'spring', stiffness: 350, damping: 26, mass: 0.75 }}
              />
            )}
            <span className="dock-btn-label"><span>💰</span> Retorno & Ahorro</span>
          </button>
          <button id="seniority" className={idx === SENIORITY_INDEX ? 'active' : ''} onClick={() => go(SENIORITY_INDEX)}>
            {idx === SENIORITY_INDEX && (
              <motion.div
                layoutId="dockLavaBubble"
                className="dock-lava-bubble"
                transition={{ type: 'spring', stiffness: 350, damping: 26, mass: 0.75 }}
              />
            )}
            <span className="dock-btn-label"><span>⭐</span> Seniority</span>
          </button>
          <button id="btn-vision" className={idx === VISION_INDEX ? 'active' : ''} onClick={() => go(VISION_INDEX)}>
            {idx === VISION_INDEX && (
              <motion.div
                layoutId="dockLavaBubble"
                className="dock-lava-bubble"
                transition={{ type: 'spring', stiffness: 350, damping: 26, mass: 0.75 }}
              />
            )}
            <span className="dock-btn-label"><span>🚀</span> Visión 2027</span>
          </button>
          <span className="counter">
            <strong className="counter-current">{execMode ? Math.max(1, EXEC_SLIDES.indexOf(idx) + 1) : idx + 1}</strong>
            <span className="counter-sep">/</span>
            <span className="counter-total">{execMode ? EXEC_SLIDES.length : TOTAL}</span>
          </span>
          <button id="next" className="btn-nav" onClick={goNext} aria-label="Siguiente">→</button>
        </nav>
      </LayoutGroup>
      <motion.div
        className="progress"
        initial={false}
        animate={{ width: `${((idx + 1) / TOTAL) * 100}%` }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      />
    </main>
  );
}

