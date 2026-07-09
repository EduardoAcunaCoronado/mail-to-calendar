// Content script: extrae los datos del correo abierto en Gmail.

function getOpenEmail() {
  // El asunto solo existe cuando hay un correo abierto (no en la bandeja).
  const subjectEl = document.querySelector('h2.hP');
  if (!subjectEl) return null;

  // En un hilo puede haber varios mensajes; tomamos el último expandido.
  const bodies = document.querySelectorAll('div.a3s');
  let bodyText = '';
  for (let i = bodies.length - 1; i >= 0; i--) {
    const el = bodies[i];
    if (el.offsetParent !== null && el.innerText.trim()) {
      bodyText = el.innerText.trim();
      break;
    }
  }

  // Remitente del último mensaje visible.
  const senders = document.querySelectorAll('span.gD[email]');
  const senderEl = senders.length ? senders[senders.length - 1] : null;

  // Otros participantes (Para/Cc) por si se quieren invitar.
  const participants = new Set();
  document.querySelectorAll('span.g2[email], span.gD[email]').forEach((el) => {
    const email = el.getAttribute('email');
    if (email) participants.add(email);
  });

  return {
    subject: subjectEl.innerText.trim(),
    body: bodyText,
    senderName: senderEl ? (senderEl.getAttribute('name') || senderEl.innerText.trim()) : '',
    senderEmail: senderEl ? senderEl.getAttribute('email') : '',
    participants: Array.from(participants),
    url: location.href
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'GET_EMAIL') {
    sendResponse(getOpenEmail());
  }
  return false;
});
