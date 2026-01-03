import { Vector2 } from './Vector2.js';

/**
 * SAT Collision Helper
 */
export const SAT = {
    /**
     * Checks if two convex polygons intersect.
     * @param {Vector2[]} polyA
     * @param {Vector2[]} polyB
     * @returns {boolean}
     */
    checkCollision(polyA, polyB) {
        const polygons = [polyA, polyB];
        for (let i = 0; i < polygons.length; i++) {
            const polygon = polygons[i];
            for (let j = 0; j < polygon.length; j++) {
                const p1 = polygon[j];
                const p2 = polygon[(j + 1) % polygon.length];

                // Normal axis
                const normal = new Vector2(-(p2.y - p1.y), p2.x - p1.x).normalize();

                const minMaxA = this.project(polyA, normal);
                const minMaxB = this.project(polyB, normal);

                if (minMaxA.max < minMaxB.min || minMaxB.max < minMaxA.min) {
                    return false; // Gap found
                }
            }
        }
        return true;
    },

    project(poly, axis) {
        let min = poly[0].dot(axis);
        let max = min;
        for (let i = 1; i < poly.length; i++) {
            const p = poly[i].dot(axis);
            if (p < min) min = p;
            if (p > max) max = p;
        }
        return { min, max };
    },

    isPointInConvexPoly(p, poly) {
        // Cross product approach
        // (p2.x - p1.x) * (p.y - p1.y) - (p2.y - p1.y) * (p.x - p1.x)
        let lastSign = 0;
        for (let i = 0; i < poly.length; i++) {
            const p1 = poly[i];
            const p2 = poly[(i + 1) % poly.length];

            const val = (p2.x - p1.x) * (p.y - p1.y) - (p2.y - p1.y) * (p.x - p1.x);
            if (val !== 0) {
                const sign = val > 0 ? 1 : -1;
                if (lastSign !== 0 && sign !== lastSign) return false;
                lastSign = sign;
            }
        }
        return true;
    }
};
