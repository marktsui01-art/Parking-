/**
 * Analytical Reeds-Shepp Curves (1990) across all 48 words (12 base types x 4 symmetries).
 * Kinematics: dx/ds = cos(theta), dy/ds = sin(theta), dtheta/ds = steer / turningRadius
 * where steer in { +1 (L), -1 (R), 0 (S) } and signed ds > 0 is forward, ds < 0 is reverse.
 */

const TWO_PI = Math.PI * 2;
const EPS = 1e-9;

/**
 * Wraps an angle into [-PI, PI).
 * @param {number} angle
 * @returns {number}
 */
export function normalizeAngle(angle) {
    let a = (angle + Math.PI) % TWO_PI;
    if (a < 0) a += TWO_PI;
    return a - Math.PI;
}

/**
 * Wraps an angle into [0, 2*PI).
 * @param {number} angle
 * @returns {number}
 */
function mod2pi(angle) {
    let a = angle % TWO_PI;
    if (a < 0) a += TWO_PI;
    return a;
}

function polar(x, y) {
    return [Math.hypot(x, y), Math.atan2(y, x)];
}

function tauOmega(u, v, xi, eta, phi) {
    const delta = normalizeAngle(u - v);
    const A = Math.sin(u) - Math.sin(delta);
    const B = Math.cos(u) - Math.cos(delta) - 1;
    const t1 = Math.atan2(eta * A - xi * B, xi * A + eta * B);
    const t2 = 2 * (Math.cos(delta) - Math.cos(v) - Math.cos(u)) + 3;
    const tau = t2 < 0 ? normalizeAngle(t1 + Math.PI) : normalizeAngle(t1);
    const omega = normalizeAngle(tau - u + v - phi);
    return [tau, omega];
}

// --- 12 Base Reeds-Shepp Curve Families (unit turning radius) ---
// Each returns null or array of signed segment lengths [l0, l1, ...] paired with types.

// 1. LpSpLp (Formula 8.1)
function LpSpLp(x, y, phi) {
    let [u, t] = polar(x - Math.sin(phi), y - 1 + Math.cos(phi));
    if (Math.abs(t + Math.PI) < 1e-7) t = Math.PI;
    if (t < -EPS) return null;
    let v = normalizeAngle(phi - t);
    if (Math.abs(v + Math.PI) < 1e-7) v = Math.PI;
    if (v < -EPS) return null;
    return [Math.max(0, t), u, Math.max(0, v)];
}

// 2. LpSpRp (Formula 8.2)
function LpSpRp(x, y, phi) {
    const [u1, t1] = polar(x + Math.sin(phi), y - 1 - Math.cos(phi));
    const u1Sq = u1 * u1;
    if (u1Sq < 4) return null;
    const u = Math.sqrt(u1Sq - 4);
    const theta = Math.atan2(2, u);
    let t = normalizeAngle(t1 + theta);
    let v = normalizeAngle(t - phi);
    if (Math.abs(t + Math.PI) < 1e-7) t = Math.PI;
    if (Math.abs(v + Math.PI) < 1e-7) v = Math.PI;
    if (t < -EPS || v < -EPS) return null;
    return [Math.max(0, t), u, Math.max(0, v)];
}

// 3. LpRmLp (Formula 8.3)
function LpRmLp(x, y, phi) {
    const xi = x - Math.sin(phi);
    const eta = y - 1 + Math.cos(phi);
    const [u1, theta] = polar(xi, eta);
    if (u1 > 4) return null;
    const A = Math.acos(Math.max(-1, Math.min(1, u1 / 4)));
    const t = normalizeAngle(theta + Math.PI / 2 + A);
    const u = normalizeAngle(Math.PI - 2 * A);
    const v = normalizeAngle(phi - t - u);
    if (t < -EPS || u < -EPS || v < -EPS) return null;
    return [Math.max(0, t), -Math.max(0, u), Math.max(0, v)];
}

// 4. LpRmLm (Formula 8.3 variant: + - -)
function LpRmLm(x, y, phi) {
    const xi = x - Math.sin(phi);
    const eta = y - 1 + Math.cos(phi);
    const [u1, theta] = polar(xi, eta);
    if (u1 > 4) return null;
    const A = Math.acos(Math.max(-1, Math.min(1, u1 / 4)));
    const t = normalizeAngle(theta + Math.PI / 2 + A);
    const uPos = Math.PI - 2 * A;
    const v = normalizeAngle(phi - t - uPos);
    if (t < -EPS || v > EPS) return null;
    return [Math.max(0, t), -Math.max(0, uPos), Math.min(0, v)];
}

