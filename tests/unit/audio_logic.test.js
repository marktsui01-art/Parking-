
import { AudioController, ENGINE_PRESETS } from '../../src/AudioController.js';
import { EngineSim } from '../../src/EngineSim.js';

describe('Engine Logic & Audio State Tests', () => {

    test('EngineSim should reach terminal velocity based on drag/torque', () => {
        const sim = new EngineSim({ acceleration: 200, maxSpeed: 400 });

        // Full throttle for 10 seconds
        for (let i = 0; i < 600; i++) {
            sim.update(1.0);
        }

        // Should be very close to maxSpeed
        expect(sim.velocity).toBeGreaterThan(350);
        expect(sim.velocity).toBeLessThanOrEqual(400);
    });

    test('EngineSim should decelerate with engine braking', () => {
        const sim = new EngineSim({ maxSpeed: 300 });
        sim.velocity = 200;

        const v1 = sim.update(0);
        expect(v1).toBeLessThan(200);
    });

    test('AudioController should calculate correct RPM and VTEC state', () => {
        const audio = new AudioController();
        audio.setEngineType({ type: 'civic_vtec' }); // Redline 8200, VTEC 5800

        // Test Idle
        const stIdle = audio.calculateState(0, 0);
        expect(stIdle.currentRPM).toBe(900);
        expect(stIdle.isVtecActive).toBe(false);

        // Test near VTEC crossover
        // ratio for 5800 RPM: (5800 - 900) / (8200 - 900) = 4900 / 7300 ≈ 0.67
        const stMid = audio.calculateState(0.6, 0);
        expect(stMid.currentRPM).toBeLessThan(5800);
        expect(stMid.isVtecActive).toBe(false);

        const stHigh = audio.calculateState(0.8, 1.0);
        expect(stHigh.currentRPM).toBeGreaterThan(5800);
        expect(stHigh.isVtecActive).toBe(true);
        expect(stHigh.vtecFreqShift).toBeGreaterThan(1.0);
    });

    test('AudioController should scale gains correctly with throttle', () => {
        const audio = new AudioController();
        audio.setEngineType({ type: 'v8' });

        const stateLow = audio.calculateState(0.5, 0.1);
        const stateHigh = audio.calculateState(0.5, 0.9);

        expect(stateHigh.intakeVol).toBeGreaterThan(stateLow.intakeVol);
        expect(stateHigh.exhaustVol).toBeGreaterThan(stateLow.exhaustVol);
    });
});
