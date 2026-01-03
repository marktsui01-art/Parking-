
import { GameEngine, CAR_MODELS } from '../src/GameEngine.js';
import { LEVELS } from '../src/levels.js';
import fs from 'fs';

// Constants matching src/main.js
const FIXED_STEP = 1 / 60;

/**
 * Runs a replay headless.
 * @param {object} replayData - The parsed JSON replay.
 * @returns {object} Result { won, score, finalPos, finalHeading, crash }
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
    for (const input of replayData.inputs) {
        // Stop if won (optional, but replay might continue after win?)
        // The game loop usually stops updating if won, but let's see GameEngine.js
        // GameEngine.update returns early if (this.won).

        // We use the EXACT same fixed step
        engine.update(FIXED_STEP, input);

        // Check crash state (engine.crashTimer > 0 means a collision occurred recently)
        // Note: Engine resets velocity on crash, so we can detect it by checking score drop or crashTimer.
        if (engine.crashTimer > 0) {
            crashed = true;
        }
    }

    return {
        won: engine.won,
        score: engine.score,
        finalPos: engine.pos,
        finalHeading: engine.heading,
        crashed: crashed
    };
}

// CLI Execution
if (process.argv[1] === import.meta.filename) {
    const replayFile = process.argv[2];
    if (!replayFile) {
        console.error("Usage: node scripts/solve_level.js <replay_file.json>");
        process.exit(1);
    }

    try {
        const json = fs.readFileSync(replayFile, 'utf8');
        const replayData = JSON.parse(json);
        console.log(`Loading Replay: Level ${replayData.levelIndex}, Car ${replayData.carModel}, Frames: ${replayData.inputs.length}`);

        const result = simulateReplay(replayData);

        console.log("---------------------------------------------------");
        console.log("SIMULATION RESULT:");
        console.log(`Won: ${result.won ? "YES" : "NO"}`);
        console.log(`Crashed: ${result.crashed ? "YES" : "NO"}`);
        console.log(`Final Score: ${result.score}`);
        console.log(`Final Pos: (${result.finalPos.x.toFixed(2)}, ${result.finalPos.y.toFixed(2)})`);
        console.log("---------------------------------------------------");

    } catch (e) {
        console.error("Error running replay:", e.message);
    }
}

/**
 * OPTIMIZER LOGIC
 * Mutates a replay to try and improve the score or achieve a win.
 */
export function optimizeReplay(initialReplayData, iterations = 1000) {
    let bestReplay = JSON.parse(JSON.stringify(initialReplayData));
    let bestResult = simulateReplay(bestReplay);

    // Fitness function:
    // High Score is good.
    // If not won, Distance to Target is the metric (lower is better).
    // We want to MAXIMIZE score, and if not won, MINIMIZE distance.
    // Let's combine: Fitness = Score - DistanceToTarget * Weight
    // But engine.score decreases on crash.

    // Let's get target center for distance calc
    const levelIndex = initialReplayData.levelIndex;
    const target = LEVELS[levelIndex].target;
    // target x, y

    const calculateFitness = (result) => {
        const dx = result.finalPos.x - target.x;
        const dy = result.finalPos.y - target.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        let fitness = result.score;
        if (result.won) {
            fitness += 10000; // Big bonus for winning
        }
        // Penalize distance heavily if not won
        if (!result.won) {
            fitness -= dist * 10;
        }

        // Penalize crashing extra (score handles some, but let's be strict)
        if (result.crashed) {
            fitness -= 5000;
        }

        return fitness;
    };

    let bestFitness = calculateFitness(bestResult);

    console.log(`Starting Optimization. Initial Fitness: ${bestFitness.toFixed(2)} (Won: ${bestResult.won})`);

    for (let i = 0; i < iterations; i++) {
        // Create candidate
        const candidateReplay = JSON.parse(JSON.stringify(bestReplay));

        // MUTATION:
        // Pick a random frame, change steer or throttle slightly
        const numMutations = Math.floor(Math.random() * 5) + 1; // Change 1 to 5 frames

        for (let m=0; m<numMutations; m++) {
            const frameIdx = Math.floor(Math.random() * candidateReplay.inputs.length);
            const input = candidateReplay.inputs[frameIdx];

            if (Math.random() > 0.5) {
                // Mutate Steer
                // Steer is usually -1 to 1.
                input.steer += (Math.random() - 0.5) * 0.2;
                if (input.steer > 1) input.steer = 1;
                if (input.steer < -1) input.steer = -1;
            } else {
                // Mutate Throttle
                input.throttle += (Math.random() - 0.5) * 0.2;
                if (input.throttle > 1) input.throttle = 1;
                if (input.throttle < -1) input.throttle = -1;
            }
        }

        // Evaluate
        const result = simulateReplay(candidateReplay);
        const fitness = calculateFitness(result);

        if (fitness > bestFitness) {
            bestFitness = fitness;
            bestReplay = candidateReplay;
            bestResult = result;
            console.log(`[${i}] Improved! Fitness: ${bestFitness.toFixed(2)} (Won: ${bestResult.won})`);
            if (bestResult.won && !bestResult.crashed) {
                // We could stop early if we just want A win, but maybe we want BEST win?
                // Let's continue for now.
            }
        }
    }

    return bestReplay;
}

// Add CLI arg for optimization
if (process.argv[1] === import.meta.filename && process.argv[3] === '--optimize') {
    const replayFile = process.argv[2];
    const json = fs.readFileSync(replayFile, 'utf8');
    const replayData = JSON.parse(json);

    const optimized = optimizeReplay(replayData, 2000); // 2000 iterations

    const outFile = replayFile.replace('.json', '_optimized.json');
    fs.writeFileSync(outFile, JSON.stringify(optimized, null, 2));
    console.log(`Optimized replay saved to ${outFile}`);
}
