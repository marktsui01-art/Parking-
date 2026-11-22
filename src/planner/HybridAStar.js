import { CollisionChecker } from './CollisionChecker.js';
import { HeuristicGrid } from './HeuristicGrid.js';
import {
    computeReedsSheppPaths,
    stepArc,
    normalizeAngle
} from './ReedsShepp.js';

const TWO_PI = Math.PI * 2;

/**
 * Binary min-heap storing arbitrary values ordered by scalar priority.
 */
class MinHeap {
    constructor() {
        this.p = [];
        this.v = [];
    }

    get size() {
        return this.p.length;
    }

    push(prio, val) {
        let i = this.p.length;
        this.p.push(prio);
        this.v.push(val);
        while (i > 0) {
            const par = (i - 1) >> 1;
            if (this.p[par] <= prio) break;
            this.p[i] = this.p[par];
            this.v[i] = this.v[par];
            i = par;
        }
        this.p[i] = prio;
        this.v[i] = val;
    }

    pop() {
        const top = this.v[0];
        const lp = this.p.pop();
        const lv = this.v.pop();
        const len = this.p.length;
        if (len > 0) {
            let i = 0;
            const half = len >> 1;
            while (i < half) {
                let c = (i << 1) + 1;
                const r = c + 1;
                if (r < len && this.p[r] < this.p[c]) c = r;
                if (lp <= this.p[c]) break;
                this.p[i] = this.p[c];
                this.v[i] = this.v[c];
                i = c;
            }
            this.p[i] = lp;
            this.v[i] = lv;
        }
        return top;
    }
}

/**
 * Reverses a list of kinematic segments for time-reversed trajectory construction.
 */
function reverseSegments(segs) {
    return [...segs].reverse().map((s) => ({
        steer: s.steer,
        dir: -s.dir,
        length: s.length,
        kappa: s.kappa
    }));
}

/**
 * Checks whether a sequence of Reeds-Shepp segments is collision-free.
 */
function isReedsSheppPathFree(start, segments, turningRadius, checker, margin, stepSize = 1.8) {
    let x = start.x;
    let y = start.y;
    let heading = start.heading;

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (seg.length <= 1e-6) continue;
        const kappa = seg.steer / turningRadius;
        const steps = Math.max(1, Math.ceil(seg.length / stepSize));
        const ds = (seg.dir * seg.length) / steps;

        for (let k = 0; k < steps; k++) {
            const next = stepArc(x, y, heading, kappa, ds);
            x = next.x;
            y = next.y;
            heading = next.heading;
            if (checker.collides(x, y, heading, margin)) {
                return false;
            }
        }
    }
    return true;
}

/**
 * Samples a list of geometric segments into dense waypoints and extracts gear-shift cusps.
 */
function buildTrajectoryFromSegments(start, segments, stepSize = 1.2) {
    const waypoints = [];
    const cusps = [];

    let x = start.x;
    let y = start.y;
    let heading = start.heading;
    let prevDir = 0;

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (seg.length <= 1e-5) continue;

        if (prevDir !== 0 && seg.dir !== prevDir) {
            cusps.push({
                x,
                y,
                heading: normalizeAngle(heading),
                fromDir: prevDir,
                toDir: seg.dir,
                waypointIndex: waypoints.length
            });
        }
        prevDir = seg.dir;

        const steps = Math.max(1, Math.ceil(seg.length / stepSize));
        const ds = (seg.dir * seg.length) / steps;

        if (waypoints.length === 0) {
            waypoints.push({
                x,
                y,
                heading: normalizeAngle(heading),
                dir: seg.dir,
                steer: seg.steer,
                kappa: seg.kappa
            });
        }

        for (let k = 0; k < steps; k++) {
            const next = stepArc(x, y, heading, seg.kappa, ds);
            x = next.x;
            y = next.y;
            heading = next.heading;
            waypoints.push({
                x,
                y,
                heading: normalizeAngle(heading),
                dir: seg.dir,
                steer: seg.steer,
                kappa: seg.kappa
            });
        }
    }

    return { waypoints, cusps };
}

