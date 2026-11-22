import { GameEngine } from '../GameEngine.js';
import { Vector2 } from '../Vector2.js';
import { normalizeAngle } from './ReedsShepp.js';

const FIXED_STEP = 1 / 60;

function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Simulates smooth braking from a live initial state to rest without teleporting.
 * Tries preserving current steering first, then straight-wheel braking if turning grazes.
 *
 * @param {object} level
 * @param {object} carSpec
 * @param {{ x: number, y: number, heading: number, velocity?: number, steerAngle?: number }} initialState
 * @returns {{ prefixInputs: Array<{ steer: number, throttle: number }>, stoppedPose: { x: number, y: number, heading: number }, crashedDuringBrake: boolean }}
 */
export function computeBrakingPrefix(level, carSpec, initialState) {
    const startHeading = normalizeAngle(initialState.heading || 0);
    const vel0 = initialState.velocity || 0;

    if (Math.abs(vel0) < 0.1) {
        return {
            prefixInputs: [],
            stoppedPose: { x: initialState.x, y: initialState.y, heading: startHeading },
            crashedDuringBrake: false
        };
    }

    const holdSteer = clamp((initialState.steerAngle || 0) / carSpec.maxSteerAngle, -1, 1);
    const steerModes = Math.abs(holdSteer) > 1e-4 ? [holdSteer, 0] : [0];

    for (const steer of steerModes) {
        const engine = new GameEngine();
        engine.applyCarModel(carSpec);
        engine.loadLevel(level);
        engine.pos = new Vector2(initialState.x, initialState.y);
        engine.heading = startHeading;
        engine.velocity = vel0;
        engine.steerAngle = initialState.steerAngle || 0;

        const prefixInputs = [];
        let crashed = false;

        for (let f = 0; f < 120; f++) {
            if (Math.abs(engine.velocity) < 0.1) break;
            const prevTimer = engine.crashTimer;
            const prevVel = engine.velocity;
            const prevX = engine.pos.x;
            const prevY = engine.pos.y;
            const throttle = clamp(-engine.velocity / (engine.acceleration * FIXED_STEP), -1, 1);
            const inp = { steer, throttle };
            prefixInputs.push(inp);
            engine.update(FIXED_STEP, inp);

            const expectedVel = prevVel + throttle * engine.acceleration * FIXED_STEP;
            if (
                engine.crashTimer > prevTimer ||
                (Math.abs(expectedVel) > 0.05 && engine.velocity === 0 && engine.pos.x === prevX && engine.pos.y === prevY)
            ) {
                crashed = true;
                break;
            }
        }

        if (!crashed && Math.abs(engine.velocity) < 0.1) {
            return {
                prefixInputs,
                stoppedPose: {
                    x: engine.pos.x,
                    y: engine.pos.y,
                    heading: normalizeAngle(engine.heading)
                },
                crashedDuringBrake: false
            };
        }
    }

    return {
        prefixInputs: [],
        stoppedPose: { x: initialState.x, y: initialState.y, heading: startHeading },
        crashedDuringBrake: true
    };
}

/**
 * Splits dense waypoints into contiguous same-gear phases with cumulative arc length s.
 */
function splitPhases(waypoints) {
    const phases = [];
    if (!waypoints || waypoints.length === 0) return phases;

    let current = [];
    let currentDir = waypoints[0].dir;
    let s = 0;

    for (let i = 0; i < waypoints.length; i++) {
        const wp = waypoints[i];
        if (wp.dir !== currentDir && current.length > 0) {
            phases.push({ dir: currentDir, points: current, totalLength: s });
            current = [];
            currentDir = wp.dir;
            s = 0;
        }
        if (current.length > 0) {
            const prev = current[current.length - 1];
            s += Math.hypot(wp.x - prev.x, wp.y - prev.y);
        }
        current.push({ ...wp, s });
    }

    if (current.length > 0) {
        phases.push({ dir: currentDir, points: current, totalLength: s });
    }

    return phases;
}

/**
 * Computes lateral steering command for a given trajectory phase point.
 */
