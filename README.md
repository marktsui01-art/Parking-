# 2D Kinematic Parking Simulator

A browser-based 2D parking simulator built on real-scale **Ackermann steering geometry**, **Separating Axis Theorem (SAT)** collision detection, an **Autonomous Hybrid A\* + Reeds-Shepp Auto-Park Planner**, and a **procedural Web Audio engine synthesizer**.

---

## Features

- **Realistic Bicycle Kinematics & Scale (`20 px = 1 m`):** Play inside an `800×600` world (`40 m × 30 m`) with asymmetric front/rear overhangs, steering-angle limits, drag, and stationary win checks.
- **10 Real-World Scaled Vehicles:** From the nimble `2.52 m` Microlino 2.0 EV to the `5.00 m` Toyota Land Cruiser 300 with a `30°` lock.
- **15 Handcrafted Levels:** Progress from open bays and basic alleys through parallel squeezes, constrained 90° rear-entry and end-of-aisle stalls, a spiral garage ramp, an underground Parkhaus, and a multi-bend tight 90° car park.
- **Auto-Park From Anywhere:** Click **🤖 Auto-Park Demo** mid-level (even while rolling or parked close to a wall) to plan and execute a collision-free Reeds-Shepp / Hybrid A\* parking trajectory at 60 Hz with path & gear-shift visualization.
- **Procedural Engine Audio:** Each car synthesizes its engine sound in real time with zero pre-recorded audio files — driven by a 60 Hz parking drivetrain (clutch flare, braking vs. reverse detection, idle hunting) and a subtractive formant synthesizer (`ModularAudioEngine`), plus an optional **Engine Sound** override in the menu.
- **Replay & In-Game Level Editor:** Record and reload `.json` driving replays, click any obstacle/target/start pose mid-level to inspect or tweak coordinates live, and copy updated level JSON.

---

## Quick Start

```bash
npm install
npm start
```

Then open:
- **Parking Simulator Game:** `http://localhost:8080/index.html`
- **Modular DSP Audio Workbench:** `http://localhost:8080/src/modular_tuner.html`

### Controls

| Input | Action |
| :--- | :--- |
| `W` / `ArrowUp` | Throttle forward (or brake while reversing) |
| `S` / `ArrowDown` | Brake while rolling forward / Reverse when stopped |
| `A` / `ArrowLeft` & `D` / `ArrowRight` | Steer left / right |
| **Gamepad** | Left stick = steering, `RT` = throttle, `LT` = brake/reverse |
| **Click Level Object** *(while playing)* | Open in-game level editor for obstacles, target bay, or start pose |

*Winning condition:* Bring the car completely inside the green target box at near-zero velocity with steering and throttle released. Colliding with walls or parked cars deducts `50` points from the starting `1000` score.

---

## Vehicle Roster

| Key | Vehicle | Size (`L × W`) | Max Steer | Top Speed | Engine Sound Preset |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `m3_g80` | BMW M3 (G80) | `4.79 m × 1.90 m` | `40°` | `63.0 km/h` | `inline_6_m3` *(S58 3.0L Inline-6)* |
| `g31_xdrive` | BMW G31 xDrive (5 Series Touring) | `4.94 m × 1.87 m` | `35°` | `55.8 km/h` | `inline_6_touring` *(Smooth Inline-6)* |
| `e91_touring` | BMW E91 (3 Series Touring) | `4.52 m × 1.82 m` | `42°` | `57.6 km/h` | `inline_6_touring` *(Smooth Inline-6)* |
| `mini_5d` | Mini Cooper 5-Door (2019) | `4.01 m × 1.73 m` | `40°` | `48.6 km/h` | `inline_4_sport` *(16V Sport I4)* |
| `jazz_mk1` | Honda Jazz (Mk1 2000) | `3.83 m × 1.68 m` | `42°` | `43.2 km/h` | `inline_4_sport` *(16V Sport I4)* |
| `civic_eg` | Honda Civic (EG Generation) | `4.07 m × 1.70 m` | `38°` | `52.2 km/h` | `civic_vtec_b16` *(B16A DOHC VTEC)* |
| `cayman_987` | Porsche Cayman (987.2 S) | `4.35 m × 1.80 m` | `35°` | `61.2 km/h` | `boxer_6_cayman` *(987.2 Flat-6)* |
| `microlino` | Microlino 2.0 | `2.52 m × 1.47 m` | `45°` | `18.0 km/h` | `ev_microlino` *(Electric Traction Drive)* |
| `jimny` | Suzuki Jimny (JB74) | `3.65 m × 1.65 m` | `35°` | `37.8 km/h` | `inline_4_sport` *(16V Sport I4)* |
| `landcruiser_300` | Toyota Land Cruiser 300 | `5.00 m × 1.99 m` | `30°` | `45.0 km/h` | `v8_crossplane` *(Cross-Plane V8)* |

*(Bonus sound presets selectable in the **Engine Sound** dropdown: **Dodge Viper V10** `dodge_viper_v10` and **F1 Golden Era V10** `f1_golden_era_v10`.)*

---

## Levels Guide

