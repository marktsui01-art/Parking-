import { Vector2 } from './Vector2.js';
import { SAT } from './SAT.js';

export const CAR_MODELS = {
    m3_g80: {
        // Dimensions (mm): Wheelbase: 2857, Width: 1903, Front Overhang: 837, Rear Overhang: 1100, Total Length: 4794
        name: "BMW M3 (G80)",
        wheelBase: 57,
        width: 38,
        frontOverhang: 17,
        rearOverhang: 22,
        maxSteerAngle: 40 * Math.PI / 180,
        engineConfig: { type: 'i6' }
    },
    g31_xdrive: {
        // Dimensions (mm): Wheelbase: 2975, Width: 1868, Front Overhang: 865, Rear Overhang: 1103, Total Length: 4943
        name: "BMW G31 xDrive (5 Series Touring)",
        wheelBase: 60,
        width: 37,
        frontOverhang: 17,
        rearOverhang: 22,
        maxSteerAngle: 35 * Math.PI / 180,
        engineConfig: { type: 'i6' }
    },
    e91_touring: {
        // Dimensions (mm): Wheelbase: 2760, Width: 1817, Front Overhang: 755, Rear Overhang: 1005, Total Length: 4520
        name: "BMW E91 (3 Series Touring)",
        wheelBase: 55,
        width: 36,
        frontOverhang: 15,
        rearOverhang: 20,
        maxSteerAngle: 42 * Math.PI / 180,
        engineConfig: { type: 'i6' }
    },
    mini_5d: {
        // Dimensions (mm): Wheelbase: 2567, Width: 1727, Front Overhang: 778, Rear Overhang: 660, Total Length: 4005
        name: "Mini Cooper 5-Door (2019)",
        wheelBase: 51,
        width: 35,
        frontOverhang: 16,
        rearOverhang: 13,
        maxSteerAngle: 40 * Math.PI / 180,
        engineConfig: { type: 'i4' }
    },
    jazz_mk1: {
        // Dimensions (mm): Wheelbase: 2450, Width: 1675, Front Overhang: 700, Rear Overhang: 680, Total Length: 3830
        name: "Honda Jazz (Mk1 2000)",
        wheelBase: 49,
        width: 34,
        frontOverhang: 14,
        rearOverhang: 14,
        maxSteerAngle: 42 * Math.PI / 180,
        engineConfig: { type: 'i4' }
    },
    civic_eg: {
        // Dimensions (mm): Wheelbase: 2570, Width: 1695, Front Overhang: 785, Rear Overhang: 715, Total Length: 4070
        name: "Honda Civic (EG Generation)",
        wheelBase: 51,
        width: 34,
        frontOverhang: 16,
        rearOverhang: 14,
        maxSteerAngle: 38 * Math.PI / 180,
        engineConfig: { type: 'i4' }
    },
    cayman_987: {
        // Dimensions (mm): Wheelbase: 2415, Width: 1801, Front Overhang: 954, Rear Overhang: 978, Total Length: 4347
        name: "Porsche Cayman (987.2 S)",
        wheelBase: 48,
        width: 36,
        frontOverhang: 19,
        rearOverhang: 20,
        maxSteerAngle: 35 * Math.PI / 180,
        engineConfig: { type: 'flat6' }
    },
    microlino: {
        // Dimensions (mm): Wheelbase: 1566, Width: 1473, Front Overhang: 743, Rear Overhang: 210, Total Length: 2519
        name: "Microlino 2.0",
        wheelBase: 31,
        width: 29,
        frontOverhang: 15,
        rearOverhang: 4,
        maxSteerAngle: 45 * Math.PI / 180,
        engineConfig: { type: 'i4' } // Actually electric but user didn't ask for EV sound logic, stick to i4 or maybe silent? I'll use i4 for now as per instructions "We don't need to simulate gears... assume it'll drive around in 1st gear".
    },
    jimny: {
        // Dimensions (mm): Wheelbase: 2250, Width: 1645, Front Overhang: 615, Rear Overhang: 780, Total Length: 3645
        name: "Suzuki Jimny (JB74)",
        wheelBase: 45,
        width: 33,
        frontOverhang: 12,
        rearOverhang: 16,
        maxSteerAngle: 35 * Math.PI / 180,
        engineConfig: { type: 'i4' }
    },
    landcruiser_300: {
        // Dimensions (mm): Wheelbase: 2850, Width: 1985, Front Overhang: 930, Rear Overhang: 1220, Total Length: 5000
        name: "Toyota Land Cruiser 300",
        wheelBase: 57,
        width: 40,
        frontOverhang: 19,
        rearOverhang: 24,
        maxSteerAngle: 30 * Math.PI / 180,
        engineConfig: { type: 'v8' }
    }
};

/**
 * Helper to create polygon vertices for a rectangle.
 * @param {number} x Center x
 * @param {number} y Center y
 * @param {number} width Width (x-axis local)
 * @param {number} height Height (y-axis local)
 * @param {number} angle Angle in radians
 * @returns {Vector2[]}
 */
export function createPolygon(x, y, width, height, angle) {
    const hw = width / 2;
    const hh = height / 2;
    // Corners relative to center, unrotated
    const corners = [
        new Vector2(hw, hh),
        new Vector2(hw, -hh),
        new Vector2(-hw, -hh),
        new Vector2(-hw, hh)
    ];
    // Rotate and translate
    return corners.map(p => p.rotate(angle).add(new Vector2(x, y)));
}

/**
 * Headless Game Engine containing physics and logic.
 */