function computeSteerCommand(engine, phase, idx, dir) {
    const pts = phase.points;
    const wp = pts[idx];
    const cosH = Math.cos(wp.heading);
    const sinH = Math.sin(wp.heading);

    // Cross-track error along right-hand normal (-sinH, cosH)
    const eCt = (engine.pos.x - wp.x) * (-sinH) + (engine.pos.y - wp.y) * cosH;
    const eTheta = normalizeAngle(wp.heading - engine.heading);

    // Average local curvature slightly ahead to anticipate arc transitions
    let kappaSum = 0;
    let count = 0;
    for (let k = idx; k <= Math.min(pts.length - 1, idx + 2); k++) {
        kappaSum += pts[k].kappa;
        count++;
    }
    const kappaRef = kappaSum / count;

    // Critically damped kinematic path tracker (validated for both dir = +1 and dir = -1)
    const kappaCmd = kappaRef + dir * 0.14 * eTheta - 0.0045 * eCt;
    return clamp(Math.atan(engine.wheelBase * kappaCmd) / engine.maxSteerAngle, -1, 1);
}

/**
 * Runs closed-loop zero-overshoot tracking across all phases at a specific base cruise speed.
 */
function simulateTrajectory(plan, level, carSpec, baseCruise, options = {}) {
    const engine = new GameEngine();
    engine.applyCarModel(carSpec);
    engine.loadLevel(level);

    if (options.initialState) {
        engine.pos = new Vector2(options.initialState.x, options.initialState.y);
        engine.heading = options.initialState.heading || 0;
        engine.velocity = options.initialState.velocity || 0;
        engine.steerAngle = options.initialState.steerAngle || 0;
    }

    const phases = plan.alreadyInside ? [] : splitPhases(plan.waypoints);
    const inputs = [];
    let crashCount = 0;

    const pushFrame = (steer, throttle) => {
        const input = { steer, throttle };
        inputs.push(input);
        const prevTimer = engine.crashTimer;
        engine.update(FIXED_STEP, input);
        if (engine.crashTimer > prevTimer) {
            crashCount++;
        }
    };

    const prefixInputs = options.prefixInputs || [];
    for (let i = 0; i < prefixInputs.length; i++) {
        pushFrame(prefixInputs[i].steer, prefixInputs[i].throttle);
        if (crashCount > 0 || engine.won) break;
    }

    let lastSteer = prefixInputs.length > 0 ? prefixInputs[prefixInputs.length - 1].steer : 0;

    for (let pIdx = 0; pIdx < phases.length && crashCount === 0 && !engine.won; pIdx++) {
        const phase = phases[pIdx];
        const pts = phase.points;
        const dir = phase.dir;

        if (pts.length === 0) continue;

        const phaseCruise = phase.totalLength < 20 ? Math.min(baseCruise, 18) : baseCruise;

        // Smooth stationary steering alignment before shifting gears on subsequent phases
        const initialSteer = computeSteerCommand(engine, phase, 0, dir);
        if (pIdx > 0) {
            const turnFrames = 10;
            for (let f = 1; f <= turnFrames; f++) {
                const alpha = f / turnFrames;
                const steer = lastSteer + (initialSteer - lastSteer) * alpha;
                pushFrame(steer, 0);
                if (crashCount > 0) return { won: false, score: engine.score, crashCount, inputs };
            }
        }

        let idx = 0;
        const aBrake = 0.45 * engine.acceleration;
        const maxPhaseFrames = Math.max(300, Math.ceil((phase.totalLength / Math.max(8, phaseCruise) + 4.0) * 60));

        for (let frame = 0; frame < maxPhaseFrames; frame++) {
            // Advance monotonic waypoint index within local search window
            let bestIdx = idx;
            let bestDistSq = Infinity;
            const searchEnd = Math.min(pts.length - 1, idx + 25);
            for (let k = idx; k <= searchEnd; k++) {
                const dx = engine.pos.x - pts[k].x;
                const dy = engine.pos.y - pts[k].y;
                const dSq = dx * dx + dy * dy;
                if (dSq < bestDistSq) {
                    bestDistSq = dSq;
                    bestIdx = k;
                }
            }
            idx = bestIdx;

            const wp = pts[idx];
            const travelCos = dir * Math.cos(wp.heading);
            const travelSin = dir * Math.sin(wp.heading);
            const along = (engine.pos.x - wp.x) * travelCos + (engine.pos.y - wp.y) * travelSin;
            const dRem = phase.totalLength - (wp.s + along);

            const steer = computeSteerCommand(engine, phase, idx, dir);
            lastSteer = steer;

            if (dRem <= 0.12 && Math.abs(engine.velocity) < 0.5) {
                break;
            }

            let vDesired;
            if (dRem <= 0.12) {
                vDesired = 0;
            } else {
                const vSafe = Math.sqrt(Math.max(0, 2 * aBrake * Math.max(0, dRem - 0.08)));
                const vMag = Math.min(phaseCruise, vSafe, dRem * 30);
                vDesired = dir * Math.max(1.5, vMag);
            }

            let throttle = clamp((vDesired - engine.velocity) / (engine.acceleration * FIXED_STEP), -1, 1);

            // Prevent inadvertent zero throttle while moving toward phase end (avoids friction branch)
            if (vDesired !== 0 && Math.abs(throttle) < 1e-4) {
                throttle = vDesired > 0 ? 1e-4 : -1e-4;
            }

            pushFrame(steer, throttle);
            if (crashCount > 0 || engine.won) break;
        }

        if (crashCount > 0 || engine.won) break;

        // Ensure complete stop before gear switch or finish
        for (let stopFrame = 0; stopFrame < 45; stopFrame++) {
            if (Math.abs(engine.velocity) < 0.1) break;
            const brakeThrottle = clamp(-engine.velocity / (engine.acceleration * FIXED_STEP), -1, 1);
            pushFrame(lastSteer, brakeThrottle);
            if (crashCount > 0 || engine.won) break;
        }

        if (crashCount > 0 || engine.won) break;
    }

    // Satisfy exact win condition: stationary (|v| < 1) + exact { steer: 0, throttle: 0 }
    if (crashCount === 0 && !engine.won) {
        for (let settle = 0; settle < 60; settle++) {
            if (Math.abs(engine.velocity) >= 1) {
                const brakeThrottle = clamp(-engine.velocity / (engine.acceleration * FIXED_STEP), -1, 1);
                pushFrame(0, brakeThrottle);
            } else {
                pushFrame(0, 0);
            }
            if (engine.won || crashCount > 0) break;
        }
    }

    return {
        won: engine.won,
        score: engine.score,
        crashCount,
        finalPos: { x: engine.pos.x, y: engine.pos.y },
        finalHeading: engine.heading,
        inputs
    };
}

