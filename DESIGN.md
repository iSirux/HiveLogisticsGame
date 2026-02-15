# Hive Logistics — Game Design Document

## Overview

A logistics management game where you guide a bee colony on an infinite hex grid. Direct autonomous bee workers through pheromone-based controls, manage resource supply chains, and expand your hive. Built as a web app prioritizing fast iteration, procedural audio/visuals, and emergent gameplay.

---

## Core Fantasy

You are the intelligence of the hive — not micromanaging individual bees, but shaping collective behavior. Your bees are autonomous agents following simple rules. You influence them by painting pheromone signals, setting priorities, and building infrastructure. Success emerges from good logistics, not fast clicks.

---

## Core Loop

```
Scout → Discover → Assign → Extract → Transport → Process → Build → Expand
```

1. **Scout** — Send scouts to reveal fog-of-war hexes and discover resource patches.
2. **Discover** — Scouts return and perform a waggle dance, marking patch locations.
3. **Assign** — Set pheromone zones and role priorities to direct workforce.
4. **Extract** — Foragers fly to patches, collect raw resources.
5. **Transport** — Bees carry resources back to hive along pheromone trails.
6. **Process** — Raw resources are converted inside hive cells (nectar → honey).
7. **Build** — Spend processed resources to construct new comb, hatch bees, upgrade.
8. **Expand** — Push further out, discover new biomes, manage longer supply chains.

**Central tension:** the further you expand, the longer your supply chains, the more bees tied up in transit, and the more vulnerable your routes become.

---

## Resources

### Raw Resources (gathered from the world)

| Resource | Source        | Gathering                                           |
| -------- | ------------- | --------------------------------------------------- |
| Nectar   | Flowers       | Foragers visit blooming flower patches              |
| Pollen   | Flowers       | Collected alongside nectar, separate carry capacity |
| Resin    | Trees         | Slower extraction, requires dedicated foragers      |
| Water    | Ponds/streams | Carried in small quantities, evaporates over time   |

### Processed Resources (produced inside the hive)

| Resource    | Input                 | Process                      | Used For                         |
| ----------- | --------------------- | ---------------------------- | -------------------------------- |
| Honey       | Nectar                | Evaporation in storage cells | Universal currency, food, energy |
| Bee Bread   | Pollen                | Fermentation in comb cells   | Larvae feeding, bee production   |
| Propolis    | Resin                 | Mixing by builders           | Hive defense, sealing, repairs   |
| Wax         | Honey (self-produced) | Worker metabolism            | Building new comb cells          |
| Royal Jelly | Honey + Pollen        | Nurse bee production         | Queen upgrades, special units    |

### Resource Properties

- **Carry weight** — bees have limited carry capacity, some resources are heavier.
- **Spoilage** — water evaporates, nectar ferments if not processed in time.
- **Storage** — each comb cell holds one resource type with a max quantity.

---

## The Hex Grid

### World Generation

Infinite hex grid generated procedurally in chunks. The hive starts at the center.

### Hex Types

| Type        | Description                                          |
| ----------- | ---------------------------------------------------- |
| **Hive**    | Player-built comb cells (interior)                   |
| **Flowers** | Resource patches — bloom and deplete, regrow over time |
| **Trees**   | Resin sources — slow yield but persistent            |
| **Water**   | Ponds, streams — water collection                    |
| **Grass**   | Empty, traversable                                   |
| **Rock**    | Impassable obstacle                                  |
| **Danger**  | Pesticide zones — high yield but damages bees        |

### Biome Rings

Terrain shifts as distance from hive increases:

1. **Meadow** (near) — abundant flowers, safe, moderate yield
2. **Garden** — cultivated flowers, high yield, some pesticide risk
3. **Forest** — resin-rich, less nectar, predator habitat
4. **Wetland** — water-abundant, unique flowers, flood risk
5. **Urban fringe** — sparse resources, high danger, rare finds

### Fog of War

Hexes beyond explored range are hidden. Scouts reveal them. Revealed hexes stay visible but resource state can change (flowers deplete, seasons shift).

---

## Bee System

### Roles

| Role        | Function                                               | Priority               |
| ----------- | ------------------------------------------------------ | ---------------------- |
| **Scout**   | Explores unknown hexes, discovers resource patches     | Low count, high value  |
| **Forager** | Flies to patches, extracts raw resources, carries back | Bulk of workforce      |
| **Hauler**  | Relay transport — carries between depots               | Unlocked later         |
| **Nurse**   | Tends larvae, feeds brood, produces royal jelly        | Scales with brood size |
| **Builder** | Constructs new comb cells, repairs damage              | On-demand              |
| **Guard**   | Defends hive entrance and patrol zones                 | Scales with threats    |

