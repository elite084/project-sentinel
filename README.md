# Project Sentinel

Project Sentinel is an autonomous incident resolution engine that monitors a group of microservices, detects errors and injected faults via its Chaos Monkey, and drives automated remediation — all surfaced through a real-time Next.js dashboard.

# Commands

```bash
pnpm install
pnpm dev
```

The `dev` script starts all three backend services (auth :4001, payments :4002, inventory :4003) and the Next.js dashboard simultaneously. Services write structured JSON logs to `services/logs/`.

| Command | Description |
|---|---|
| `pnpm dev` | Start all services and the dashboard |
| `pnpm dev:services` | Start only the three microservices |
| `pnpm poll` | Continuously poll service health endpoints |
| `pnpm chaos:run` | Inject a random fault into a random service |
| `pnpm chaos:reset` | Clear all active chaos state |
| `pnpm test` | Run tests across all workspaces |