/**
 * Compiles a geometric Hybrid A* + Reeds-Shepp plan into a verified 60 Hz GameEngine replay.
 * Automatically tries progressively gentler cruise speeds if tight clearance causes a graze.
 *
 * @param {object} plan - Output from planParkingPath()
 * @param {number} levelIndex
 * @param {string} carKey
 * @param {object} level
 * @param {object} carSpec
 * @param {object} [options]
 * @returns {{ success: boolean, replay: object|null, result: object }}
 */
export function compilePathToReplay(plan, levelIndex, carKey, level, carSpec, options = {}) {
    if (!plan || !plan.success || (!plan.alreadyInside && (!plan.waypoints || plan.waypoints.length === 0))) {
        return {
            success: false,
            replay: null,
            result: { won: false, score: 0, crashCount: 0, frames: 0, durationSec: 0, cusps: [], waypoints: [] }
        };
    }

    const cruiseSpeeds = plan.alreadyInside ? [30] : [95, 60, 30, 15];
    let bestSim = null;

    for (const speed of cruiseSpeeds) {
        const sim = simulateTrajectory(plan, level, carSpec, speed, options);
        bestSim = sim;
        if (sim.won && sim.crashCount === 0) {
            return {
                success: true,
                replay: {
                    levelIndex,
                    carModel: carKey,
                    inputs: sim.inputs
                },
                result: {
                    won: sim.won,
                    score: sim.score,
                    crashCount: sim.crashCount,
                    frames: sim.inputs.length,
                    durationSec: sim.inputs.length / 60,
                    cusps: plan.cusps || [],
                    waypoints: plan.waypoints || []
                }
            };
        }
    }

    return {
        success: false,
        replay: bestSim ? { levelIndex, carModel: carKey, inputs: bestSim.inputs } : null,
        result: {
            won: bestSim ? bestSim.won : false,
            score: bestSim ? bestSim.score : 0,
            crashCount: bestSim ? bestSim.crashCount : 0,
            frames: bestSim ? bestSim.inputs.length : 0,
            durationSec: bestSim ? bestSim.inputs.length / 60 : 0,
            cusps: plan.cusps || [],
            waypoints: plan.waypoints || []
        }
    };
}