/**
 * Computes valid collision-free rear-axle goal poses centered inside level.target.
 * @param {object} level
 * @param {object} carSpec
 * @param {CollisionChecker} [checker]
 * @returns {Array<{ x: number, y: number, heading: number }>}
 */
export function computeGoalPoses(level, carSpec, checker = new CollisionChecker(level, carSpec)) {
    const t = level.target;
    const baseAngle = t.height > t.width ? (t.angle || 0) + Math.PI / 2 : (t.angle || 0);
    const bodyCenterDist = checker.bodyCenterDist;

    const candidateAngles = [normalizeAngle(baseAngle), normalizeAngle(baseAngle + Math.PI)];
    const goals = [];

    for (const h of candidateAngles) {
        const gx = t.x - bodyCenterDist * Math.cos(h);
        const gy = t.y - bodyCenterDist * Math.sin(h);
        if (checker.isCarInsideTarget(gx, gy, h, 0) && !checker.collides(gx, gy, h, 0)) {
            goals.push({ x: gx, y: gy, heading: h });
        }
    }

    return goals;
}

/**
 * Stage 1: Best-First Escape Funnel outward from goal poses using slide-to-contact
 * and heading-alignment snap primitives. Escapes tight parking bays cleanly and checks
 * direct Reeds-Shepp connections back to startPose.
 */