### Bee Properties

- **Energy** — depletes during flight/work, restored by eating honey.
- **Age** — bees have a lifespan. Young bees start as nurses, transition to foragers.
- **Carry capacity** — how much resource a bee can transport per trip.
- **Speed** — flight speed, affected by load and weather.
- **Health** — reduced by pesticides, combat, disease.

### Autonomy Model

Bees are **autonomous agents** that make local decisions based on:

1. **Pheromone gradients** — player-painted signals that attract/repel bees.
2. **Role assignment** — global ratios (e.g., 60% forager, 20% nurse, 10% builder, 10% guard).
3. **Proximity** — bees prefer nearby tasks over distant ones.
4. **Need** — hungry bees eat, tired bees rest, hive needs trigger role switches.

**Player controls are indirect:**

- Paint pheromone attract/repel zones on the hex grid.
- Set global role allocation percentages.
- Designate priority resource patches (stronger pheromone signal).
- Place waypoints / relay depots to shape routes.
- Build hive structures that passively influence behavior.

Bees should feel alive — slightly imperfect, emergent, occasionally surprising.

---

## Hive Interior

The hive is built on the same hex grid as the world. Each hex inside the hive is a **comb cell** with a type:

### Cell Types

| Cell                | Function                                              |
| ------------------- | ----------------------------------------------------- |
| **Honey Storage**   | Stores processed honey                                |
| **Pollen Storage**  | Stores pollen / bee bread                             |
| **Brood Cell**      | Egg → larva → pupa → adult bee                        |
| **Processing Cell** | Converts nectar → honey (evaporation)                 |
| **Royal Chamber**   | Queen resides here, lays eggs in adjacent brood cells |
| **Entrance**        | Hive entry/exit point, guards station here            |
| **Wax Cap**         | Sealed storage (long-term preservation)               |

### Layout Matters

- **Brood cells** work best near the center (warmth from clustering bees).
- **Honey storage** on the perimeter (insulation).
- **Processing cells** need airflow — adjacent empty cells act as ventilation.
- **Adjacency bonuses** — same-type clusters are more efficient.
- **Entrance placement** affects traffic flow and defense chokepoints.

---

## Threats & Challenges

### Predators

| Threat      | Behavior                                              |
| ----------- | ----------------------------------------------------- |
| **Wasps**   | Raid foragers on routes, steal from unguarded patches |
| **Hornets** | Assault hive entrance, kill bees, steal honey         |
| **Birds**   | Pick off isolated foragers in open hexes              |

### Environmental

| Threat              | Effect                                       |
| ------------------- | -------------------------------------------- |
| **Rain**            | Grounds all foragers, reduces visibility     |
| **Cold snap**       | Bees cluster for warmth, no outdoor activity |
| **Drought**         | Water sources dry up, flowers wilt early     |
| **Pesticide drift** | Random hexes become toxic for a period       |

### Disease

| Threat           | Effect                                              |
| ---------------- | --------------------------------------------------- |
| **Varroa mites** | Spread through brood, weaken new bees               |
| **Nosema**       | Reduces forager efficiency, spreads via shared food |
| **Foulbrood**    | Kills larvae, must destroy infected comb cells      |

---

## Logistics Mechanics

### The Core Challenge

Moving resources efficiently from distant patches back to the hive.

### Route Optimization

- Pheromone trails strengthen with use (bees follow popular paths).
- But popular paths cause congestion (bees slow down in dense traffic).
- Player can paint pheromone highways to spread traffic across parallel routes.

### Relay Depots

Unlockable outpost structures placed on field hexes:

- **Waystation** — small cache where foragers drop off, haulers pick up.
- **Satellite hive** — mini-hive that can do basic processing closer to patches.

This creates a hub-and-spoke logistics network as you expand.

### Supply Chain Depth

```
Flower → [Forager carries nectar] → Hive/Depot
  → [Processing cell converts] → Honey
    → [Stored in comb] → Available for building/feeding
      → [Builder uses wax] → New comb cell
```

Multiple conversion steps = more things that can bottleneck.

---

## Progression

### Early Game

