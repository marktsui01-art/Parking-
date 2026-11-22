/**
 * Fast exact Oriented Bounding Box (OBB) collision checker and target-containment
 * verifier matching GameEngine's SAT polygon semantics with zero per-call allocations.
 */
export class CollisionChecker {
    /**
     * @param {object} level - Level definition with obstacles, target, start
     * @param {object} carSpec - Car model specification from CAR_MODELS
     */
    constructor(level, carSpec) {
        this.wheelBase = carSpec.wheelBase;
        this.width = carSpec.width;
        this.frontOverhang = carSpec.frontOverhang;
        this.rearOverhang = carSpec.rearOverhang;
        this.length = this.frontOverhang + this.wheelBase + this.rearOverhang;
        this.bodyCenterDist = (this.wheelBase + this.frontOverhang - this.rearOverhang) / 2;
        this.halfLength = this.length / 2;
        this.halfWidth = this.width / 2;

        // Precompute obstacle OBB geometry matching createPolygon()
        this.obstacles = (level.obstacles || []).map((obs) => {
            const angle = obs.angle || 0;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const hw = obs.width / 2;
            const hh = obs.height / 2;

            // Corner vectors relative to center: (+/-hw, +/-hh) rotated by angle
            const ux = hw * cos;
            const uy = hw * sin;
            const vx = -hh * sin;
            const vy = hh * cos;

            const c0x = obs.x + ux + vx;
            const c0y = obs.y + uy + vy;
            const c1x = obs.x + ux - vx;
            const c1y = obs.y + uy - vy;
            const c2x = obs.x - ux - vx;
            const c2y = obs.y - uy - vy;
            const c3x = obs.x - ux + vx;
            const c3y = obs.y - uy + vy;

            const minX = Math.min(c0x, c1x, c2x, c3x);
            const maxX = Math.max(c0x, c1x, c2x, c3x);
            const minY = Math.min(c0y, c1y, c2y, c3y);
            const maxY = Math.max(c0y, c1y, c2y, c3y);

            // Orthonormal axes of obstacle
            const ax0x = cos;
            const ax0y = sin;
            const ax1x = -sin;
            const ax1y = cos;

            const centerDot0 = obs.x * ax0x + obs.y * ax0y;
            const centerDot1 = obs.x * ax1x + obs.y * ax1y;

            return {
                x: obs.x,
                y: obs.y,
                hw,
                hh,
                c0x, c0y,
                c1x, c1y,
                c2x, c2y,
                c3x, c3y,
                minX,
                maxX,
                minY,
                maxY,
                ax0x,
                ax0y,
                ax1x,
                ax1y,
                oMin0: centerDot0 - hw,
                oMax0: centerDot0 + hw,
                oMin1: centerDot1 - hh,
                oMax1: centerDot1 + hh
            };
        });

        // Precompute target frame for containment checks
        const t = level.target;
        const tAngle = t.angle || 0;
        this.target = {
            x: t.x,
            y: t.y,
            halfW: t.width / 2,
            halfH: t.height / 2,
            angle: tAngle,
            cos: Math.cos(tAngle),
            sin: Math.sin(tAngle)
        };
    }

