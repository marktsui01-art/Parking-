import { jest } from '@jest/globals';
import { Drivetrain } from '../../src/Drivetrain.js';
import { GameAudioController, CAR_SOUND_PRESETS, GAME_SOUND_OPTIONS } from '../../src/GameAudioController.js';
import { ModularAudioEngine, MODULAR_PATCH_PRESETS } from '../../src/ModularAudioEngine.js';
import { CAR_MODELS } from '../../src/GameEngine.js';

describe('Drivetrain Parking Physics (Chapter 1.5)', () => {
    test('Maintains shared-crankshaft idle micro-hunting around idleRPM at standstill', () => {
        const dt = new Drivetrain({ idleRPM: 900, redlineRPM: 7000, maxSpeed: 300, idleHuntAmp: 12 });
        const samples = [];
        for (let i = 0; i < 60; i++) {
            samples.push(dt.step(1 / 60, 0, 0).rpm);
        }
        const minRpm = Math.min(...samples);
        const maxRpm = Math.max(...samples);
        expect(minRpm).toBeGreaterThanOrEqual(885);
        expect(maxRpm).toBeLessThanOrEqual(915);
        expect(maxRpm - minRpm).toBeGreaterThan(2);
        expect(dt.gear).toBe('N');
    });

    test('Flares clutch RPM and manifold load cleanly for both Forward and Reverse launches', () => {
        const dtFwd = new Drivetrain({ idleRPM: 900, redlineRPM: 7000, maxSpeed: 300 });
        for (let i = 0; i < 20; i++) dtFwd.step(1 / 60, 4, 1);
        expect(dtFwd.rpm).toBeGreaterThan(1800);
        expect(dtFwd.engineLoad).toBeGreaterThan(0.8);
        expect(dtFwd.gear).toBe('D');
        expect(dtFwd.isBraking).toBe(false);

        const dtRev = new Drivetrain({ idleRPM: 900, redlineRPM: 7000, maxSpeed: 300 });
        for (let i = 0; i < 20; i++) dtRev.step(1 / 60, -4, -1);
        expect(dtRev.rpm).toBeGreaterThan(1800);
        expect(dtRev.engineLoad).toBeGreaterThan(0.8);
        expect(dtRev.gear).toBe('R');
        expect(dtRev.isReversing).toBe(true);
        expect(dtRev.isBraking).toBe(false);
    });

    test('Distinguishes footbrake from throttle when opposing motion (forward & reverse)', () => {
        const dt = new Drivetrain({ idleRPM: 900, redlineRPM: 7000, maxSpeed: 300 });
        for (let i = 0; i < 15; i++) dt.step(1 / 60, 120, 1);
        expect(dt.engineLoad).toBeGreaterThan(0.7);

        // Press reverse/brake while still rolling forward -> braking drops engineLoad toward 0
        let brakeSt;
        for (let i = 0; i < 15; i++) brakeSt = dt.step(1 / 60, 80, -1);
        expect(brakeSt.isBraking).toBe(true);
        expect(brakeSt.engineLoad).toBeLessThan(0.05);

        // Rolling backward, press forward pedal -> braking drops engineLoad toward 0
        const dtRev = new Drivetrain({ idleRPM: 900, redlineRPM: 7000, maxSpeed: 300 });
        for (let i = 0; i < 15; i++) dtRev.step(1 / 60, -80, -1);
        for (let i = 0; i < 15; i++) brakeSt = dtRev.step(1 / 60, -60, 1);
        expect(brakeSt.isBraking).toBe(true);
        expect(brakeSt.engineLoad).toBeLessThan(0.05);
    });

    test('Exhibits asymmetric flywheel inertia, overrun state, and shorter reverse gear ratio', () => {
        const dt = new Drivetrain({ idleRPM: 900, redlineRPM: 7000, maxSpeed: 300 });
        dt.step(0.1, 0, 1);
        const riseAfter100ms = dt.rpm - 900;

        const peak = dt.rpm;
        dt.step(0.1, 0, 0);
        const dropAfter100ms = peak - dt.rpm;
        expect(riseAfter100ms).toBeGreaterThan(dropAfter100ms * 2);

        // Overrun when coasting fast off throttle
        const dtCoast = new Drivetrain({ idleRPM: 900, redlineRPM: 7000, maxSpeed: 300 });
        for (let i = 0; i < 30; i++) dtCoast.step(1 / 60, 220, 1);
        const stCoast = dtCoast.step(1 / 60, 220, 0);
        expect(stCoast.isOverrun).toBe(true);

        // Reverse has higher RPM than forward at same speed
        const dFwd = new Drivetrain({ idleRPM: 900, redlineRPM: 7000, maxSpeed: 300 });
        const dRev = new Drivetrain({ idleRPM: 900, redlineRPM: 7000, maxSpeed: 300 });
        for (let i = 0; i < 60; i++) {
            dFwd.step(1 / 60, 150, 0.5);
            dRev.step(1 / 60, -150, -0.5);
        }
        expect(dRev.rpm).toBeGreaterThan(dFwd.rpm);
    });

    test('EV drivetrain sits silently at 0 RPM at standstill and tracks wheel speed cleanly', () => {
        const ev = new Drivetrain({ idleRPM: 0, redlineRPM: 10000, maxSpeed: 100, isEV: true });
        const idleSt = ev.step(1 / 60, 0, 0);
        expect(idleSt.rpm).toBe(0);
        expect(idleSt.isOverrun).toBe(false);

        for (let i = 0; i < 40; i++) ev.step(1 / 60, 80, 1);
        expect(ev.rpm).toBeGreaterThan(7500);
        expect(ev.rpm).toBeLessThanOrEqual(10000);
    });
});

