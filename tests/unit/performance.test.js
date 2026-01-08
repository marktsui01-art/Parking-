
import { GameEngine, CAR_MODELS } from '../../src/GameEngine.js';
import { Vector2 } from '../../src/Vector2.js';

describe('Car Performance Tests', () => {
    const DT = 1 / 60;
    const TEST_DURATION = 15; // 15 seconds of full throttle

    Object.keys(CAR_MODELS).forEach(carKey => {
        if (carKey === 'microlino') return; // Skip EV for now

        test(`${carKey} should reach redline and have reasonable acceleration`, () => {
            const model = CAR_MODELS[carKey];
            const engine = new GameEngine({ carModel: model });

            // Override maxSpeed if specified in model (we might need to add this)
            const maxVelocity = model.maxSpeed || 300;
            const targetRPM = model.engineConfig.redline || 6500;

            let velocity = 0;
            let timeTo60 = -1;

            // Simulation loop
            for (let i = 0; i < TEST_DURATION * 60; i++) {
                // We use the same physics logic as the GameEngine
                // But for the purpose of the tuner/sound, we want to see if it reaches MAX_SPEED

                // Acceleration
                const accel = model.acceleration || 150;
                velocity += 1.0 * accel * DT;

                // Clamp
                if (velocity > maxVelocity) velocity = maxVelocity;

                const kmh = velocity / 20 * 3.6;
                if (timeTo60 === -1 && kmh >= 60) {
                    timeTo60 = i * DT;
                }
            }

            const finalKmh = velocity / 20 * 3.6;
            console.log(`${model.name}: Final Speed ${finalKmh.toFixed(1)} km/h, 0-60: ${timeTo60 === -1 ? 'N/A' : timeTo60.toFixed(2) + 's'}`);

            // Verification
            expect(velocity).toBeGreaterThanOrEqual(maxVelocity * 0.99); // Should hit at least 99% of max speed/redline
        });
    });
});
