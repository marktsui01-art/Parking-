import { Vector2 } from './Vector2.js';
import { GameEngine, createPolygon, CAR_MODELS } from './GameEngine.js';
import { InputHandler } from './InputHandler.js';
import { CanvasRenderer } from './CanvasRenderer.js';
import { LEVELS } from './levels.js';
import { SAT } from './SAT.js';
import { AudioController } from './AudioController.js';

let currentCarKey = 'm3_g80';

// Init
const canvas = document.getElementById('gameCanvas');
const engine = new GameEngine();
const inputHandler = new InputHandler();
const renderer = new CanvasRenderer(canvas);
const audioController = new AudioController();
const telemetry = document.getElementById('telemetry');

// UI Elements
const uiLayer = document.getElementById('ui-layer');
const levelChooser = document.getElementById('level-chooser');
const levelList = document.getElementById('level-list');
const messageArea = document.getElementById('message-area');
const returnContainer = document.getElementById('return-container');
const returnBtn = document.getElementById('return-btn');
const carSelect = document.getElementById('car-select');

let gameState = 'MENU'; // MENU, PLAYING, GAMEOVER

// Replay System
let replayState = 'NONE'; // NONE, RECORDING, PLAYBACK
let recordedInputs = [];
let replayFrame = 0;
let replayLevelIndex = 0;
let replayCarModel = 'm3_g80';

// Replay Public API
window.startRecording = () => {
    if (gameState !== 'PLAYING') return alert("Must be playing to record.");
    replayState = 'RECORDING';
    recordedInputs = [];
    replayLevelIndex = LEVELS.indexOf(engine.currentLevel);
    replayCarModel = currentCarKey;
    console.log("Recording started...");
};

window.stopRecording = () => {
    if (replayState !== 'RECORDING') return;
    replayState = 'NONE';
    console.log(`Recording stopped. ${recordedInputs.length} frames captured.`);
};

