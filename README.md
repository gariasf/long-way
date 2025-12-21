# Long Way

A self-hosted road trip planning app with AI assistance.

## Features

- Plan road trips with multiple stop types (base camps, waypoints, stops, transport)
- Interactive map with markers and route visualization
- AI-powered trip planning assistant (Claude)
- Drag-and-drop stop reordering
- Filter stops by type and tags
- Dark mode support

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Configuration

The app uses SQLite for data storage. The database is automatically created on first run in `./data/longway.db`.

To use the AI chat feature, add your Anthropic API key in Settings (gear icon).

### Environment Variables (optional)

- `DATABASE_PATH` - Custom path for SQLite database (default: `./data/longway.db`)

## Docker

```bash
# Build and run with Docker Compose
docker compose up -d
```

The app will be available at [http://localhost:3000](http://localhost:3000).

Data is persisted in a Docker volume.

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- SQLite (better-sqlite3)
- Leaflet for maps
- Claude API for AI assistance
