// Popup: lee el correo abierto, intenta detectar fecha/hora en el texto
// y crea el evento en Google Calendar con los datos del formulario.

const MONTHS = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9,
  noviembre: 10, diciembre: 11
};

const WEEKDAYS = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, miércoles: 3,
  jueves: 4, viernes: 5, sabado: 6, sábado: 6
};

// --- Detección de fecha en el texto del correo ---

function parseDate(text) {
  const t = text.toLowerCase();
  const now = new Date();

  // dd/mm/yyyy o dd-mm-yy
  let m = t.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (m) {
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    const d = new Date(year, parseInt(m[2], 10) - 1, parseInt(m[1], 10));
    if (!isNaN(d)) return d;
  }

  // "15 de julio" / "15 de julio de 2026"
  m = t.match(/\b(\d{1,2})\s+de\s+([a-záéíóú]+)(?:\s+(?:de\s+|del\s+)?(\d{4}))?/);
  if (m && MONTHS[m[2]] !== undefined) {
    const year = m[3] ? parseInt(m[3], 10) : now.getFullYear();
    const d = new Date(year, MONTHS[m[2]], parseInt(m[1], 10));
    // Sin año explícito y ya pasó: asumimos el año siguiente.
    if (!m[3] && d < now && (now - d) > 24 * 3600 * 1000) {
      d.setFullYear(d.getFullYear() + 1);
    }
    return d;
  }

  // "pasado mañana", "mañana", "hoy"
  if (/\bpasado\s+mañana\b/.test(t)) return addDays(now, 2);
  if (/\bmañana\b/.test(t)) return addDays(now, 1);
  if (/\bhoy\b/.test(t)) return now;

  // "el lunes", "este martes", "próximo viernes"
  m = t.match(/\b(?:el|este|esta|pr[oó]ximo|siguiente)\s+(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/);
  if (m) {
    const target = WEEKDAYS[m[1]];
    let diff = (target - now.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    return addDays(now, diff);
  }

  return null;
}

// --- Detección de hora en el texto del correo ---

function parseTime(text) {
  const t = text.toLowerCase();

  // "a las 10", "a las 10:30", "a las 3 pm"
  let m = t.match(/\ba\s+las?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.?\s?m\.?|p\.?\s?m\.?|hrs?\.?|h\b)?/);
  if (m) return toTime(m[1], m[2], m[3]);

  // "10:30 am", "15:00", "15:00 hrs"
  m = t.match(/\b(\d{1,2}):(\d{2})\s*(am|pm|a\.?\s?m\.?|p\.?\s?m\.?|hrs?\.?)?/);
  if (m) return toTime(m[1], m[2], m[3]);

  // "3 pm", "3pm"
  m = t.match(/\b(\d{1,2})\s*(am|pm)\b/);
  if (m) return toTime(m[1], null, m[2]);

  return null;
}

function toTime(hStr, minStr, suffix) {
  let hours = parseInt(hStr, 10);
  const minutes = minStr ? parseInt(minStr, 10) : 0;
  if (hours > 23 || minutes > 59) return null;
  if (suffix) {
    const s = suffix.replace(/[\s.]/g, '');
    if (s.startsWith('p') && hours < 12) hours += 12;
    if (s.startsWith('a') && hours === 12) hours = 0;
  } else if (hours >= 1 && hours <= 7) {
    // Sin am/pm, una "reunión a las 3" casi siempre es de tarde.
    hours += 12;
  }
  return { hours, minutes };
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// --- Formato para la URL de Google Calendar ---

function pad(n) {
  return String(n).padStart(2, '0');
}

function toCalendarStamp(d) {
  return (
    d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
    'T' + pad(d.getHours()) + pad(d.getMinutes()) + '00'
  );
}

function buildCalendarUrl({ title, start, durationMin, guests, description }) {
  const end = new Date(start.getTime() + durationMin * 60000);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: toCalendarStamp(start) + '/' + toCalendarStamp(end),
    details: description
  });
  if (guests) params.set('add', guests);
  return 'https://calendar.google.com/calendar/render?' + params.toString();
}

// --- Comunicación con la pestaña de Gmail ---

async function getEmailFromTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !tab.url.startsWith('https://mail.google.com/')) {
    throw new Error('NOT_GMAIL');
  }
  try {
    return await chrome.tabs.sendMessage(tab.id, { type: 'GET_EMAIL' });
  } catch {
    // El content script no está inyectado (p. ej. Gmail abierto antes de
    // instalar la extensión): lo inyectamos y reintentamos.
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    return await chrome.tabs.sendMessage(tab.id, { type: 'GET_EMAIL' });
  }
}

// --- UI ---

const $ = (id) => document.getElementById(id);

function showStatus(message, isError) {
  const el = $('status');
  el.textContent = message;
  el.classList.remove('hidden');
  el.classList.toggle('error', !!isError);
}

function setDateInputs(date) {
  $('date').value = date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  $('time').value = pad(date.getHours()) + ':' + pad(date.getMinutes());
}

async function init() {
  let email;
  try {
    email = await getEmailFromTab();
  } catch (e) {
    showStatus(
      e.message === 'NOT_GMAIL'
        ? 'Abre Gmail (mail.google.com) y entra a un correo para usar la extensión.'
        : 'No se pudo leer la pestaña. Recarga Gmail e inténtalo de nuevo.',
      true
    );
    return;
  }

  if (!email) {
    showStatus('No hay ningún correo abierto. Abre el correo que quieres agendar.', true);
    return;
  }

  $('form').classList.remove('hidden');

  // Prefill con los datos del correo.
  $('title').value = email.subject || 'Reunión';
  $('guests').value = email.senderEmail || '';

  const snippet = (email.body || '').slice(0, 500);
  $('description').value =
    'Creado desde el correo de ' +
    (email.senderName || email.senderEmail || 'remitente desconocido') +
    ':\n\n' + snippet + (email.body && email.body.length > 500 ? '…' : '');

  // Detectar fecha y hora en asunto + cuerpo.
  const text = (email.subject || '') + '\n' + (email.body || '');
  const date = parseDate(text);
  const time = parseTime(text);

  const start = date || addDays(new Date(), 1);
  if (time) {
    start.setHours(time.hours, time.minutes, 0, 0);
  } else {
    start.setHours(9, 0, 0, 0);
  }
  setDateInputs(start);

  if (date || time) {
    const hint = $('hint');
    hint.textContent =
      '✓ Se detectó ' +
      (date ? 'la fecha' : '') +
      (date && time ? ' y ' : '') +
      (time ? 'la hora' : '') +
      ' en el correo. Revísala antes de crear el evento.';
    hint.classList.remove('hidden');
  }
}

$('form').addEventListener('submit', (ev) => {
  ev.preventDefault();

  const [y, mo, d] = $('date').value.split('-').map(Number);
  const [h, mi] = $('time').value.split(':').map(Number);
  const start = new Date(y, mo - 1, d, h, mi);

  const url = buildCalendarUrl({
    title: $('title').value.trim() || 'Reunión',
    start,
    durationMin: parseInt($('duration').value, 10),
    guests: $('guests').value.split(',').map((s) => s.trim()).filter(Boolean).join(','),
    description: $('description').value
  });

  chrome.tabs.create({ url });
});

init();
