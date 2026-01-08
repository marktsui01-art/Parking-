
/**
 * Simple kinematic physics for engine simulation (Tuner and UI tests)
 */
export class EngineSim {
    constructor(config = {}) {
        this.velocity = 0;
        this.dt = 1 / 60;
        this.params = {
            acceleration: config.acceleration || 150,
            maxSpeed: config.maxSpeed || 300,
            rollingResist: 0.999,
            aeroDragCoeff: 0.005,
            engineBrakeCoeff: 0.985
        };
    }

    update(throttle = 0) {
        const currentMax = this.params.maxSpeed;
        const drag = this.params.aeroDragCoeff * (this.velocity / currentMax);
        const friction = this.params.rollingResist - drag;

        if (throttle > 0) {
            const torque = throttle * (this.params.acceleration * 0.8);
            this.velocity += torque * this.dt;
        }

        // Applied losses
        this.velocity *= Math.pow(friction, this.dt * 60);

        // Engine braking
        if (throttle === 0 && this.velocity > 0) {
            this.velocity *= this.params.engineBrakeCoeff;
        }

        this.velocity = Math.max(0, Math.min(currentMax, this.velocity));
        return this.velocity;
    }

    getRatio() {
        return this.velocity / this.params.maxSpeed;
    }

    reset() {
        this.velocity = 0;
    }
}
