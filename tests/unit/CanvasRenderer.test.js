import { CAR_MODELS, GameEngine } from '../../src/GameEngine.js';
import { computeAckermannWheelAngles, computeWheelLayout } from '../../src/CanvasRenderer.js';

function getWheelCorners(cx, cy, w, h, angle) {
    const hw = w / 2;
    const hh = h / 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return [
        [hw, hh],
        [hw, -hh],
        [-hw, -hh],
        [-hw, hh]
    ].map(([lx, ly]) => ({
        x: cx + lx * cos - ly * sin,
        y: cy + lx * sin + ly * cos
    }));
}

describe('CanvasRenderer Inset Ackermann Wheels', () => {
    const carEntries = Object.entries(CAR_MODELS);

    test.each(carEntries)(
        '%s computes valid Ackermann inner/outer angles across straight, left, and right lock',
        (_key, spec) => {
            const engine = new GameEngine();
            engine.applyCarModel(spec);

            // Straight ahead
            engine.steerAngle = 0;
            const straight = computeWheelLayout(engine);
            expect(straight.frontLeftAngle).toBe(0);
            expect(straight.frontRightAngle).toBe(0);

            // Full right turn (+y): right wheel is inner (sharper), left wheel is outer (gentler)
            engine.steerAngle = spec.maxSteerAngle;
            const rightTurn = computeWheelLayout(engine);
            expect(rightTurn.frontRightAngle).toBeGreaterThan(spec.maxSteerAngle);
            expect(rightTurn.frontLeftAngle).toBeGreaterThan(0);
            expect(rightTurn.frontLeftAngle).toBeLessThan(spec.maxSteerAngle);

            const track = rightTurn.axleY * 2;
            const cotDiffRight = 1 / Math.tan(rightTurn.frontLeftAngle) - 1 / Math.tan(rightTurn.frontRightAngle);
            expect(cotDiffRight).toBeCloseTo(track / spec.wheelBase, 6);

            // Full left turn (-y): mirror symmetry
            engine.steerAngle = -spec.maxSteerAngle;
            const leftTurn = computeWheelLayout(engine);
            expect(leftTurn.frontLeftAngle).toBeCloseTo(-rightTurn.frontRightAngle, 8);
            expect(leftTurn.frontRightAngle).toBeCloseTo(-rightTurn.frontLeftAngle, 8);
        }
    );

    test.each(carEntries)(
        '%s keeps all 4 wheel corners strictly inside the SAT body bounds at full lock',
        (_key, spec) => {
            const engine = new GameEngine();
            engine.applyCarModel(spec);

            for (const steer of [0, spec.maxSteerAngle, -spec.maxSteerAngle]) {
                engine.steerAngle = steer;
                const { wheelWidth, wheelHeight, axleY, frontLeftAngle, frontRightAngle } = computeWheelLayout(engine);
                const wheels = [
                    [0, -axleY, 0],
                    [0, axleY, 0],
                    [engine.wheelBase, -axleY, frontLeftAngle],
                    [engine.wheelBase, axleY, frontRightAngle]
                ];

                for (const [wx, wy, wAngle] of wheels) {
                    const corners = getWheelCorners(wx, wy, wheelWidth, wheelHeight, wAngle);
                    for (const c of corners) {
                        expect(Math.abs(c.y)).toBeLessThanOrEqual(engine.width / 2);
                        expect(c.x).toBeGreaterThanOrEqual(-engine.rearOverhang);
                        expect(c.x).toBeLessThanOrEqual(engine.wheelBase + engine.frontOverhang);
                    }
                }
            }
        }
    );

    test('computeAckermannWheelAngles matches exact bicycle ICR geometry', () => {
        const angles = computeAckermannWheelAngles(60, 30, Math.PI / 6);
        const R = 60 / Math.tan(Math.PI / 6);
        expect(angles.right).toBeCloseTo(Math.atan2(60, R - 15), 10);
        expect(angles.left).toBeCloseTo(Math.atan2(60, R + 15), 10);
    });
});
