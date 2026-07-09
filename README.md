# Mail to Calendar

Extensión de Google Chrome que agenda una reunión en Google Calendar a partir del correo que tengas abierto en Gmail.

## Qué hace

1. Lee el correo abierto en Gmail (asunto, cuerpo y remitente).
2. Detecta automáticamente fechas y horas mencionadas en el texto, en español:
   - `15 de julio`, `15/07/2026`, `hoy`, `mañana`, `pasado mañana`, `el próximo lunes`
   - `a las 10:30`, `3 pm`, `15:00 hrs`
3. Prellena un formulario editable (título = asunto, invitado = remitente, descripción = extracto del correo).
4. Al confirmar, abre Google Calendar con el evento listo para guardar — sin necesidad de configurar OAuth ni claves de API.

## Instalación

1. Abre Chrome y entra a `chrome://extensions`.
2. Activa el **Modo de desarrollador** (interruptor arriba a la derecha).
3. Pulsa **Cargar descomprimida** y selecciona esta carpeta (`mail-to-calendar`).

## Uso

1. Abre Gmail y entra al correo de la reunión.
2. Haz clic en el icono de la extensión en la barra de Chrome.
3. Revisa/ajusta título, fecha, hora, duración e invitados.
4. Pulsa **Crear evento en Google Calendar**: se abre una pestaña de Calendar con todo prellenado; solo queda pulsar **Guardar**.

## Archivos

- `manifest.json` — configuración de la extensión (Manifest V3).
- `content.js` — se ejecuta dentro de Gmail y extrae los datos del correo abierto.
- `popup.html` / `popup.css` / `popup.js` — el formulario y la lógica de detección de fecha/hora.

## Donaciones

Si la extensión te resulta útil, acepto donaciones por **Bizum**: `651 540 128`. ¡Gracias! 💙

## Limitaciones

- Funciona con Gmail (`mail.google.com`); no soporta Outlook Web u otros clientes.
- La detección de fecha/hora es heurística: siempre revisa el valor prellenado antes de crear el evento.
- Si un número de hora no lleva am/pm (p. ej. «a las 3»), se asume horario de tarde para valores entre 1 y 7.
