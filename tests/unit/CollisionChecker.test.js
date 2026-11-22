import { GameEngine, CAR_MODELS, createPolygon } from '../../src/GameEngine.js';
import { LEVELS } from '../../src/levels.js';
import { SAT } from '../../src/SAT.js';
import { CollisionChecker } from '../../src/planner/CollisionChecker.js';

function mulberry32(seed) {
    return function () {
        let t = (seed += 0x6D2B79F5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

describe('CollisionChecker vs SAT', () => {
    test('agrees 100% with GameEngine + SAT across 1000 random poses on multiple levels', () => {
        const rand = mulberry32(1337);
        const car = CAR_MODELS.m3_g80;
        const engine = new GameEngine({ carModel: car });

        const testLevels = [LEVELS[5], LEVELS[7], LEVELS[11]]; // Hardcore Parallel, 45° Squeeze, Elite Challenge
        for (const lvl of testLevels) {
            engine.loadLevel(lvl);
            const checker = new CollisionChecker(lvl, car);
            const t = lvl.target;
            const targetPoly = createPolygon(t.x, t.y, t.width, t.height, t.angle);

            for (let i = 0; i < 350; i++) {
                const x = 40 + rand() * 720;
                const y = 40 + rand() * 520;
                const heading = (rand() - 0.5) * Math.PI * 2;

                engine.pos.x = x;
                engine.pos.y = y;
                engine.heading = heading;

                const carPoly = engine.getPolygon();
                const satHit = lvl.obstacles.some((o) =>
                    SAT.checkCollision(carPoly, createPolygon(o.x, o.y, o.width, o.height, o.angle))
                );
                expect(checker.collides(x, y, heading, 0)).toBe(satHit);

                const satInside = engine.isCarInside(carPoly, targetPoly);
                expect(checker.isCarInsideTarget(x, y, heading, 0)).toBe(satInside);
            }
        }
    });
});