function buildGoalFunnel(level, carSpec, checker, goals, startPose, margin) {
    const turningRadius = carSpec.wheelBase / Math.tan(carSpec.maxSteerAngle);
    const prims = [];
    for (const s of [-1, 0, 1]) {
        const k = s === 0 ? 0 : Math.tan(s * carSpec.maxSteerAngle) / carSpec.wheelBase;
        for (const d of [1, -1]) prims.push({ steer: s, dir: d, kappa: k });
    }

    // Immediate direct Reeds-Shepp shot from startPose -> goals
    for (const g of goals) {
        const rs = computeReedsSheppPaths(startPose, g, turningRadius, {
            reverseWeight: 1.2,
            cuspPenalty: 45
        });
        const limit = Math.min(5, rs.length);
        for (let k = 0; k < limit; k++) {
            if (isReedsSheppPathFree(startPose, rs[k].segments, turningRadius, checker, margin)) {
                return {
                    directSegs: rs[k].segments.map((s) => ({ ...s, kappa: s.steer / turningRadius })),
                    goalPose: g,
                    funnelTargets: [],
                    expanded: 1
                };
            }
        }
    }

    const snapAngles = [0, Math.PI / 2, -Math.PI / 2, Math.PI, startPose.heading];
    const heap = new MinHeap();
    const bestCost = new Map();
    const keyOf = (x, y, h, dir) =>
        `${Math.round(x / 3)},${Math.round(y / 3)},${Math.round(normalizeAngle(h) / (Math.PI / 60))},${dir}`;

    for (const g of goals) {
        heap.push(0, {
            x: g.x,
            y: g.y,
            heading: g.heading,
            dir: 0,
            shifts: 0,
            len: 0,
            segs: [],
            goalPose: g
        });
    }

    const funnelTargets = [];
    const funnelKeys = new Set();
    const minClearRadius = Math.min(level.target.width, level.target.height) * 0.7;
    let expanded = 0;

    while (heap.size > 0 && expanded < 1600) {
        const cur = heap.pop();
        expanded++;

        const cx = cur.x + checker.bodyCenterDist * Math.cos(cur.heading);
        const cy = cur.y + checker.bodyCenterDist * Math.sin(cur.heading);
        const distFromTarget = Math.hypot(cx - level.target.x, cy - level.target.y);
        const outsideBay = distFromTarget >= minClearRadius && !checker.isCarInsideTarget(cur.x, cur.y, cur.heading, -2);

        if (outsideBay) {
            const rs = computeReedsSheppPaths(startPose, { x: cur.x, y: cur.y, heading: cur.heading }, turningRadius, {
                reverseWeight: 1.2,
                cuspPenalty: 45
            });
            const limit = Math.min(4, rs.length);
            for (let k = 0; k < limit; k++) {
                if (isReedsSheppPathFree(startPose, rs[k].segments, turningRadius, checker, margin)) {
                    const rsSegs = rs[k].segments.map((s) => ({ ...s, kappa: s.steer / turningRadius }));
                    return {
                        directSegs: rsSegs.concat(reverseSegments(cur.segs)),
                        goalPose: cur.goalPose,
                        funnelTargets,
                        expanded
                    };
                }
            }

            const fk = `${Math.round(cur.x / 20)},${Math.round(cur.y / 20)},${Math.round(normalizeAngle(cur.heading) / (Math.PI / 8))}`;
            if (!funnelKeys.has(fk) && funnelTargets.length < 64) {
                funnelKeys.add(fk);
                funnelTargets.push({
                    x: cur.x,
                    y: cur.y,
                    heading: cur.heading,
                    segsFromGoal: cur.segs,
                    dir: cur.dir,
                    shifts: cur.shifts,
                    len: cur.len,
                    goalPose: cur.goalPose
                });
            }
        }

        if (cur.shifts >= 8 || distFromTarget > 220) continue;

        for (let p = 0; p < prims.length; p++) {
            const pr = prims[p];
            if (pr.dir === cur.dir && cur.segs.length > 0 && cur.segs[cur.segs.length - 1].steer === pr.steer) {
                continue;
            }

            let sx = cur.x;
            let sy = cur.y;
            let sh = cur.heading;
            let maxD = 0;
            const samples = [];

            for (let step = 1; step <= 260; step++) {
                const nxt = stepArc(sx, sy, sh, pr.kappa, pr.dir * 0.5);
                if (checker.collides(nxt.x, nxt.y, nxt.heading, margin)) break;
                sx = nxt.x;
                sy = nxt.y;
                sh = nxt.heading;
                maxD += 0.5;
                if ((step <= 60 && step % 16 === 0) || (step > 60 && step % 40 === 0)) {
                    samples.push({ x: sx, y: sy, h: sh, d: maxD });
                }
            }
            if (maxD < 1.5) continue;

            samples.push({ x: sx, y: sy, h: sh, d: maxD });

            // Snap onto exact cardinal / start headings when turning across them
            if (Math.abs(pr.kappa) > 1e-6) {
                const rate = pr.dir * pr.kappa;
                for (let a = 0; a < snapAngles.length; a++) {
                    let diff = normalizeAngle(snapAngles[a] - cur.heading);
                    if (rate > 0 && diff <= 0) diff += TWO_PI;
                    if (rate < 0 && diff >= 0) diff -= TWO_PI;
                    const dSnap = diff / rate;
                    if (dSnap > 1.0 && dSnap < maxD - 0.5) {
                        const sp = stepArc(cur.x, cur.y, cur.heading, pr.kappa, pr.dir * dSnap);
                        if (!checker.collides(sp.x, sp.y, sp.heading, margin)) {
                            samples.push({ x: sp.x, y: sp.y, h: sp.heading, d: dSnap });
                        }
                    }
                }
            }

            if (maxD > 14) {
                const half = stepArc(cur.x, cur.y, cur.heading, pr.kappa, pr.dir * (maxD * 0.5));
                samples.push({ x: half.x, y: half.y, h: half.heading, d: maxD * 0.5 });
            }

            const nextShifts = cur.dir === 0 ? 0 : (pr.dir !== cur.dir ? cur.shifts + 1 : cur.shifts);
            for (let s = 0; s < samples.length; s++) {
                const sp = samples[s];
                const nh = normalizeAngle(sp.h);
                const nLen = cur.len + sp.d;
                const k = keyOf(sp.x, sp.y, nh, pr.dir);
                const costVal = nextShifts * 45 + nLen;
                if (costVal >= (bestCost.get(k) ?? Infinity) - 1e-6) continue;
                bestCost.set(k, costVal);

                const ncx = sp.x + checker.bodyCenterDist * Math.cos(nh);
                const ncy = sp.y + checker.bodyCenterDist * Math.sin(nh);
                const nd = Math.hypot(ncx - level.target.x, ncy - level.target.y);
                const prio = nextShifts * 32 + nLen * 0.25 - Math.min(nd, 180) * 1.4;
                heap.push(prio, {
                    x: sp.x,
                    y: sp.y,
                    heading: nh,
                    dir: pr.dir,
                    shifts: nextShifts,
                    len: nLen,
                    segs: [...cur.segs, { steer: pr.steer, dir: pr.dir, length: sp.d, kappa: pr.kappa }],
                    goalPose: cur.goalPose
                });
            }
        }
    }

    return { directSegs: null, funnelTargets, expanded };
}

