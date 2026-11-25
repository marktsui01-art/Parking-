/**
 * GameAudioController.js
 *
 * Bridges GameEngine driving physics, the Chapter 1.5 parking Drivetrain,
 * and the ModularAudioEngine subtractive formant synthesizer for all game cars.
 */

import { ModularAudioEngine, MODULAR_PATCH_PRESETS } from './ModularAudioEngine.js';
import { Drivetrain } from './Drivetrain.js';

export const CAR_SOUND_PRESETS = {
    m3_g80: 'inline_6_m3',
    g31_xdrive: 'inline_6_touring',
    e91_touring: 'inline_6_touring',
    mini_5d: 'inline_4_sport',
    jazz_mk1: 'inline_4_sport',
    civic_eg: 'civic_vtec_b16',
    cayman_987: 'boxer_6_cayman',
    microlino: 'ev_microlino',
    jimny: 'inline_4_sport',
    landcruiser_300: 'v8_crossplane'
};

export const GAME_SOUND_OPTIONS = [
    { key: 'auto', label: 'Auto (Match Selected Car)' },
    { key: 'inline_6_m3', label: 'BMW M3 (S58 3.0L Inline-6)' },
    { key: 'inline_6_touring', label: 'BMW Touring (Smooth Inline-6)' },
    { key: 'boxer_6_cayman', label: 'Porsche Cayman (987.2 Flat-6)' },
    { key: 'civic_vtec_b16', label: 'Honda Civic (B16A DOHC VTEC)' },
    { key: 'inline_4_sport', label: '16V Sport Inline-4 (Mini / Jazz / Jimny)' },
    { key: 'v8_crossplane', label: 'Cross-Plane V8 (Land Cruiser 300)' },
    { key: 'ev_microlino', label: 'Microlino 2.0 (Electric Drive)' },
    { key: 'dodge_viper_v10', label: 'Dodge Viper V10 (8.4L Side-Pipe)' },
    { key: 'f1_golden_era_v10', label: 'F1 Golden Era V10 (19,000 RPM)' }
];

const ENGINE_TYPE_FALLBACK = {
    flat6: 'boxer_6_cayman',
    i6: 'inline_6_m3',
    civic_vtec: 'civic_vtec_b16',
    v8: 'v8_crossplane',
    ev: 'ev_microlino',
    i4: 'inline_4_sport'
};

export class GameAudioController {
    constructor() {
        this.synth = new ModularAudioEngine('inline_6_m3');
        this.drivetrain = new Drivetrain();

        this.initialized = false;
        this.userMuted = false;
        this.isSilenced = true;

        this.carKey = 'm3_g80';
        this.modelSpec = null;
        this.soundOverride = 'auto';
        this.activePresetKey = 'inline_6_m3';
        this.activePresetName = MODULAR_PATCH_PRESETS.inline_6_m3.name;

        this.currentRPM = 850;
        this.engineLoad = 0;
        this.gear = 'N';
        this.isBraking = false;
        this.isOverrun = false;
    }

    /**
     * Initialize or resume Web Audio context on user gesture.
     */
    init() {
        if (!this.initialized) {
            this.synth.init();
            this.initialized = true;
            this.synth.setMuted(this.userMuted || this.isSilenced, 0);
            return;
        }
        if (this.synth.ctx && this.synth.ctx.state === 'suspended' && typeof this.synth.ctx.resume === 'function') {
            this.synth.ctx.resume().catch(() => {});
        }
    }

    /**
     * Resolve modular preset key for a car model, honoring user override.
     * @param {string} carKey
     * @param {object|null} [modelSpec]
     * @returns {string}
     */
    resolvePresetKey(carKey, modelSpec = null) {
        if (this.soundOverride !== 'auto' && MODULAR_PATCH_PRESETS[this.soundOverride]) {
            return this.soundOverride;
        }
        if (carKey && CAR_SOUND_PRESETS[carKey]) {
            return CAR_SOUND_PRESETS[carKey];
        }
        const engType = modelSpec?.engineConfig?.type;
        if (engType && ENGINE_TYPE_FALLBACK[engType]) {
            return ENGINE_TYPE_FALLBACK[engType];
        }
        return 'inline_4_sport';
    }

