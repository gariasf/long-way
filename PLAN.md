# Long Way — Trip Planning App

## Vision

A self-hosted trip planning tool for contemplative, long-distance journeys. Features a map visualization, stop management, and an integrated Claude assistant that can read and modify trip data through natural conversation.

**Design Philosophy:**
- Simplicity over features — resist feature creep
- Serendipity within structure — plan the anchors, leave room for discovery
- Claude as collaborative partner — not automation, but conversation that flows into action
- Desktop-first planning tool — not a navigation app

---

## Core Features (MVP)

### 1. Trip Management
- Create/rename/delete trips (user-initiated only, not Claude)
- Each trip is a self-contained "project"
- Trip has: name, description, list of stops

### 2. Stop Management
- Add, edit, remove stops via forms
- Stop types:
  - **Base Camp** — anchor location, multiple nights, day trips radiate out
  - **Waypoint** — overnight stop, covering ground
  - **Stop** — hours only, viewpoint/meal/photo op
  - **Transport** — ferry, flight, train segment
- Reorder stops via drag-and-drop
- Mark stops as **optional** (interest points, serendipity candidates)

### 3. Map Visualization
- Full trip route displayed on map
- Stops shown as markers, color-coded by type
- Optional stops shown with different styling (dashed? lighter?)
- Route line connecting stops in order
- Click marker to see stop details (read-only on map)
- "Open in Google Maps" button for navigation

### 4. Timeline/List View
- Ordered list of stops with:
  - Name and type icon
  - Short description
  - Duration
  - Distance/time to next stop (entered manually or calculated)
- Optional stops shown indented or with visual distinction
- Expandable notes (hidden by default)

### 5. Claude Integration
- Chat panel alongside map/timeline (resizable split view)
- User provides their own Anthropic API key (stored locally)
- Claude has access to trip data and can:
  - Read full trip details
  - Add new stops
  - Edit existing stops
  - Remove stops
  - Reorder stops
  - Answer questions about the trip
  - Suggest stops based on criteria
- Claude works within the current trip "sandbox" — no awareness of app-level operations
- Conversation history persisted per trip

---

## Data Model

### Trip
```
id: string (uuid)
name: string
description: string (optional)
created_at: datetime
updated_at: datetime
```

### Stop
```
id: string (uuid)
trip_id: string (foreign key)
name: string
type: 'base_camp' | 'waypoint' | 'stop' | 'transport'
description: string (short, one-liner)
latitude: number
longitude: number
duration_value: number
duration_unit: 'hours' | 'nights' | 'days'
is_optional: boolean (default: false)
tags: string[] (optional)
links: string[] (optional, URLs)
notes: string (optional, markdown)
order: number (for sequencing)

# Transport-specific (nullable for other types)
transport_type: 'ferry' | 'flight' | 'train' | 'bus' | null
departure_time: string (optional, e.g., "14:30")
arrival_time: string (optional)
departure_location: string (optional, e.g., "Hirtshals Port")
arrival_location: string (optional, e.g., "Kristiansand Terminal")
```

### Conversation (for Claude chat history)
```
id: string (uuid)
trip_id: string (foreign key)
messages: JSON (array of {role, content, timestamp})
created_at: datetime
updated_at: datetime
```

### Settings (app-level)
```
anthropic_api_key: string (encrypted at rest)
```

---

## UI Layout

```
+----------------------------------------------------------+
|  [Trip Selector Dropdown]              [Settings Gear]   |
+----------------------------------------------------------+
|                    |                                      |
|                    |                                      |
|       MAP          |         SIDEBAR                      |
|    (Leaflet)       |   +----------------------------+    |
|                    |   |  [Timeline] [Chat] tabs    |    |
|                    |   +----------------------------+    |
|                    |   |                            |    |
|                    |   |   Timeline view            |    |
|                    |   |   - Stop list              |    |
|                    |   |   - Add stop button        |    |
|                    |   |                            |    |
|                    |   |   -- OR --                 |    |
|                    |   |                            |    |
|                    |   |   Chat view                |    |
|                    |   |   - Message history        |    |
|                    |   |   - Input box              |    |
|                    |   |                            |    |
+----------------------------------------------------------+
```

- Map takes ~60% width on desktop
- Sidebar takes ~40% with tabs for Timeline and Chat
- Stop detail modal/panel for editing
- Responsive: on smaller screens, stack vertically (map on top)

---

## Claude Tool Definitions

Claude will have access to these tools:

### `get_trip`
Returns full trip data including all stops, ordered.

### `add_stop`
Parameters: name, type, description, latitude, longitude, duration_value, duration_unit, is_optional, tags, links, notes, order (optional, defaults to end), transport fields if applicable
Returns: created stop

### `update_stop`
Parameters: stop_id, any fields to update
Returns: updated stop

### `remove_stop`
Parameters: stop_id
Returns: confirmation

### `reorder_stops`
Parameters: array of stop_ids in new order
Returns: confirmation