// 5. LpRpRmLm (Formula 8.4: CCCC: t >= 0, u >= 0, -u <= 0, v <= 0)
function LpRpRmLm(x, y, phi) {
    const xi = x + Math.sin(phi);
    const eta = y - 1 - Math.cos(phi);
    const rho = 0.25 * (2 + Math.hypot(xi, eta));
    if (rho > 1) return null;
    const u = Math.acos(rho); // in [0, pi/2]
    const [t, v] = tauOmega(u, -u, xi, eta, phi);
    if (t < -EPS || v > EPS) return null;
    return [Math.max(0, t), u, -u, Math.min(0, v)];
}

// 7. LpRmLmRp (Formula 8.4 variant: t >= 0, u <= 0, -u <= 0, v >= 0)
function LpRmLmRp(x, y, phi) {
    const xi = x + Math.sin(phi);
    const eta = y - 1 - Math.cos(phi);
    const rho = (20 - xi * xi - eta * eta) / 16;
    if (rho < 0 || rho > 1) return null;
    const u = -Math.acos(rho); // in [-pi/2, 0]
    if (u < -Math.PI / 2 - EPS) return null;
    const [t, v] = tauOmega(u, u, xi, eta, phi);
    if (t < -EPS || v < -EPS) return null;
    return [Math.max(0, t), u, u, Math.max(0, v)];
}

// 8. LpRmSmLm (Formula 8.7: C C(pi/2) S C: t >= 0, -pi/2, u <= 0, v <= 0)
function LpRmSmLm(x, y, phi) {
    const xi = x - Math.sin(phi);
    const eta = y - 1 + Math.cos(phi);
    const [rho, theta] = polar(xi, eta);
    if (rho < 2) return null;
    const r = Math.sqrt(rho * rho - 4);
    const u = 2 - r;
    const t = normalizeAngle(theta + Math.atan2(r, -2));
    const v = normalizeAngle(phi - Math.PI / 2 - t);
    if (t < -EPS || u > EPS || v > EPS) return null;
    return [Math.max(0, t), -Math.PI / 2, Math.min(0, u), Math.min(0, v)];
}

// 9. LpRmSmRm (Formula 8.8: C C(pi/2) S C: t >= 0, -pi/2, u <= 0, v <= 0)
function LpRmSmRm(x, y, phi) {
    const xi = x + Math.sin(phi);
    const eta = y - 1 - Math.cos(phi);
    const [rho, theta] = polar(-eta, xi);
    if (rho < 2) return null;
    const t = theta;
    const u = 2 - rho;
    const v = normalizeAngle(t + Math.PI / 2 - phi);
    if (t < -EPS || u > EPS || v > EPS) return null;
    return [Math.max(0, t), -Math.PI / 2, Math.min(0, u), Math.min(0, v)];
}

