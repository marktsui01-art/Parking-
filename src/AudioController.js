export const ENGINE_PRESETS = {
    i4: {
        type: 'ice',
        name: 'Inline 4',
        baseFreq: 22,
        oscType: 'sawtooth',
        harmonics: [
            { mult: 2.0, gain: 0.8 },
            { mult: 1.0, gain: 0.4 },
            { mult: 4.0, gain: 0.2 }
        ],
        params: {
            redline: 6500,
            idleRPM: 900,
            mechanical: { frictionGain: 0.3, valveGain: 0.2, filterBase: 1000 },
            intake: { gain: 0.5, filterBase: 400, filterRange: 2000, screamGain: 0.2 },
            exhaust: { gain: 0.8, filterBase: 300, filterRange: 1500, resonance: 0.4, distortion: 15 },
            vtec: { enabled: false, rpm: 5800, liftGain: 0.3, freqShift: 1.0 },
            physics: { acceleration: 130, maxSpeed: 270 }
        }
    },
    i6: {
        type: 'ice',
        name: 'Inline 6',
        baseFreq: 18,
        oscType: 'sawtooth',
        harmonics: [
            { mult: 1.0, gain: 0.5 },
            { mult: 3.0, gain: 0.8 },
            { mult: 6.0, gain: 0.3 },
            { mult: 1.5, gain: 0.4 },
            { mult: 4.5, gain: 0.2 }
        ],
        params: {
            redline: 7000,
            idleRPM: 900,
            mechanical: { frictionGain: 0.2, valveGain: 0.3, filterBase: 1200 },
            intake: { gain: 0.4, filterBase: 300, filterRange: 1800, screamGain: 0.1 },
            exhaust: { gain: 0.7, filterBase: 250, filterRange: 1200, resonance: 0.5, distortion: 12 },
            vtec: { enabled: false, rpm: 0, liftGain: 0, freqShift: 1.0 },
            physics: { acceleration: 180, maxSpeed: 350 }
        }
    },
    v8: {
        type: 'ice',
        name: 'V8',
        baseFreq: 16,
        oscType: 'sawtooth',
        harmonics: [
            { mult: 1.0, gain: 0.7 },
            { mult: 2.0, gain: 0.6 },
            { mult: 4.0, gain: 0.8 },
            { mult: 0.5, gain: 0.4 },
            { mult: 8.0, gain: 0.1 }
        ],
        params: {
            redline: 5800,
            idleRPM: 850,
            mechanical: { frictionGain: 0.4, valveGain: 0.1, filterBase: 800 },
            intake: { gain: 0.6, filterBase: 200, filterRange: 1500, screamGain: 0.0 },
            exhaust: { gain: 1.0, filterBase: 150, filterRange: 1000, resonance: 0.6, distortion: 20 },
            vtec: { enabled: false, rpm: 0, liftGain: 0, freqShift: 1.0 },
            physics: { acceleration: 110, maxSpeed: 250 }
        }
    },
    flat6: {
        type: 'ice',
        name: 'Flat 6',
        baseFreq: 17,
        oscType: 'triangle',
        harmonics: [
            { mult: 3.0, gain: 0.6 },
            { mult: 1.5, gain: 0.6 },
            { mult: 1.0, gain: 0.4 },
            { mult: 6.0, gain: 0.2 },
            { mult: 0.75, gain: 0.2 }
        ],
        params: {
            redline: 7400,
            idleRPM: 950,
            mechanical: { frictionGain: 0.3, valveGain: 0.4, filterBase: 1500 },
            intake: { gain: 0.5, filterBase: 400, filterRange: 2500, screamGain: 0.2 },
            exhaust: { gain: 0.6, filterBase: 300, filterRange: 2000, resonance: 0.4, distortion: 10 },
            vtec: { enabled: true, rpm: 4500, liftGain: 0.2, freqShift: 1.1 },
            physics: { acceleration: 175, maxSpeed: 340 }
        }
    },
    civic_vtec: {
        type: 'ice',
        name: 'Civic VTEC',
        baseFreq: 22,
        oscType: 'sawtooth',
        harmonics: [
            { mult: 2.0, gain: 0.6 },
            { mult: 1.0, gain: 0.3 },
            { mult: 4.0, gain: 0.2 },
            { mult: 6.0, gain: 0.1 }
        ],
        params: {
            redline: 8200,
            idleRPM: 900,
            mechanical: { frictionGain: 0.2, valveGain: 0.4, filterBase: 2000 },
            intake: { gain: 0.7, filterBase: 500, filterRange: 4000, screamGain: 0.5 },
            exhaust: { gain: 0.6, filterBase: 350, filterRange: 2500, resonance: 0.3, distortion: 15 },
            vtec: { enabled: true, rpm: 5800, liftGain: 0.6, freqShift: 1.2 },
            physics: { acceleration: 145, maxSpeed: 290 }
        }
    },
    ev: {
        type: 'ev',
        name: 'Electric',
        baseFreq: 200,
        oscType: 'sine',
        harmonics: [
            { mult: 1.0, gain: 0.8 },
            { mult: 2.0, gain: 0.2 }
        ],
        params: {
            redline: 15000,
            idleRPM: 0,
            mechanical: { frictionGain: 0.1, valveGain: 0, filterBase: 5000 },
            intake: { gain: 0, filterBase: 0, filterRange: 0, screamGain: 0 },
            exhaust: { gain: 0, filterBase: 0, filterRange: 0, resonance: 0, distortion: 0 },
            vtec: { enabled: false, rpm: 0, liftGain: 0, freqShift: 1.0 }
        }
    }
};

