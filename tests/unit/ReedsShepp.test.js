import {
    computeReedsSheppPaths,
    reedsSheppDistance,
    sampleReedsSheppPath,
    normalizeAngle
} from '../../src/planner/ReedsShepp.js';

function mulberry32(seed) {
    return function () {
        let t = (seed += 0x6D2B79F5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

describe('ReedsShepp Analytical Curves', () => {
    test('reaches exact target pose across 200 randomized configurations and all 48 word symmetries', () => {
        const rand = mulberry32(42);
        const R = 67.93;
        const patternsSeen = new Set();

        for (let i = 0; i < 200; i++) {
            const start = {
                x: (rand() - 0.5) * 400,
                y: (rand() - 0.5) * 400,
                heading: (rand() - 0.5) * Math.PI * 2
            };
            const goal = {
                x: (rand() - 0.5) * 400,
                y: (rand() - 0.5) * 400,
                heading: (rand() - 0.5) * Math.PI * 2
            };

            const paths = computeReedsSheppPaths(start, goal, R);
            expect(paths.length).toBeGreaterThan(0);

            for (const path of paths) {
                const pattern = path.segments
                    .map((s) => (s.steer === 1 ? 'L' : s.steer === -1 ? 'R' : 'S') + (s.dir > 0 ? 'p' : 'm'))
                    .join('');
                patternsSeen.add(pattern);

                const wps = sampleReedsSheppPath(start, path.segments, R, 5);
                expect(wps.length).toBeGreaterThan(0);
                const last = wps[wps.length - 1];

                const posErr = Math.hypot(last.x - goal.x, last.y - goal.y);
                const angErr = Math.abs(normalizeAngle(last.heading - goal.heading));
                expect(posErr).toBeLessThan(1e-3);
                expect(angErr).toBeLessThan(1e-3);
            }
        }

        expect(patternsSeen.size).toBeGreaterThanOrEqual(40);
    });

    test('shortest RS distance matches straight distance for aligned forward goal and is symmetric', () => {
        const R = 50;
        const a = { x: 0, y: 0, heading: 0 };
        const b = { x: 120, y: 0, heading: 0 };
        expect(reedsSheppDistance(a, b, R)).toBeCloseTo(120, 5);

        const p1 = { x: 30, y: -40, heading: 0.7 };
        const p2 = { x: 180, y: 95, heading: -1.2 };
        expect(reedsSheppDistance(p1, p2, R)).toBeCloseTo(reedsSheppDistance(p2, p1, R), 5);
    });

    test('penalizes reverse and gear switches when configured', () => {
        const R = 50;
        const start = { x: 0, y: 0, heading: 0 };
        const behind = { x: -80, y: 0, heading: 0 };

        const unbiased = computeReedsSheppPaths(start, behind, R);
        expect(unbiased[0].segments[0].dir).toBe(-1);
        expect(unbiased[0].length).toBeCloseTo(80, 5);

        const heavyReverse = computeReedsSheppPaths(start, behind, R, { reverseWeight: 10 });
        expect(heavyReverse[0].segments[0].dir).toBe(1);
    });
});
