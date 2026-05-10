# Scanner Elite Crypto — Backend 24/7

Backend Node.js para el Scanner Elite. Corre en Railway 24/7.

## Setup en Railway

1. Sube este proyecto a GitHub
2. En Railway: New Project → Deploy from GitHub → selecciona el repo
3. En Variables de entorno agrega:
   - `TELEGRAM_TOKEN` = tu token del bot
   - `TELEGRAM_CHAT_ID` = tu chat ID

## Variables de entorno

Crea un archivo `.env` (no subir a GitHub):
```
TELEGRAM_TOKEN=tu_token_aqui
TELEGRAM_CHAT_ID=tu_chat_id_aqui
PORT=3000
```

## API Endpoints

- `GET /api/stats` — estadísticas generales
- `GET /api/history` — historial de señales
- `POST /api/capital` — actualizar capital `{ capital: 1000 }`
- `POST /api/close/:id` — cerrar señal manual `{ result: "win" | "loss" }`
- `GET /health` — estado del servidor

## Lo que hace

- Monitorea 20 pares crypto cada 15 segundos
- Detecta señales LONG/SHORT con 8 indicadores
- Calcula SL/TP automáticamente con ATR
- Envía alertas a Telegram con entry, SL, TP y tamaño de posición
- Cierra operaciones automáticamente al tocar SL o TP
- Envía reporte diario a las 8am
- Guarda todo en SQLite