/**
 * Stage 2: 3-Tier Multi-Resolution Hybrid A* searching Goal/Funnel -> Start.
 */
function goalToStartHybridAStar(level, carSpec, checker, bfsToStart, startPose, goals, funnelTargets, margin, maxExp = 15000) {
    const turningRadius = carSpec.wheelBase / Math.tan(carSpec.maxSteerAngle);
    const steers = [-1, -0.5, 0, 0.5, 1];
    const dirs = [1, -1];
    const prims = [];
    for (const steer of steers) {
        const kappa = steer === 0 ? 0 : Math.tan(steer * carSpec.maxSteerAngle) / carSpec.wheelBase;
        for (const dir of dirs) prims.push({ steer, dir, kappa });
    }

    const bounds = checker.getWorldBounds();
    const minX = bounds.minX - 50;
    const minY = bounds.minY - 50;

    const nodes = [];
    const open = new MinHeap();
    const bestG = new Map();
    const hWeight = 1.5;

    const getTier = (x, y, h, hDist, dGoal) => {
        if (dGoal < 60 || hDist < 60) return 0;
        if (hDist < 200 || checker.collides(x, y, h, margin + 15)) return 1;
        return 2;
    };

    const packKey = (x, y, h, dir, tier) => {
        const xyRes = tier === 0 ? 2 : tier === 1 ? 4 : 10;
        const tb = tier === 2 ? 36 : 72;
        const gx = Math.max(0, Math.min(1023, Math.round((x - minX) / xyRes) + 64));
        const gy = Math.max(0, Math.min(1023, Math.round((y - minY) / xyRes) + 64));
        let norm = h % TWO_PI;
        if (norm < 0) norm += TWO_PI;
        const gt = Math.floor(norm / (TWO_PI / tb)) % tb;
        return ((((tier * 1024 + gx) * 1024 + gy) * 72 + gt) * 2) + (dir < 0 ? 1 : 0);
    };

    const seeds = [
        ...goals.map((g) => ({
            x: g.x,
            y: g.y,
            heading: g.heading,
            segsFromGoal: [],
            dir: 0,
            gCost: 0,
            goalPose: g
        })),
        ...funnelTargets.map((ft) => ({
            x: ft.x,
            y: ft.y,
            heading: ft.heading,
            segsFromGoal: ft.segsFromGoal,
            dir: ft.dir,
            gCost: ft.len + ft.shifts * 35,
            goalPose: ft.goalPose
        }))
    ];

    for (const sd of seeds) {
        const hVal = bfsToStart.getDistance(sd.x, sd.y, sd.heading);
        const dGoal = Math.hypot(sd.x - level.target.x, sd.y - level.target.y);
        const tier = getTier(sd.x, sd.y, sd.heading, hVal, dGoal);
        const ni = nodes.length;
        nodes.push({
            x: sd.x,
            y: sd.y,
            heading: sd.heading,
            g: sd.gCost,
            f: sd.gCost + hWeight * hVal,
            h: hVal,
            tier,
            parent: -1,
            dir: sd.dir,
            steer: 0,
            kappa: 0,
            stepLen: 0,
            seedSegs: sd.segsFromGoal,
            goalPose: sd.goalPose
        });
        open.push(nodes[ni].f, ni);
    }

    let exp = 0;
    while (open.size > 0 && exp < maxExp) {
        const ci = open.pop();
        const cur = nodes[ci];
        if (cur.parent !== -1) {
            const ck = packKey(cur.x, cur.y, cur.heading, cur.dir, cur.tier);
            if (cur.g > (bestG.get(ck) ?? Infinity) + 1e-6) continue;
        }
        exp++;

        const shotInt = cur.h < 220 ? 2 : 10;
        if (exp === 1 || exp % shotInt === 0) {
            const rs = computeReedsSheppPaths({ x: cur.x, y: cur.y, heading: cur.heading }, startPose, turningRadius, {
                reverseWeight: 1.2,
                cuspPenalty: 45
            });
            const limit = Math.min(4, rs.length);
            for (let k = 0; k < limit; k++) {
                if (isReedsSheppPathFree({ x: cur.x, y: cur.y, heading: cur.heading }, rs[k].segments, turningRadius, checker, margin)) {
                    const searchSegs = [];
                    let p = ci;
                    while (nodes[p].parent !== -1) {
                        const n = nodes[p];
                        searchSegs.push({ steer: n.steer, dir: n.dir, length: n.stepLen, kappa: n.kappa });
                        p = n.parent;
                    }
                    searchSegs.reverse();
                    const rootNode = nodes[p];
                    const rsSegs = rs[k].segments.map((s) => ({ ...s, kappa: s.steer / turningRadius }));
                    const goalToStartSegs = rootNode.seedSegs.concat(searchSegs, rsSegs);
                    return { segs: reverseSegments(goalToStartSegs), goalPose: rootNode.goalPose, exp };
                }
            }
        }

        const stepLen = cur.tier === 0 ? 4 : cur.tier === 1 ? 8 : 16;
        const subCnt = Math.max(1, Math.ceil(stepLen / 2.0));
        const subDs = stepLen / subCnt;

        for (let p = 0; p < prims.length; p++) {
            const pr = prims[p];
            let sx = cur.x;
            let sy = cur.y;
            let sh = cur.heading;
            let hit = false;

            const signedSubDs = pr.dir * subDs;
            for (let s = 0; s < subCnt; s++) {
                const nxt = stepArc(sx, sy, sh, pr.kappa, signedSubDs);
                sx = nxt.x;
                sy = nxt.y;
                sh = nxt.heading;
                if (checker.collides(sx, sy, sh, margin)) {
                    hit = true;
                    break;
                }
            }
            if (hit) continue;

            sh = normalizeAngle(sh);
            // Moving forward (dir > 0) during Goal->Start becomes reverse in Start->Goal
            let cost = stepLen * (pr.dir > 0 ? 1.2 : 1.0);
            if (cur.dir !== 0 && pr.dir !== cur.dir) cost += 45;
            if (cur.dir !== 0 && pr.steer !== cur.steer) cost += 2 * Math.abs(pr.steer - cur.steer);
            if (checker.collides(sx, sy, sh, margin + 2.5)) cost += 3;

            const ng = cur.g + cost;
            const nh = bfsToStart.getDistance(sx, sy, sh);
            const ndGoal = Math.hypot(sx - level.target.x, sy - level.target.y);
            const nTier = getTier(sx, sy, sh, nh, ndGoal);
            const nk = packKey(sx, sy, sh, pr.dir, nTier);
            if (ng >= (bestG.get(nk) ?? Infinity) - 1e-6) continue;

            bestG.set(nk, ng);
            const nf = ng + hWeight * nh;
            const ni = nodes.length;
            nodes.push({
                x: sx,
                y: sy,
                heading: sh,
                g: ng,
                f: nf,
                h: nh,
                tier: nTier,
                parent: ci,
                dir: pr.dir,
                steer: pr.steer,
                kappa: pr.kappa,
                stepLen
            });
            open.push(nf, ni);
        }
    }

    return { segs: null, exp };
}

