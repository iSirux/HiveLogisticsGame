# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hive Logistics is a browser-based logistics game where you guide a bee colony on a hex grid. Players use indirect controls (pheromones, role ratios) to manage autonomous bee agents that forage, build, and expand the hive. Pure TypeScript + Canvas 2D with zero runtime dependencies.

## Commands

```bash
npm run dev        # Start Vite dev server with HMR
npm run build      # TypeScript compile + Vite production build
npm run preview    # Preview production build locally
npm test           # Run tests once (vitest run)
npm run test:watch # Run tests in watch mode (vitest)
```

Vitest is configured for testing. No linter or formatter is configured.

## Architecture

**Systems-based simulation with fixed-timestep game loop.**

The game runs at 10 TPS (ticks per second) using an accumulator pattern. Rendering is decoupled from simulation via interpolation (`tickAlpha`). Systems execute each tick in this order:

1. **Foraging** — Runs bee AI state machines (`beeAI.ts`)
2. **Lifecycle** — Energy drain (flying/working/idle), aging, death from old age
3. **Movement** — Advances bees along hex paths, wing animation
4. **Hive** — Nectar→honey conversion, pollen→bee bread, brood hatching, wax production
5. **Pheromones** — Decay pheromone values
6. **DayNight** — Advance time-of-day, flower regrowth
7. **Exploration** — Scout fog-of-war revelation

**Key source layout:**

- `src/types.ts` — All interfaces and enums (single source of truth for data shapes)
- `src/constants.ts` — All tuning parameters (costs, rates, capacities, weights)
- `src/game.ts` — Game loop orchestrator, wires together all subsystems, autosave every 300 ticks
- `src/world/world.ts` — Central state container (grid, bees, resources, settings, version counters)
- `src/world/worldGen.ts` — World generation with biomes (Meadow radius 12, Forest radius 22)
- `src/entities/beeAI.ts` — Bee autonomy: state machines with role-specific behavior and scoring heuristics
- `src/hex/` — Flat-top hex math (axial coords), HexGrid backed by `Map<string, HexCell>`
- `src/systems/` — Pure-ish update functions that mutate World state each tick
- `src/rendering/` — Canvas 2D renderer with camera (pan/zoom), visibility culling, LOD, fog of war
- `src/rendering/minimap.ts` — Minimap with terrain colors, fog, bee positions, click-to-pan
- `src/ui/uiManager.ts` — Binds HTML HUD elements to world state (role sliders, bee list, speed controls)
- `src/input/inputHandler.ts` — Mouse, touch, pinch-zoom, right-click pan, pheromone drag painting
- `src/audio/audioManager.ts` — Procedural Web Audio API sounds (no audio files)
- `src/storage/saveManager.ts` — localStorage-based save/load with slot management and autosave

**State lives in World.** Systems read/write world state directly. Rendering reads world state + interpolation alpha. No event bus or ECS framework — just typed functions operating on shared data. Version counters (`terrainVersion`, `explorationVersion`) drive minimap cache invalidation.

## Hex Grid

Flat-top hexagons using axial coordinates (q, r). HEX_SIZE = 28px outer radius. The grid is stored as `Map<string, HexCell>` keyed by `"q,r"`. Use `hexKey()`, `hexToPixel()`, `pixelToHex()`, `hexNeighbors()` from `src/hex/hex.ts`. HexGrid has query helpers: `cellsOfType(terrain)`, `waystationCells()`, `hiveCells()`.

## Bee AI

Five roles: **Forager**, **Nurse**, **Builder**, **Scout**, **Hauler**. Each has a role-specific state machine (see `BeeState` enum in `types.ts`). All roles share a hunger interrupt — when energy drops below 30%, bees seek honey and eat.

- **Foragers** score flowers by distance, pheromone, nectar, pollen, and waystation proximity. Can deposit at nearest waystation or hive.
- **Scouts** explore unexplored hexes to reveal fog of war, then waggle dance at hive to reveal target area.
- **Haulers** pick up resources from waystations and transport them back to hive.
- **Nurses** tend brood and process nectar.
- **Builders** idle at hive, ready for player-initiated build commands.

Role reassignment is driven by player-set ratios in `WorldSettings` (forager, nurse, scout, hauler sliders; builder is the remainder). At night all bees return to hive.

## Key Mechanics

- **Energy & lifespan** — Bees drain energy while flying/working/idle. Mean lifespan ~60,000 ticks. Death from old age tracked via `deathCount`.
- **Fog of war** — Hexes start unexplored. Only hive area (radius 4) is initially revealed. Scouts reveal with vision radius 3; waggle dance reveals radius 4.
- **Waystations** — Buildable intermediate storage (nectar capacity 1.5, pollen 1). Enable multi-step logistics chains with haulers.
- **Save/load** — Full world state serialized to localStorage. Autosave every 300 ticks. Auto-loads latest save on start.
- **Speed controls** — Pause (0x), 1x, 2x, 3x simulation speed multipliers.

## Current Scope

Implemented: hex grid, single hive, 5 bee roles, foraging loop, nectar→honey→wax chain, pollen→bee bread, building cells (including waystations), brood hatching, pheromone painting, role sliders, day/night cycle, fog of war, minimap, energy/lifespan system, save/load, touch support. See `DESIGN.md` for the full vision including seasons, threats, and rival hives.
