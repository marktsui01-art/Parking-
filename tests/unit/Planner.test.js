import { LEVELS } from '../../src/levels.js';
import { GameEngine, CAR_MODELS } from '../../src/GameEngine.js';
import { Vector2 } from '../../src/Vector2.js';
import { CollisionChecker } from '../../src/planner/CollisionChecker.js';
import { solveLevel, solveCustomLevel } from '../../src/planner/index.js';
import { simulateReplay } from '../../scripts/solve_level.js';

function replayFromLiveState(level, carKey, initialState, inputs) {
    const engine = new GameEngine();
    engine.applyCarModel(CAR_MODELS[carKey]);
    engine.loadLevel(level);
    engine.pos = new Vector2(initialState.x, initialState.y);
    engine.heading = initialState.heading || 0;
    engine.velocity = initialState.velocity || 0;
    engine.steerAngle = initialState.steerAngle || 0;

    let crashCount = 0;
    let firstFramePos = null;
    for (let i = 0; i < inputs.length; i++) {
        const prevTimer = engine.crashTimer;
        engine.update(1 / 60, inputs[i]);
        if (i === 0) {
            firstFramePos = { x: engine.pos.x, y: engine.pos.y };
        }
        if (engine.crashTimer > prevTimer) {
            crashCount++;
        }
    }

    return {
        won: engine.won,
        crashCount,
        score: engine.score,
        firstFramePos
    };
}

describe('Autonomous Parking Planner (Hybrid A* + Reeds-Shepp)', () => {
    test.each(LEVELS.map((lvl, idx) => [idx, lvl.name]))(
        'solves Level %i (%s) cleanly with m3_g80 (won=true, crashes=0, score=1000)',
        (levelIdx) => {
            const solved = solveLevel(levelIdx, 'm3_g80');
            expect(solved.success).toBe(true);
            expect(solved.replay).not.toBeNull();

            const sim = simulateReplay(solved.replay);
            expect(sim.won).toBe(true);
            expect(sim.crashCount).toBe(0);
            expect(sim.score).toBe(1000);
        }
    );

    test.each([
        ['cayman_987', 5],
        ['cayman_987', 6],
        ['cayman_987', 7],
        ['cayman_987', 9],
        ['cayman_987', 10],
        ['cayman_987', 11],
        ['e91_touring', 6],
        ['e91_touring', 9],
        ['e91_touring', 11],
        ['microlino', 6],
        ['microlino', 11],
        ['landcruiser_300', 3],
        ['landcruiser_300', 5],
        ['landcruiser_300', 7],
        ['landcruiser_300', 8]
    ])('solves tough level with diverse car model %s on level %i', (carKey, levelIdx) => {
        const solved = solveLevel(levelIdx, carKey);
        expect(solved.success).toBe(true);

        const sim = simulateReplay(solved.replay);
        expect(sim.won).toBe(true);
        expect(sim.crashCount).toBe(0);
        expect(sim.score).toBe(1000);
    });
});