export class AudioController {
    constructor() {
        this.ctx = null;
        this.initialized = false;

        // Final Output Chain
        this.masterGain = null;
        this.analyser = null;

        // Component Groups
        this.mechanical = { gain: null, oscillators: [], noise: null };
        this.intake = { gain: null, noise: null, filter: null };
        this.exhaust = { gain: null, oscillators: [], distortion: null, reverb: null, resonators: [] };
        this.sub = { gain: null, osc: null };

        // Config & State
        this.config = JSON.parse(JSON.stringify(ENGINE_PRESETS.i4));
        this.currentRPM = 900;
        this.isVtecActive = false;
    }

    init() {
        if (this.initialized) return;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        this.ctx = new AudioContext();

        // Master Analyser
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 2048;

        // Master Gain
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.5;

        // --- SUB BASS LAYER ---
        this.sub.gain = this.ctx.createGain();
        this.sub.gain.gain.value = 0;

        // --- MECHANICAL LAYER ---
        this.mechanical.gain = this.ctx.createGain();
        this.mechanical.gain.gain.value = 1.0;

        // --- INTAKE LAYER ---
        this.intake.gain = this.ctx.createGain();
        this.intake.filter = this.ctx.createBiquadFilter();
        this.intake.filter.type = 'bandpass';
        this.intake.filter.Q.value = 1.0;

        // --- EXHAUST LAYER ---
        this.exhaust.gain = this.ctx.createGain();
        this.exhaust.distortion = this.ctx.createWaveShaper();
        this.exhaust.reverb = this.ctx.createConvolver();
        this.exhaust.reverb.buffer = this.createExhaustImpulse(0.12, 0.4);

        this.exhaust.dryGain = this.ctx.createGain();
        this.exhaust.wetGain = this.ctx.createGain();

        // Resonators (targeting annoying whines)
        this.exhaust.resonator1 = this.ctx.createBiquadFilter();
        this.exhaust.resonator1.type = 'notch';
        this.exhaust.resonator1.frequency.value = 1000;
        this.exhaust.resonator1.Q.value = 4;

        this.exhaust.resonator2 = this.ctx.createBiquadFilter();
        this.exhaust.resonator2.type = 'notch';
        this.exhaust.resonator2.frequency.value = 2500;
        this.exhaust.resonator2.Q.value = 2;

        // --- ROUTING ---
        // Sub -> Master
        this.sub.gain.connect(this.masterGain);

        // Mechanical -> Master
        this.mechanical.gain.connect(this.masterGain);

        // Intake -> Master
        this.intake.filter.connect(this.intake.gain);
        this.intake.gain.connect(this.masterGain);

        // Exhaust Oscillators -> Distortion -> Resonators -> [Dry/Wet] -> Master
        this.exhaust.distortion.connect(this.exhaust.resonator1);
        this.exhaust.resonator1.connect(this.exhaust.resonator2);

        this.exhaust.resonator2.connect(this.exhaust.dryGain);
        this.exhaust.resonator2.connect(this.exhaust.reverb);
        this.exhaust.reverb.connect(this.exhaust.wetGain);

        this.exhaust.dryGain.connect(this.exhaust.gain);
        this.exhaust.wetGain.connect(this.exhaust.gain);
        this.exhaust.gain.connect(this.masterGain);

        // Master -> Analyser -> Dest
        this.masterGain.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);

