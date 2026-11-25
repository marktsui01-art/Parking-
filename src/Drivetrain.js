/**
 * Drivetrain.js
 *
 * Stateful 60 Hz parking-focused drivetrain and flywheel model (Chapter 1.5).
 * Translates vehicle wheel speed and raw driver pedal input into physical
 * engine RPM, manifold load, braking/overrun state, and gear indicator.
 */

export class Drivetrain {
    /**
     * @param {object} [config]
     */
    constructor(config = {}) {
        this.idleRPM = config.idleRPM ?? 900;
        this.redlineRPM = config.redlineRPM ?? 7000;
        this.maxSpeed = config.maxSpeed ?? 300;
        this.isEV = !!config.isEV;
        this.flareRange = config.flareRange ?? 1350;
        this.reverseRatioBoost = config.reverseRatioBoost ?? 1.15;
        this.tauUp = config.tauUp ?? 0.085;
        this.tauDown = config.tauDown ?? 0.22;
        this.tauLoadUp = config.tauLoadUp ?? 0.035;
        this.tauLoadDown = config.tauLoadDown ?? 0.055;
        this.idleHuntAmp = config.idleHuntAmp ?? 12;

        this.rpm = this.isEV ? 0 : this.idleRPM;
        this.engineLoad = 0;
        this.time = 0;
        this.isBraking = false;
        this.isReversing = false;
        this.isOverrun = false;
        this.gear = 'N';
    }

    /**
     * Reconfigure drivetrain parameters for a new vehicle or sound preset.
     * @param {object} [config]
     */
    configure(config = {}) {
        if (config.idleRPM !== undefined) this.idleRPM = config.idleRPM;
        if (config.redlineRPM !== undefined) this.redlineRPM = config.redlineRPM;
        if (config.maxSpeed !== undefined) this.maxSpeed = config.maxSpeed;
        if (config.isEV !== undefined) this.isEV = !!config.isEV;
        if (config.flareRange !== undefined) this.flareRange = config.flareRange;
        if (config.reverseRatioBoost !== undefined) this.reverseRatioBoost = config.reverseRatioBoost;
        if (config.tauUp !== undefined) this.tauUp = config.tauUp;
        if (config.tauDown !== undefined) this.tauDown = config.tauDown;
        if (config.tauLoadUp !== undefined) this.tauLoadUp = config.tauLoadUp;
        if (config.tauLoadDown !== undefined) this.tauLoadDown = config.tauLoadDown;
        if (config.idleHuntAmp !== undefined) this.idleHuntAmp = config.idleHuntAmp;
        this.reset();
    }

    /**
     * Reset drivetrain to resting idle / standstill state.
     */
    reset() {
        this.rpm = this.isEV ? 0 : this.idleRPM;
        this.engineLoad = 0;
        this.isBraking = false;
        this.isReversing = false;
        this.isOverrun = false;
        this.gear = 'N';
    }

    /**
     * Advance drivetrain dynamics by `dt` seconds.
     * @param {number} dt Timestep in seconds
     * @param {number} [velocityPxPerSec=0] Signed longitudinal velocity in px/s
     * @param {number} [rawThrottleInput=0] Signed pedal input in [-1, 1]
     * @returns {object}
     */
    step(dt, velocityPxPerSec = 0, rawThrottleInput = 0) {
        const safeDt = Math.max(0.0001, Math.min(0.1, Number(dt) || 1 / 60));
        this.time += safeDt;

        const vel = Number(velocityPxPerSec) || 0;
        const rawInput = Number(rawThrottleInput) || 0;
        const absVel = Math.abs(vel);
        const hasInput = Math.abs(rawInput) > 0.01;

        const isBraking = hasInput && absVel > 5 && Math.sign(rawInput) !== Math.sign(vel);
        const isReversing = vel < -2 || (absVel <= 5 && rawInput < -0.01);
        const gear = isReversing ? 'R' : (absVel > 1 || rawInput > 0.01 ? 'D' : 'N');
        const rawLoad = isBraking ? 0 : Math.min(1, Math.abs(rawInput));

        const tauLoad = rawLoad > this.engineLoad ? this.tauLoadUp : this.tauLoadDown;
        const alphaLoad = 1 - Math.exp(-safeDt / tauLoad);
        this.engineLoad += (rawLoad - this.engineLoad) * alphaLoad;

        let finalRPM;
        let isOverrun = false;

        if (this.isEV) {
            const speedRatio = Math.min(1, absVel / Math.max(1, this.maxSpeed));
            const targetRPM = speedRatio * this.redlineRPM;
            const tauEv = targetRPM > this.rpm ? 0.04 : 0.08;
            const alphaRpm = 1 - Math.exp(-safeDt / tauEv);
            this.rpm += (targetRPM - this.rpm) * alphaRpm;
            finalRPM = Math.max(0, Math.min(this.redlineRPM, this.rpm));
        } else {
            const gearMult = isReversing ? this.reverseRatioBoost : 1.0;
            const rpmSpan = Math.max(1, this.redlineRPM - this.idleRPM);
            const coupledWheelRPM = this.idleRPM + (absVel / Math.max(1, this.maxSpeed)) * rpmSpan * gearMult;
            const clutchSlip = Math.max(0, 1 - absVel / 55);
            const clutchFlareRPM = this.idleRPM + rawLoad * this.flareRange * (0.35 + 0.65 * clutchSlip);
            const targetRPM = Math.min(this.redlineRPM, Math.max(this.idleRPM, coupledWheelRPM, clutchFlareRPM));

            const tauRpm = targetRPM > this.rpm ? this.tauUp : this.tauDown;
            const alphaRpm = 1 - Math.exp(-safeDt / tauRpm);
            this.rpm += (targetRPM - this.rpm) * alphaRpm;

            const idleWeight = Math.max(0, 1 - Math.max(0, this.rpm - this.idleRPM) / 600);
            const hunting = idleWeight * this.idleHuntAmp * (
                0.625 * Math.sin(this.time * 2 * Math.PI * 1.3) +
                0.375 * Math.sin(this.time * 2 * Math.PI * 3.1)
            );
            finalRPM = Math.max(this.idleRPM * 0.85, Math.min(this.redlineRPM, this.rpm + hunting));
            isOverrun = rawLoad < 0.05 && this.rpm > this.idleRPM + 250;
        }

        this.isBraking = isBraking;
        this.isReversing = isReversing;
        this.isOverrun = isOverrun;
        this.gear = gear;

        return {
            rpm: finalRPM,
            baseRPM: this.rpm,
            engineLoad: this.engineLoad,
            isBraking,
            isReversing,
            isOverrun,
            gear
        };
    }
}
