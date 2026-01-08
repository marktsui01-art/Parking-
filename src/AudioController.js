export const ENGINE_PRESETS = {
    i4: {
        type: 'ice',
        baseFreq: 20,
        oscType: 'sawtooth',
        harmonics: [
            { mult: 2.0, gain: 0.8 },
            { mult: 1.0, gain: 0.4 },
            { mult: 4.0, gain: 0.2 }
        ],
        params: {
            rpm: { min: 900, range: 6.0 },
            filter: { base: 300, speedCoef: 800, throttleCoef: 1500, max: 6000, Q: 2 },
            noise: { filterBase: 40, filterSpeedCoef: 100, gainSpeedCoef: 0.25, gainThrottleCoef: 0.25, maxGain: 0.5 },
            sub: { freqMult: 0.5, baseGain: 0.1, throttleGain: 0.4 },
            exhaust: { baseGain: 0.2, throttleGain: 0.3, speedGain: 0.1, maxGain: 0.6 },
            distortion: { amount: 15 }
        }
    },
    i6: {
        type: 'ice',
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
            rpm: { min: 900, range: 6.0 },
            filter: { base: 300, speedCoef: 800, throttleCoef: 1500, max: 6000, Q: 2 },
            noise: { filterBase: 40, filterSpeedCoef: 100, gainSpeedCoef: 0.25, gainThrottleCoef: 0.25, maxGain: 0.5 },
            sub: { freqMult: 0.5, baseGain: 0.1, throttleGain: 0.4 },
            exhaust: { baseGain: 0.2, throttleGain: 0.3, speedGain: 0.1, maxGain: 0.6 },
            distortion: { amount: 15 }
        }
    },
    v8: {
        type: 'ice',
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
            rpm: { min: 900, range: 6.0 },
            filter: { base: 300, speedCoef: 800, throttleCoef: 1500, max: 6000, Q: 2 },
            noise: { filterBase: 40, filterSpeedCoef: 100, gainSpeedCoef: 0.25, gainThrottleCoef: 0.25, maxGain: 0.5 },
            sub: { freqMult: 0.5, baseGain: 0.1, throttleGain: 0.4 },
            exhaust: { baseGain: 0.2, throttleGain: 0.3, speedGain: 0.1, maxGain: 0.6 },
            distortion: { amount: 15 }
        }
    },
    flat6: {
        type: 'ice',
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
            rpm: { min: 900, range: 6.0 },
            filter: { base: 300, speedCoef: 800, throttleCoef: 1500, max: 6000, Q: 2 },
            noise: { filterBase: 40, filterSpeedCoef: 100, gainSpeedCoef: 0.25, gainThrottleCoef: 0.25, maxGain: 0.5 },
            sub: { freqMult: 0.5, baseGain: 0.1, throttleGain: 0.4 },
            exhaust: { baseGain: 0.2, throttleGain: 0.3, speedGain: 0.1, maxGain: 0.6 },
            distortion: { amount: 15 }
        }
    },
    ev: {
        type: 'ev',
        baseFreq: 200,
        oscType: 'sine',
        harmonics: [
            { mult: 1.0, gain: 0.8 },
            { mult: 2.0, gain: 0.2 }
        ],
        params: {
            // EV Specific params
            rpm: { min: 0, range: 0 },
            filter: { base: 2000, speedCoef: 2000, throttleCoef: 0, max: 20000, Q: 1 }, // Used for high pitch filter
            noise: { filterBase: 0, filterSpeedCoef: 0, gainSpeedCoef: 0, gainThrottleCoef: 0, maxGain: 0 }, // Often silent
            sub: { freqMult: 0, baseGain: 0, throttleGain: 0 },
            exhaust: { baseGain: 0, throttleGain: 0, speedGain: 0, maxGain: 0 },
            distortion: { amount: 0 }
        }
    }
};

export class AudioController {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.distortion = null;
        this.noise = null;
        this.noiseGain = null;
        this.reverb = null;
        this.subOsc = null;
        this.subGain = null;
        this.oscillators = [];

        this.analyser = null;