| # | Level | Challenge |
| :---: | :--- | :--- |
| 1 | **Level 1: The Basics** | Straight open-lot entry |
| 2 | **Level 2: The Alley** | Navigate a long narrow corridor |
| 3 | **Level 3: Parallel Park** | Standard parallel bay with plenty of swing room |
| 4 | **Realistic 90° Parking** | `2.5 m × 5.5 m` stall between two parked cars |
| 5 | **Realistic Parallel Park** | `7.0 m` curbside gap between expensive neighbors |
| 6 | **Level 6: Hardcore Parallel** | `6.5 m` gap off a tight `3.6 m` two-way street |
| 7 | **Level 7: The Spiral** | Multi-story garage ramp loop into a top-row perpendicular stall |
| 8 | **Level 8: 45° Squeeze** | Diagonal one-way bay requiring clean reverse alignment |
| 9 | **Level 9: Constrained 90°** | `2.5 m` stall (`2.9 m` car-to-car gap) off a `4.3 m` aisle — requires pulling past & backing in |
| 10 | **Level 10: Long Spot, Tight Road** | Generous `6.2 m` parallel pocket off a tight `2.6 m` lane |
| 11 | **Level 11: Tight Spot, Wide Road** | Razor-tight `5.4 m` parallel gap with `5.0 m` street width |
| 12 | **Level 12: Elite Challenge** | `5.4 m` parallel spot off a `3.0 m` lane — minimal clearance front and rear |
| 13 | **Level 13: Underground Parkhaus** | Pillar chicane, hairpin ramp, and column-flanked dead-end bay |
| 14 | **Level 14: Tight 90° Car Park** | Four `4.5 m` 90° bends into a `3.0 m` approach lane and wide `3.9 m` 90° bay |
| 15 | **Level 15: End-of-Aisle 90°** | Dead-end `2.5 m` stall off a `5.6 m` aisle — forward park or reverse down from the entry cross-aisle |

---

## Autonomous Parking Planner & CLI

The planner ([`src/planner/`](./src/planner/)) pairs an exact OBB `CollisionChecker`, a `HeuristicGrid` (holonomic 2D BFS + Reeds-Shepp distance), bidirectional **Hybrid A\*** with a tight-bay escape funnel, and a closed-loop pure-pursuit + PID speed `ReplayCompiler`:

```bash
# Solve all 15 levels headlessly and verify zero-crash 1000-score replays
node scripts/solve_level.js --solve --level all --car m3_g80
node scripts/solve_level.js --solve --level all --car g31_xdrive

# Solve a specific level (0-indexed) and export a replay JSON
node scripts/solve_level.js --solve --level 13 --car landcruiser_300 --out /tmp/l14_lc.json

# Verify or optimize an existing replay file
node scripts/solve_level.js /tmp/l14_lc.json
```

---

## Procedural Engine Sound Synthesis

Rather than looping pre-recorded samples, the game synthesizes engine audio in real time through a 3-stage pipeline:

1. **60 Hz Parking Drivetrain ([`src/Drivetrain.js`](./src/Drivetrain.js)):** Separates foot-braking from Reverse acceleration, models low-speed clutch flare (`0–55 px/s`), applies asymmetric flywheel inertia, scales Reverse gear ratio (`1.15×`), tracks overrun deceleration, and adds shared-crankshaft idle micro-hunting.
2. **Modular Subtractive Formant Synth ([`src/ModularAudioEngine.js`](./src/ModularAudioEngine.js)):** Combines `0`-detune crankshaft-locked harmonic orders (`triangle` sub/bank orders, `sawtooth` primary firing core, and convex $u_{\text{RPM}}^\gamma$-gated upper zing) with pre-waveshaper brown/pink gas turbulence inside a `soft_tanh` shaper, a short inverting exhaust-pipe waveguide delay, wide-$Q$ chest/body formants, and a cascaded `-24 dB/oct` Butterworth low-pass + safety compressor limiter.
3. **Interactive DSP Workbench ([`src/modular_tuner.html`](./src/modular_tuner.html)):** Patch nodes visually, switch live A/B snapshots, inspect real-time FFT spectrum & composite filter transfer curves, and profile presets with `scripts/measure_histograms.mjs`.

For the full first-principles DSP physics curriculum, acoustic case studies, and printable PDFs, see **[`docs/README.md`](./docs/README.md)**.

---

## Testing & Project Structure

```bash
# Run all Jest unit tests (Physics, Collision, Reeds-Shepp, Planner, Drivetrain & Audio)
npm test

# Run Playwright browser E2E tests
npm run test:e2e
```

```text
.
├── index.html                  # Game entry point & UI
├── src/
│   ├── GameEngine.js           # Vehicle specs (CAR_MODELS), Ackermann physics, SAT & win rules
│   ├── levels.js               # 14 parking level definitions
│   ├── Drivetrain.js           # 60 Hz clutch flare, gear, braking, and flywheel RPM/load model
│   ├── ModularAudioEngine.js   # Real-time Web Audio node graph synth & calibrated car presets
│   ├── GameAudioController.js  # Bridges GameEngine, Drivetrain & ModularAudioEngine (+ overrides/mute)
│   ├── main.js                 # Game loop, UI wiring, replay & Auto-Park controls
│   ├── CanvasRenderer.js       # 2D canvas car, obstacle, and planned-path overlay rendering
│   ├── modular_tuner.html      # Modular DSP Audio Workbench UI
│   └── planner/                # Hybrid A*, Reeds-Shepp, HeuristicGrid, CollisionChecker, ReplayCompiler
├── scripts/
│   ├── solve_level.js          # Headless CLI solver & replay verifier/optimizer
│   └── measure_histograms.mjs  # Playwright live Web Audio 16k-FFT & warble profiler
├── docs/                       # Two-chapter procedural engine audio guide, diagrams & PDFs
└── tests/
    ├── unit/                   # Jest unit suites (game, planner, audio, reeds-shepp, performance)
    └── e2e/                    # Playwright browser tests
```
