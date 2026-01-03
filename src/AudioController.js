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
        this.engineType = 'i4'; // Default
        this.baseFreq = 15; // Hz at idle fundamental
        this.currentRPM = 900;
        this.initialized = false;
        this.config = {};
    }

    init() {
        if (this.initialized) return;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) {
            console.warn("Web Audio API not supported.");
            return;
        }

        this.ctx = new AudioContext();

        // 1. Distortion
        this.distortion = this.ctx.createWaveShaper();
        this.distortion.curve = this.makeDistortionCurve(15);
        this.distortion.oversample = '4x';

        // 2. Master Gain
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.4;

        // 3. Reverb / Exhaust Resonance (Convolution)
        this.reverb = this.ctx.createConvolver();
        this.reverb.buffer = this.createExhaustImpulse(0.1, 0.5); // 100ms short metallic decay

        // 4. Sub-Bass Layer for physical "oomph"
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

        this.masterGain.connect(this.ctx.destination);

        this.initialized = true;

        // Start initial engine sound (idle)
        this.setupEngineSound();
    }

    createExhaustImpulse(duration, decay) {
        const sampleRate = this.ctx.sampleRate;
        const length = sampleRate * duration;
        const impulse = this.ctx.createBuffer(2, length, sampleRate);
        for (let i = 0; i < 2; i++) {
            const channelData = impulse.getChannelData(i);
            for (let j = 0; j < length; j++) {
                // White noise with exponential decay
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
        this.noiseGain.gain.value = 0; // Starts silent

        // Filter for the noise (exhaust rumble vs valve clatter)
        this.noiseFilter = this.ctx.createBiquadFilter();
        this.noiseFilter.type = 'lowpass';
        this.noiseFilter.frequency.value = 100;

        this.noise.connect(this.noiseFilter);
        this.noiseFilter.connect(this.noiseGain);
        this.noiseGain.connect(this.masterGain);
        this.noise.start();
    }

    setEngineType(config) {
        if (config && config.type) {
            this.engineType = config.type;
        } else {
            this.engineType = 'i4'; // Default
        }

        // Re-setup if already initialized
        if (this.initialized) {
            this.setupEngineSound();
        }
    }

    setupEngineSound() {
        // Stop existing oscillators
        this.stop();

        if (!this.ctx) return;

        // Define harmonics based on engine type
        // Fundamental frequency base: ~80-100Hz for idle
        let harmonics = [];

        switch (this.engineType) {
            case 'i6': // Inline 6 - Smooth but powerful
                harmonics = [
                    { mult: 1.0, gain: 0.5 },   // Fundamental "Body"
                    { mult: 3.0, gain: 0.8 },   // Main Firing
                    { mult: 6.0, gain: 0.3 },   // Smooth singing
                    { mult: 1.5, gain: 0.4 },   // Balanced sub-rumble
                    { mult: 4.5, gain: 0.2 }
                ];
                this.baseFreq = 18;
                break;
            case 'v8': // V8 - The big muscle
                harmonics = [
                    { mult: 1.0, gain: 0.7 },   // Massive fundamental body
                    { mult: 2.0, gain: 0.6 },   // Low end "Gub-Gub"
                    { mult: 4.0, gain: 0.8 },   // Main firing
                    { mult: 0.5, gain: 0.4 },   // Sub-harmonic "Shake"
                    { mult: 8.0, gain: 0.1 }
                ];
                this.baseFreq = 16;
                break;
            case 'flat6': // Boxer 6 - Mechanical and raspy
                harmonics = [
                    { mult: 3.0, gain: 0.6 },
                    { mult: 1.5, gain: 0.6 },   // Pulse
                    { mult: 1.0, gain: 0.4 },   // Body
                    { mult: 6.0, gain: 0.2 },
                    { mult: 0.75, gain: 0.2 }
                ];
                this.baseFreq = 17;
                break;
            case 'ev':
                harmonics = [
                    { mult: 1.0, gain: 0.8 },
                    { mult: 2.0, gain: 0.2 }
                ];
                this.baseFreq = 200;
                break;
            default: // i4
                harmonics = [
                    { mult: 2.0, gain: 0.8 },
                    { mult: 1.0, gain: 0.4 },
                    { mult: 4.0, gain: 0.2 }
                ];
                this.baseFreq = 20;
                break;
        }

        this.oscillators = harmonics.map(h => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            if (this.engineType === 'ev') {
                osc.type = 'sine';
            } else if (this.engineType === 'flat6') {
                osc.type = 'triangle';
            } else {
                osc.type = 'sawtooth';
            }

            osc.frequency.value = this.baseFreq * h.mult;
            gain.gain.value = h.gain;

            osc.connect(gain);
            // CONNECT TO DISTORTION for harmonics
            gain.connect(this.distortion);
            osc.start();

            return { osc, gain, mult: h.mult, baseGain: h.gain };
        });

        // Setup Sub-Bass layer
        if (this.engineType !== 'ev') {
            this.subOsc = this.ctx.createOscillator();
            this.subOsc.type = 'sine';
            this.subOsc.frequency.value = this.baseFreq * 0.5;
            this.subOsc.connect(this.subGain);
            this.subGain.connect(this.masterGain);
            this.subOsc.start();
        }

        // Refine filtering with Resonance (Q)
        if (this.globalFilter) this.globalFilter.disconnect();
        this.globalFilter = this.ctx.createBiquadFilter();
        this.globalFilter.type = 'lowpass';
        this.globalFilter.Q.value = 2; // Add some "Growl" at the cutoff
        this.globalFilter.frequency.value = 300;

        // Distortion -> MasterGain is already connected in init
        // We just need to ensure masterGain is connected to Destination or the filter
        this.masterGain.disconnect();
        this.masterGain.connect(this.globalFilter);
        this.globalFilter.connect(this.ctx.destination);
    }

    update(speedRatio, throttle = 0) {
        if (!this.initialized || !this.ctx) return;
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const absSpeed = Math.abs(speedRatio);
        const absThrottle = Math.abs(throttle);

        if (this.engineType === 'ev') {
            // EV Logic: Pitch = Speed, Volume = Speed + Load
            const currentFreq = this.baseFreq + (absSpeed * 600);
            this.oscillators.forEach(item => {
                item.osc.frequency.setTargetAtTime(currentFreq * item.mult, this.ctx.currentTime, 0.1);
            });

            const vol = (absSpeed * 0.3) + (absThrottle * 0.2);
            this.masterGain.gain.setTargetAtTime(Math.min(0.5, vol), this.ctx.currentTime, 0.1);
            this.globalFilter.frequency.setTargetAtTime(2000 + absSpeed * 2000, this.ctx.currentTime, 0.1);
            if (this.noiseGain) this.noiseGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);

        } else {
            // ICE Logic - Muscular
            const rpmFactor = 1 + (absSpeed * 6.0); // 1.0 to 7.0 range
            this.currentRPM = Math.floor(rpmFactor * 900);

            const idleFluctuation = (absSpeed < 0.05) ? (Math.random() * 0.02) : 0;
            const currentFreq = this.baseFreq * (rpmFactor + idleFluctuation);

            this.oscillators.forEach(item => {
                // Harmonic Roll-off: Higher harmonics lose gain as fundamental gets faster
                // This prevents the "whine" at high RPM
                let gainScale = 1.0;
                if (item.mult > 4) {
                    gainScale = Math.max(0.1, 1.0 - (absSpeed * 0.8));
                }
                item.gain.gain.setTargetAtTime(item.baseGain * gainScale, this.ctx.currentTime, 0.1);
                item.osc.frequency.setTargetAtTime(currentFreq * item.mult, this.ctx.currentTime, 0.05);
            });

            if (this.globalFilter) {
                // Growly resonant filter - move slower than pitch
                const baseFilter = 300 + (absSpeed * 800);
                const loadFilter = absThrottle * 1500;
                this.globalFilter.frequency.setTargetAtTime(Math.min(6000, baseFilter + loadFilter), this.ctx.currentTime, 0.1);
            }

            // Move resonators based on frequency to clear "harsh" zones
            if (this.resonator1) {
                this.resonator1.frequency.setTargetAtTime(800 + (absSpeed * 1200), this.ctx.currentTime, 0.1);
            }

            // Noise for "Texture/Weight" (rumble)
            if (this.noiseGain) {
                const nVol = (absSpeed * 0.25) + (absThrottle * 0.25);
                this.noiseGain.gain.setTargetAtTime(Math.min(0.5, nVol), this.ctx.currentTime, 0.05);
                this.noiseFilter.frequency.setTargetAtTime(40 + (absSpeed * 100), this.ctx.currentTime, 0.1);
            }

            if (this.subOsc) {
                this.subOsc.frequency.setTargetAtTime(currentFreq * 0.5, this.ctx.currentTime, 0.05);
                // Sub kicks in more under load
                const sVol = 0.1 + (absThrottle * 0.4);
                this.subGain.gain.setTargetAtTime(sVol, this.ctx.currentTime, 0.1);
            }

            // Exhaust Resonance (Convolver) Wet Mix
            if (this.wetGain) {
                // More resonance under load for "tubular" pipe sound
                const rVol = 0.2 + (absThrottle * 0.3) + (absSpeed * 0.1);
                this.wetGain.gain.setTargetAtTime(Math.min(0.6, rVol), this.ctx.currentTime, 0.1);
            }

            const targetVol = 0.2 + (absSpeed * 0.25) + (absThrottle * 0.45);
            this.masterGain.gain.setTargetAtTime(Math.min(0.9, targetVol), this.ctx.currentTime, 0.05);
        }
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
