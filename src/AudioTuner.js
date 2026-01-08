import { AudioController, ENGINE_PRESETS } from './AudioController.js';
import { EngineSim } from './EngineSim.js';

const audio = new AudioController();
const canvas = document.getElementById('viz-canvas');
const ctx = canvas.getContext('2d');

// UI Elements
const btnIgnition = document.getElementById('btn-ignition');
const throttleSlider = document.getElementById('throttle-slider');
const throttleVal = document.getElementById('throttle-val');
const rpmDisplay = document.getElementById('rpm-display');
const speedDisplay = document.getElementById('speed-display');
const presetSelect = document.getElementById('preset-select');
const jsonIO = document.getElementById('json-io');
const btnExport = document.getElementById('btn-export');
const btnImport = document.getElementById('btn-import');
const harmonicsList = document.getElementById('harmonics-list');
const btnAddHarmonic = document.getElementById('btn-add-harmonic');
const vtecLight = document.getElementById('vtec-light');

// Scenario Buttons
const btnScenRev = document.getElementById('btn-scen-rev');
const btnScenBrake = document.getElementById('btn-scen-brake');

// State
let isRunning = false;
let throttleInput = 0;
let scenarioActive = null; // 'rev', 'brake'
const sim = new EngineSim();
const DT = 1 / 60;

// --- VISUALIZATION ---
function drawVisualizer() {
    requestAnimationFrame(drawVisualizer);
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!audio.analyser) return;

    const bufferLength = audio.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    audio.analyser.getByteFrequencyData(dataArray);

    const barWidth = (canvas.width / bufferLength) * 2.5;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        const hue = (i / bufferLength) * 360;
        ctx.fillStyle = `hsl(${hue}, 80%, 50%)`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
    }
}
drawVisualizer();

// --- SIMULATION LOOP ---
function loop() {
    if (isRunning) {

        // --- SCENARIO LOGIC ---
        if (scenarioActive === 'rev') {
            // Quick Rev Up
            throttleInput = Math.min(1.0, throttleInput + 0.1);
            if (sim.getRatio() > 0.95) scenarioActive = 'rev_down';
        } else if (scenarioActive === 'rev_down') {
            throttleInput = 0;
            if (sim.velocity < 5) scenarioActive = null;
        } else if (scenarioActive === 'brake') {
            // Instant high speed, zero throttle
            sim.velocity = sim.params.maxSpeed * 0.8;
            throttleInput = 0;
            scenarioActive = 'decelerating';
        } else if (scenarioActive === 'decelerating') {
            throttleInput = 0;
            if (sim.velocity < 5) scenarioActive = null;
        } else {
            throttleInput = parseFloat(throttleSlider.value);
        }

        // --- PHYSICS ---
        const phys = audio.config.params.physics || { acceleration: 150, maxSpeed: 300 };
        sim.params.acceleration = phys.acceleration;
        sim.params.maxSpeed = phys.maxSpeed;

        // Run Sim
        const simVelocity = sim.update(throttleInput);
        const currentMaxSpeed = sim.params.maxSpeed;

        // Sync Slider back for visual feedback if scenario auto-moved it
        if (scenarioActive) {
            throttleSlider.value = throttleInput;
            throttleVal.innerText = Math.round(throttleInput * 100) + '%';
        }

        // Update Audio
        const ratio = sim.getRatio();
        audio.update(ratio, throttleInput);

        // Update Stats UI
        rpmDisplay.innerText = Math.round(audio.currentRPM);
        speedDisplay.innerText = (simVelocity / 20 * 3.6).toFixed(1);

        // VTEC Light
        if (audio.isVtecActive) vtecLight.classList.add('on');
        else vtecLight.classList.remove('on');
    }

    setTimeout(loop, 1000 / 60);
}
loop();

// --- UI BINDINGS ---