describe('Calibrated In-Game Modular DSP Engine Presets', () => {
    const icePresets = [
        'inline_6_m3',
        'inline_6_touring',
        'inline_4_sport',
        'civic_vtec_b16',
        'v8_crossplane',
        'boxer_6_cayman'
    ];

    test.each(icePresets)('%s has 0-detune phase-locked orders, body dome, load sensitivity, and -24dB/oct fizz rejection', (presetKey) => {
        const engine = new ModularAudioEngine(presetKey);
        expect(engine.patch.nodes.length).toBeGreaterThanOrEqual(12);
        expect(engine.patch.connections.some(c => c.to === 'master')).toBe(true);

        const oscNodes = engine.patch.nodes.filter(n => n.type === 'oscillator');
        expect(oscNodes.length).toBeGreaterThanOrEqual(4);
        for (const osc of oscNodes) {
            expect(osc.params.detune || 0).toBe(0);
        }

        // Sweep across entire RPM band without NaN/Inf
        for (let rpm = engine.patch.baseRPM; rpm <= engine.patch.redlineRPM; rpm += 400) {
            const st = engine.calculateState(rpm, 0.6);
            for (const ns of Object.values(st.nodeStates)) {
                if (ns.frequency !== undefined) expect(Number.isFinite(ns.frequency)).toBe(true);
                if (ns.gain !== undefined) expect(ns.gain).toBeGreaterThanOrEqual(0);
            }
        }

        // Mid-RPM body boost + strong 8 kHz buzz rejection
        const midRpm = Math.round((engine.patch.baseRPM + engine.patch.redlineRPM) * 0.45);
        engine.currentRPM = midRpm;
        engine.currentThrottle = 0.5;
        const bodyDb = engine.getCompositeFilterFrequencyResponse([220])[0];
        const fizzDb = engine.getCompositeFilterFrequencyResponse([8000])[0];
        expect(bodyDb).toBeGreaterThan(1.0);
        expect(fizzDb - bodyDb).toBeLessThan(-35.0);

        // Load sensitivity (0% overrun vs 100% WOT opens lowpasses)
        const s0 = engine.calculateState(midRpm, 0);
        const s1 = engine.calculateState(midRpm, 1);
        expect(s1.nodeStates['flt_exh_lp'].frequency).toBeGreaterThan(s0.nodeStates['flt_exh_lp'].frequency);
        expect(s1.nodeStates['flt_exh_lp2'].frequency).toBeGreaterThan(s0.nodeStates['flt_exh_lp2'].frequency);
    });

    test('civic_vtec_b16 keeps 3500 RPM warm and unleashes high-cam top end at 8200 RPM', () => {
        const engine = new ModularAudioEngine('civic_vtec_b16');
        const mid = engine.calculateState(3500, 0.5);
        const high = engine.calculateState(8200, 1.0);

        expect(mid.nodeStates['flt_exh_lp'].frequency).toBeLessThan(800);
        expect(mid.nodeStates['osc_vtec60'].gain).toBeLessThan(0.2);

        expect(high.nodeStates['flt_exh_lp'].frequency).toBeGreaterThan(3200);
        expect(high.nodeStates['osc_vtec60'].gain).toBeGreaterThan(0.6);
    });

    test('ev_microlino is silent at 0 RPM / 0 throttle and scales cleanly with speed', () => {
        const engine = new ModularAudioEngine('ev_microlino');
        const idle = engine.calculateState(0, 0);
        expect(idle.nodeStates['osc_inv40'].gain).toBe(0);
        expect(idle.nodeStates['osc_inv80'].gain).toBe(0);
        expect(idle.nodeStates['noise_tire'].gain).toBe(0);

        const fast = engine.calculateState(8000, 0.7);
        expect(fast.nodeStates['osc_inv40'].gain).toBeGreaterThan(0.3);
        expect(fast.nodeStates['noise_tire'].gain).toBeGreaterThan(0.08);
    });
});

