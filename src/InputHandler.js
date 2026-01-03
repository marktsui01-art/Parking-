/**
 * Handles keyboard and gamepad input.
 */
export class InputHandler {
    constructor() {
        this.keys = {};

        // Ensure we are in a browser environment before adding listeners
        if (typeof window !== 'undefined') {
            window.addEventListener('keydown', (e) => this.keys[e.code] = true);
            window.addEventListener('keyup', (e) => this.keys[e.code] = false);
        }
    }

    /**
     * Gets the current steering input (-1 to 1).
     * @returns {number}
     */
    getSteer() {
        let steer = 0;
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) steer -= 1;
        if (this.keys['KeyD'] || this.keys['ArrowRight']) steer += 1;

        // Gamepad check
        if (typeof navigator !== 'undefined' && navigator.getGamepads) {
            const gamepad = navigator.getGamepads()[0];
            if (gamepad) {
                // Left stick horizontal axis (usually axis 0)
                const axisX = gamepad.axes[0];
                if (Math.abs(axisX) > 0.1) steer = axisX; // Deadzone
            }
        }

        return Math.max(-1, Math.min(1, steer));
    }

    /**
     * Gets the current throttle/brake input (-1 to 1).
     * Positive is forward, negative is backward/brake.
     * @returns {number}
     */
    getThrottle() {
        let throttle = 0;
        if (this.keys['KeyW'] || this.keys['ArrowUp']) throttle += 1;
        if (this.keys['KeyS'] || this.keys['ArrowDown']) throttle -= 1;

        // Gamepad check
        if (typeof navigator !== 'undefined' && navigator.getGamepads) {
            const gamepad = navigator.getGamepads()[0];
            if (gamepad) {
                // Triggers usually are buttons 6 (LT) and 7 (RT)
                // They return a value between 0 and 1.
                const brake = gamepad.buttons[6] ? gamepad.buttons[6].value : 0;
                const gas = gamepad.buttons[7] ? gamepad.buttons[7].value : 0;

                throttle += gas;
                throttle -= brake;
            }
        }

        return Math.max(-1, Math.min(1, throttle));
    }
}
