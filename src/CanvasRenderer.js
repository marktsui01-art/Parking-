import { Vector2 } from './Vector2.js';

/**
 * Renders the game state to a canvas.
 */
export class CanvasRenderer {
    /**
     * @param {HTMLCanvasElement} canvas
     */
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    /**
     * Draws the current frame.
     * @param {GameEngine} engine
     */
    render(engine) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Level Elements
        if (engine.currentLevel) {
            // Draw Target
            const target = engine.currentLevel.target;
            this.drawRotatedRect(target.x, target.y, target.width, target.height, target.angle, 'rgba(46, 204, 113, 0.2)', '#2ecc71', [10, 5]);

            // Draw Obstacles
            for (const obs of engine.currentLevel.obstacles) {
                this.drawRotatedRect(obs.x, obs.y, obs.width, obs.height, obs.angle, '#7f8c8d');
            }

            // Draw Start Position (Ghost Car)
            if (engine.currentLevel.start) {
                const start = engine.currentLevel.start;

                // Car dims from engine config
                const ghostLength = engine.length;
                const ghostWidth = engine.width;
                const ghostWB = engine.wheelBase;

                // Center of car relative to rear axle (start position)
                const centerDist = (engine.wheelBase + engine.frontOverhang - engine.rearOverhang) / 2;
                const centerX = start.x + centerDist * Math.cos(start.heading || 0);
                const centerY = start.y + centerDist * Math.sin(start.heading || 0);

                this.drawRotatedRect(centerX, centerY, engine.length, engine.width, start.heading || 0, 'rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.4)', [5, 5]);
            }
        }

        this.ctx.save();

        // Translate to REAR AXLE (which is this.pos)
        this.ctx.translate(engine.pos.x, engine.pos.y);
        this.ctx.rotate(engine.heading);

        // Now we are in local coordinates where (0,0) is the rear axle.
        // Car center calculation for asymmetrical overhangs
        const bodyCenterX = (engine.wheelBase + engine.frontOverhang - engine.rearOverhang) / 2;
        const bodyCenterY = 0;

        // Draw Body
        // Rectangle needs to be centered at (bodyCenterX, bodyCenterY)
        this.ctx.fillStyle = '#3498db';
        if (engine.crashTimer > 0) this.ctx.fillStyle = '#e74c3c'; // Red flash on crash
        if (engine.won) this.ctx.fillStyle = '#2ecc71'; // Green if won

        // fillRect(x, y, w, h)
        this.ctx.fillRect(bodyCenterX - engine.length / 2, bodyCenterY - engine.width / 2, engine.length, engine.width);

        // Indicate front with a small line or color difference
        this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
        // Front section
        this.ctx.fillRect(bodyCenterX + engine.length / 4, bodyCenterY - engine.width / 2, engine.length / 4, engine.width);

        // Draw Wheels
        this.ctx.fillStyle = '#000';
        const wheelWidth = 12;
        const wheelHeight = 6;

        const axleY = engine.width / 2;

        // Rear Wheels (At local x=0)
        this.drawWheel(0, -axleY, wheelWidth, wheelHeight, 0);
        this.drawWheel(0, axleY, wheelWidth, wheelHeight, 0);

        // Front Wheels (At local x=wheelBase)
        this.drawWheel(engine.wheelBase, -axleY, wheelWidth, wheelHeight, engine.steerAngle);
        this.drawWheel(engine.wheelBase, axleY, wheelWidth, wheelHeight, engine.steerAngle);

        this.ctx.restore();
    }

    /**
     * Helper to draw a rotated rectangle.
     */
    drawRotatedRect(x, y, w, h, angle, fillStyle, strokeStyle = null, lineDash = []) {
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(angle);

        if (fillStyle) {
            this.ctx.fillStyle = fillStyle;
            this.ctx.fillRect(-w / 2, -h / 2, w, h);
        }

        if (strokeStyle) {
            this.ctx.strokeStyle = strokeStyle;
            this.ctx.lineWidth = fillStyle ? 4 : 2; // Default logic or param? Keeping simple
            if (strokeStyle === 'rgba(255, 255, 255, 0.4)') this.ctx.lineWidth = 2; // Ghost car specific hack or make generic?
            // Let's make it slightly more generic but simple for now
            this.ctx.setLineDash(lineDash);
            this.ctx.strokeRect(-w / 2, -h / 2, w, h);
        }

        this.ctx.restore();
    }

    drawWheel(x, y, w, h, angle) {
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(angle);
        this.ctx.fillRect(-w / 2, -h / 2, w, h);
        this.ctx.restore();
    }
}