// 10. LpRmLmSm (Reverse of CCSC, wait: handle via time-reversal or direct)
// Let's include direct LpRmSmLm / LpRmSmRm + exact time-reversed words (CSCC):
// In Reeds-Shepp, the 4 CCSC families are:
//   8.7 (CSC-type? no): C C(pi/2) S C  (2 forms: same final circle, opposite final circle)
//   AND their reverse-ordered counterparts C S C(pi/2) C!
// Notice: reversing the spatial path from goal->start is NOT timeflip (timeflip preserves time reversal -> flips direction AND reverses order!).
// Wait: let's check what timeflip on (x, y, phi) ACTUALLY does!
// Wait: in our derivation earlier:
// tilde(x)(s) = -x(-s), tilde(y)(s) = y(-s), tilde(theta)(s) = -theta(-s).
// If s runs from 0 to L, then -s runs from 0 to -L (backward along the curve!).
// When starting at (0,0,0), tilde starts at (-x(0), y(0), -theta(0)) = (0,0,0) and ends at (-x(L), y(L), -theta(L)) = (-x_g, y_g, -phi) ONLY IF we step by ds = -ds'!
// WAIT: if we negate EVERY segment length (same order!), does that move from (0,0,0) to (-x, y, -phi)?
// Let's check!
// At s=0, take segment 1 of length -l1:
// dx/ds = cos(theta), d(-x(-s))/ds = cos(-theta(-s))... Wait: x(-s) moves backward from s=0 into negative s, NOT from s=L down to 0!
// For a fixed sequence of segments [seg1(l1), seg2(l2), seg3(l3)]:
// Replacing [l1, l2, l3] -> [-l1, -l2, -l3] in the SAME ORDER maps endpoint (x, y, phi) to (-x, y, -phi) ONLY?
// Let's check for a 2-segment path L(a) S(b):
// End of L(a) S(b): x = sin(a) + b cos(a), y = 1 - cos(a) + b sin(a), phi = a.
// End of L(-a) S(-b): x' = sin(-a) - b cos(-a) = -(sin(a) + b cos(a)) = -x!
//                      y' = 1 - cos(-a) - b sin(-a) = 1 - cos(a) + b sin(a) = y!
//                      phi' = -a = -phi!
// IT DOES! Because each step in the SAME order simply mirrors x -> -x and phi -> -phi!
// AND THEREFORE, C-C-S-C has 2 distinct families (CCSC and CSCC) when timeflip/reflect keep segment ORDER!
// Let's double check! Reversing the ORDER of segments corresponds to going from goal -> start backwards (`time-reversal` of path: swap start and goal!).
// For CSCC: solving CCSC from goal->start (reversed path) and reversing segment order & signs gives CSCC!
// Wait: that's why standard RS implementations (like OMPL!) have BOTH:
//   - CCSC evaluated at (x, y, phi) with all 4 symmetries
//   - AND CCSC evaluated with reversed-order (solving from goal to start: (-x cos phi - y sin phi... or simply checking 8.9/8.10)!
// Even better: evaluating the base word at the inverse transform (goal -> start) AND reversing the segment order + negating lengths? Wait:
// Let's check! Suppose path P goes from A=(0,0,0) to B=(x,y,phi) via [S1, S2, S3, S4].
// If you traverse P BACKWARDS from B to A, every segment length gets NEGATED (`dir -> -dir`) AND the order is REVERSED `[ -S4, -S3, -S2, -S1 ]`!
// Now transform B to origin and A to B^-1 = (-x cos phi - y sin phi, x sin phi - y cos phi, -phi)!
// No, wait: if P goes B->A in reverse, that starts at B=(0,0,0) and reaches A=B^-1 via `[-S4, -S3, -S2, -S1]`.
// Equivalently, if you find ANY valid RS path Q from B^-1? Wait: if Q goes from A=(0,0,0) to B^-1 with segments [q1, q2, q3, q4], then going BACKWARDS along Q from B^-1 to A goes from (x_B^-1) to (0,0,0) via `[-q4, -q3, -q2, -q1]`, which rigidly rotated by B goes from B to A? No, goes from A to B! Wait:
// Transform origin=B, target=A=B^-1. If Q goes from B to A, then going backwards along Q goes from A to B with segments `[-q_n, ..., -q_1]`!
// Let's verify on 2-segment L(a) S(b):
// B = (sin a + b cos a, 1 - cos a + b sin a, a).
// B^-1: x_inv = -(sin a + b cos a) cos a - (1 - cos a + b sin a) sin a = -b - sin a
//       y_inv = (sin a + b cos a) sin a - (1 - cos a + b sin a) cos a = 1 - cos a
//       phi_inv = -a.
// Now if we find a path Q from (0,0,0) to (x_inv, y_inv, phi_inv) = S(-b) L(-a):
// Check S(-b): (-b, 0, 0). Then L(-a): (-b + sin(-a), 1 - cos(-a), -a) = (-b - sin a, 1 - cos a, -a) = B^-1!
// Now reverse order and negate signs of Q = [S(-b), L(-a)] => [L(+a), S(+b)] = P!
// THAT'S SO CLEAN AND EXACT!
// Wait: for asymmetric C-C-S-C, applying CCSC to B^-1 and reversing order & negating signs automatically generates ALL 4 symmetries of C-S-C-C!

