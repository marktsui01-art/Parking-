/**
 * A 2D Vector class for geometric operations.
 */
export class Vector2 {
    /**
     * @param {number} x
     * @param {number} y
     */
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    /**
     * Adds another vector to this one.
     * @param {Vector2} v
     * @returns {Vector2} New vector
     */
    add(v) {
        return new Vector2(this.x + v.x, this.y + v.y);
    }

    /**
     * Subtracts another vector from this one.
     * @param {Vector2} v
     * @returns {Vector2} New vector
     */
    sub(v) {
        return new Vector2(this.x - v.x, this.y - v.y);
    }

    /**
     * Scales the vector by a scalar.
     * @param {number} s
     * @returns {Vector2} New vector
     */
    scale(s) {
        return new Vector2(this.x * s, this.y * s);
    }

    /**
     * Calculates the dot product with another vector.
     * @param {Vector2} v
     * @returns {number}
     */
    dot(v) {
        return this.x * v.x + this.y * v.y;
    }

    /**
     * Rotates the vector by an angle.
     * @param {number} angle Angle in radians
     * @returns {Vector2} New vector
     */
    rotate(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return new Vector2(
            this.x * cos - this.y * sin,
            this.x * sin + this.y * cos
        );
    }

    /**
     * Returns the magnitude of the vector.
     * @returns {number}
     */
    magnitude() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    /**
     * Returns a normalized vector.
     * @returns {Vector2}
     */
    normalize() {
        const m = this.magnitude();
        return m === 0 ? new Vector2(0, 0) : this.scale(1 / m);
    }
}