        this.initialized = true;
        this.setupNoiseSources();
        this.setupEngineSound();
    }

    createExhaustImpulse(duration, decay) {
        const sampleRate = this.ctx.sampleRate;
        const length = sampleRate * duration;
        const impulse = this.ctx.createBuffer(2, length, sampleRate);
        for (let i = 0; i < 2; i++) {
            const channel = impulse.getChannelData(i);
            for (let j = 0; j < length; j++) {
                channel[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / length, decay);
            }
        }
        return impulse;
    }

    setupNoiseSources() {
        const bufferSize = 2 * this.ctx.sampleRate;
        const whiteBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const whiteData = whiteBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) whiteData[i] = Math.random() * 2 - 1;

        // Mechanical Noise (friction/valves)
        this.mechanical.noise = this.ctx.createBufferSource();
        this.mechanical.noise.buffer = whiteBuffer;
        this.mechanical.noise.loop = true;
        this.mechanical.noiseFilter = this.ctx.createBiquadFilter();
        this.mechanical.noiseFilter.type = 'lowpass';
        this.mechanical.noiseFilter.frequency.value = 1000;
        this.mechanical.noise.connect(this.mechanical.noiseFilter);
        this.mechanical.noiseFilter.connect(this.mechanical.gain);
        this.mechanical.noise.start();

        // Intake Noise (air rush)
        this.intake.noise = this.ctx.createBufferSource();
        this.intake.noise.buffer = whiteBuffer;
        this.intake.noise.loop = true;
        this.intake.noise.connect(this.intake.filter);
        this.intake.noise.start();
    }

    setEngineType(config) {
        let presetKey = 'i4';
        if (config && config.type && ENGINE_PRESETS[config.type]) presetKey = config.type;

        this.config = JSON.parse(JSON.stringify(ENGINE_PRESETS[presetKey]));
        if (config) Object.assign(this.config, config);

        if (this.initialized) {
            this.updateDistortionCurve();
            this.setupEngineSound();
        }
    }

    updateDistortionCurve() {
        const amount = this.config.params.exhaust.distortion || 10;
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        const k = amount;
        const deg = Math.PI / 180;
        for (let i = 0; i < n_samples; ++i) {
            const x = (i * 2) / n_samples - 1;
            curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
        }
        this.exhaust.distortion.curve = curve;
    }

    setupEngineSound() {
        this.stopNodes();
        if (!this.ctx) return;

        const { harmonics, baseFreq, oscType } = this.config;

        // Mechanical Oscillators (cleaner)
        this.mechanical.oscillators = harmonics.map(h => {
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.type = 'triangle'; // Mechanical is more "pingy"
            osc.frequency.value = baseFreq * h.mult;
            g.gain.value = h.gain * 0.3; // Mechanical is quieter background
            osc.connect(g);
            g.connect(this.mechanical.gain);
            osc.start();
            return { osc, gain: g, mult: h.mult, baseGain: h.gain };
        });

        // Exhaust Oscillators (aggressive)
        this.exhaust.oscillators = harmonics.map(h => {
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.type = oscType || 'sawtooth';
            osc.frequency.value = baseFreq * h.mult;
            g.gain.value = h.gain;
            osc.connect(g);
            g.connect(this.exhaust.distortion);
            osc.start();
            return { osc, gain: g, mult: h.mult, baseGain: h.gain };
        });

        // Sub Bass
        if (this.config.type !== 'ev') {
            this.sub.osc = this.ctx.createOscillator();
            this.sub.osc.type = 'sine';
            this.sub.osc.frequency.value = baseFreq * 0.5;
            this.sub.osc.connect(this.sub.gain);
            this.sub.osc.start();
        }

        this.updateDistortionCurve();
    }

    update(speedRatio, throttle = 0) {
        if (!this.initialized || !this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const state = this.calculateState(speedRatio, throttle);
        this.applyState(state);
    }

    /**
     * Pure calculation of engine state based on inputs.
     * Can be unit tested without AudioContext.
     */
    calculateState(speedRatio, throttle = 0) {
        const absSpeed = Math.abs(speedRatio);
        const absThrottle = Math.max(0, throttle);
        const p = this.config.params;

        const rpmRange = p.redline - p.idleRPM;
        const currentRPM = p.idleRPM + (absSpeed * rpmRange);
        const rpmFactor = currentRPM / (p.idleRPM || 1);
        const currentFreq = this.config.baseFreq * rpmFactor;

        const isVtecActive = p.vtec.enabled && currentRPM >= p.vtec.rpm;
        const vtecFreqShift = isVtecActive ? p.vtec.freqShift : 1.0;

        return {
            currentRPM,
            currentFreq,
            isVtecActive,
            vtecFreqShift,
            absSpeed,
            absThrottle,
            mechVol: p.mechanical.frictionGain + (absSpeed * 0.4),
            intakeVol: (p.intake.gain * absThrottle) + (isVtecActive ? p.intake.screamGain * absThrottle : 0),
            intakeFreq: p.intake.filterBase + (absSpeed * p.intake.filterRange) + (isVtecActive ? 1000 : 0),
            exhaustVol: p.exhaust.gain * (0.2 + (absThrottle * 0.6) + (absSpeed * 0.2)),
            subVol: (absThrottle * 0.5) + (absSpeed * 0.1),
            masterVol: Math.min(1.0, 0.3 + (absSpeed * 0.2) + (absThrottle * 0.3))
        };
    }

    /**
     * Applies calculated state to Web Audio nodes.
     */
    applyState(state) {
        const p = this.config.params;
        this.currentRPM = state.currentRPM;
        this.isVtecActive = state.isVtecActive;

        // 1. Mechanical
        this.mechanical.gain.gain.setTargetAtTime(state.mechVol, this.ctx.currentTime, 0.1);
        this.mechanical.oscillators.forEach(item => {
            item.osc.frequency.setTargetAtTime(state.currentFreq * item.mult * state.vtecFreqShift, this.ctx.currentTime, 0.05);
        });

        // 2. Intake
        this.intake.gain.gain.setTargetAtTime(state.intakeVol, this.ctx.currentTime, 0.05);
        this.intake.filter.frequency.setTargetAtTime(state.intakeFreq, this.ctx.currentTime, 0.1);
        this.intake.filter.Q.setTargetAtTime(state.isVtecActive ? 5.0 : 1.0, this.ctx.currentTime, 0.1);

        // 3. Exhaust
        this.exhaust.gain.gain.setTargetAtTime(state.exhaustVol, this.ctx.currentTime, 0.05);
        this.exhaust.dryGain.gain.setTargetAtTime(0.7, this.ctx.currentTime, 0.1);
        this.exhaust.wetGain.gain.setTargetAtTime(p.exhaust.resonance + (state.absThrottle * 0.3), this.ctx.currentTime, 0.1);

        this.exhaust.oscillators.forEach(item => {
            let gScale = 1.0;
            if (item.mult > 4 && !state.isVtecActive) gScale = Math.max(0.2, 1.0 - (state.absSpeed * 0.6));
            if (state.isVtecActive && item.mult > 2) gScale = 1.2;

            item.gain.gain.setTargetAtTime(item.baseGain * gScale, this.ctx.currentTime, 0.05);
            item.osc.frequency.setTargetAtTime(state.currentFreq * item.mult * state.vtecFreqShift, this.ctx.currentTime, 0.05);
        });

        // 4. Sub & Master
        this.sub.gain.gain.setTargetAtTime(state.subVol, this.ctx.currentTime, 0.1);
        if (this.sub.osc) {
            this.sub.osc.frequency.setTargetAtTime(state.currentFreq * 0.5, this.ctx.currentTime, 0.05);
        }
        this.masterGain.gain.setTargetAtTime(state.masterVol, this.ctx.currentTime, 0.1);
    }
    stopNodes() {
        [...this.mechanical.oscillators, ...this.exhaust.oscillators].forEach(item => {
            try { item.osc.stop(); item.osc.disconnect(); } catch (e) { }
        });
        if (this.sub.osc) {
            try { this.sub.osc.stop(); this.sub.osc.disconnect(); } catch (e) { }
            this.sub.osc = null;
        }
        this.mechanical.oscillators = [];
        this.exhaust.oscillators = [];
    }

    stop() {
        this.stopNodes();
    }
}