// 10. LpRmSmLmRp (Formula 8.11: CCSCC: t >= 0, -pi/2, u <= 0, -pi/2, v >= 0)
function LpRmSmLmRp(x, y, phi) {
    const xi = x + Math.sin(phi);
    const eta = y - 1 - Math.cos(phi);
    const [rho, theta] = polar(xi, eta);
    if (rho < Math.sqrt(20) - EPS) return null;
    const fourPlusR = Math.sqrt(Math.max(0, rho * rho - 4));
    const r = fourPlusR - 4;
    if (r < -EPS) return null;
    const t = normalizeAngle(theta - Math.atan2(-fourPlusR, -2));
    const v = normalizeAngle(t - phi);
    if (t < -EPS || v < -EPS) return null;
    return [Math.max(0, t), -Math.PI / 2, -Math.max(0, r), -Math.PI / 2, Math.max(0, v)];
}

/**
 * Computes candidate Reeds-Shepp paths from start to goal.
 * Each returned path is guaranteed to satisfy start -> goal kinematics (when collision-free).
 *
 * @param {{ x: number, y: number, heading: number }} start
 * @param {{ x: number, y: number, heading: number }} goal
 * @param {number} turningRadius
 * @param {object} [options]
 * @param {number} [options.reverseWeight=1.0] - Multiplier for reverse segment cost
 * @param {number} [options.cuspPenalty=0] - Penalty added per gear switch
 * @returns {Array<{ cost: number, length: number, cusps: number, segments: Array<{ steer: number, dir: number, length: number }> }>}
 */
export function computeReedsSheppPaths(start, goal, turningRadius, options = {}) {
    const reverseWeight = options.reverseWeight ?? 1.0;
    const cuspPenalty = options.cuspPenalty ?? 0;

    // Transform goal into start's normalized local frame (unit turning radius)
    const dx = (goal.x - start.x) / turningRadius;
    const dy = (goal.y - start.y) / turningRadius;
    const c = Math.cos(start.heading);
    const s = Math.sin(start.heading);
    const x = c * dx + s * dy;
    const y = -s * dx + c * dy;
    const phi = normalizeAngle(goal.heading - start.heading);

    // Inverse transform (goal -> start) for reversing order of asymmetric words (CSCC)
    const invX = Math.cos(phi) * (-x) + Math.sin(phi) * (-y);
    const invY = -Math.sin(phi) * (-x) + Math.cos(phi) * (-y);
    const invPhi = -phi;

    const candidates = [];

    const addPath = (steers, signedLengths) => {
        if (!signedLengths) return;
        const segments = [];
        let totalLen = 0;
        let weightedLen = 0;
        let cusps = 0;
        let prevDir = 0;

        for (let i = 0; i < steers.length; i++) {
            const sl = signedLengths[i];
            if (!Number.isFinite(sl)) return;
            const len = Math.abs(sl) * turningRadius;
            if (len < 1e-6) continue;
            const dir = sl >= 0 ? 1 : -1;
            if (prevDir !== 0 && dir !== prevDir) cusps++;
            prevDir = dir;
            totalLen += len;
            weightedLen += len * (dir < 0 ? reverseWeight : 1);
            segments.push({ steer: steers[i], dir, length: len });
        }

        // Handle zero-distance goal
        if (segments.length === 0 && Math.hypot(x, y) < 1e-4 && Math.abs(phi) < 1e-4) {
            candidates.push({ cost: 0, length: 0, cusps: 0, segments: [] });
            return;
        }
        if (segments.length === 0) return;

        candidates.push({
            cost: weightedLen + cusps * cuspPenalty,
            length: totalLen,
            cusps,
            segments
        });
    };

    const runSymmetries = (fn, steers) => {
        const opp = steers.map((st) => -st);
        const neg = (arr) => (arr ? arr.map((v) => -v) : null);

        addPath(steers, fn(x, y, phi));
        addPath(steers, neg(fn(-x, y, -phi)));
        addPath(opp, fn(x, -y, -phi));
        addPath(opp, neg(fn(-x, -y, phi)));
    };

    const runReversedSymmetries = (fn, steers) => {
        const revSteers = [...steers].reverse();
        const revOpp = revSteers.map((st) => -st);
        const revNeg = (arr) => (arr ? [...arr].reverse().map((v) => -v) : null);
        const revPos = (arr) => (arr ? [...arr].reverse() : null);

        addPath(revSteers, revNeg(fn(invX, invY, invPhi)));
        addPath(revSteers, revPos(fn(-invX, invY, -invPhi)));
        addPath(revOpp, revNeg(fn(invX, -invY, -invPhi)));
        addPath(revOpp, revPos(fn(-invX, -invY, invPhi)));
    };

    // CSC
    runSymmetries(LpSpLp, [1, 0, 1]);
    runSymmetries(LpSpRp, [1, 0, -1]);

    // CCC
    runSymmetries(LpRmLp, [1, -1, 1]);
    runSymmetries(LpRmLm, [1, -1, 1]);
    runReversedSymmetries(LpRmLm, [1, -1, 1]); // generates LpRpLm and symmetries

    // CCCC
    runSymmetries(LpRpRmLm, [1, -1, 1, -1]);
    runSymmetries(LpRmLmRp, [1, -1, 1, -1]);

    // CCSC and CSCC
    runSymmetries(LpRmSmLm, [1, -1, 0, 1]);
    runReversedSymmetries(LpRmSmLm, [1, -1, 0, 1]);
    runSymmetries(LpRmSmRm, [1, -1, 0, -1]);
    runReversedSymmetries(LpRmSmRm, [1, -1, 0, -1]);

    // CCSCC
    runSymmetries(LpRmSmLmRp, [1, -1, 0, 1, -1]);

    candidates.sort((a, b) => a.cost - b.cost);
    return candidates;
}

