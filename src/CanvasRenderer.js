import { Vector2 } from './Vector2.js';

/**
 * Computes true Ackermann steering angles for left and right front wheels.
 * Positive steerAngle turns clockwise (right, +y on canvas), making the right wheel the inner wheel.
 * @param {number} wheelBase
 * @param {number} trackWidth
 * @param {number} steerAngle
 * @returns {{ left: number, right: number }}
 */
export function computeAckermannWheelAngles(wheelBase, trackWidth, steerAngle) {
    if (Math.abs(steerAngle) < 1e-5) {
        return { left: 0, right: 0 };
    }
    const sign = Math.sign(steerAngle);
    const absR = wheelBase / Math.tan(Math.abs(steerAngle));
    const halfTrack = trackWidth / 2;
    const innerAngle = sign * Math.atan2(wheelBase, Math.max(1e-3, absR - halfTrack));
    const outerAngle = sign * Math.atan2(wheelBase, absR + halfTrack);
    return sign > 0
        ? { left: outerAngle, right: innerAngle }
        : { left: innerAngle, right: outerAngle };
}

/**
 * Computes inset wheel dimensions, lateral track offset, and Ackermann front wheel angles
 * so tires remain inside the SAT collision box across the full steering lock range.
 * @param {object} engine
 * @returns {{ wheelWidth: number, wheelHeight: number, axleY: number, frontLeftAngle: number, frontRightAngle: number }}
 */
export function computeWheelLayout(engine) {
    const rearCap = engine.rearOverhang != null ? engine.rearOverhang * 2 - 0.5 : 11;
    const frontCap = engine.frontOverhang != null ? engine.frontOverhang * 2 - 0.5 : 11;
    const wheelWidth = Math.min(11, rearCap, frontCap, Math.max(7.5, engine.wheelBase * 0.21));
    const wheelHeight = Math.min(4.6, Math.max(3.6, engine.width * 0.125));
    const maxSteer = engine.maxSteerAngle || (40 * Math.PI / 180);

    let axleY = engine.width / 2 - wheelHeight / 2 - 1;
    for (let i = 0; i < 2; i++) {
        const maxAngles = computeAckermannWheelAngles(engine.wheelBase, axleY * 2, maxSteer);
        const innerAbsAngle = Math.abs(maxAngles.right);
        const maxLatHalfExtent =
            (wheelWidth / 2) * Math.sin(innerAbsAngle) +
            (wheelHeight / 2) * Math.cos(innerAbsAngle);
        axleY = Math.max(
            wheelHeight,
            Math.min(engine.width / 2 - wheelHeight / 2 - 1, engine.width / 2 - maxLatHalfExtent - 0.5)
        );
    }

    const frontAngles = computeAckermannWheelAngles(engine.wheelBase, axleY * 2, engine.steerAngle || 0);
    return {
        wheelWidth,
        wheelHeight,
        axleY,
        frontLeftAngle: frontAngles.left,
        frontRightAngle: frontAngles.right
    };
}

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

        // Draw Inset Ackermann Wheels
        this.ctx.fillStyle = '#000';
        const { wheelWidth, wheelHeight, axleY, frontLeftAngle, frontRightAngle } = computeWheelLayout(engine);

        // Rear Wheels (At local x=0)
        this.drawWheel(0, -axleY, wheelWidth, wheelHeight, 0);
        this.drawWheel(0, axleY, wheelWidth, wheelHeight, 0);

        // Front Wheels (At local x=wheelBase, true Ackermann inner/outer angles)
        this.drawWheel(engine.wheelBase, -axleY, wheelWidth, wheelHeight, frontLeftAngle);
        this.drawWheel(engine.wheelBase, axleY, wheelWidth, wheelHeight, frontRightAngle);

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
