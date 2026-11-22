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
     * @param {object|null} [demoOverlay=null] - Optional { waypoints, cusps } planned path overlay
     */
    render(engine, demoOverlay = null) {
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

        if (demoOverlay && demoOverlay.waypoints && demoOverlay.waypoints.length > 1) {
            this.drawDemoOverlay(demoOverlay);
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

    /**
     * Renders the planned path (forward=green, reverse=amber) and numbered gear-shift pivot markers.
     */
    drawDemoOverlay(demoOverlay) {
        const wps = demoOverlay.waypoints;
        this.ctx.save();
        this.ctx.lineWidth = 2.5;

        let i = 0;
        while (i < wps.length) {
            const dir = wps[i].dir;
            this.ctx.beginPath();
            this.ctx.moveTo(wps[i].x, wps[i].y);
            let j = i + 1;
            while (j < wps.length && wps[j].dir === dir) {
                this.ctx.lineTo(wps[j].x, wps[j].y);
                j++;
            }
            this.ctx.strokeStyle = dir >= 0 ? 'rgba(46, 204, 113, 0.75)' : 'rgba(243, 156, 18, 0.85)';
            this.ctx.setLineDash(dir >= 0 ? [6, 4] : [4, 4]);
            this.ctx.stroke();
            i = j;
        }

        // Draw gear-shift pivot / cusp markers
        const cusps = demoOverlay.cusps || [];
        this.ctx.setLineDash([]);
        this.ctx.font = 'bold 9px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        for (let k = 0; k < cusps.length; k++) {
            const cusp = cusps[k];
            this.ctx.beginPath();
            this.ctx.arc(cusp.x, cusp.y, 9, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(20, 20, 20, 0.85)';
            this.ctx.fill();
            this.ctx.lineWidth = 2;
            this.ctx.strokeStyle = '#f1c40f';
            this.ctx.stroke();

            this.ctx.fillStyle = '#fff';
            const gearLabel = cusp.toDir < 0 ? 'R' : 'D';
            this.ctx.fillText(`${k + 1}${gearLabel}`, cusp.x, cusp.y + 0.5);
        }

        this.ctx.restore();
    }
}
