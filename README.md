# SaveBite — Demo Hackathon

Pequeña SPA estática para demo de 5 minutos: restaurantes publican ofertas de último minuto para evitar desperdicio.

Cómo abrir (modo rápido):

1. Abrir `index.html` en un navegador.
2. O servir con un servidor estático (recomendado):

```bash
# desde la raíz del repo
python3 -m http.server 8000
# luego abrir http://localhost:8000
```

Paleta (estética relajada, formas redondeadas):
- Beige (principal): #F5ECE0
- Verde (detalles): #2F6F3E
- Naranja (acentos): #FF7A18


Contenido incluido:
- `index.html` — interfaz principal (SPA sin backend), diseño vertical y optimizado para móviles.
- `styles.css` — tema y componentes visuales (vista scrolleable).
- `app.js` — lógica de carga, reservas demo, moneda en pesos uruguayos (UYU) y simulación en tiempo real.
- `data.json` — 7 restaurantes de ejemplo y sus ofertas (tiempo en minutos, ofertas <=30 min).
- `PITCH.md` — guion sugerido para la presentación de 5 minutos.



Notas de diseño y uso:
- UX simple: selector de "cuenta demo" y lista vertical de avisos espontáneos; al pulsar "Reservar" decrece cantidad y muestra toast.
- Moneda: los precios se muestran en pesos uruguayos (UYU) usando `Intl.NumberFormat('es-UY', {currency:'UYU'})`.
 - Simulación: `app.js` decrementa tiempos y cantidades para mostrar actividad en tiempo real.

Nuevas características:
- Precios realistas en UYU y descuentos de ejemplo (30% / 35% / 40%).
- Contacto mock: cada negocio tiene un número (`phone`) y un botón "Contactar" que abre una vista con el número (puede iniciar `tel:` en dispositivos móviles).
- Notificaciones centradas: avisos emergentes en cuadro naranja con símbolo de reloj y hora estimada de retiro (ej. `18:42`).
 - Notificaciones centradas: avisos emergentes en cuadro naranja con símbolo de reloj y hora estimada de retiro (ej. `18:42`).
 - Nuevo botón "Notificaciones": permite revisar las notificaciones previas que se mostraron durante la sesión.
 - Generación: la demo crea nuevas ofertas esporádicamente si no hay disponibilidad, con tiempo mínimo 10 minutos y máximo 25 minutos.
