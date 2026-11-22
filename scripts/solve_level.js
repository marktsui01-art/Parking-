import { GameEngine, CAR_MODELS } from '../src/GameEngine.js';
import { LEVELS } from '../src/levels.js';
import { solveLevel } from '../src/planner/index.js';
import fs from 'fs';
import path from 'path';

// Constants matching src/main.js
const FIXED_STEP = 1 / 60;

/**
 * Runs a replay headless.
 * @param {object} replayData - The parsed JSON replay.
 * @returns {object} Result { won, score, finalPos, finalHeading, crashed, firstCrashFrame, crashCount }
 */
export function simulateReplay(replayData) {
    const engine = new GameEngine();

    // 1. Setup Car
    if (replayData.carModel && CAR_MODELS[replayData.carModel]) {
        engine.applyCarModel(CAR_MODELS[replayData.carModel]);
    }

    // 2. Setup Level
    const levelIndex = replayData.levelIndex;
    if (levelIndex === undefined || !LEVELS[levelIndex]) {
        throw new Error(`Invalid level index: ${levelIndex}`);
    }
    engine.loadLevel(LEVELS[levelIndex]);

    // 3. Run Loop
    let crashed = false;
    let firstCrashFrame = -1;
    let crashCount = 0;

    for (let i = 0; i < replayData.inputs.length; i++) {
        const input = replayData.inputs[i];
        const prevTimer = engine.crashTimer;
        engine.update(FIXED_STEP, input);

        // Check if a crash occurred this frame
        // The engine sets crashTimer to 0.5 on crash
        if (engine.crashTimer > prevTimer) {
            crashCount++;
            if (!crashed) {
                crashed = true;
                firstCrashFrame = i;
            }
        }
    }

    return {
        won: engine.won,
        score: engine.score,
        finalPos: engine.pos,
        finalHeading: engine.heading,
        crashed,
        firstCrashFrame,
        crashCount
    };
}

/**
 * OPTIMIZER LOGIC
 * Mutates a replay to try and improve the score or achieve a win.
 */
export function optimizeReplay(initialReplayData, iterations = 1000) {
    let bestReplay = JSON.parse(JSON.stringify(initialReplayData));
    let bestResult = simulateReplay(bestReplay);

    const levelIndex = initialReplayData.levelIndex;
    const target = LEVELS[levelIndex].target;

    const calculateFitness = (result) => {
        const dx = result.finalPos.x - target.x;
        const dy = result.finalPos.y - target.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let fitness = result.score;
        if (result.won) {
            fitness += 10000;
        }
        if (!result.won) {
            fitness -= dist * 20;
        }
        fitness -= result.crashCount * 2000;

        return fitness;
    };

    let bestFitness = calculateFitness(bestResult);

    console.log(`Starting Optimization. Initial Fitness: ${bestFitness.toFixed(2)} (Won: ${bestResult.won}, Crashes: ${bestResult.crashCount})`);

    for (let i = 0; i < iterations; i++) {
        const candidateReplay = JSON.parse(JSON.stringify(bestReplay));
        const numMutations = Math.floor(Math.random() * 5) + 1;

        for (let m = 0; m < numMutations; m++) {
            let frameIdx;

            if (bestResult.crashed && Math.random() > 0.5) {
                const windowSize = 60;
                const startFrame = Math.max(0, bestResult.firstCrashFrame - windowSize);
                frameIdx = startFrame + Math.floor(Math.random() * (bestResult.firstCrashFrame - startFrame + 1));
            } else {
                frameIdx = Math.floor(Math.random() * candidateReplay.inputs.length);
            }

            const input = candidateReplay.inputs[frameIdx];

            if (Math.random() > 0.5) {
                input.steer += (Math.random() - 0.5) * 0.4;
                if (input.steer > 1) input.steer = 1;
                if (input.steer < -1) input.steer = -1;
            } else {
                input.throttle += (Math.random() - 0.5) * 0.4;
                if (input.throttle > 1) input.throttle = 1;
                if (input.throttle < -1) input.throttle = -1;
            }
        }

        const result = simulateReplay(candidateReplay);
        const fitness = calculateFitness(result);

        if (fitness > bestFitness) {
            bestFitness = fitness;
            bestReplay = candidateReplay;
            bestResult = result;
            console.log(`[${i}] Improved! Fitness: ${bestFitness.toFixed(2)} (Won: ${bestResult.won}, Crashes: ${bestResult.crashCount})`);
        }
    }

    return bestReplay;
}

function parseSolveArgs(args) {
    let levelArg = 'all';
    let carKey = 'm3_g80';
    let outPath = null;

    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '--solve') continue;
        if (a === '--level' && i + 1 < args.length) {
            levelArg = args[++i];
        } else if (a.startsWith('--level=')) {
            levelArg = a.slice('--level='.length);
        } else if (a === '--car' && i + 1 < args.length) {
            carKey = args[++i];
        } else if (a.startsWith('--car=')) {
            carKey = a.slice('--car='.length);
        } else if (a === '--out' && i + 1 < args.length) {
            outPath = args[++i];
        } else if (a.startsWith('--out=')) {
            outPath = a.slice('--out='.length);
        }
    }

    return { levelArg, carKey, outPath };
}