describe('GameAudioController Integration & Mock Web Audio Smoothing', () => {
    class MockAudioNode {
        constructor() {
            const mkParam = (v) => ({
                value: v,
                setValueAtTime: jest.fn(function (nv) { this.value = nv; }),
                setTargetAtTime: jest.fn(function (nv) { this.value = nv; })
            });
            this.gain = mkParam(1);
            this.frequency = mkParam(440);
            this.detune = mkParam(0);
            this.Q = mkParam(1);
            this.delayTime = mkParam(0);
            this.threshold = mkParam(0);
            this.knee = mkParam(0);
            this.ratio = mkParam(1);
            this.attack = mkParam(0);
            this.release = mkParam(0);
        }
        connect = jest.fn();
        disconnect = jest.fn();
        start = jest.fn();
        stop = jest.fn();
    }

    class MockAudioContext {
        currentTime = 0;
        sampleRate = 48000;
        state = 'running';
        destination = new MockAudioNode();
        createGain() { return new MockAudioNode(); }
        createOscillator() { return new MockAudioNode(); }
        createBiquadFilter() { return new MockAudioNode(); }
        createWaveShaper() { return new MockAudioNode(); }
        createDelay() { return new MockAudioNode(); }
        createDynamicsCompressor() { return new MockAudioNode(); }
        createBufferSource() { return new MockAudioNode(); }
        createAnalyser() { const a = new MockAudioNode(); a.fftSize = 2048; return a; }
        createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
        close = jest.fn().mockResolvedValue();
        resume = jest.fn().mockResolvedValue();
    }

    test('Every CAR_MODELS entry maps cleanly to a calibrated ModularAudioEngine preset', () => {
        const ctrl = new GameAudioController();
        for (const [carKey, spec] of Object.entries(CAR_MODELS)) {
            expect(CAR_SOUND_PRESETS[carKey]).toBeDefined();
            expect(MODULAR_PATCH_PRESETS[CAR_SOUND_PRESETS[carKey]]).toBeDefined();

            ctrl.setCarModel(carKey, spec);
            expect(ctrl.activePresetKey).toBe(CAR_SOUND_PRESETS[carKey]);
            if (spec.engineConfig?.redline) {
                expect(ctrl.drivetrain.redlineRPM).toBe(spec.engineConfig.redline);
            }
        }
        expect(GAME_SOUND_OPTIONS.some(o => o.key === 'auto')).toBe(true);
    });

    test('Supports sound overrides, click-free smoothing, safety limiter, and idempotent stop()', () => {
        globalThis.AudioContext = MockAudioContext;
        try {
            const ctrl = new GameAudioController();
            ctrl.setCarModel('cayman_987', CAR_MODELS.cayman_987);
            ctrl.init();

            expect(ctrl.synth.outputMuteNode).toBeDefined();
            expect(ctrl.synth.limiterNode).toBeDefined();
            expect(ctrl.synth.limiterNode.threshold.setValueAtTime).toHaveBeenCalledWith(-3, 0);

            // Initially silenced in menu; first gameplay update unmutes smoothly and uses setTargetAtTime
            expect(ctrl.isSilenced).toBe(true);
            ctrl.update(1 / 60, 0, 1);
            expect(ctrl.isSilenced).toBe(false);
            expect(ctrl.synth.outputMuteNode.gain.setTargetAtTime).toHaveBeenCalledWith(1, 0, 0.03);
            const masterGain = ctrl.synth.getMasterGain().gain;
            expect(masterGain.setTargetAtTime).toHaveBeenCalled();

            // stop() mutes output cleanly WITHOUT closing AudioContext
            ctrl.stop();
            expect(ctrl.isSilenced).toBe(true);
            expect(ctrl.synth.ctx.close).not.toHaveBeenCalled();
            expect(ctrl.synth.outputMuteNode.gain.setTargetAtTime).toHaveBeenCalledWith(0, 0, 0.04);

            // Second stop() in a row is a no-op
            const prevCalls = ctrl.synth.outputMuteNode.gain.setTargetAtTime.mock.calls.length;
            ctrl.stop();
            expect(ctrl.synth.outputMuteNode.gain.setTargetAtTime.mock.calls.length).toBe(prevCalls);

            // Sound override switches preset regardless of car
            ctrl.setSoundOverride('f1_golden_era_v10');
            expect(ctrl.activePresetKey).toBe('f1_golden_era_v10');
            ctrl.setSoundOverride('auto');
            expect(ctrl.activePresetKey).toBe('boxer_6_cayman');

            // Persistent mute stays muted even across update()
            expect(ctrl.toggleMute()).toBe(true);
            ctrl.update(1 / 60, 100, 1);
            expect(ctrl.synth.outputMuteNode.gain.value).toBe(0);

            ctrl.destroy();
        } finally {
            delete globalThis.AudioContext;
        }
    });
});
