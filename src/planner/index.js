import { CAR_MODELS } from '../GameEngine.js';
import { LEVELS } from '../levels.js';
import { CollisionChecker } from './CollisionChecker.js';
import { planParkingPath } from './HybridAStar.js';
import { compilePathToReplay, computeBrakingPrefix } from './ReplayCompiler.js';

export { CollisionChecker } from './CollisionChecker.js';
export { HeuristicGrid } from './HeuristicGrid.js';
export { computeGoalPoses, planParkingPath } from './HybridAStar.js';
export { compilePathToReplay, computeBrakingPrefix } from './ReplayCompiler.js';
export { computeReedsSheppPaths, reedsSheppDistance, sampleReedsSheppPath, normalizeAngle } from './ReedsShepp.js';

/**
 * Plans and compiles a verified 60 Hz parking demonstration for an arbitrary level and car spec.
 * Pass 1 tries Stage 1+2 across margins; Pass 2 runs Stage 3 forward fallback only if Pass 1 fails.
 * When options.initialState is provided, smoothly brakes from that live pose/velocity without resetting.
 *
 * @param {object} level
 * @param {object} carSpec
 * @param {object} [options]
 * @param {number} [options.levelIndex=0]
 * @param {string} [options.carKey='custom']
 * @param {object} [options.initialState]
 * @returns {object}
 */
export function solveCustomLevel(level, carSpec, options = {}) {
    const t0 = performance.now();
    const levelIndex = options.levelIndex ?? 0;
    const carKey = options.carKey ?? 'custom';
    const allowForwardFallback = options.allowForwardFallback ?? true;

    let planLevel = level;
    let effectiveInitialState = options.initialState;
    let prefixInputs = [];
    let requiresInstantStop = false;
    let stoppedPose = null;
    let margins = options.margins;

    if (options.initialState) {
        const braking = computeBrakingPrefix(level, carSpec, options.initialState);
        requiresInstantStop = braking.crashedDuringBrake;
        effectiveInitialState = requiresInstantStop
            ? { ...options.initialState, velocity: 0, steerAngle: 0 }
            : options.initialState;
        prefixInputs = requiresInstantStop ? [] : braking.prefixInputs;
        stoppedPose = braking.stoppedPose;
        planLevel = { ...level, start: stoppedPose };

        if (!margins) {
            const checker = new CollisionChecker(planLevel, carSpec);
            margins = checker.collides(stoppedPose.x, stoppedPose.y, stoppedPose.heading, 0.2)
                ? [1.5, 0.5, 0.2, 0]
                : [1.5, 0.5, 0.2];
        }
    } else if (!margins) {
        margins = [1.5, 0.5, 0.2];
    }

    const cache = {};
    let lastFailure = null;
    const passes = allowForwardFallback ? [false, true] : [false];

    for (const enableFwd of passes) {
        for (const margin of margins) {
            const plan = planParkingPath(planLevel, carSpec, {
                ...options,
                startPose: stoppedPose || options.startPose,
                margins: [margin],
                allowForwardFallback: enableFwd,
                forwardOnly: enableFwd,
                _cache: cache
            });

            if (!plan.success) {
                lastFailure = {
                    success: false,
                    plan,
                    replay: null,
                    requiresInstantStop,
                    startPose: stoppedPose,
                    result: {
                        won: false,
                        score: 0,
                        crashCount: 0,
                        frames: 0,
                        durationSec: 0,
                        cusps: [],
                        waypoints: [],
                        solveMs: performance.now() - t0
                    }
                };
                continue;
            }

            const compiled = compilePathToReplay(plan, levelIndex, carKey, planLevel, carSpec, {
                initialState: effectiveInitialState,
                prefixInputs
            });
            compiled.plan = plan;
            compiled.requiresInstantStop = requiresInstantStop;
            compiled.startPose = stoppedPose;
            compiled.result.solveMs = performance.now() - t0;
            if (compiled.success) {
                return compiled;
            }
            lastFailure = compiled;
        }
    }

    return lastFailure || {
        success: false,
        plan: { success: false, stats: { durationMs: performance.now() - t0 } },
        replay: null,
        requiresInstantStop,
        startPose: stoppedPose,
        result: {
            won: false,
            score: 0,
            crashCount: 0,
            frames: 0,
            durationSec: 0,
            cusps: [],
            waypoints: [],
            solveMs: performance.now() - t0
        }
    };
}

/**
 * Plans and compiles a verified 60 Hz parking demonstration for a built-in level and car key.
 *
 * @param {number} levelIndex
 * @param {string} [carKey='m3_g80']
 * @param {object} [options]
 * @returns {object}
 */
export function solveLevel(levelIndex, carKey = 'm3_g80', options = {}) {
    const level = LEVELS[levelIndex];
    if (!level) {
        throw new Error(`Invalid level index: ${levelIndex}`);
    }
    const carSpec = CAR_MODELS[carKey];
    if (!carSpec) {
        throw new Error(`Unknown car model: ${carKey}`);
    }
    return solveCustomLevel(level, carSpec, { ...options, levelIndex, carKey });
}