- Small hive, ~20 bees, queen + starter comb.
- Discover nearby flowers, set up first foraging routes.
- Build basic honey storage, first brood cycle.
- Learn pheromone controls.

### Mid Game

- Expand to multiple resource patches across biomes.
- Set up relay depots for distant patches.
- Manage role allocation as colony grows to hundreds of bees.
- First predator encounters, build defenses.

### Late Game

- Massive colony, thousands of bees, complex supply networks.
- Multiple satellite hives.
- Competing with rival hives for territory.
- Managing disease outbreaks, severe weather events.
- Optimize for efficiency — the logistics puzzle deepens.

### Upgrades (via Royal Jelly / Research)

- Longer bee lifespan
- Greater carry capacity
- Faster processing
- New cell types
- Pheromone range/strength
- Scout reveal radius
- Weather resistance

---

## Controls & UI

### Camera

- **Top-down 2D** with smooth zoom from colony-wide to individual-bee level.
- Hex grid always visible, snaps to grid for building.

### Primary Interactions

- **Click hex** — inspect, build, assign.
- **Paint mode** — drag to paint pheromone attract/repel zones.
- **Role panel** — sliders for global role allocation.
- **Priority flags** — click resource patches to mark priority.
- **Build mode** — place comb cell types inside hive.
- **Time controls** — pause, 1x, 2x, 3x speed.

### Information Display

- Resource counters (honey, pollen, resin, water, wax).
- Population counter with role breakdown.
- Time-of-day indicator.
- Minimap showing explored territory.
- Overlay toggles: pheromone density, traffic heat map, resource heatmap.

---

## Visual Style

### Aesthetic

- Clean, readable hex grid with soft natural colors.
- Warm golds/ambers for hive, greens/blues for world.
- Bees as simple animated sprites — visible individually when zoomed, particles when zoomed out.
- Pheromone trails as translucent colored overlays.

### Procedural Graphics

- Hex cells: fill level shown via color saturation/height.
- Flowers: procedural petal generation, wilt animation.
- Weather: shader overlays (rain streaks, fog, snow).
- Day/night cycle: warm gold → cool blue color shift.

### Procedural Audio

- **Base buzz** — always present, amplitude scales with visible bee count.
- **Individual bee sounds** — detuned oscillators, Doppler as they fly past.
- **Waggle dance** — rhythmic buzzing pattern when scout reports.
- **Rain** — filtered noise, muffles other sounds.
- **Building** — crunchy wax sounds.
- **Alert** — distinct tone for threats, starvation warnings.
- **Ambience** — background environmental sounds shifting with time of day.

---

## Tech Stack

### Core

- **Platform:** Web app (browser-based)
- **Rendering:** HTML Canvas 2D or WebGL (evaluate based on sprite count)
- **Language:** TypeScript
- **Build:** Vite (HMR for fast iteration)
- **State:** ECS (Entity-Component-System) for bee agents and hex grid
- **Audio:** Web Audio API for procedural sound synthesis

### Architecture Priorities

1. **Development speed** — hot reload, fast feedback loop.
2. **Performance** — thousands of autonomous agents updating each tick.
3. **Modularity** — systems (rendering, simulation, audio) decoupled for iteration.

### Key Technical Challenges

- **Agent simulation at scale** — spatial hashing, LOD for off-screen bees.
- **Infinite hex grid** — chunk-based loading/generation, efficient storage.
- **Pathfinding** — A\* on hex grid with pheromone-weighted costs, cached paths.
- **Procedural audio** — real-time synthesis without lag spikes.

---

## MVP Scope

The minimum playable version to validate the core loop:

1. Hex grid rendering with camera pan/zoom.
2. Single hive with honey storage and brood cells.
3. Flower patches that contain nectar.
4. Bees that autonomously forage (fly to flowers, carry nectar back).
5. Nectar → honey processing.
6. Build new comb cells with wax.
7. Hatch new bees from brood cells.
8. Basic pheromone painting (attract zone).
9. Role allocation slider (forager vs nurse vs builder).
10. Simple day cycle (bees return at night).

**Cut from MVP:** threats, disease, depots, fog of war, rival hives, upgrades.

---

## Open Questions

- **Multiplayer?** — cooperative hive management or competitive rival hives?
- **Procedural generation seed** — shareable seeds for challenge runs?
- **Difficulty modes** — or purely emergent difficulty from expansion choices?
- **Mobile support** — touch controls viable for pheromone painting?
- **Narrative** — purely sandbox, or light story/objectives?