        // Default Config
        this.config = JSON.parse(JSON.stringify(ENGINE_PRESETS.i4));

        // Runtime state
        this.currentRPM = 900;
        this.initialized = false;

        // Layer Gains (0.0 to 1.0)
        this.layerGains = {
            mechanical: 1.0, // Oscillators
            noise: 1.0,      // Rumble
            sub: 1.0,        // Sub-bass
            exhaust: 1.0     // Wet reverb
        };
    }

    init() {
        if (this.initialized) return;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) {
            console.warn("Web Audio API not supported.");
            return;
        }

        this.ctx = new AudioContext();

        // 0. Analyser for Visualization
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 2048;

        // 1. Distortion
        this.distortion = this.ctx.createWaveShaper();
        this.updateDistortionCurve();
        this.distortion.oversample = '4x';

        // 2. Master Gain
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.4;

        // 3. Reverb / Exhaust Resonance (Convolution)
        this.reverb = this.ctx.createConvolver();
        this.reverb.buffer = this.createExhaustImpulse(0.1, 0.5);

        // 4. Sub-Bass Layer
        this.subGain = this.ctx.createGain();
        this.subGain.gain.value = 0;

        // 5. Noise Source
        this.setupNoiseSource();

        // 6. Notch Filters (Resonators)
        this.resonator1 = this.ctx.createBiquadFilter();
        this.resonator1.type = 'notch';
        this.resonator1.frequency.value = 1000;
        this.resonator1.Q.value = 5;

        this.resonator2 = this.ctx.createBiquadFilter();
        this.resonator2.type = 'notch';
        this.resonator2.frequency.value = 2500;
        this.resonator2.Q.value = 2;

        // Routing
        // Oscillators -> Distortion -> Resonators -> Reverb (Wet/Dry) -> MasterGain
        this.distortion.connect(this.resonator1);
        this.resonator1.connect(this.resonator2);

        // Parallel Reverb Path
        this.dryGain = this.ctx.createGain();
        this.dryGain.gain.value = 0.8;
        this.wetGain = this.ctx.createGain();
        this.wetGain.gain.value = 0.3;

        this.resonator2.connect(this.dryGain);
        this.resonator2.connect(this.reverb);
        this.reverb.connect(this.wetGain);

        this.dryGain.connect(this.masterGain);
        this.wetGain.connect(this.masterGain);
        this.subGain.connect(this.masterGain);

        // Final Output
        this.masterGain.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);

        this.initialized = true;

        // Start initial engine sound
        this.setupEngineSound();
    }

    createExhaustImpulse(duration, decay) {
        if (!this.ctx) return null;
        const sampleRate = this.ctx.sampleRate;
        const length = sampleRate * duration;
        const impulse = this.ctx.createBuffer(2, length, sampleRate);
        for (let i = 0; i < 2; i++) {
            const channelData = impulse.getChannelData(i);
            for (let j = 0; j < length; j++) {
                channelData[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / length, decay);
            }
        }
        return impulse;
    }

    makeDistortionCurve(amount) {
        const k = typeof amount === 'number' ? amount : 50;
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        const deg = Math.PI / 180;
        for (let i = 0; i < n_samples; ++i) {
            const x = (i * 2) / n_samples - 1;
            curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
        }
        return curve;
    }

    updateDistortionCurve() {
        if (this.distortion && this.config.params && this.config.params.distortion) {
            this.distortion.curve = this.makeDistortionCurve(this.config.params.distortion.amount);
        }
    }

    setupNoiseSource() {
        const bufferSize = 2 * this.ctx.sampleRate;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        this.noise = this.ctx.createBufferSource();
        this.noise.buffer = noiseBuffer;
        this.noise.loop = true;

        this.noiseGain = this.ctx.createGain();
        this.noiseGain.gain.value = 0;

        this.noiseFilter = this.ctx.createBiquadFilter();
        this.noiseFilter.type = 'lowpass';
        this.noiseFilter.frequency.value = 100;

        this.noise.connect(this.noiseFilter);
        this.noiseFilter.connect(this.noiseGain);
        this.noiseGain.connect(this.masterGain);
        this.noise.start();
    }

    setEngineType(config) {
        let presetKey = 'i4';
        if (config && config.type && ENGINE_PRESETS[config.type]) {
            presetKey = config.type;
        }

        // Initialize from preset
        this.config = JSON.parse(JSON.stringify(ENGINE_PRESETS[presetKey]));

        // Merge in specific overrides (like redline, vtecRPM, etc)
        if (config) {
            Object.assign(this.config, config);
        }
        this.engineType = this.config.type || presetKey;

        // Re-setup if already initialized
        if (this.initialized) {
            this.updateDistortionCurve();
            this.setupEngineSound();
        }
    }

    setLayerGain(layer, value) {
        if (this.layerGains.hasOwnProperty(layer)) {
            this.layerGains[layer] = Math.max(0, Math.min(1, value));
        }
    }

    setupEngineSound() {
        this.stop();
        if (!this.ctx) return;

        // Use config
        const { harmonics, baseFreq, oscType } = this.config;

        this.oscillators = harmonics.map(h => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = oscType || 'sawtooth';
            osc.frequency.value = baseFreq * h.mult;
            gain.gain.value = h.gain;

            osc.connect(gain);
            gain.connect(this.distortion);
            osc.start();

            return { osc, gain, mult: h.mult, baseGain: h.gain };
        });

        // Setup Sub-Bass layer
        if (this.config.type !== 'ev') {
            this.subOsc = this.ctx.createOscillator();
            this.subOsc.type = 'sine';
            this.subOsc.frequency.value = baseFreq * (this.config.params.sub.freqMult || 0.5);
            this.subOsc.connect(this.subGain);
            this.subOsc.start();
        }

        // Global Filter
        if (this.globalFilter) this.globalFilter.disconnect();
        this.globalFilter = this.ctx.createBiquadFilter();
        this.globalFilter.type = 'lowpass';
        this.globalFilter.Q.value = this.config.params.filter.Q || 2;
        this.globalFilter.frequency.value = this.config.params.filter.base || 300;

        // Reconnect Master Gain to Filter
        this.masterGain.disconnect();
        this.masterGain.connect(this.globalFilter);
        this.globalFilter.connect(this.analyser);
    }

    update(speedRatio, throttle = 0) {
        if (!this.initialized || !this.ctx) return;
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const absSpeed = Math.abs(speedRatio);
        const absThrottle = Math.abs(throttle);
        const p = this.config.params;

        if (this.config.type === 'ev') {
            // EV Logic
            const currentFreq = this.config.baseFreq + (absSpeed * 600);
            this.oscillators.forEach(item => {
                item.osc.frequency.setTargetAtTime(currentFreq * item.mult, this.ctx.currentTime, 0.1);
                item.gain.gain.setTargetAtTime(item.baseGain * this.layerGains.mechanical, this.ctx.currentTime, 0.1);
            });

            const vol = (absSpeed * 0.3) + (absThrottle * 0.2);
            this.masterGain.gain.setTargetAtTime(Math.min(0.5, vol), this.ctx.currentTime, 0.1);

            // Filter
            const fBase = p.filter.base;
            const fSpeed = p.filter.speedCoef;
            this.globalFilter.frequency.setTargetAtTime(fBase + absSpeed * fSpeed, this.ctx.currentTime, 0.1);

            if (this.noiseGain) this.noiseGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);

        } else {
            // ICE Logic - Muscular & Realistic Redline
            const idleRPM = p.rpm.min;
            const redline = this.config.redline || 6500;
            const rpmRange = redline - idleRPM;

            // rpmFactor: 1.0 (Idle) to Max (Redline)
            const speedRatioClamped = Math.min(1.0, absSpeed);
            this.currentRPM = Math.floor(idleRPM + (speedRatioClamped * rpmRange));
            const rpmFactor = this.currentRPM / idleRPM;

            const idleFluctuation = (absSpeed < 0.05) ? (Math.random() * 0.02) : 0;
            const currentFreq = this.config.baseFreq * (rpmFactor + idleFluctuation);

            // VTEC / Lift Check
            const vtecActive = (this.config.vtecRPM && this.currentRPM >= this.config.vtecRPM) ||
                (this.config.liftRPM && this.currentRPM >= this.config.liftRPM);

            this.oscillators.forEach(item => {
                // Harmonic Roll-off: Less aggressive to keep high frequencies
                let gainScale = 1.0;
                if (item.mult > 4) {
                    // Above VTEC, we BOOST high harmonics for the "scream"
                    if (vtecActive) {
                        gainScale = 1.2;
                    } else {
                        gainScale = Math.max(0.3, 1.0 - (absSpeed * 0.5));
                    }
                }
                // Apply Layer Gain
                const finalGain = item.baseGain * gainScale * this.layerGains.mechanical;
                item.gain.gain.setTargetAtTime(finalGain, this.ctx.currentTime, 0.05);
                item.osc.frequency.setTargetAtTime(currentFreq * item.mult, this.ctx.currentTime, 0.05);
            });

            if (this.globalFilter) {
                // Brighter filter, especially in VTEC
                const vtecBoost = vtecActive ? 1500 : 0;
                const baseFilter = p.filter.base + (absSpeed * p.filter.speedCoef) + vtecBoost;
                const loadFilter = absThrottle * p.filter.throttleCoef;
                this.globalFilter.frequency.setTargetAtTime(Math.min(8000, baseFilter + loadFilter), this.ctx.currentTime, 0.05);
            }

            // Move resonators based on frequency
            if (this.resonator1) {
                this.resonator1.frequency.setTargetAtTime(1000 + (absSpeed * 1500), this.ctx.currentTime, 0.1);
            }

            // Noise for "Mechanical Hiss / Scream"
            if (this.noiseGain) {
                // More noise at high speed/load
                const nVol = (absSpeed * p.noise.gainSpeedCoef) + (absThrottle * p.noise.gainThrottleCoef);
                const finalNoiseGain = Math.min(p.noise.maxGain, nVol) * this.layerGains.noise;
                this.noiseGain.gain.setTargetAtTime(finalNoiseGain, this.ctx.currentTime, 0.05);
                // Allow more high freq noise back in with speed
                this.noiseFilter.frequency.setTargetAtTime(p.noise.filterBase + (absSpeed * 3000), this.ctx.currentTime, 0.1);
            }

            if (this.subOsc) {
                this.subOsc.frequency.setTargetAtTime(currentFreq * p.sub.freqMult, this.ctx.currentTime, 0.05);
                const sVol = (p.sub.baseGain + (absThrottle * p.sub.throttleGain)) * this.layerGains.sub;
                this.subGain.gain.setTargetAtTime(sVol, this.ctx.currentTime, 0.1);
            }

            // Exhaust Resonance (Convolver)
            if (this.wetGain) {
                const rVol = (p.exhaust.baseGain + (absThrottle * p.exhaust.throttleGain) + (absSpeed * p.exhaust.speedGain)) * this.layerGains.exhaust;
                this.wetGain.gain.setTargetAtTime(Math.min(p.exhaust.maxGain, rVol), this.ctx.currentTime, 0.1);
            }

            // Dry Mix
            if (this.dryGain) {
                this.dryGain.gain.setTargetAtTime(0.8 * this.layerGains.mechanical, this.ctx.currentTime, 0.1);
            }

            const targetVol = 0.2 + (absSpeed * 0.3) + (absThrottle * 0.4);
            this.masterGain.gain.setTargetAtTime(Math.min(0.85, targetVol), this.ctx.currentTime, 0.05);
        }
    }

    getAnalyser() {
        return this.analyser;
    }

    stop() {
        this.oscillators.forEach(item => {
            try {
                item.osc.stop();
                item.osc.disconnect();
                item.gain.disconnect();
            } catch (e) { /* ignore */ }
        });
        this.oscillators = [];

        if (this.subOsc) {
            try {
                this.subOsc.stop();
                this.subOsc.disconnect();
            } catch (e) { /* ignore */ }
            this.subOsc = null;
        }
    }
}