### `get_stop`
Parameters: stop_id
Returns: single stop details

### `search_stops`
Parameters: query (searches name, description, tags, notes)
Returns: matching stops

---

## Technical Architecture

### Stack
- **Frontend**: Next.js 14 (App Router) with React
- **Styling**: Tailwind CSS
- **Map**: Leaflet + React-Leaflet + OpenStreetMap tiles (free, no API key needed)
- **Database**: SQLite via better-sqlite3 (file-based, perfect for self-hosting)
- **Claude**: Anthropic API with tool use (user provides API key)
- **Deployment**: Docker + docker-compose

### Why This Stack
- **Next.js**: Industry standard, handles both frontend and API routes, good ecosystem
- **SQLite**: Zero configuration, file-based, easily backed up, sufficient for single-user
- **Leaflet + OSM**: Completely free, no usage limits, good enough for visualization
- **Tailwind**: Fast to build, no CSS architecture decisions

### Project Structure
```
/app
  /page.tsx                 # Main app (trip view)
  /api
    /trips/route.ts         # Trip CRUD
    /stops/route.ts         # Stop CRUD
    /chat/route.ts          # Claude conversation endpoint
    /settings/route.ts      # API key management
/components
  /Map.tsx                  # Leaflet map component
  /Timeline.tsx             # Stop list
  /Chat.tsx                 # Claude chat panel
  /StopForm.tsx             # Add/edit stop modal
  /StopMarker.tsx           # Map marker component
/lib
  /db.ts                    # SQLite connection and queries
  /claude.ts                # Anthropic API integration with tools
  /types.ts                 # TypeScript types
/data
  /longway.db               # SQLite database file (gitignored)
```

---

## Out of Scope (MVP)

Explicitly NOT building:
- Budgeting / cost tracking
- Packing lists
- Booking management (beyond link field)
- Social sharing / collaboration
- Multiple user accounts
- Offline mode
- Mobile editing
- Route calculation (distances entered manually or via external tool)
- Import/export (GPX, Google Maps)
- Actual date scheduling (just sequence + duration)

These can be added later if needed.

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Project setup (Next.js, Tailwind, SQLite)
- [ ] Database schema and migrations
- [ ] Basic API routes for trips and stops
- [ ] Trip list/selector UI

### Phase 2: Map & Timeline
- [ ] Leaflet map integration
- [ ] Stop markers on map
- [ ] Route line between stops
- [ ] Timeline/list view in sidebar
- [ ] Stop detail panel

### Phase 3: Stop Management
- [ ] Add stop form
- [ ] Edit stop form
- [ ] Delete stop confirmation
- [ ] Drag-and-drop reordering
- [ ] Optional stop styling

### Phase 4: Claude Integration
- [ ] Settings page for API key
- [ ] Chat UI component
- [ ] Anthropic API integration
- [ ] Tool definitions and handlers
- [ ] Conversation persistence
- [ ] Real-time UI updates when Claude modifies data

### Phase 5: Polish
- [ ] Transport stop special fields
- [ ] Tags display and filtering
- [ ] "Open in Google Maps" button
- [ ] Responsive layout tweaks
- [ ] Docker configuration
- [ ] Documentation

---

## Open Questions

1. **Distance/time between stops**: Calculate automatically (requires routing API, adds complexity/cost) or manual entry?
   - Recommendation: Manual entry for MVP, with "Open in Google Maps" to check

2. **Map interaction**: Click-to-add-stop would be convenient but adds complexity. Worth it?
   - Recommendation: No for MVP. Use form with address/coordinate search instead.

3. **Coordinate entry**: How should users enter locations?
   - Option A: Type address, geocode to coordinates (needs geocoding API)
   - Option B: Enter lat/lng directly (tedious)
   - Option C: Search via Nominatim (free OpenStreetMap geocoding)
   - Recommendation: Option C — Nominatim is free and sufficient

4. **Chat context**: How much trip context to send to Claude on each message?
   - Full trip data every time (simple but token-heavy)
   - Smart context (recent changes, relevant stops)
   - Recommendation: Full trip for MVP (trips won't be huge), optimize later if needed

---

## Success Criteria

The app is "done" when you can:
1. Create a new trip called "Barcelona → Oslo"
2. Add stops with different types (base camp in Bergen, waypoint in Hamburg, ferry from Hirtshals)
3. See all stops on the map with a route line
4. Open Claude chat and say "Add a photography stop somewhere between Lyon and Geneva with good mountain views"
5. See Claude add the stop and have it appear on the map immediately
6. Reorder stops by dragging in the timeline
7. Export nothing — just have a clear view of your trip that you can reference while planning

---

## Notes for Implementation

- Keep components small and focused
- Avoid premature abstraction — duplicate code is fine until patterns emerge
- No state management library needed — React state + server state is sufficient
- Test with real trip data early (Barcelona → Oslo)
- Claude tool responses should trigger UI refresh automatically
