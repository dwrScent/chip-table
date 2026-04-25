# Chip Table

Chip Table is a lightweight self-hosted web app for tracking poker table chips. It lets players join a table, manage wallet chips, bet into a shared pot, collect the pot for a winner, and protect high-risk reset actions with an admin PIN. The interface supports Chinese and English.

The app is built with Next.js, React, SQLite, and Docker. Data is stored in a mounted SQLite database so it survives restarts and container rebuilds.

## Deployment

### Docker Compose

1. Copy the environment template:

```bash
cp .env.example .env
```

2. Edit `.env` and set a private `ADMIN_PIN`:

```env
DATABASE_PATH=./data/chip-table.db
ADMIN_PIN=replace-with-a-private-pin
TABLE_NAME=Main Table
LOG_LIMIT=80
```

3. Start the app:

```bash
docker compose up -d --build
```

4. Open:

```text
http://localhost:3000
```

The default compose file publishes the app on host port `3000`. Put your reverse proxy in front of that port if you want to serve it from a domain with HTTPS.

### Persistent Data

SQLite data is stored in `./data` on the host and mounted to `/app/data` in the container:

```yaml
volumes:
  - ./data:/app/data
```

Keep this directory when upgrading or rebuilding the container.

### Update

Pull the latest code, keep the existing `.env` and `./data` directory, then rebuild:

```bash
docker compose up -d --build
```
