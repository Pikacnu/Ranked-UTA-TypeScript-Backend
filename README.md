# RUTA_TS

A multiplayer game matching and WebSocket communication system built with TypeScript and Bun.

Used to Ranked UTA Project.
Frontend is [here](https://github.com/Pikacnu/Ranked-UTA-Fronetend-Java) (Minecraft Server Mod)

Undertale Arena Map Made By [Nebulirion](https://www.youtube.com/@nebulirion)
Modified and updated by [FocalSalt](https://github.com/focalsalt)

## Project Structure

### Core Components

- **WebSocket Server** (`websocket/`): Main WebSocket server implementation
- **Database Layer** (`src/db/`): Data access layer using Drizzle ORM
- **Game Logic** (`src/classes/`): Core game and player classes
- **Handlers** (`websocket/handlers/`): Modular message processing architecture

### Features

- Dynamic handler loading with hot reload support
- Type-safe WebSocket message processing
- Database operations with Drizzle ORM
- Discord bot integration

## Quick Start

### Install Dependencies

```bash
bun install
```

### Run Applications

```bash
# Start Discord Bot
bun run index.ts

# Start WebSocket Server
bun run start.ts
```

### Database Operations

```bash
# Generate migrations
bun run generate

# Run migrations
bun run migrate
```