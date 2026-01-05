import { AudioController, ENGINE_PRESETS } from './AudioController.js';

// Setup
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
const chkAutoRev = document.getElementById('chk-autorev');

// State
let isRunning = false;
let throttleInput = 0;
let autoRevTime = 0;

// Physics Sim State
let simVelocity = 0;
const MAX_SPEED = 300; // Match GameEngine defaults roughly
const ACCEL = 150;
const FRICTION = 0.95;
const DT = 1/60;

// --- Visualization ---
function drawVisualizer() {
    requestAnimationFrame(drawVisualizer);

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!audio.analyser) return;

    const bufferLength = audio.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    audio.analyser.getByteFrequencyData(dataArray);

    const barWidth = (canvas.width / bufferLength) * 2.5;
    let barHeight;
    let x = 0;

    for(let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i];

        const r = barHeight + (25 * (i/bufferLength));
        const g = 250 * (i/bufferLength);
        const b = 50;

        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
    }
}
drawVisualizer();

// --- Simulation Loop ---
function loop() {
    if (isRunning) {
        // Auto Rev Logic
        if (chkAutoRev.checked) {
            autoRevTime += DT;
            throttleInput = (Math.sin(autoRevTime * 2) + 1) / 2;
            throttleSlider.value = throttleInput;
            throttleVal.innerText = Math.round(throttleInput * 100) + '%';
        }

        // Physics
        if (throttleInput > 0) {
            simVelocity += throttleInput * ACCEL * DT;
        } else {
            simVelocity *= Math.pow(FRICTION, DT * 60);
        }
        simVelocity = Math.max(0, Math.min(MAX_SPEED, simVelocity));

        // Audio Update
        const speedRatio = simVelocity / MAX_SPEED;
        audio.update(speedRatio, throttleInput);

        // UI Update
        if (audio.currentRPM) {
            rpmDisplay.innerText = `RPM: ${audio.currentRPM}`;
        } else {
             // EV approximation
             rpmDisplay.innerText = `FREQ: ${Math.round(audio.config.baseFreq + speedRatio*600)}Hz`;
        }
        speedDisplay.innerText = `${(simVelocity/20*3.6).toFixed(1)} km/h`;
    }
    setTimeout(loop, 1000/60);
}
loop();

// --- UI Binding ---

// Ignition
btnIgnition.onclick = () => {
    if (!isRunning) {
        audio.init();
        audio.setEngineType(audio.config); // Re-apply current config to be safe
        isRunning = true;
        btnIgnition.innerText = "STOP ENGINE";
        btnIgnition.classList.add('active');
    } else {
        audio.stop();
        isRunning = false;
        simVelocity = 0;
        btnIgnition.innerText = "START ENGINE";
        btnIgnition.classList.remove('active');
    }
};

// Throttle
throttleSlider.oninput = (e) => {
    throttleInput = parseFloat(e.target.value);
    throttleVal.innerText = Math.round(throttleInput * 100) + '%';
    chkAutoRev.checked = false; // Disengage auto
};

// Preset
presetSelect.onchange = (e) => {
    const type = e.target.value;
    const preset = ENGINE_PRESETS[type];
    if (preset) {
        // We need to keep the audio controller consistent
        audio.config = JSON.parse(JSON.stringify(preset));
        if (isRunning) audio.setEngineType({ type }); // This reloads audio graph
        refreshUI();
    }
};

// Layers Mixer
document.querySelectorAll('.layer-gain').forEach(slider => {
    slider.oninput = (e) => {
        const layer = e.target.getAttribute('data-layer');
        audio.setLayerGain(layer, parseFloat(e.target.value));
    };
});

// JSON Export
btnExport.onclick = () => {
    const json = JSON.stringify(audio.config, null, 2);
    jsonIO.value = json;
    navigator.clipboard.writeText(json);
    btnExport.innerText = "Copied!";
    setTimeout(() => btnExport.innerText = "Copy JSON", 2000);
};

// JSON Import
btnImport.onclick = () => {
    try {
        const cfg = JSON.parse(jsonIO.value);
        audio.config = cfg;
        if (isRunning) audio.setupEngineSound();
        refreshUI();
        alert("Config Loaded");
    } catch (e) {
        alert("Invalid JSON");
    }
};

// --- Dynamic UI Builders ---

function refreshUI() {
    const cfg = audio.config;

    // Base Params
    document.getElementById('inp-basefreq').value = cfg.baseFreq;
    document.getElementById('inp-osctype').value = cfg.oscType || 'sawtooth';
    document.getElementById('inp-distortion').value = cfg.params.distortion ? cfg.params.distortion.amount : 0;

    // Harmonics
    renderHarmonicsList();

    // Sliders for nested params (generic binding)
    document.querySelectorAll('.param-slider').forEach(slider => {
        const path = slider.getAttribute('data-path');
        const val = getNestedValue(cfg, path);
        if (val !== undefined) slider.value = val;
    });
}

// Helper for nested access
function getNestedValue(obj, path) {
    return path.split('.').reduce((o, p) => (o ? o[p] : undefined), obj);
}
function setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const last = keys.pop();
    const target = keys.reduce((o, p) => o[p], obj);
    if (target) target[last] = value;
}

// Bind Base Params
document.getElementById('inp-basefreq').onchange = (e) => {
    audio.config.baseFreq = parseFloat(e.target.value);
    if (isRunning) audio.setupEngineSound(); // Needs graph rebuild for osc freq base? Actually update() handles freq, but baseFreq change might need re-init if not constantly checked.
    // update() uses config.baseFreq dynamically, so we might just need to wait for next frame.
    // However, setupEngineSound sets the initial values. Let's call setup to be safe or ensure update picks it up.
    // update() calculates currentFreq = baseFreq * ... so it should be immediate.
};

document.getElementById('inp-osctype').onchange = (e) => {
    audio.config.oscType = e.target.value;
    if (isRunning) audio.setupEngineSound(); // Must rebuild oscillators
};

document.getElementById('inp-distortion').oninput = (e) => {
    const val = parseFloat(e.target.value);
    if (!audio.config.params.distortion) audio.config.params.distortion = {};
    audio.config.params.distortion.amount = val;
    audio.updateDistortionCurve();
};

// Bind Generic Param Sliders
document.querySelectorAll('.param-slider').forEach(slider => {
    slider.oninput = (e) => {
        const path = e.target.getAttribute('data-path');
        setNestedValue(audio.config, path, parseFloat(e.target.value));
        // No need to re-setup, update() loop picks these up
    };
});

// Harmonics List
function renderHarmonicsList() {
    harmonicsList.innerHTML = '';
    audio.config.harmonics.forEach((h, index) => {
        const row = document.createElement('div');
        row.className = 'harmonic-row';

        const inpMult = document.createElement('input');
        inpMult.type = 'number';
        inpMult.step = '0.1';
        inpMult.value = h.mult;
        inpMult.placeholder = 'Mult';
        inpMult.onchange = (e) => {
            h.mult = parseFloat(e.target.value);
            if (isRunning) audio.setupEngineSound(); // Frequency mapping changes
        };

        const inpGain = document.createElement('input');
        inpGain.type = 'number';
        inpGain.step = '0.1';
        inpGain.value = h.gain;
        inpGain.placeholder = 'Gain';
        inpGain.onchange = (e) => {
            h.gain = parseFloat(e.target.value);
            // Just gain, could be live updated without rebuild, but setup is safer for consistency
            if (audio.oscillators[index]) {
                audio.oscillators[index].baseGain = h.gain;
            }
        };

        const btnDel = document.createElement('button');
        btnDel.innerText = 'X';
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

// Initial Render
refreshUI();