    /**
     * Configure audio synthesizer and drivetrain for a selected car model.
     * @param {string} carKey
     * @param {object|null} [modelSpec]
     */
    setCarModel(carKey, modelSpec = null) {
        this.carKey = carKey || 'm3_g80';
        this.modelSpec = modelSpec || this.modelSpec;

        const presetKey = this.resolvePresetKey(this.carKey, this.modelSpec);
        const targetRedline = (this.soundOverride === 'auto' && this.modelSpec?.engineConfig?.redline)
            ? this.modelSpec.engineConfig.redline
            : MODULAR_PATCH_PRESETS[presetKey].redlineRPM;

        if (this.activePresetKey !== presetKey || this.synth.patch?.redlineRPM !== targetRedline) {
            this.synth.loadPreset(presetKey);
            if (targetRedline && this.synth.patch) {
                this.synth.patch.redlineRPM = targetRedline;
                if (this.synth.ctx) {
                    this.synth.update(this.currentRPM, this.engineLoad, 0);
                }
            }
        }

        this.activePresetKey = presetKey;
        this.activePresetName = this.synth.patch?.name || MODULAR_PATCH_PRESETS[presetKey].name;

        const flareRange = presetKey === 'v8_crossplane'
            ? 950
            : presetKey === 'f1_golden_era_v10'
                ? 3200
                : 1350;

        this.drivetrain.configure({
            idleRPM: this.synth.patch.baseRPM,
            redlineRPM: this.synth.patch.redlineRPM,
            maxSpeed: this.modelSpec?.maxSpeed || 300,
            isEV: presetKey === 'ev_microlino',
            flareRange
        });

        this.currentRPM = this.drivetrain.rpm;
        this.engineLoad = 0;
        this.gear = 'N';
        this.isBraking = false;
        this.isOverrun = false;
    }

    /**
     * Override the engine sound preset independently of selected car ('auto' restores car mapping).
     * @param {string} presetKey
     */
    setSoundOverride(presetKey) {
        this.soundOverride = (presetKey && MODULAR_PATCH_PRESETS[presetKey]) ? presetKey : 'auto';
        this.setCarModel(this.carKey, this.modelSpec);
    }

    /**
     * Set persistent user mute state.
     * @param {boolean} muted
     */
    setMuted(muted) {
        this.userMuted = !!muted;
        this.synth.setMuted(this.userMuted || this.isSilenced, 0.03);
    }

    /**
     * Toggle persistent user mute state.
     * @returns {boolean} New muted state
     */
    toggleMute() {
        this.setMuted(!this.userMuted);
        return this.userMuted;
    }

    /**
     * Advance drivetrain and update live synthesizer at 60 Hz with click-free smoothing.
     * @param {number} dt Timestep in seconds
     * @param {number} velocityPxPerSec Vehicle velocity in px/s
     * @param {number} [rawThrottleInput=0] Signed throttle input [-1..1]
     * @returns {object}
     */
    update(dt, velocityPxPerSec = 0, rawThrottleInput = 0) {
        const st = this.drivetrain.step(dt, velocityPxPerSec, rawThrottleInput);
        this.currentRPM = st.rpm;
        this.engineLoad = st.engineLoad;
        this.gear = st.gear;
        this.isBraking = st.isBraking;
        this.isOverrun = st.isOverrun;

        if (this.isSilenced) {
            this.isSilenced = false;
            this.synth.setMuted(this.userMuted, 0.03);
        }

        if (this.initialized && this.synth.ctx && this.synth.ctx.state === 'suspended' && !this.userMuted && typeof this.synth.ctx.resume === 'function') {
            this.synth.ctx.resume().catch(() => {});
        }

        this.synth.update(st.rpm, st.engineLoad, 0.025);
        return st;
    }

    /**
     * Idempotently silence audio when in menus or game-over without tearing down AudioContext.
     */
    stop() {
        if (this.isSilenced) return;
        this.isSilenced = true;
        this.synth.setMuted(true, 0.04);
        this.drivetrain.reset();
        this.currentRPM = this.drivetrain.rpm;
        this.engineLoad = 0;
        this.gear = 'N';
        this.isBraking = false;
        this.isOverrun = false;
    }

    /**
     * Completely tear down underlying Web Audio graph and close context.
     */
    destroy() {
        this.synth.stop();
        this.initialized = false;
        this.isSilenced = true;
    }
}