/**
 * Stage 3 Fallback: Forward Hybrid A* from startPose connecting to goals or escaped funnel targets.
 */
function forwardHybridAStar(level, carSpec, checker, bfsToGoal, startPose, goals, funnelTargets, margin, maxExp = 10000) {
    const turningRadius = carSpec.wheelBase / Math.tan(carSpec.maxSteerAngle);
    const steers = [-1, -0.5, 0, 0.5, 1];
    const dirs = [1, -1];
    const prims = [];
    for (const steer of steers) {
        const kappa = steer === 0 ? 0 : Math.tan(steer * carSpec.maxSteerAngle) / carSpec.wheelBase;
        for (const dir of dirs) prims.push({ steer, dir, kappa });
    }

    const allTargets = [
        ...goals.map((g) => ({
            x: g.x,
            y: g.y,
            heading: g.heading,
            tailSegs: [],
            goalPose: g
        })),
        ...funnelTargets.map((ft) => ({
            x: ft.x,
            y: ft.y,
            heading: ft.heading,
            tailSegs: reverseSegments(ft.segsFromGoal),
            goalPose: ft.goalPose
        }))
    ];

    const bounds = checker.getWorldBounds();
    const minX = bounds.minX - 50;
    const minY = bounds.minY - 50;

    const nodes = [];
    const open = new MinHeap();
    const bestG = new Map();
    const hWeight = 1.65;

    const packKey = (x, y, h, dir, near) => {
        const xyRes = near ? 5 : 12;
        const tb = near ? 72 : 36;
        const gx = Math.max(0, Math.min(1023, Math.round((x - minX) / xyRes) + 64));
        const gy = Math.max(0, Math.min(1023, Math.round((y - minY) / xyRes) + 64));
        let norm = h % TWO_PI;
        if (norm < 0) norm += TWO_PI;
        const gt = Math.floor(norm / (TWO_PI / tb)) % tb;
        return (((((near ? 0 : 1) * 1024 + gx) * 1024 + gy) * 72 + gt) * 2) + (dir < 0 ? 1 : 0);
    };

    const sh0 = bfsToGoal.getDistance(startPose.x, startPose.y, startPose.heading);
    nodes.push({
        x: startPose.x,
        y: startPose.y,
        heading: startPose.heading,
        g: 0,
        f: hWeight * sh0,
        h: sh0,
        near: sh0 < 220,
        parent: -1,
        dir: 0,
        steer: 0,
        kappa: 0,
        stepLen: 0
    });
    open.push(nodes[0].f, 0);

    let exp = 0;
    while (open.size > 0 && exp < maxExp) {
        const ci = open.pop();
        const cur = nodes[ci];
        if (cur.parent !== -1) {
            const ck = packKey(cur.x, cur.y, cur.heading, cur.dir, cur.near);
            if (cur.g > (bestG.get(ck) ?? Infinity) + 1e-6) continue;
        }
        exp++;

        const shotInt = cur.h < 220 ? 3 : 12;
        if (exp % shotInt === 0) {
            const sortedT = allTargets
                .map((t) => ({
                    t,
                    d: Math.hypot(t.x - cur.x, t.y - cur.y) + 25 * Math.abs(normalizeAngle(t.heading - cur.heading))
                }))
                .sort((a, b) => a.d - b.d)
                .slice(0, 6);

            for (let i = 0; i < sortedT.length; i++) {
                const t = sortedT[i].t;
                const rs = computeReedsSheppPaths({ x: cur.x, y: cur.y, heading: cur.heading }, t, turningRadius, {
                    reverseWeight: 1.2,
                    cuspPenalty: 45
                });
                const limit = Math.min(3, rs.length);
                for (let k = 0; k < limit; k++) {
                    if (isReedsSheppPathFree({ x: cur.x, y: cur.y, heading: cur.heading }, rs[k].segments, turningRadius, checker, margin)) {
                        const hybridSegs = [];
                        let p = ci;
                        while (p > 0) {
                            const n = nodes[p];
                            hybridSegs.push({ steer: n.steer, dir: n.dir, length: n.stepLen, kappa: n.kappa });
                            p = n.parent;
                        }
                        hybridSegs.reverse();
                        const rsSegs = rs[k].segments.map((s) => ({ ...s, kappa: s.steer / turningRadius }));
                        return { segs: hybridSegs.concat(rsSegs, t.tailSegs), goalPose: t.goalPose, exp };
                    }
                }
            }
        }

        const stepLen = cur.near ? 9 : 18;
        const subCnt = Math.max(1, Math.ceil(stepLen / 2.2));
        const subDs = stepLen / subCnt;

        for (let p = 0; p < prims.length; p++) {
            const pr = prims[p];
            let sx = cur.x;
            let sy = cur.y;
            let sh = cur.heading;
            let hit = false;

            const signedSubDs = pr.dir * subDs;
            for (let s = 0; s < subCnt; s++) {
                const nxt = stepArc(sx, sy, sh, pr.kappa, signedSubDs);
                sx = nxt.x;
                sy = nxt.y;
                sh = nxt.heading;
                if (checker.collides(sx, sy, sh, margin)) {
                    hit = true;
                    break;
                }
            }
            if (hit) continue;

            sh = normalizeAngle(sh);
            let cost = stepLen * (pr.dir < 0 ? 1.2 : 1.0);
            if (cur.dir !== 0 && pr.dir !== cur.dir) cost += 45;
            if (cur.dir !== 0 && pr.steer !== cur.steer) cost += 2 * Math.abs(pr.steer - cur.steer);
            if (checker.collides(sx, sy, sh, margin + 2.5)) cost += 3;

            const ng = cur.g + cost;
            const nh = bfsToGoal.getDistance(sx, sy, sh);
            const nNear = nh < 220;
            const nk = packKey(sx, sy, sh, pr.dir, nNear);
            if (ng >= (bestG.get(nk) ?? Infinity) - 1e-6) continue;

            bestG.set(nk, ng);
            const nf = ng + hWeight * nh;
            const ni = nodes.length;
            nodes.push({
                x: sx,
                y: sy,
                heading: sh,
                g: ng,
                f: nf,
                h: nh,
                near: nNear,
                parent: ci,
                dir: pr.dir,
                steer: pr.steer,
                kappa: pr.kappa,
                stepLen
            });
            open.push(nf, ni);
        }
    }

    return { segs: null, exp };
}

