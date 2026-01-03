import { Vector2 } from './src/Vector2.js';
import { GameEngine } from './src/GameEngine.js';

// The following lines are just to demonstrate usage since the class already has default params
// that match the original script's "default config" or close to it.
// However, the original script used hardcoded values in `analyze_radius.js` instead of importing.
// Now we use the actual GameEngine class.

const engine = new GameEngine();
// The original script set these manually:
engine.steerAngle = engine.maxSteerAngle;
engine.velocity = 100;
const dt = 0.01;
const startPos = { x: engine.pos.x, y: engine.pos.y };
let maxDist = 0;

// Run simulation
const steps = 1000;
for (let i = 0; i < steps; i++) {
    // Physics update from index.html (now in GameEngine.update, but we want to simulate
    // specifically the turning circle logic which assumes constant velocity/steer).
    // GameEngine.update handles acceleration/friction which we might not want here?
    // The original script manually integrated.

    // Original manual integration:
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