    /**
     * Checks whether the car at rear-axle pose (x, y, heading) collides with any obstacle.
     * Matches SAT.checkCollision when margin === 0.
     * @param {number} x - Rear axle X
     * @param {number} y - Rear axle Y
     * @param {number} heading - Heading in radians
     * @param {number} [margin=0] - Extra padding around car half-extents (px)
     * @returns {boolean}
     */
    collides(x, y, heading, margin = 0) {
        const cos = Math.cos(heading);
        const sin = Math.sin(heading);

        const cx = x + this.bodyCenterDist * cos;
        const cy = y + this.bodyCenterDist * sin;

        const hl = this.halfLength + margin;
        const hw = this.halfWidth + margin;

        const ux = hl * cos;
        const uy = hl * sin;
        const vx = -hw * sin;
        const vy = hw * cos;

        const p0x = cx + ux + vx;
        const p0y = cy + uy + vy;
        const p1x = cx + ux - vx;
        const p1y = cy + uy - vy;
        const p2x = cx - ux - vx;
        const p2y = cy - uy - vy;
        const p3x = cx - ux + vx;
        const p3y = cy - uy + vy;

        const carMinX = Math.min(p0x, p1x, p2x, p3x);
        const carMaxX = Math.max(p0x, p1x, p2x, p3x);
        const carMinY = Math.min(p0y, p1y, p2y, p3y);
        const carMaxY = Math.max(p0y, p1y, p2y, p3y);

        // Car unit axes: (cos, sin) and (-sin, cos)
        const cDot0 = cx * cos + cy * sin;
        const cMin0 = cDot0 - hl;
        const cMax0 = cDot0 + hl;

        const cDot1 = -cx * sin + cy * cos;
        const cMin1 = cDot1 - hw;
        const cMax1 = cDot1 + hw;

        const obsList = this.obstacles;
        for (let i = 0; i < obsList.length; i++) {
            const obs = obsList[i];

            // Fast AABB rejection
            if (carMaxX < obs.minX || obs.maxX < carMinX || carMaxY < obs.minY || obs.maxY < carMinY) {
                continue;
            }

            // Axis 1: Car longitudinal axis (cos, sin)
            const o00 = obs.c0x * cos + obs.c0y * sin;
            const o01 = obs.c1x * cos + obs.c1y * sin;
            const o02 = obs.c2x * cos + obs.c2y * sin;
            const o03 = obs.c3x * cos + obs.c3y * sin;
            const obsProjMin0 = Math.min(o00, o01, o02, o03);
            const obsProjMax0 = Math.max(o00, o01, o02, o03);
            if (cMax0 < obsProjMin0 || obsProjMax0 < cMin0) continue;

            // Axis 2: Car lateral axis (-sin, cos)
            const o10 = -obs.c0x * sin + obs.c0y * cos;
            const o11 = -obs.c1x * sin + obs.c1y * cos;
            const o12 = -obs.c2x * sin + obs.c2y * cos;
            const o13 = -obs.c3x * sin + obs.c3y * cos;
            const obsProjMin1 = Math.min(o10, o11, o12, o13);
            const obsProjMax1 = Math.max(o10, o11, o12, o13);
            if (cMax1 < obsProjMin1 || obsProjMax1 < cMin1) continue;

            // Axis 3: Obstacle axis 0
            const ax0x = obs.ax0x;
            const ax0y = obs.ax0y;
            const cp00 = p0x * ax0x + p0y * ax0y;
            const cp01 = p1x * ax0x + p1y * ax0y;
            const cp02 = p2x * ax0x + p2y * ax0y;
            const cp03 = p3x * ax0x + p3y * ax0y;
            const cProjMin0 = Math.min(cp00, cp01, cp02, cp03);
            const cProjMax0 = Math.max(cp00, cp01, cp02, cp03);
            if (cProjMax0 < obs.oMin0 || obs.oMax0 < cProjMin0) continue;

            // Axis 4: Obstacle axis 1
            const ax1x = obs.ax1x;
            const ax1y = obs.ax1y;
            const cp10 = p0x * ax1x + p0y * ax1y;
            const cp11 = p1x * ax1x + p1y * ax1y;
            const cp12 = p2x * ax1x + p2y * ax1y;
            const cp13 = p3x * ax1x + p3y * ax1y;
            const cProjMin1 = Math.min(cp10, cp11, cp12, cp13);
            const cProjMax1 = Math.max(cp10, cp11, cp12, cp13);
            if (cProjMax1 < obs.oMin1 || obs.oMax1 < cProjMin1) continue;

            return true;
        }

        return false;
    }

    /**
     * Checks whether all 4 corners of the car are inside the target rectangle.
     * @param {number} x - Rear axle X
     * @param {number} y - Rear axle Y
     * @param {number} heading - Heading in radians
     * @param {number} [inset=0] - Optional inward tolerance inside target box (px)
     * @returns {boolean}
     */
    isCarInsideTarget(x, y, heading, inset = 0) {
        const cos = Math.cos(heading);
        const sin = Math.sin(heading);
        const cx = x + this.bodyCenterDist * cos;
        const cy = y + this.bodyCenterDist * sin;

        const ux = this.halfLength * cos;
        const uy = this.halfLength * sin;
        const vx = -this.halfWidth * sin;
        const vy = this.halfWidth * cos;

        const maxW = this.target.halfW - inset;
        const maxH = this.target.halfH - inset;
        if (maxW < 0 || maxH < 0) return false;

        const tx = this.target.x;
        const ty = this.target.y;
        const tCos = this.target.cos;
        const tSin = this.target.sin;

        // Corner 0 (+ux + vx)
        let dx = cx + ux + vx - tx;
        let dy = cy + uy + vy - ty;
        if (Math.abs(dx * tCos + dy * tSin) > maxW || Math.abs(-dx * tSin + dy * tCos) > maxH) return false;

        // Corner 1 (+ux - vx)
        dx = cx + ux - vx - tx;
        dy = cy + uy - vy - ty;
        if (Math.abs(dx * tCos + dy * tSin) > maxW || Math.abs(-dx * tSin + dy * tCos) > maxH) return false;

        // Corner 2 (-ux - vx)
        dx = cx - ux - vx - tx;
        dy = cy - uy - vy - ty;
        if (Math.abs(dx * tCos + dy * tSin) > maxW || Math.abs(-dx * tSin + dy * tCos) > maxH) return false;

        // Corner 3 (-ux + vx)
        dx = cx - ux + vx - tx;
        dy = cy - uy + vy - ty;
        if (Math.abs(dx * tCos + dy * tSin) > maxW || Math.abs(-dx * tSin + dy * tCos) > maxH) return false;

        return true;
    }

    /**
     * Computes world bounding box spanning all obstacles and target.
     * @returns {{ minX: number, maxX: number, minY: number, maxY: number }}
     */
    getWorldBounds() {
        let minX = 0;
        let maxX = 800;
        let minY = 0;
        let maxY = 600;

        for (let i = 0; i < this.obstacles.length; i++) {
            const o = this.obstacles[i];
            if (o.minX < minX) minX = o.minX;
            if (o.maxX > maxX) maxX = o.maxX;
            if (o.minY < minY) minY = o.minY;
            if (o.maxY > maxY) maxY = o.maxY;
        }

        return { minX, maxX, minY, maxY };
    }
}