/**
 * Plans a collision-free kinematic parking path from level.start to level.target.
 * @param {object} level
 * @param {object} carSpec
 * @param {object} [options]
 * @returns {{ success: boolean, segments?: Array, waypoints?: Array, cusps?: Array, goalPose?: object, stats: object }}
 */
export function planParkingPath(level, carSpec, options = {}) {
    const t0 = performance.now();
    const checker = new CollisionChecker(level, carSpec);
    const goals = computeGoalPoses(level, carSpec, checker);

    if (goals.length === 0) {
        return { success: false, error: 'No collision-free target pose fits inside target box', stats: { durationMs: 0 } };
    }

    const rawStart = options.startPose || level.start;
    const startPose = {
        x: rawStart.x,
        y: rawStart.y,
        heading: normalizeAngle(rawStart.heading || 0)
    };
    if (checker.collides(startPose.x, startPose.y, startPose.heading, 0)) {
        return { success: false, error: 'Start pose is in collision', stats: { durationMs: 0 } };
    }

    if (checker.isCarInsideTarget(startPose.x, startPose.y, startPose.heading, 0)) {
        return {
            success: true,
            alreadyInside: true,
            segments: [],
            waypoints: [{ x: startPose.x, y: startPose.y, heading: startPose.heading, dir: 1, steer: 0, kappa: 0 }],
            cusps: [],
            goalPose: startPose,
            stats: { expansions: 0, margin: 0, durationMs: performance.now() - t0 }
        };
    }

    let defaultMargins = [1.5, 0.5, 0.2];
    if (checker.collides(startPose.x, startPose.y, startPose.heading, 0.2)) {
        defaultMargins = [1.5, 0.5, 0.2, 0];
    }
    const margins = options.margins ?? defaultMargins;
    const maxExpRev = options.maxExpansions ?? 12000;
    const maxExpFwd = options.maxForwardExpansions ?? 15000;
    const cellSize = options.gridCellSize ?? 5;
    const allowForwardFallback = options.allowForwardFallback ?? true;
    const forwardOnly = options.forwardOnly ?? false;
    const cache = options._cache || {};
    cache.funnelByMargin = cache.funnelByMargin || {};

    let totalExp = 0;
    const pass2Candidates = [];

    // Pass 1: Stage 1 (Best-First Escape Funnel) + Stage 2 (Goal -> Start Hybrid A*)
    if (!forwardOnly) {
        for (const margin of margins) {
            if (checker.collides(startPose.x, startPose.y, startPose.heading, margin)) continue;
            const activeGoals = goals.filter((g) => !checker.collides(g.x, g.y, g.heading, margin));
            if (activeGoals.length === 0) continue;

            const funnel = buildGoalFunnel(level, carSpec, checker, activeGoals, startPose, margin);
            totalExp += funnel.expanded;

            let finalSegs = funnel.directSegs;
            let goalPose = funnel.goalPose;

            if (!finalSegs) {
                if (funnel.funnelTargets.length > 0) {
                    const entry = { margin, activeGoals, funnelTargets: funnel.funnelTargets };
                    pass2Candidates.push(entry);
                    cache.funnelByMargin[margin] = { activeGoals, funnelTargets: funnel.funnelTargets };
                }

                // Skip Stage 2 if bay escape exhausted all states inside the bay at this margin
                if (funnel.funnelTargets.length === 0 && funnel.expanded < 1600) {
                    continue;
                }

                if (!cache.bfsToStart) {
                    const startBodyLevel = {
                        ...level,
                        target: {
                            x: startPose.x + checker.bodyCenterDist * Math.cos(startPose.heading),
                            y: startPose.y + checker.bodyCenterDist * Math.sin(startPose.heading),
                            width: 40,
                            height: 40,
                            angle: 0
                        }
                    };
                    cache.bfsToStart = new HeuristicGrid(startBodyLevel, carSpec, cellSize);
                }

                const rev = goalToStartHybridAStar(
                    level,
                    carSpec,
                    checker,
                    cache.bfsToStart,
                    startPose,
                    activeGoals,
                    funnel.funnelTargets,
                    margin,
                    maxExpRev
                );
                totalExp += rev.exp;
                if (rev.segs) {
                    finalSegs = rev.segs;
                    goalPose = rev.goalPose;
                }
            }

            if (finalSegs) {
                const { waypoints, cusps } = buildTrajectoryFromSegments(startPose, finalSegs, 1.2);
                return {
                    success: true,
                    segments: finalSegs,
                    waypoints,
                    cusps,
                    goalPose,
                    stats: {
                        expansions: totalExp,
                        margin,
                        durationMs: performance.now() - t0
                    }
                };
            }
        }
    }

    // Pass 2: Stage 3 Forward Hybrid A* fallback only if Pass 1 failed on all margins
    const fwdCandidates = forwardOnly
        ? margins
            .map((m) => (cache.funnelByMargin[m] ? { margin: m, ...cache.funnelByMargin[m] } : null))
            .filter(Boolean)
        : pass2Candidates;

    if (allowForwardFallback && fwdCandidates.length > 0) {
        if (!cache.bfsToGoal) {
            cache.bfsToGoal = new HeuristicGrid(level, carSpec, cellSize);
        }
        for (const cand of fwdCandidates) {
            const fwd = forwardHybridAStar(
                level,
                carSpec,
                checker,
                cache.bfsToGoal,
                startPose,
                cand.activeGoals,
                cand.funnelTargets,
                cand.margin,
                maxExpFwd
            );
            totalExp += fwd.exp;
            if (fwd.segs) {
                const { waypoints, cusps } = buildTrajectoryFromSegments(startPose, fwd.segs, 1.2);
                return {
                    success: true,
                    segments: fwd.segs,
                    waypoints,
                    cusps,
                    goalPose: fwd.goalPose,
                    stats: {
                        expansions: totalExp,
                        margin: cand.margin,
                        durationMs: performance.now() - t0
                    }
                };
            }
        }
    }

    return {
        success: false,
        stats: {
            expansions: totalExp,
            durationMs: performance.now() - t0
        }
    };
}
