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
            case 'ev': // Electric Vehicle (Microlino) - Sci-fi whine
                harmonics = [
                    { mult: 1.0, gain: 1.0 }, // Fundamental whine
                    { mult: 3.0, gain: 0.1 }  // Slight harmonic
                ];
                this.baseFreq = 200; // Start higher
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

            // Sawtooth for engines, Sine for EV
            if (this.engineType === 'ev') {
                osc.type = 'sine';
            } else {
                osc.type = 'sawtooth';
            }

            // Apply multiplier to base freq later in update
            osc.frequency.value = this.baseFreq * h.mult;

            gain.gain.value = h.gain;

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.start();

            return { osc, gain, mult: h.mult, baseGain: h.gain };
        });

        // Add a LowPass filter to dampen the sawtooth harshness
        // For EV, we might want less filtering or a BandPass, but LowPass is fine
        if (this.globalFilter) this.globalFilter.disconnect();
        this.globalFilter = this.ctx.createBiquadFilter();
        this.globalFilter.type = 'lowpass';
        this.globalFilter.frequency.value = 800; // Muffle it a bit

        // Re-route master gain to filter
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
            // Pitch scales linearly from base (0 speed) to high (max speed)
            const currentFreq = this.baseFreq + (absSpeed * 600);

            this.oscillators.forEach(item => {
                item.osc.frequency.setTargetAtTime(currentFreq * item.mult, this.ctx.currentTime, 0.1);
            });

            // EV is quiet at idle/stopped, louder with speed/load
            // Load adds "whine intensity"
            const vol = (absSpeed * 0.3) + (absThrottle * 0.2);
            this.masterGain.gain.setTargetAtTime(Math.min(0.5, vol), this.ctx.currentTime, 0.1);

            // Filter open
            this.globalFilter.frequency.setTargetAtTime(2000 + absSpeed * 2000, this.ctx.currentTime, 0.1);

        } else {
            // ICE Logic
            // RPM = Idle + SpeedFactor
            // Load affects volume and filter brightness

            const rpmFactor = 1 + (absSpeed * 3.0);

            // Random fluctuation for idle (loping)
            const idleFluctuation = (absSpeed < 0.05) ? (Math.random() * 0.05) : 0;

            const currentFreq = this.baseFreq * (rpmFactor + idleFluctuation);

            this.oscillators.forEach(item => {
                item.osc.frequency.setTargetAtTime(currentFreq * item.mult, this.ctx.currentTime, 0.1);
            });

            if (this.globalFilter) {
                // Filter Freq: Base 400.
                // Speed adds 1500.
                // Load adds 2000 (Gives that "bwaaaa" intake sound opening up).
                const filterFreq = 400 + (absSpeed * 1500) + (absThrottle * 2000);
                this.globalFilter.frequency.setTargetAtTime(filterFreq, this.ctx.currentTime, 0.1);
            }

            // Volume: Base 0.1 (Idle).
            // Speed adds 0.1.
            // Load adds 0.2.
            const targetVol = 0.1 + (absSpeed * 0.1) + (absThrottle * 0.2);
            this.masterGain.gain.setTargetAtTime(Math.min(0.5, targetVol), this.ctx.currentTime, 0.1);
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