btnIgnition.onclick = () => {
    if (!isRunning) {
        audio.init();
        audio.setEngineType(audio.config);
        isRunning = true;
        btnIgnition.innerText = "KILL ENGINE";
        btnIgnition.classList.add('active');
    } else {
        audio.stop();
        isRunning = false;
        simVelocity = 0;
        btnIgnition.innerText = "START ENGINE";
        btnIgnition.classList.remove('active');
        vtecLight.classList.remove('on');
    }
};

throttleSlider.oninput = (e) => {
    throttleInput = parseFloat(e.target.value);
    throttleVal.innerText = Math.round(throttleInput * 100) + '%';
    scenarioActive = null;
};

presetSelect.onchange = (e) => {
    const type = e.target.value;
    audio.setEngineType({ type });
    refreshUI();
};

btnScenRev.onclick = () => { scenarioActive = 'rev'; };
btnScenBrake.onclick = () => { scenarioActive = 'brake'; };

btnExport.onclick = () => {
    const json = JSON.stringify(audio.config, null, 2);
    jsonIO.value = json;
    navigator.clipboard.writeText(json);
    btnExport.innerText = "Copied!";
    setTimeout(() => btnExport.innerText = "Export Config", 2000);
};

btnImport.onclick = () => {
    try {
        const cfg = JSON.parse(jsonIO.value);
        audio.config = cfg;
        if (isRunning) audio.setupEngineSound();
        refreshUI();
        alert("Config Imported Successfully");
    } catch (e) {
        alert("Invalid JSON format");
    }
};

// --- DYNAMIC PARAMETER REFRESH ---

function refreshUI() {
    const cfg = audio.config;
    document.querySelectorAll('.param-slider').forEach(slider => {
        const path = slider.getAttribute('data-path');
        const val = getNestedValue(cfg, path);
        if (val !== undefined) slider.value = val;
    });
    renderHarmonicsList();
    jsonIO.value = JSON.stringify(cfg, null, 2);
}

function getNestedValue(obj, path) {
    return path.split('.').reduce((o, p) => (o ? o[p] : undefined), obj);
}
function setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce((o, p) => o[p], obj);
    if (target) target[last] = value;
}

document.querySelectorAll('.param-slider').forEach(slider => {
    slider.oninput = (e) => {
        const path = e.target.getAttribute('data-path');
        setNestedValue(audio.config, path, parseFloat(e.target.value));
        // Update live
        if (path.includes('distortion')) audio.updateDistortionCurve();
        jsonIO.value = JSON.stringify(audio.config, null, 2);
    };
});

function renderHarmonicsList() {
    harmonicsList.innerHTML = '';
    audio.config.harmonics.forEach((h, index) => {
        const row = document.createElement('div');
        row.className = 'harmonic-row';

        const inpMult = document.createElement('input');
        inpMult.type = 'number';
        inpMult.step = '0.1';
        inpMult.value = h.mult;
        inpMult.onchange = (e) => {
            h.mult = parseFloat(e.target.value);
            if (isRunning) audio.setupEngineSound();
        };

        const inpGain = document.createElement('input');
        inpGain.type = 'number';
        inpGain.step = '0.05';
        inpGain.value = h.gain;
        inpGain.onchange = (e) => {
            h.gain = parseFloat(e.target.value);
            if (isRunning) audio.setupEngineSound();
        };

        const btnDel = document.createElement('button');
        btnDel.className = 'btn-del';
        btnDel.innerText = '×';
        btnDel.onclick = () => {
            audio.config.harmonics.splice(index, 1);
            if (isRunning) audio.setupEngineSound();
            renderHarmonicsList();
        };

        row.appendChild(inpMult);
        row.appendChild(inpGain);
        row.appendChild(btnDel);
        harmonicsList.appendChild(row);
    });
}

btnAddHarmonic.onclick = () => {
    audio.config.harmonics.push({ mult: 1.0, gain: 0.5 });
    if (isRunning) audio.setupEngineSound();
    renderHarmonicsList();
};

// Initial Start
refreshUI();
