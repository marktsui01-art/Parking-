import { Vector2 } from '../../src/Vector2.js';

describe('Vector2', () => {
    test('should add vectors', () => {
        const v1 = new Vector2(1, 2);
        const v2 = new Vector2(3, 4);
        const result = v1.add(v2);
        expect(result.x).toBe(4);
        expect(result.y).toBe(6);
    });

    test('should subtract vectors', () => {
        const v1 = new Vector2(5, 5);
        const v2 = new Vector2(2, 3);
        const result = v1.sub(v2);
        expect(result.x).toBe(3);
        expect(result.y).toBe(2);
    });

    test('should scale vectors', () => {
        const v = new Vector2(2, 3);
        const result = v.scale(2);
        expect(result.x).toBe(4);
        expect(result.y).toBe(6);
    });

    test('should calculate dot product', () => {
        const v1 = new Vector2(1, 2);
        const v2 = new Vector2(3, 4);
        const dot = v1.dot(v2);
        expect(dot).toBe(11); // 1*3 + 2*4 = 3 + 8 = 11
    });

    test('should normalize', () => {
        const v = new Vector2(3, 4); // Magnitude 5
        const result = v.normalize();
        expect(result.x).toBeCloseTo(0.6);
        expect(result.y).toBeCloseTo(0.8);
    });
});
