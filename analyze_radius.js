
class Vector2 {
    constructor(x, y) { this.x = x; this.y = y; }
    add(v) { return new Vector2(this.x + v.x, this.y + v.y); }
    sub(v) { return new Vector2(this.x - v.x, this.y - v.y); }
    scale(s) { return new Vector2(this.x * s, this.y * s); }
    rotate(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return new Vector2(this.x * cos - this.y * sin, this.x * sin + this.y * cos);
    }
}

class GameEngine {
    constructor(config = {}) {
        this.pos = new Vector2(0, 0);
        this.heading = 0;
        this.velocity = 0;
        this.steerAngle = 0;

        // Scale: ~20 pixels = 1 meter
        this.wheelBase = config.wheelBase || 56;
        this.maxSteerAngle = config.maxSteerAngle || (30 * Math.PI / 180);
        this.maxSpeed = config.maxSpeed || 300;
        this.acceleration = config.acceleration || 150;
        this.friction = config.friction || 0.98;
        this.width = config.width || 38;
        this.length = config.length || 94;
    }
}

const engine = new GameEngine();
engine.steerAngle = engine.maxSteerAngle;
engine.velocity = 100;
const dt = 0.01;
const startPos = { x: engine.pos.x, y: engine.pos.y };
let maxDist = 0;

// Run simulation
const steps = 1000;
for (let i = 0; i < steps; i++) {
    // Physics update from index.html
    engine.pos.x += engine.velocity * Math.cos(engine.heading) * dt;
    engine.pos.y += engine.velocity * Math.sin(engine.heading) * dt;
    const angularVelocity = (engine.velocity / engine.wheelBase) * Math.tan(engine.steerAngle);
    engine.heading += angularVelocity * dt;

    const dist = Math.sqrt(Math.pow(engine.pos.x - startPos.x, 2) + Math.pow(engine.pos.y - startPos.y, 2));
    if (dist > maxDist) maxDist = dist;
}

const diameter = maxDist;
const radius = diameter / 2;
const scale = 20; // px per meter

console.log(`Radius (px): ${radius.toFixed(2)}`);
console.log(`Radius (m): ${(radius / scale).toFixed(2)}`);
console.log(`Wheelbase (px): ${engine.wheelBase}`);
console.log(`Max Steer (rad): ${engine.maxSteerAngle.toFixed(4)}`);