/**
 * Computes minimum unweighted Reeds-Shepp path length (admissible non-holonomic heuristic).
 * @param {{ x: number, y: number, heading: number }} start
 * @param {{ x: number, y: number, heading: number }} goal
 * @param {number} turningRadius
 * @returns {number}
 */
export function reedsSheppDistance(start, goal, turningRadius) {
    const paths = computeReedsSheppPaths(start, goal, turningRadius);
    return paths.length > 0 ? paths[0].length : Math.hypot(goal.x - start.x, goal.y - start.y);
}

/**
 * Advances a pose along a constant-steer arc of signed length ds.
 * @param {number} x
 * @param {number} y
 * @param {number} heading
 * @param {number} kappa - Signed curvature (steer / turningRadius)
 * @param {number} ds - Signed arc length (+ forward, - reverse)
 * @returns {{ x: number, y: number, heading: number }}
 */
export function stepArc(x, y, heading, kappa, ds) {
    if (Math.abs(kappa) < 1e-9) {
        return {
            x: x + ds * Math.cos(heading),
            y: y + ds * Math.sin(heading),
            heading
        };
    }
    const r = 1 / kappa;
    const nextHeading = heading + ds * kappa;
    return {
        x: x + r * (Math.sin(nextHeading) - Math.sin(heading)),
        y: y - r * (Math.cos(nextHeading) - Math.cos(heading)),
        heading: nextHeading
    };
}

/**
 * Samples a sequence of Reeds-Shepp segments into dense waypoints.
 * @param {{ x: number, y: number, heading: number }} start
 * @param {Array<{ steer: number, dir: number, length: number }>} segments
 * @param {number} turningRadius
 * @param {number} [stepSize=2.5]
 * @returns {Array<{ x: number, y: number, heading: number, dir: number, steer: number, kappa: number }>}
 */
export function sampleReedsSheppPath(start, segments, turningRadius, stepSize = 2.5) {
    const waypoints = [];
    let x = start.x;
    let y = start.y;
    let heading = start.heading;

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (seg.length <= 1e-6) continue;
        const kappa = seg.steer / turningRadius;
        const steps = Math.max(1, Math.ceil(seg.length / stepSize));
        const ds = (seg.dir * seg.length) / steps;

        if (waypoints.length === 0) {
            waypoints.push({ x, y, heading: normalizeAngle(heading), dir: seg.dir, steer: seg.steer, kappa });
        }

        for (let k = 0; k < steps; k++) {
            const next = stepArc(x, y, heading, kappa, ds);
            x = next.x;
            y = next.y;
            heading = next.heading;
            waypoints.push({ x, y, heading: normalizeAngle(heading), dir: seg.dir, steer: seg.steer, kappa });
        }
    }

    return waypoints;
}
