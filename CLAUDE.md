# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hive Logistics is a browser-based logistics game where you guide a bee colony on a hex grid. Players use indirect controls (pheromones, role ratios) to manage autonomous bee agents that forage, build, and expand the hive. Pure TypeScript + Canvas 2D with zero runtime dependencies.

## Commands

```bash
npm run dev       # Start Vite dev server with HMR
npm run build     # TypeScript compile + Vite production build
npm run preview   # Preview production build locally
```

No test framework, linter, or formatter is configured.

## Architecture

**Systems-based simulation with fixed-timestep game loop.**

The game runs at 10 TPS (ticks per second) using an accumulator pattern. Rendering is decoupled from simulation via interpolation (`tickAlpha`). Systems execute each tick in this order:

1. **Foraging** — Runs bee AI state machines (`beeAI.ts`)
2. **Movement** — Advances bees along hex paths
3. **Hive** — Nectar→honey conversion, brood hatching, passive wax production
4. **Pheromones** — Decay pheromone values
5. **DayNight** — Advance time-of-day, flower regrowth

**Key source layout:**

- `src/types.ts` — All interfaces and enums (single source of truth for data shapes)
- `src/constants.ts` — All tuning parameters (costs, rates, capacities, weights)
- `src/game.ts` — Game loop orchestrator, wires together all subsystems
- `src/world/world.ts` — Central state container (grid, bees, resources, settings)
- `src/entities/beeAI.ts` — Bee autonomy: state machines with role-specific behavior and scoring heuristics
- `src/hex/` — Flat-top hex math (axial coords), HexGrid backed by `Map<string, HexCell>`
- `src/systems/` — Pure-ish update functions that mutate World state each tick
- `src/rendering/` — Canvas 2D renderer with camera (pan/zoom), visibility culling, LOD for bees
- `src/ui/uiManager.ts` — Binds HTML HUD elements to world state
- `src/audio/audioManager.ts` — Procedural Web Audio API sounds (no audio files)

**State lives in World.** Systems read/write world state directly. Rendering reads world state + interpolation alpha. No event bus or ECS framework — just typed functions operating on shared data.

## Hex Grid

Flat-top hexagons using axial coordinates (q, r). HEX_SIZE = 28px outer radius. The grid is stored as `Map<string, HexCell>` keyed by `"q,r"`. Use `hexKey()`, `hexToPixel()`, `pixelToHex()`, `hexNeighbors()` from `src/hex/hex.ts`.

## Bee AI

Bees are autonomous agents with roles (Forager, Nurse, Builder) and state machines (see `BeeState` enum). Foragers use a scoring function (distance, pheromone, nectar, jitter) to pick flowers. At night all bees return to hive. Role reassignment is driven by player-set ratios in `WorldSettings`.

## MVP Scope

Current implementation covers: hex grid, single hive, foraging loop, nectar→honey→wax chain, building cells, brood hatching, pheromone painting, role sliders, day/night cycle. See `DESIGN.md` for the full vision including seasons, threats, fog of war, and rival hives.
