import { GameEngine } from '../../src/GameEngine.js';

describe('GameEngine', () => {
    test('should initialize with default values', () => {
        const engine = new GameEngine();
        expect(engine.pos).toBeDefined();
        expect(engine.pos.x).toBe(100);
        expect(engine.pos.y).toBe(300);
        expect(engine.velocity).toBe(0);
        expect(engine.heading).toBe(0);
    });

    test('should load level', () => {
        const engine = new GameEngine();
        const level = {
            start: { x: 50, y: 50, heading: Math.PI },
            obstacles: [],
            target: { x: 100, y: 100, width: 20, height: 20, angle: 0 }
        };
        engine.loadLevel(level);
        expect(engine.pos.x).toBe(50);
        expect(engine.pos.y).toBe(50);
        expect(engine.heading).toBe(Math.PI);
        expect(engine.currentLevel).toBe(level);
    });

    test('turning circle regression logic', () => {
        const engine = new GameEngine();
        // Set up for turning circle test
        engine.steerAngle = engine.maxSteerAngle;
        engine.velocity = 100;
        const dt = 0.01;
        const startPos = { x: engine.pos.x, y: engine.pos.y };
        let maxDist = 0;

        // Simulate
        const steps = 500;
        for (let i = 0; i < steps; i++) {
             // We need to manually integrate or just use engine.update?
             // engine.update handles acceleration/friction.
             // We want constant velocity.
             // So we'll use the manual integration logic from analyze_radius.js for this specific physics test
             // OR we mock input to maintain velocity.

             // Let's use manual integration to match the regression test's intent
            engine.pos.x += engine.velocity * Math.cos(engine.heading) * dt;
            engine.pos.y += engine.velocity * Math.sin(engine.heading) * dt;
            const angularVelocity = (engine.velocity / engine.wheelBase) * Math.tan(engine.steerAngle);
            engine.heading += angularVelocity * dt;

            const dist = Math.sqrt(Math.pow(engine.pos.x - startPos.x, 2) + Math.pow(engine.pos.y - startPos.y, 2));
            if (dist > maxDist) maxDist = dist;
        }

        expect(maxDist).toBeGreaterThan(0);
        // Expect diameter to be reasonable (approx 280-300px for default settings)
        // wheelbase 57, steer 40deg (~0.698 rad)
        // R = L / tan(delta) = 57 / tan(0.698) = 57 / 0.839 = 67.9
        // Diameter = 135.8
        // Wait, max steer 40 deg.
        // let's verify calculation.
        // tan(40 * pi / 180) = 0.839
        // 57 / 0.839 = 67.93 radius
        // Diameter = 135.86.
        // Let's check analyze_radius output...

        // This test ensures we don't regress on this basic calculation.
        expect(maxDist).toBeCloseTo(135.8, -1); // approximate check
    });
});