window.downloadReplay = () => {
    if (recordedInputs.length === 0) return alert("No recording available.");

    const replayData = {
        levelIndex: replayLevelIndex,
        carModel: replayCarModel,
        inputs: recordedInputs
    };

    const blob = new Blob([JSON.stringify(replayData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `replay_level_${replayLevelIndex}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

window.loadReplay = (jsonString) => {
    try {
        const data = JSON.parse(jsonString);
        if (!data.inputs || !Array.isArray(data.inputs)) throw new Error("Invalid replay format");

        // Load correct car
        if (data.carModel && CAR_MODELS[data.carModel]) {
            currentCarKey = data.carModel;
            engine.applyCarModel(CAR_MODELS[currentCarKey]);
            // Update UI selector if possible (optional)
            carSelect.value = currentCarKey;
        }

        // Load correct level
        if (data.levelIndex !== undefined && LEVELS[data.levelIndex]) {
            startLevel(data.levelIndex);
        }

        recordedInputs = data.inputs;
        replayFrame = 0;
        replayState = 'PLAYBACK';
        console.log(`Replay loaded: ${recordedInputs.length} frames.`);

    } catch (e) {
        console.error(e);
        alert("Failed to load replay: " + e.message);
    }
};

// Level Manager Logic
function initLevelChooser() {
    // Populate Car Select
    carSelect.innerHTML = '';
    for (const key in CAR_MODELS) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.innerText = CAR_MODELS[key].name;
        if (key === currentCarKey) opt.selected = true;
        carSelect.appendChild(opt);
    }

    carSelect.onchange = (e) => {
        currentCarKey = e.target.value;
        const model = CAR_MODELS[currentCarKey];
        engine.applyCarModel(model);
        audioController.setEngineType(model.engineConfig);
    };

    levelList.innerHTML = '';
    LEVELS.forEach((level, index) => {
        const btn = document.createElement('button');
        btn.className = 'level-btn';
        btn.innerText = level.name;
        btn.onclick = () => startLevel(index);
        levelList.appendChild(btn);
    });
}

function startLevel(index) {
    // Attempt to init audio context on user gesture
    audioController.init();

    // Set initial engine type if not set
    if (CAR_MODELS[currentCarKey]) {
        audioController.setEngineType(CAR_MODELS[currentCarKey].engineConfig);
    }

    const level = LEVELS[index];
    engine.loadLevel(level);
    gameState = 'PLAYING';

    // Stop any active replay stuff
    if (replayState !== 'RECORDING') {
        replayState = 'NONE';
    }

    // UI Updates
    levelChooser.style.display = 'none';
    messageArea.style.display = 'none';
    returnContainer.style.display = 'none';
    btnCopy.style.display = 'block';
}

function showMenu() {
    gameState = 'MENU';
    replayState = 'NONE';
    levelChooser.style.display = 'block';
    messageArea.style.display = 'none';
    returnContainer.style.display = 'none';
    btnCopy.style.display = 'none';
    hideEditor();
}

function showGameOver(won) {
    gameState = 'GAMEOVER';
    messageArea.style.display = 'block';
    messageArea.innerText = won ? 'LEVEL COMPLETE!' : 'CRASHED!';
    messageArea.className = won ? 'win' : 'loss';
    returnContainer.style.display = 'block';
}

returnBtn.onclick = () => {
    showMenu();
};

// --- Editor Logic ---
let selectedObject = null; // { type: 'obstacle'|'target'|'start', index?: number, obj: object }
const editorUi = document.getElementById('editor-ui');
const inpX = document.getElementById('edit-x');
const inpY = document.getElementById('edit-y');
const inpW = document.getElementById('edit-w');
const inpH = document.getElementById('edit-h');
const inpAngle = document.getElementById('edit-angle');
const btnApply = document.getElementById('btn-apply');
const btnClose = document.getElementById('btn-close');
const btnCopy = document.getElementById('btn-copy-level');

function showEditor(obj, type) {
    selectedObject = { obj, type };
    inpX.value = obj.x;
    inpY.value = obj.y;
    // Handle different object types
    if (type === 'start') {
        // Start has no width/height in data, but represented by car dims
        inpW.value = engine.width; // Read-only ideally or just reference
        inpH.value = engine.length;
        inpW.disabled = true;
        inpH.disabled = true;
        inpAngle.value = obj.heading || 0;
    } else {
        inpW.value = obj.width;
        inpH.value = obj.height;
        inpW.disabled = false;
        inpH.disabled = false;
        inpAngle.value = obj.angle || 0;
    }
    editorUi.style.display = 'flex';
}

function hideEditor() {
    editorUi.style.display = 'none';
    selectedObject = null;
}

canvas.addEventListener('mousedown', (e) => {
    if (gameState !== 'PLAYING') return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const mouseVec = new Vector2(mouseX, mouseY);

    // Hit Test Priority: Start > Target > Obstacles
    // 1. Check Start (Ghost)
    if (engine.currentLevel.start) {
        const start = engine.currentLevel.start;
        // Car polygon at start
        const ghostWB = engine.wheelBase;
        const centerDist = ghostWB / 2;
        const centerX = start.x + centerDist * Math.cos(start.heading || 0);
        const centerY = start.y + centerDist * Math.sin(start.heading || 0);
        const startPoly = createPolygon(centerX, centerY, engine.length, engine.width, start.heading || 0);

        if (SAT.isPointInConvexPoly(mouseVec, startPoly)) {
            showEditor(start, 'start');
            return;
        }
    }

    // 2. Check Target
    if (engine.currentLevel.target) {
        const t = engine.currentLevel.target;
        const tPoly = createPolygon(t.x, t.y, t.width, t.height, t.angle);
        if (SAT.isPointInConvexPoly(mouseVec, tPoly)) {
            showEditor(t, 'target');
            return;
        }
    }

    // 3. Check Obstacles
    if (engine.currentLevel.obstacles) {
        for (const obs of engine.currentLevel.obstacles) {
            const obsPoly = createPolygon(obs.x, obs.y, obs.width, obs.height, obs.angle);
            if (SAT.isPointInConvexPoly(mouseVec, obsPoly)) {
                showEditor(obs, 'obstacle');
                return;
            }
        }
    }

    // Clicked nothing? Close editor
    hideEditor();
});

btnApply.onclick = () => {
    if (!selectedObject) return;
    const obj = selectedObject.obj;

    obj.x = parseFloat(inpX.value);
    obj.y = parseFloat(inpY.value);

    if (selectedObject.type === 'start') {
        obj.heading = parseFloat(inpAngle.value);
        // W/H ignored for start
    } else {
        obj.width = parseFloat(inpW.value);
        obj.height = parseFloat(inpH.value);
        obj.angle = parseFloat(inpAngle.value);
    }
    // Flash success?
    btnApply.innerText = "Applied!";
    setTimeout(() => btnApply.innerText = "Apply", 1000);
};

btnClose.onclick = hideEditor;

btnCopy.onclick = () => {
    if (!engine.currentLevel) return;
    const json = JSON.stringify(engine.currentLevel, null, 4);
    navigator.clipboard.writeText(json).then(() => {
        btnCopy.innerText = "Copied!";
        setTimeout(() => btnCopy.innerText = "📋 Copy Level JSON", 2000);
    }).catch(err => {
        console.error('Failed to copy', err);
        alert("Failed to copy to clipboard. Check console.");
    });
};

// Show Copy button when playing
const originalStartLevel = startLevel;
// Redefine locally within scope if possible, but startLevel is function declaration hoisted.
// Just overwrite the pointer.
// Note: In modules, functions are not global. This local `startLevel` is what `btn.onclick` uses.
// But wait, `originalStartLevel` refers to `startLevel` which calls `engine.loadLevel`.
// The overriding pattern in `index.html` relied on `startLevel` being a variable or function in the same scope.
// Here `startLevel` is a function declaration. I can't overwrite it like `startLevel = ...` easily if it's const/function.
// But `btn.onclick` captures `startLevel`.
// I can just add the logic to `startLevel` directly.
// Refactoring: Merging logic.

// RE-IMPLEMENT startLevel to include button visibility logic
function startLevelWithCopy(index) {
    const level = LEVELS[index];
    engine.loadLevel(level);
    gameState = 'PLAYING';

    // UI Updates
    levelChooser.style.display = 'none';
    messageArea.style.display = 'none';
    returnContainer.style.display = 'none';

    // Copy button
    btnCopy.style.display = 'block';
}

// Update the click handler in initLevelChooser to use the new function?
// No, I need to update `startLevel` usage.
// Actually, `initLevelChooser` calls `startLevel`.
// I will just modify `startLevel` above to include `btnCopy.style.display = 'block';`.

// Let's rewrite startLevel above.
/*
function startLevel(index) {
    const level = LEVELS[index];
    engine.loadLevel(level);
    gameState = 'PLAYING';

    // UI Updates
    levelChooser.style.display = 'none';
    messageArea.style.display = 'none';
    returnContainer.style.display = 'none';
    btnCopy.style.display = 'block'; // Added
}
*/
// The original code did wrapping. Here I can just edit the function.

// Same for showMenu
/*
function showMenu() {
    gameState = 'MENU';
    levelChooser.style.display = 'block';
    messageArea.style.display = 'none';
    returnContainer.style.display = 'none';
    btnCopy.style.display = 'none'; // Added
    hideEditor(); // Added
}
*/

// Bootstrap
initLevelChooser();
showMenu();

// --- UI Wiring for Replay ---
const btnRecord = document.getElementById('btn-record');
const btnStopRecord = document.getElementById('btn-stop-record');
const btnUploadReplay = document.getElementById('btn-upload-replay');
const fileInputReplay = document.getElementById('replay-file');
const replayControls = document.getElementById('replay-controls');

btnRecord.onclick = () => {
    window.startRecording();
    btnRecord.style.display = 'none';
    btnStopRecord.style.display = 'inline-block';
};

btnStopRecord.onclick = () => {
    window.stopRecording();
    window.downloadReplay();
    btnRecord.style.display = 'inline-block';
    btnStopRecord.style.display = 'none';
};

btnUploadReplay.onclick = () => {
    fileInputReplay.click();
};

fileInputReplay.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        window.loadReplay(evt.target.result);
    };
    reader.readAsText(file);
    // Reset val so same file can be loaded again if needed
    fileInputReplay.value = '';
};

// Hook into showMenu/startLevel to toggle UI visibility
const _originalShowMenu = showMenu;
showMenu = function () {
    _originalShowMenu();
    replayControls.style.display = 'none';
};

const _originalStartLevel = startLevel;
startLevel = function (index) {
    _originalStartLevel(index);
    // If not playing a replay, show record button
    if (replayState !== 'PLAYBACK') {
        replayControls.style.display = 'block';
        btnRecord.style.display = 'inline-block';
        btnStopRecord.style.display = 'none';
    } else {
        replayControls.style.display = 'none';
    }
};

// Re-bootstrap to ensure overridden functions are used
initLevelChooser(); // Updates onclicks to use new startLevel
showMenu();

// Expose to window
window.game = engine;
// Also expose regression test runner
window.runRegressionTests = () => testTurningCircle(GameEngine);


// Game Loop
let lastTime = performance.now();
let accumulator = 0;
const FIXED_STEP = 1 / 60;
const MAX_ACCUMULATOR = 0.2; // Prevent spiral of death

function loop(now) {
    let dt = (now - lastTime) / 1000;
    if (dt > 1) dt = 1; // Cap large headers
    lastTime = now;

    accumulator += dt;
    if (accumulator > MAX_ACCUMULATOR) accumulator = MAX_ACCUMULATOR;

    while (accumulator >= FIXED_STEP) {
        if (gameState === 'PLAYING') {
            let input = { steer: 0, throttle: 0 };

            if (replayState === 'PLAYBACK') {
                if (replayFrame < recordedInputs.length) {
                    input = recordedInputs[replayFrame];
                    replayFrame++;
                } else {
                    // Replay ended
                    replayState = 'NONE';
                }
            } else {
                // Live Input
                input = {
                    steer: inputHandler.getSteer(),
                    throttle: inputHandler.getThrottle()
                };
            }

            if (replayState === 'RECORDING') {
                recordedInputs.push(input);
            }

            // Update Logic
            engine.update(FIXED_STEP, input);

            // Audio Update
            const speedRatio = engine.velocity / engine.maxSpeed;
            audioController.update(speedRatio, input.throttle);

            // Check for Game Over conditions
            if (engine.won) {
                showGameOver(true);
            }
        } else {
            // Stop audio if not playing
            audioController.stop();
        }
        accumulator -= FIXED_STEP;
    }

    // Render
    renderer.render(engine);

    // Telemetry Update
    if (gameState === 'PLAYING') {
        const vKmh = (engine.velocity / 20 * 3.6).toFixed(1);
        const scoreText = `Score: ${engine.score}`;

        telemetry.innerText = `Level: ${engine.currentLevel ? engine.currentLevel.name : 'None'}
Pos: (${engine.pos.x.toFixed(1)}, ${engine.pos.y.toFixed(1)})
Heading: ${(engine.heading * 180 / Math.PI).toFixed(1)}°
Speed: ${vKmh} km/h (${engine.velocity.toFixed(1)} px/s)
Steer: ${(engine.steerAngle * 180 / Math.PI).toFixed(1)}°
${scoreText}`;
    } else {
        telemetry.innerText = `State: ${gameState}`;
    }

    requestAnimationFrame(loop);
}

// Start Loop
requestAnimationFrame(loop);


// --- Self-Test ---
(function runSelfTest() {
    console.log("Running Self-Test: 1s of Gas + Left Turn...");
    const testEngine = new GameEngine();
    // Move starting position to 0,0 for easier calculation checks if needed, or keep default
    testEngine.pos = new Vector2(0, 0);
    testEngine.heading = 0;
    testEngine.velocity = 0;

    const dt = 1 / 60; // Fixed timestep for test
    const steps = 60; // 1 second roughly

    for (let i = 0; i < steps; i++) {
        testEngine.update(dt, { steer: -1, throttle: 1 });
    }

    console.log("Self-Test Complete.");
    console.log(`Final Position: x=${testEngine.pos.x.toFixed(2)}, y=${testEngine.pos.y.toFixed(2)}`);
    console.log(`Final Heading: ${(testEngine.heading * 180 / Math.PI).toFixed(2)} degrees`);

    // Simple heuristic check: Should have moved forward and turned left (negative y, positive x, negative heading)
    if (testEngine.pos.x > 0 && testEngine.pos.y < 0 && testEngine.heading < 0) {
        console.log("Self-Test PASSED: Movement logic appears correct (moved forward-left).");
    } else {
        console.warn("Self-Test WARNING: Unexpected position/heading.");
    }
})();

/**
 * Runs a regression test to verify turning circle dimensions.
 * @param {typeof GameEngine} EngineClass The GameEngine class to test
 * @returns {object} Test results
 */
function testTurningCircle(EngineClass) {
    const engine = new EngineClass();
    console.log("Starting Turning Circle Test...");
    console.log(`Config: WheelBase=${engine.wheelBase}, MaxSteer=${engine.maxSteerAngle.toFixed(3)} rad`);

    engine.steerAngle = engine.maxSteerAngle;
    engine.velocity = 100; // Constant speed
    const dt = 0.01;
    const startPos = { x: engine.pos.x, y: engine.pos.y };
    let maxDist = 0;

    // Calculate expected period
    // angular_velocity = (v / L) * tan(delta)
    const w = (engine.velocity / engine.wheelBase) * Math.tan(engine.steerAngle);
    const T = 2 * Math.PI / w;

    // Simulate for slightly more than half a period to find diameter
    const duration = (T / 2) * 1.2;
    const steps = Math.ceil(duration / dt);

    for (let i = 0; i < steps; i++) {
        // Manually integrate position for constant circular motion verification
        // (Using same logic as engine.update mainly, but ensuring constant velocity/steer)

        // Update Pos
        engine.pos.x += engine.velocity * Math.cos(engine.heading) * dt;
        engine.pos.y += engine.velocity * Math.sin(engine.heading) * dt;

        // Update Heading
        const angularVelocity = (engine.velocity / engine.wheelBase) * Math.tan(engine.steerAngle);
        engine.heading += angularVelocity * dt;

        // Track max distance from start (Diameter)
        const dist = Math.sqrt(Math.pow(engine.pos.x - startPos.x, 2) + Math.pow(engine.pos.y - startPos.y, 2));
        if (dist > maxDist) maxDist = dist;
    }

    const diameter = maxDist;
    const radius = diameter / 2;

    console.log(`Turning Circle Test Results: Diameter=${diameter.toFixed(2)}, Radius=${radius.toFixed(2)}`);
    return { diameter, radius };
}
