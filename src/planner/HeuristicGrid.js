/**
 * 2D Obstacle-Aware Dijkstra Distance Grid around level obstacles.
 * Eliminates straight-line Euclidean local minima (e.g., Level 7 center island).
 */
export class HeuristicGrid {
    /**
     * @param {object} level
     * @param {object} carSpec
     * @param {number} [cellSize=5]
     */
    constructor(level, carSpec, cellSize = 5) {
        this.cellSize = cellSize;
        this.bodyCenterDist = (carSpec.wheelBase + carSpec.frontOverhang - carSpec.rearOverhang) / 2;
        this.targetX = level.target.x;
        this.targetY = level.target.y;

        // World bounds
        let minX = 0;
        let maxX = 800;
        let minY = 0;
        let maxY = 600;
        for (const obs of level.obstacles || []) {
            const r = Math.hypot(obs.width / 2, obs.height / 2);
            if (obs.x - r < minX) minX = Math.floor(obs.x - r);
            if (obs.x + r > maxX) maxX = Math.ceil(obs.x + r);
            if (obs.y - r < minY) minY = Math.floor(obs.y - r);
            if (obs.y + r > maxY) maxY = Math.ceil(obs.y + r);
        }

        this.minX = minX;
        this.minY = minY;
        this.cols = Math.ceil((maxX - minX) / cellSize);
        this.rows = Math.ceil((maxY - minY) / cellSize);

        const total = this.cols * this.rows;
        const blocked = new Uint8Array(total);
        this.dist = new Float32Array(total);
        this.dist.fill(Infinity);

        // Inflate obstacles so narrow non-traversable gaps (like Level 7's 30px
        // clockwise blocker) are closed while valid bays stay open for all cars.
        const inflation = Math.min(19.0, carSpec.width * 0.46 + 1.5);
        const obsList = (level.obstacles || []).map((obs) => {
            const angle = obs.angle || 0;
            return {
                x: obs.x,
                y: obs.y,
                hw: obs.width / 2 + inflation,
                hh: obs.height / 2 + inflation,
                cos: Math.cos(angle),
                sin: Math.sin(angle)
            };
        });

        for (let r = 0; r < this.rows; r++) {
            const py = minY + (r + 0.5) * cellSize;
            for (let c = 0; c < this.cols; c++) {
                const px = minX + (c + 0.5) * cellSize;
                for (let i = 0; i < obsList.length; i++) {
                    const o = obsList[i];
                    const dx = px - o.x;
                    const dy = py - o.y;
                    const lx = dx * o.cos + dy * o.sin;
                    const ly = -dx * o.sin + dy * o.cos;
                    if (Math.abs(lx) <= o.hw && Math.abs(ly) <= o.hh) {
                        blocked[r * this.cols + c] = 1;
                        break;
                    }
                }
            }
        }

        // Seed Dijkstra from target center cell (unblock seed cell and direct neighbors if tight)
        const tc = this._col(this.targetX);
        const tr = this._row(this.targetY);
        const seedIdx = tr * this.cols + tc;
        blocked[seedIdx] = 0;
        this.dist[seedIdx] = 0;

        // Binary min-heap of [dist, idx] stored in parallel typed arrays
        const heapIdx = new Int32Array(total * 2);
        const heapDist = new Float32Array(total * 2);
        let heapSize = 0;

        const push = (d, idx) => {
            let i = heapSize++;
            while (i > 0) {
                const p = (i - 1) >> 1;
                if (heapDist[p] <= d) break;
                heapDist[i] = heapDist[p];
                heapIdx[i] = heapIdx[p];
                i = p;
            }
            heapDist[i] = d;
            heapIdx[i] = idx;
        };

        const pop = () => {
            const topIdx = heapIdx[0];
            const topDist = heapDist[0];
            heapSize--;
            if (heapSize > 0) {
                const d = heapDist[heapSize];
                const idx = heapIdx[heapSize];
                let i = 0;
                const half = heapSize >> 1;
                while (i < half) {
                    let child = (i << 1) + 1;
                    const right = child + 1;
                    if (right < heapSize && heapDist[right] < heapDist[child]) child = right;
                    if (d <= heapDist[child]) break;
                    heapDist[i] = heapDist[child];
                    heapIdx[i] = heapIdx[child];
                    i = child;
                }
                heapDist[i] = d;
                heapIdx[i] = idx;
            }
            return [topDist, topIdx];
        };

        push(0, seedIdx);

        const dc = [1, -1, 0, 0, 1, 1, -1, -1];
        const dr = [0, 0, 1, -1, 1, -1, 1, -1];
        const diagCost = cellSize * Math.SQRT2;
        const stepCosts = [cellSize, cellSize, cellSize, cellSize, diagCost, diagCost, diagCost, diagCost];

        while (heapSize > 0) {
            const [d, idx] = pop();
            if (d > this.dist[idx]) continue;

            const r = Math.floor(idx / this.cols);
            const c = idx - r * this.cols;

            for (let k = 0; k < 8; k++) {
                const nc = c + dc[k];
                const nr = r + dr[k];
                if (nc < 0 || nc >= this.cols || nr < 0 || nr >= this.rows) continue;
                const nIdx = nr * this.cols + nc;
                if (blocked[nIdx]) continue;

                // Prevent corner-cutting through two adjacent blocked cardinal cells
                if (k >= 4) {
                    if (blocked[r * this.cols + nc] && blocked[nr * this.cols + c]) continue;
                }

                const nd = d + stepCosts[k];
                if (nd < this.dist[nIdx]) {
                    this.dist[nIdx] = nd;
                    push(nd, nIdx);
                }
            }
        }
    }

    _col(x) {
        return Math.max(0, Math.min(this.cols - 1, Math.floor((x - this.minX) / this.cellSize)));
    }

    _row(y) {
        return Math.max(0, Math.min(this.rows - 1, Math.floor((y - this.minY) / this.cellSize)));
    }

    /**
     * Returns obstacle-aware shortest path distance from the car's body center to the target.
     * @param {number} x - Rear axle X
     * @param {number} y - Rear axle Y
     * @param {number} heading - Radians
     * @returns {number}
     */
    getDistance(x, y, heading) {
        const cx = x + this.bodyCenterDist * Math.cos(heading);
        const cy = y + this.bodyCenterDist * Math.sin(heading);

        const c = this._col(cx);
        const r = this._row(cy);
        const d = this.dist[r * this.cols + c];
        if (Number.isFinite(d)) return d;

        // If body center sits slightly inside the 0.44*W inflation margin near a tight wall,
        // inspect neighbors up to radius 3 cells before falling back to Euclidean distance.
        let best = Infinity;
        for (let rad = 1; rad <= 3; rad++) {
            for (let dr = -rad; dr <= rad; dr++) {
                const nr = r + dr;
                if (nr < 0 || nr >= this.rows) continue;
                for (let dc = -rad; dc <= rad; dc++) {
                    if (Math.abs(dr) !== rad && Math.abs(dc) !== rad) continue;
                    const nc = c + dc;
                    if (nc < 0 || nc >= this.cols) continue;
                    const nd = this.dist[nr * this.cols + nc];
                    if (nd < best) best = nd;
                }
            }
            if (Number.isFinite(best)) return best + rad * this.cellSize;
        }

        return Math.hypot(this.targetX - cx, this.targetY - cy);
    }
}