export class GameEngine {
    constructor(config = {}) {
        // Car State
        // this.pos represents the REAR AXLE position
        this.pos = new Vector2(100, 300);
        this.heading = 0; // Radians, 0 points East
        this.velocity = 0;
        this.steerAngle = 0;

        // Constants / Configuration
        this.maxSpeed = config.maxSpeed || 300;
        this.acceleration = config.acceleration || 150;
        this.friction = config.friction || 0.95;

        // Level Data
        this.currentLevel = null;
        this.crashTimer = 0; // Timer for visual feedback
        this.won = false;
        this.score = 1000;

        // Load initial car model if provided in config, otherwise default
        // The original code used a global `currentCarKey`, we'll let the caller handle that or default it.
        if (config.carModel) {
            this.applyCarModel(config.carModel);
        } else {
             // Fallback or let the caller call applyCarModel explicitly.
             // To match original behavior which auto-loaded 'm3_g80':
             this.applyCarModel(CAR_MODELS['m3_g80']);
        }
    }

    applyCarModel(modelSpec) {
        this.carName = modelSpec.name;
        this.wheelBase = modelSpec.wheelBase;
        this.maxSteerAngle = modelSpec.maxSteerAngle;
        this.width = modelSpec.width;
        this.frontOverhang = modelSpec.frontOverhang;
        this.rearOverhang = modelSpec.rearOverhang;
        this.length = this.frontOverhang + this.wheelBase + this.rearOverhang;
    }

    loadLevel(level) {
        this.currentLevel = level;
        this.pos = new Vector2(level.start.x, level.start.y);
        this.heading = level.start.heading || 0;
        this.velocity = 0;
        this.steerAngle = 0;
        this.crashTimer = 0;
        this.won = false;
        this.score = 1000;
    }

    /**
     * Updates the game state.
     * @param {number} dt Delta time in seconds
     * @param {object} input Input state { steer: number, throttle: number }
     */
    update(dt, input) {
        if (this.won) return;

        // Store previous state for collision resolution
        const prevPos = new Vector2(this.pos.x, this.pos.y);
        const prevHeading = this.heading;

        // 1. Update Steering Angle
        this.steerAngle = input.steer * this.maxSteerAngle;

        // 2. Update Velocity (Acceleration & Friction)
        if (input.throttle !== 0) {
            this.velocity += input.throttle * this.acceleration * dt;
        } else {
            this.velocity *= Math.pow(this.friction, dt * 60);
            if (Math.abs(this.velocity) < 0.1) this.velocity = 0;
        }

        // Clamp speed
        this.velocity = Math.max(-this.maxSpeed, Math.min(this.maxSpeed, this.velocity));

        // 3. Movement
        this.pos.x += this.velocity * Math.cos(this.heading) * dt;
        this.pos.y += this.velocity * Math.sin(this.heading) * dt;

        const angularVelocity = (this.velocity / this.wheelBase) * Math.tan(this.steerAngle);
        this.heading += angularVelocity * dt;

        // 4. Collision Detection & Resolution
        if (this.crashTimer > 0) this.crashTimer -= dt;

        if (this.currentLevel) {
            let colliding = false;
            const carPoly = this.getPolygon();

            for (const obs of this.currentLevel.obstacles) {
                const obsPoly = createPolygon(obs.x, obs.y, obs.width, obs.height, obs.angle);
                if (SAT.checkCollision(carPoly, obsPoly)) {
                    colliding = true;
                    break;
                }
            }

            if (colliding) {
                // Resolve: Revert and stop
                this.pos = prevPos;
                this.heading = prevHeading;

                // Penalty only if we were actually moving
                if (Math.abs(this.velocity) > 1) {
                    this.score = Math.max(0, this.score - 50);
                    this.crashTimer = 0.5; // Flash for 500ms
                }
                this.velocity = 0;
            }

            // Win Condition
            const isStationary = Math.abs(this.velocity) < 1;
            const isInputNeutral = input.steer === 0 && input.throttle === 0;

            if (isStationary && isInputNeutral && !colliding) {
                const target = this.currentLevel.target;
                const targetPoly = createPolygon(target.x, target.y, target.width, target.height, target.angle);

                if (this.isCarInside(carPoly, targetPoly)) {
                    this.won = true;
                }
            }
        }
    }

    isCarInside(carPoly, targetPoly) {
        for (const p of carPoly) {
            if (!SAT.isPointInConvexPoly(p, targetPoly)) return false;
        }
        return true;
    }

    /**
     * Returns the polygon representing the car's bounding box.
     * Used for SAT.
     * @returns {Vector2[]} Array of vertices
     */
    getPolygon() {
        const cos = Math.cos(this.heading);
        const sin = Math.sin(this.heading);

        // Calculate the center of the car body relative to the Rear Axle position (this.pos)
        // Back of car is at -rearOverhang, Front of car is at wheelBase + frontOverhang
        const bodyCenterDist = (this.wheelBase + this.frontOverhang - this.rearOverhang) / 2;

        const centerX = this.pos.x + bodyCenterDist * cos;
        const centerY = this.pos.y + bodyCenterDist * sin;
        const center = new Vector2(centerX, centerY);

        const hw = this.width / 2;
        const hl = this.length / 2;

        // Relative corners to the CENTER
        const corners = [
            new Vector2(hl, hw),
            new Vector2(hl, -hw),
            new Vector2(-hl, -hw),
            new Vector2(-hl, hw)
        ];

        // Rotate and translate (using the calculated center)
        return corners.map(p => p.rotate(this.heading).add(center));
    }
}
