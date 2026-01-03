export class AudioController {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.oscillators = [];
        this.engineType = 'i4'; // Default
        this.baseFreq = 100; // Hz at idle
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
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3; // Global volume
        this.masterGain.connect(this.ctx.destination);
        this.initialized = true;

        // Start initial engine sound (idle)
        this.setupEngineSound();
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
            case 'i6': // Inline 6 (BMW B58) - Smooth, singing 3rd order
                // 3rd harmonic dominates (3 cylinders fire per rev)
                harmonics = [
                    { mult: 1.5, gain: 0.3 },   // 1.5 order (sub-harmonic rumble)
                    { mult: 3.0, gain: 0.6 },   // 3rd order (Main Note)
                    { mult: 6.0, gain: 0.2 },   // 6th order (High singing)
                    { mult: 4.5, gain: 0.1 }    // Texture
                ];
                this.baseFreq = 50; // Lower base for deeper idle
                break;
            case 'v8': // V8 (Land Cruiser) - Rumble
                // Crossplane V8 has strong 4th order but uneven pulsing creates subharmonics (0.5, 1.5, 2.5)
                harmonics = [
                    { mult: 2.0, gain: 0.4 },   // 2nd order (deep)
                    { mult: 4.0, gain: 0.5 },   // 4th order (main firing freq)
                    { mult: 2.5, gain: 0.2 },   // Rumble texture
                    { mult: 3.5, gain: 0.1 }    // Rumble texture
                ];
                this.baseFreq = 40; // Very deep idle
                break;
            case 'flat6': // Flat 6 (Cayman) - Howl, raspy
                // Similar to I6 but different timbre, often higher pitched feel
                harmonics = [
                    { mult: 3.0, gain: 0.5 },
                    { mult: 6.0, gain: 0.3 },
                    { mult: 9.0, gain: 0.15 },
                    { mult: 1.5, gain: 0.2 } // Boxer rumble at low RPM
                ];
                this.baseFreq = 55;
                break;
            default: // i4 (Generic)
                // 2nd order dominance (2 cylinders fire per rev)
                harmonics = [
                    { mult: 2.0, gain: 0.6 },
                    { mult: 4.0, gain: 0.2 },
                    { mult: 1.0, gain: 0.2 }
                ];
                this.baseFreq = 60;
                break;
        }

        this.oscillators = harmonics.map(h => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            // Sawtooth or triangle often better for engines than sine
            osc.type = 'sawtooth';

            // Apply multiplier to base freq later in update
            osc.frequency.value = this.baseFreq * h.mult;

            gain.gain.value = h.gain;

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.start();

            return { osc, gain, mult: h.mult, baseGain: h.gain };
        });

        // Add a LowPass filter to dampen the sawtooth harshness
        // Actually, let's insert a filter between masterGain and destination or individual gains
        // For simplicity, I'll just use the raw sawtooth for now, maybe too harsh.
        // Let's add a global lowpass filter.
        if (this.globalFilter) this.globalFilter.disconnect();
        this.globalFilter = this.ctx.createBiquadFilter();
        this.globalFilter.type = 'lowpass';
        this.globalFilter.frequency.value = 800; // Muffle it a bit

        // Re-route master gain to filter
        this.masterGain.disconnect();
        this.masterGain.connect(this.globalFilter);
        this.globalFilter.connect(this.ctx.destination);
    }

    update(speedRatio) {
        if (!this.initialized || !this.ctx) return;
        if (this.ctx.state === 'suspended') {
             this.ctx.resume();
        }

        // speedRatio: 0 to 1 (Ratio of max speed)
        // Map speed to "RPM"
        // Idle: 1.0 multiplier
        // Redline: 4.0 multiplier (e.g. 800rpm to 3200rpm equivalent, or higher)
        const rpmFactor = 1 + (Math.abs(speedRatio) * 3.0);

        // Random fluctuation for idle (loping)
        const idleFluctuation = (speedRatio < 0.05) ? (Math.random() * 0.05) : 0;

        const currentFreq = this.baseFreq * (rpmFactor + idleFluctuation);

        this.oscillators.forEach(item => {
            item.osc.frequency.setTargetAtTime(currentFreq * item.mult, this.ctx.currentTime, 0.1);

            // Increase volume with RPM slightly
            // Also open filter with RPM
        });

        if (this.globalFilter) {
            // Open the filter as we speed up to let high harmonics through
            const filterFreq = 400 + (Math.abs(speedRatio) * 2000);
            this.globalFilter.frequency.setTargetAtTime(filterFreq, this.ctx.currentTime, 0.1);
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
    }
}