function runSolveCli(args) {
    const { levelArg, carKey, outPath } = parseSolveArgs(args);

    if (!CAR_MODELS[carKey]) {
        console.error(`Unknown car model: ${carKey}. Available: ${Object.keys(CAR_MODELS).join(', ')}`);
        process.exit(1);
    }

    let indices;
    if (levelArg === 'all') {
        indices = LEVELS.map((_, idx) => idx);
    } else {
        const idx = Number.parseInt(levelArg, 10);
        if (!Number.isInteger(idx) || idx < 0 || idx >= LEVELS.length) {
            console.error(`Invalid level index: ${levelArg}. Expected 0-${LEVELS.length - 1} or 'all'.`);
            process.exit(1);
        }
        indices = [idx];
    }

    console.log(`Solving ${indices.length} level(s) for car: ${carKey} (${CAR_MODELS[carKey].name})`);
    console.log('-----------------------------------------------------------------------------------------');
    console.log('Lvl | Name                            | Status | Crashes | Score |  Dur  | Shifts | Solve');
    console.log('----+---------------------------------+--------+---------+-------+-------+--------+------');

    let allPassed = true;

    for (const idx of indices) {
        const solved = solveLevel(idx, carKey);
        const sim = solved.replay
            ? simulateReplay(solved.replay)
            : { won: false, score: 0, crashCount: 0 };

        const passed = solved.success && sim.won && sim.crashCount === 0;
        if (!passed) allPassed = false;

        const lvlName = LEVELS[idx].name.slice(0, 31).padEnd(31);
        const status = passed ? 'WON   ' : 'FAIL  ';
        const dur = `${solved.result.durationSec.toFixed(1)}s`.padStart(5);
        const shifts = String(solved.result.cusps.length).padStart(6);
        const solveTime = `${solved.result.solveMs.toFixed(0)}ms`.padStart(5);

        console.log(
            `${String(idx).padStart(3)} | ${lvlName} | ${status} | ${String(sim.crashCount).padStart(7)} | ${String(sim.score).padStart(5)} | ${dur} | ${shifts} | ${solveTime}`
        );

        if (outPath && solved.replay) {
            let targetFile = outPath;
            if (indices.length > 1) {
                fs.mkdirSync(outPath, { recursive: true });
                targetFile = path.join(outPath, `replay_level_${idx}_${carKey}.json`);
            }
            fs.writeFileSync(targetFile, JSON.stringify(solved.replay, null, 2));
        }
    }

    console.log('-----------------------------------------------------------------------------------------');
    if (outPath) {
        console.log(`Saved replay output to ${outPath}`);
    }
    process.exit(allPassed ? 0 : 1);
}

// CLI Execution
if (process.argv[1] === import.meta.filename) {
    const args = process.argv.slice(2);

    if (args.includes('--solve')) {
        runSolveCli(args);
    } else if (args.includes('--optimize')) {
        const replayFile = args.find((a) => !a.startsWith('-'));
        if (!replayFile) {
            console.error('Usage: node scripts/solve_level.js <replay_file.json> --optimize');
            process.exit(1);
        }
        const json = fs.readFileSync(replayFile, 'utf8');
        const replayData = JSON.parse(json);
        const optimized = optimizeReplay(replayData, 20000);
        const outFile = replayFile.replace('.json', '_optimized.json');
        fs.writeFileSync(outFile, JSON.stringify(optimized, null, 2));
        console.log(`Optimized replay saved to ${outFile}`);
    } else {
        const replayFile = args[0];
        if (!replayFile) {
            console.error('Usage:');
            console.error('  node scripts/solve_level.js --solve --level <0-11|all> [--car <carKey>] [--out <path>]');
            console.error('  node scripts/solve_level.js <replay_file.json> [--optimize]');
            process.exit(1);
        }

        try {
            const json = fs.readFileSync(replayFile, 'utf8');
            const replayData = JSON.parse(json);
            console.log(`Loading Replay: Level ${replayData.levelIndex}, Car ${replayData.carModel}, Frames: ${replayData.inputs.length}`);

            const result = simulateReplay(replayData);

            console.log('---------------------------------------------------');
            console.log('SIMULATION RESULT:');
            console.log(`Won: ${result.won ? 'YES' : 'NO'}`);
            console.log(`Crashed: ${result.crashed ? 'YES' : 'NO'} ${result.crashed ? `(First: Frame ${result.firstCrashFrame}, Total: ${result.crashCount})` : ''}`);
            console.log(`Final Score: ${result.score}`);
            console.log(`Final Pos: (${result.finalPos.x.toFixed(2)}, ${result.finalPos.y.toFixed(2)})`);
            console.log('---------------------------------------------------');
        } catch (e) {
            console.error('Error running replay:', e.message);
            process.exit(1);
        }
    }
}