describe('Auto-Park From Anywhere (Mid-Level / Moving / Edge Cases)', () => {
    test.each([
        ['Level 3 Parallel mid-lot angled', 2, { x: 420, y: 340, heading: -0.45, velocity: 0, steerAngle: 0 }],
        ['Level 6 Hardcore Parallel alongside spot', 5, { x: 560, y: 220, heading: 0.08, velocity: 0, steerAngle: 0 }],
        ['Level 7 Spiral halfway up right aisle', 6, { x: 735, y: 310, heading: -Math.PI / 2, velocity: 0, steerAngle: 0 }],
        ['Level 9 Constrained 90° mid-aisle', 8, { x: 430, y: 278, heading: 0.15, velocity: 0, steerAngle: 0 }]
    ])('initiates cleanly from %s without teleporting', (_label, levelIdx, initialState) => {
        const level = LEVELS[levelIdx];
        const solved = solveCustomLevel(level, CAR_MODELS.m3_g80, {
            levelIndex: levelIdx,
            carKey: 'm3_g80',
            initialState
        });
        expect(solved.success).toBe(true);
        expect(solved.replay).not.toBeNull();

        const sim = replayFromLiveState(level, 'm3_g80', initialState, solved.replay.inputs);
        expect(sim.won).toBe(true);
        expect(sim.crashCount).toBe(0);
        expect(sim.score).toBe(1000);
        expect(Math.hypot(sim.firstFramePos.x - initialState.x, sim.firstFramePos.y - initialState.y)).toBeLessThan(2);
    });

    test('initiates while car is moving and steered (Level 3 Parallel Park)', () => {
        const level = LEVELS[2];
        const initialState = { x: 320, y: 400, heading: -0.15, velocity: 70, steerAngle: 0.2 };
        const solved = solveCustomLevel(level, CAR_MODELS.m3_g80, {
            levelIndex: 2,
            carKey: 'm3_g80',
            initialState
        });
        expect(solved.success).toBe(true);
        expect(solved.requiresInstantStop).toBe(false);

        const sim = replayFromLiveState(level, 'm3_g80', initialState, solved.replay.inputs);
        expect(sim.won).toBe(true);
        expect(sim.crashCount).toBe(0);
        expect(sim.score).toBe(1000);
        expect(Math.hypot(sim.firstFramePos.x - initialState.x, sim.firstFramePos.y - initialState.y)).toBeLessThan(3);
    });

    test('finishes cleanly in place when already inside target box while rolling', () => {
        const level = LEVELS[0];
        // Target center (600, 300), bodyCenterDist = 26 -> rear axle at (574, 300)
        const initialState = { x: 574, y: 300, heading: 0, velocity: 15, steerAngle: 0 };
        const solved = solveCustomLevel(level, CAR_MODELS.m3_g80, {
            levelIndex: 0,
            carKey: 'm3_g80',
            initialState
        });
        expect(solved.success).toBe(true);
        expect(solved.plan.alreadyInside).toBe(true);
        expect(solved.replay.inputs.length).toBeLessThan(60);

        const sim = replayFromLiveState(level, 'm3_g80', initialState, solved.replay.inputs);
        expect(sim.won).toBe(true);
        expect(sim.crashCount).toBe(0);
    });

    test('escapes cleanly when starting 0.05 px from a wall', () => {
        const level = LEVELS[0];
        // Right wall is at x=800, width=20 (left edge x=790). M3 front is +74 ahead of rear axle -> x=715.95 leaves 0.05px clearance.
        const initialState = { x: 715.95, y: 300, heading: 0, velocity: 0, steerAngle: 0 };
        const solved = solveCustomLevel(level, CAR_MODELS.m3_g80, {
            levelIndex: 0,
            carKey: 'm3_g80',
            initialState
        });
        expect(solved.success).toBe(true);

        const sim = replayFromLiveState(level, 'm3_g80', initialState, solved.replay.inputs);
        expect(sim.won).toBe(true);
        expect(sim.crashCount).toBe(0);
        expect(sim.score).toBe(1000);
    });

    test('drives briskly on open straightaways while finishing cleanly on Level 1', () => {
        const solved = solveLevel(0, 'm3_g80');
        expect(solved.success).toBe(true);
        expect(solved.result.durationSec).toBeLessThan(4.5);

        const engine = new GameEngine();
        engine.applyCarModel(CAR_MODELS.m3_g80);
        engine.loadLevel(LEVELS[0]);
        let maxSpeed = 0;
        let crashCount = 0;
        for (const inp of solved.replay.inputs) {
            const prevTimer = engine.crashTimer;
            engine.update(1 / 60, inp);
            if (engine.crashTimer > prevTimer) crashCount++;
            maxSpeed = Math.max(maxSpeed, Math.abs(engine.velocity));
        }

        expect(maxSpeed).toBeGreaterThan(150);
        expect(engine.won).toBe(true);
        expect(crashCount).toBe(0);
        expect(engine.score).toBe(1000);
    });

    test('drives fast on open straights and slows down for tight sections on Level 7 (The Spiral)', () => {
        const level = LEVELS[6];
        const carSpec = CAR_MODELS.m3_g80;
        const solved = solveLevel(6, 'm3_g80');
        expect(solved.success).toBe(true);
        expect(solved.result.durationSec).toBeLessThan(16.5);

        const checker = new CollisionChecker(level, carSpec);
        const engine = new GameEngine();
        engine.applyCarModel(carSpec);
        engine.loadLevel(level);

        let maxOpenSpeed = 0;
        let maxTightSpeed = 0;
        let crashCount = 0;
        for (const inp of solved.replay.inputs) {
            const prevTimer = engine.crashTimer;
            engine.update(1 / 60, inp);
            if (engine.crashTimer > prevTimer) crashCount++;
            const speed = Math.abs(engine.velocity);
            if (!checker.collides(engine.pos.x, engine.pos.y, engine.heading, 16)) {
                maxOpenSpeed = Math.max(maxOpenSpeed, speed);
            }
            if (checker.collides(engine.pos.x, engine.pos.y, engine.heading, 1.5)) {
                maxTightSpeed = Math.max(maxTightSpeed, speed);
            }
        }

        expect(maxOpenSpeed).toBeGreaterThan(240);
        expect(maxTightSpeed).toBeLessThan(120);
        expect(engine.won).toBe(true);
        expect(crashCount).toBe(0);
        expect(engine.score).toBe(1000);
    });
});
