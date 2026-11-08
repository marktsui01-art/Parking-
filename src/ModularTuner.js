/**
 * ModularTuner.js
 * 
 * Interactive Modular DSP Audio Workbench Controller.
 * Provides real-time parameter tweaking, interactive patch bay wiring,
 * dual FFT spectrum & analytical biquad filter transfer curves,
 * oscilloscope, and full JSON patch import/export.
 */

import { ModularAudioEngine, MODULAR_PATCH_PRESETS, DEFAULT_NODE_PARAMS } from './ModularAudioEngine.js';
import { EngineSim } from './EngineSim.js';

// --- ENGINE & SIMULATION INSTANCES ---
const engine = new ModularAudioEngine('series_peaking_formants');
const sim = new EngineSim();

// Expose engine on window for E2E testing and console inspection
if (typeof window !== 'undefined') {
    window.engine = engine;
    window.sim = sim;
}

// --- DOM ELEMENTS ---
// Header & Global Controls
const presetSelect = document.getElementById('preset-select');
const btnWireSeries = document.getElementById('btn-wire-series');
const btnWireParallel = document.getElementById('btn-wire-parallel');
const btnExport = document.getElementById('btn-export');
const btnImport = document.getElementById('btn-import');

// Quick Add Node Buttons
const btnAddOsc = document.getElementById('btn-add-osc');
const btnAddNoise = document.getElementById('btn-add-noise');
const btnAddFilter = document.getElementById('btn-add-filter');
const btnAddWaveshaper = document.getElementById('btn-add-waveshaper');
const btnAddDelay = document.getElementById('btn-add-delay');
const btnAddGain = document.getElementById('btn-add-gain');

// Exciter & Transport
const btnIgnition = document.getElementById('btn-ignition');
const driveModeSelect = document.getElementById('drive-mode-select');
const physicsScenarios = document.getElementById('physics-scenarios');
const btnScenRev = document.getElementById('btn-scen-rev');
const btnScenBrake = document.getElementById('btn-scen-brake');
const rpmSlider = document.getElementById('rpm-slider');
const rpmDisplay = document.getElementById('rpm-display');
const f0Display = document.getElementById('f0-display');
const throttleSlider = document.getElementById('throttle-slider');
const throttleVal = document.getElementById('throttle-val');
const masterGainSlider = document.getElementById('master-gain-slider');
const masterGainVal = document.getElementById('master-gain-val');

// Patch Bay SVG & Hint
const patchBaySvg = document.getElementById('patch-bay');
const patchCablesLayer = document.getElementById('patch-cables-layer');
const patchNodesLayer = document.getElementById('patch-nodes-layer');
const patchBayHint = document.getElementById('patch-bay-hint');

// Nodes Rack
const nodesRack = document.getElementById('nodes-rack');
const nodesCountDisplay = document.getElementById('nodes-count-display');

// Visualizers
const spectrumCanvas = document.getElementById('spectrum-canvas');
const spectrumCtx = spectrumCanvas.getContext('2d');
const scopeCanvas = document.getElementById('scope-canvas');
const scopeCtx = scopeCanvas.getContext('2d');
const scaleSelect = document.getElementById('scale-select');
const jsonIO = document.getElementById('json-io');

// --- APP STATE ---
let isRunning = false;
let driveMode = 'manual'; // 'manual' | 'physics'
let currentRPM = 900;
let throttleInput = 0;
let scenarioActive = null; // 'rev' | 'rev_down' | 'brake' | 'decelerating' | null
let activeWiringSource = null; // { nodeId, name } when dragging or clicked output port
let freqScaleMode = 'log'; // 'log' | 'linear'

// Store node coordinates in the SVG patch bay: nodeId -> { x, y, width, height, inPort: {x,y}, outPort: {x,y} }
let nodeLayoutMap = new Map();

// Color Palette for Filter Response Curves
const FILTER_COLORS = [
    '#38d39f', // emerald
    '#22d3ee', // cyan
    '#fbbf24', // amber
    '#c084fc', // purple
    '#f472b6', // pink
    '#60a5fa', // blue
    '#a3e635', // lime
    '#fb923c'  // orange
];

// --- INITIALIZATION ---
function init() {
    setupEventListeners();
    refreshAllUI();
    requestAnimationFrame(renderVisualizers);
    setInterval(physicsSimulationStep, 1000 / 60);
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    // Preset Selector
    presetSelect.addEventListener('change', (e) => {
        const key = e.target.value;
        if (MODULAR_PATCH_PRESETS[key]) {
            engine.loadPreset(key);
            activeWiringSource = null;
            refreshAllUI();
        }
    });

    // Quick Add Node Buttons
    btnAddOsc.addEventListener('click', () => { engine.addNode('oscillator'); refreshAllUI(); });
    btnAddNoise.addEventListener('click', () => { engine.addNode('noise'); refreshAllUI(); });
    btnAddFilter.addEventListener('click', () => { engine.addNode('filter'); refreshAllUI(); });
    btnAddWaveshaper.addEventListener('click', () => { engine.addNode('waveshaper'); refreshAllUI(); });
    btnAddDelay.addEventListener('click', () => { engine.addNode('delay'); refreshAllUI(); });
    btnAddGain.addEventListener('click', () => { engine.addNode('gain'); refreshAllUI(); });

    // Quick Topology Rewire
    btnWireSeries.addEventListener('click', () => {
        engine.rewireFiltersTopology('series');
        refreshAllUI();
    });

    btnWireParallel.addEventListener('click', () => {
        engine.rewireFiltersTopology('parallel');
        refreshAllUI();
    });

    // Export / Import
    btnExport.addEventListener('click', () => {
        const patchJson = JSON.stringify(engine.exportPatch(), null, 2);
        jsonIO.value = patchJson;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(patchJson).catch(() => {});
        }
        btnExport.innerText = 'Copied!';
        setTimeout(() => { btnExport.innerText = 'Export Patch'; }, 2000);
    });

    btnImport.addEventListener('click', () => {
        try {
            const data = JSON.parse(jsonIO.value);
            engine.loadPatch(data);
            activeWiringSource = null;
            refreshAllUI();
        } catch (err) {
            alert('Invalid JSON Patch format: ' + err.message);
        }
    });

    // Ignition / Audio Toggle
    btnIgnition.addEventListener('click', () => {
        if (!isRunning) {
            engine.init();
            isRunning = true;
            btnIgnition.innerText = 'STOP AUDIO';
            btnIgnition.classList.add('active');
        } else {
            engine.stop();
            isRunning = false;
            btnIgnition.innerText = 'START AUDIO';
            btnIgnition.classList.remove('active');
        }
    });

    // Drive Mode Selector
    driveModeSelect.addEventListener('change', (e) => {
        driveMode = e.target.value;
        if (driveMode === 'physics') {
            physicsScenarios.classList.remove('hidden');
            rpmSlider.disabled = true;
            rpmSlider.style.opacity = '0.6';
        } else {
            physicsScenarios.classList.add('hidden');
            rpmSlider.disabled = false;
            rpmSlider.style.opacity = '1';
            scenarioActive = null;
        }
    });

    // Scenarios
    btnScenRev.addEventListener('click', () => { scenarioActive = 'rev'; });
    btnScenBrake.addEventListener('click', () => { scenarioActive = 'brake'; });

    // Sliders
    rpmSlider.addEventListener('input', (e) => {
        if (driveMode === 'manual') {
            currentRPM = parseFloat(e.target.value);
            updateExciterReadouts();
        }
    });

    throttleSlider.addEventListener('input', (e) => {
        throttleInput = parseFloat(e.target.value);
        throttleVal.innerText = Math.round(throttleInput * 100) + '%';
        scenarioActive = null;
    });

    masterGainSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        masterGainVal.innerText = val.toFixed(2);
        engine.patch.masterGain = val;
        if (engine.masterGainNode && engine.ctx) {
            engine.masterGainNode.gain.setValueAtTime(val, engine.ctx.currentTime);
        }
        syncJsonTextarea();
    });

    // Frequency Axis Scale
    scaleSelect.addEventListener('change', (e) => {
        freqScaleMode = e.target.value;
    });

    // Reset active wiring on click outside patch ports
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#patch-bay') && activeWiringSource) {
            cancelActiveWiring();
        }
    });
}

function cancelActiveWiring() {
    activeWiringSource = null;
    patchBayHint.innerText = 'Click any output port (●) then an input port (●) to connect, or click a cable to disconnect';
    patchBayHint.style.color = 'var(--accent-amber)';
    renderPatchBay();
}

function updateExciterReadouts() {
    rpmDisplay.innerText = Math.round(currentRPM) + ' RPM';
    const f0 = currentRPM / 60;
    f0Display.innerText = `f0 = ${f0.toFixed(1)} Hz`;
}

// --- PHYSICS SIMULATION LOOP ---
function physicsSimulationStep() {
    if (driveMode === 'physics') {
        const baseRPM = engine.patch.baseRPM || 900;
        const redlineRPM = engine.patch.redlineRPM || 7500;

        if (scenarioActive === 'rev') {
            throttleInput = Math.min(1.0, throttleInput + 0.08);
            if (sim.getRatio() > 0.95) {
                scenarioActive = 'rev_down';
            }
        } else if (scenarioActive === 'rev_down') {
            throttleInput = 0;
            if (sim.velocity < 5) {
                scenarioActive = null;
            }
        } else if (scenarioActive === 'brake') {
            sim.velocity = sim.params.maxSpeed * 0.9;
            throttleInput = 0;
            scenarioActive = 'decelerating';
        } else if (scenarioActive === 'decelerating') {
            throttleInput = 0;
            if (sim.velocity < 5) {
                scenarioActive = null;
            }
        } else {
            throttleInput = parseFloat(throttleSlider.value);
        }

        // Run Sim Kinematics
        sim.update(throttleInput);
        const ratio = sim.getRatio();
        currentRPM = baseRPM + ratio * (redlineRPM - baseRPM);

        // Sync UI
        rpmSlider.value = Math.round(currentRPM);
        updateExciterReadouts();

        if (scenarioActive) {
            throttleSlider.value = throttleInput;
            throttleVal.innerText = Math.round(throttleInput * 100) + '%';
        }
    } else {
        currentRPM = parseFloat(rpmSlider.value);
        throttleInput = parseFloat(throttleSlider.value);
        updateExciterReadouts();
    }

    // Update Modular Engine DSP state
    const state = engine.update(currentRPM, throttleInput);
    updateNodeStateBadges(state);
}

function updateNodeStateBadges(calcState) {
    if (!calcState || !calcState.nodeStates) return;

    for (const [id, st] of Object.entries(calcState.nodeStates)) {
        const badge = document.getElementById(`badge-state-${id}`);
        if (!badge) continue;

        if (!st.enabled) {
            badge.innerText = 'MUTED';
            badge.style.color = 'var(--accent-red)';
            continue;
        }
        if (st.bypass) {
            badge.innerText = 'BYPASS';
            badge.style.color = '#93c5fd';
            continue;
        }

        badge.style.color = 'var(--text-dim)';
        if (st.type === 'oscillator') {
            badge.innerText = `${st.frequency.toFixed(1)} Hz | Gain ${st.gain.toFixed(2)}`;
        } else if (st.type === 'noise') {
            badge.innerText = `${st.noiseType} | Gain ${st.gain.toFixed(2)}`;
        } else if (st.type === 'filter') {
            badge.innerText = `fc: ${Math.round(st.frequency)} Hz | Q: ${st.Q.toFixed(1)}`;
        } else if (st.type === 'waveshaper') {
            badge.innerText = `${st.curveType} | Drv ${st.drive}`;
        } else if (st.type === 'delay') {
            badge.innerText = `${st.delayMs.toFixed(1)}ms | Fb ${st.feedback.toFixed(2)}`;
        } else if (st.type === 'gain') {
            badge.innerText = `Gain ${st.gain.toFixed(2)}`;
        }
    }
}

// --- FULL UI REFRESH ---
function refreshAllUI() {
    renderNodesRack();
    renderPatchBay();
    syncJsonTextarea();
    nodesCountDisplay.innerText = engine.patch.nodes.length;
    masterGainSlider.value = engine.patch.masterGain ?? 0.7;
    masterGainVal.innerText = Number(masterGainSlider.value).toFixed(2);
    presetSelect.value = Object.keys(MODULAR_PATCH_PRESETS).find(k => MODULAR_PATCH_PRESETS[k].name === engine.patch.name) || '';
}

function syncJsonTextarea() {
    jsonIO.value = JSON.stringify(engine.exportPatch(), null, 2);
}

// --- 3. INTERACTIVE SIGNAL ROUTING PATCH BAY ---
function renderPatchBay() {
    patchCablesLayer.innerHTML = '';
    patchNodesLayer.innerHTML = '';
    nodeLayoutMap.clear();

    const svgWidth = 980;
    const svgHeight = 240;
    patchBaySvg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);

    // Partition nodes into 4 standard DSP workflow columns
    const col1 = []; // Sources: oscillator, noise
    const col2 = []; // Shapers & Pre-bus Gain: waveshaper, gain
    const col3 = []; // Filters & Resonators: filter, delay
    const col4 = [{ id: 'master', type: 'master', name: 'Master Output' }];

    for (const n of engine.patch.nodes) {
        if (n.type === 'oscillator' || n.type === 'noise') {
            col1.push(n);
        } else if (n.type === 'waveshaper' || n.type === 'gain') {
            col2.push(n);
        } else if (n.type === 'filter' || n.type === 'delay') {
            col3.push(n);
        } else {
            col2.push(n);
        }
    }

    const columns = [
        { x: 30, width: 180, nodes: col1 },
        { x: 270, width: 180, nodes: col2 },
        { x: 510, width: 180, nodes: col3 },
        { x: 750, width: 180, nodes: col4 }
    ];

    // Compute coordinates for each node
    for (const col of columns) {
        const count = col.nodes.length;
        if (count === 0) continue;

        const maxBoxHeight = 44;
        const availableHeight = svgHeight - 20;
        const boxHeight = Math.min(maxBoxHeight, Math.max(32, (availableHeight - (count - 1) * 8) / count));
        const totalHeight = count * boxHeight + (count - 1) * 8;
        const startY = 10 + (availableHeight - totalHeight) / 2;

        for (let i = 0; i < count; i++) {
            const node = col.nodes[i];
            const y = startY + i * (boxHeight + 8);
            const box = {
                id: node.id,
                name: node.name,
                type: node.type,
                x: col.x,
                y,
                width: col.width,
                height: boxHeight,
                inPort: (node.type === 'oscillator' || node.type === 'noise') ? null : { x: col.x, y: y + boxHeight / 2 },
                outPort: (node.type === 'master') ? null : { x: col.x + col.width, y: y + boxHeight / 2 }
            };
            nodeLayoutMap.set(node.id, box);
        }
    }

    // Render Cables
    for (const conn of engine.patch.connections) {
        const fromBox = nodeLayoutMap.get(conn.from);
        const toBox = nodeLayoutMap.get(conn.to);
        if (!fromBox || !toBox || !fromBox.outPort || !toBox.inPort) continue;

        const x1 = fromBox.outPort.x;
        const y1 = fromBox.outPort.y;
        const x2 = toBox.inPort.x;
        const y2 = toBox.inPort.y;

        const dx = Math.max(40, (x2 - x1) * 0.5);
        const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

        // Determine cable color gradient
        let strokeGrad = 'url(#cableGradGeneric)';
        if (fromBox.type === 'oscillator' || fromBox.type === 'noise') strokeGrad = 'url(#cableGradOsc)';
        else if (fromBox.type === 'filter') strokeGrad = 'url(#cableGradFlt)';

        // Cable Path
        const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathEl.setAttribute('d', d);
        pathEl.setAttribute('class', 'cable-path');
        pathEl.setAttribute('stroke', strokeGrad);
        pathEl.setAttribute('data-from', conn.from);
        pathEl.setAttribute('data-to', conn.to);
        pathEl.addEventListener('click', (e) => {
            e.stopPropagation();
            engine.disconnect(conn.from, conn.to);
            refreshAllUI();
        });
        patchCablesLayer.appendChild(pathEl);

        // Disconnect Badge (×) at Midpoint
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        const tagG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        tagG.setAttribute('class', 'cable-del-tag');
        tagG.setAttribute('transform', `translate(${mx}, ${my})`);
        tagG.addEventListener('click', (e) => {
            e.stopPropagation();
            engine.disconnect(conn.from, conn.to);
            refreshAllUI();
        });

        const tagCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        tagCircle.setAttribute('r', '8');
        tagCircle.setAttribute('fill', '#1e293b');
        tagCircle.setAttribute('stroke', '#f87171');
        tagCircle.setAttribute('stroke-width', '1.5');

        const tagText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tagText.setAttribute('y', '3');
        tagText.setAttribute('text-anchor', 'middle');
        tagText.setAttribute('fill', '#f87171');
        tagText.setAttribute('font-size', '10');
        tagText.setAttribute('font-weight', 'bold');
        tagText.textContent = '×';

        tagG.appendChild(tagCircle);
        tagG.appendChild(tagText);
        patchCablesLayer.appendChild(tagG);
    }

    // Render Node Boxes and Ports
    for (const [id, box] of nodeLayoutMap) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('transform', `translate(${box.x}, ${box.y})`);

        // Node Box Background
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('width', box.width);
        rect.setAttribute('height', box.height);
        rect.setAttribute('class', 'patch-node-box');

        // Style node box based on role
        if (box.type === 'master') {
            rect.setAttribute('fill', '#1c1917');
            rect.setAttribute('stroke', '#f59e0b');
        } else {
            rect.setAttribute('fill', '#181a1f');
            rect.setAttribute('stroke', '#353b45');
        }
        g.appendChild(rect);

        // Node Name
        const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        nameText.setAttribute('x', '10');
        nameText.setAttribute('y', box.height / 2 + 4);
        nameText.setAttribute('fill', box.type === 'master' ? '#fbbf24' : '#e5e7eb');
        nameText.setAttribute('font-size', '11');
        nameText.setAttribute('font-weight', '600');
        const truncatedName = box.name.length > 20 ? box.name.substring(0, 18) + '...' : box.name;
        nameText.textContent = truncatedName;
        g.appendChild(nameText);

        patchNodesLayer.appendChild(g);

        // Input Port (Left Circle)
        if (box.inPort) {
            const inCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            inCircle.setAttribute('cx', box.inPort.x);
            inCircle.setAttribute('cy', box.inPort.y);
            inCircle.setAttribute('r', '5.5');
            inCircle.setAttribute('fill', '#090a0d');
            inCircle.setAttribute('stroke', '#38bdf8');
            inCircle.setAttribute('class', 'patch-port patch-port-in');
            inCircle.setAttribute('data-node-id', box.id);
            inCircle.setAttribute('title', `Input Port: ${box.name}`);

            inCircle.addEventListener('click', (e) => {
                e.stopPropagation();
                if (activeWiringSource) {
                    if (activeWiringSource.nodeId !== box.id) {
                        const success = engine.connect(activeWiringSource.nodeId, box.id);
                        if (!success) {
                            patchBayHint.innerText = `Cannot connect ${activeWiringSource.name} to ${box.name} (would create loop or duplicate)`;
                            patchBayHint.style.color = 'var(--accent-red)';
                        }
                    }
                    cancelActiveWiring();
                    refreshAllUI();
                }
            });
            patchNodesLayer.appendChild(inCircle);
        }

        // Output Port (Right Circle)
        if (box.outPort) {
            const outCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            outCircle.setAttribute('cx', box.outPort.x);
            outCircle.setAttribute('cy', box.outPort.y);
            outCircle.setAttribute('r', '5.5');
            outCircle.setAttribute('fill', '#090a0d');
            outCircle.setAttribute('stroke', '#34d399');

            const isCurrentSource = activeWiringSource && activeWiringSource.nodeId === box.id;
            outCircle.setAttribute('class', `patch-port patch-port-out ${isCurrentSource ? 'active-source' : ''}`);
            outCircle.setAttribute('data-node-id', box.id);
            outCircle.setAttribute('title', `Output Port: ${box.name}`);

            outCircle.addEventListener('click', (e) => {
                e.stopPropagation();
                if (activeWiringSource && activeWiringSource.nodeId === box.id) {
                    cancelActiveWiring();
                } else {
                    activeWiringSource = { nodeId: box.id, name: box.name };
                    patchBayHint.innerText = `Wiring from [${box.name}]: click any target input port (●) or 'master' to connect`;
                    patchBayHint.style.color = 'var(--accent-green)';
                    renderPatchBay();
                }
            });
            patchNodesLayer.appendChild(outCircle);
        }
    }
}

// --- 4. DIRECT PER-NODE PARAMETER RACK ---
function renderNodesRack() {
    nodesRack.innerHTML = '';

    for (const node of engine.patch.nodes) {
        const card = document.createElement('div');
        card.className = `node-card ${!node.enabled ? 'muted' : ''} ${node.solo ? 'soloed' : ''} ${node.bypass ? 'bypassed' : ''}`;
        card.setAttribute('data-node-id', node.id);

        // Header
        const header = document.createElement('div');
        header.className = 'node-card-header';

        const headerLeft = document.createElement('div');
        headerLeft.className = 'node-header-left';

        const typeBadge = document.createElement('span');
        typeBadge.className = `node-type-badge badge-${node.type}`;
        typeBadge.innerText = node.type;

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'node-name-input';
        nameInput.value = node.name;
        nameInput.addEventListener('change', (e) => {
            engine.updateNode(node.id, { name: e.target.value });
            renderPatchBay();
            syncJsonTextarea();
        });

        const stateBadge = document.createElement('span');
        stateBadge.id = `badge-state-${node.id}`;
        stateBadge.className = 'node-state-badge';
        stateBadge.innerText = 'READY';

        headerLeft.appendChild(typeBadge);
        headerLeft.appendChild(nameInput);
        headerLeft.appendChild(stateBadge);

        // Actions
        const actions = document.createElement('div');
        actions.className = 'node-actions';

        // Mute Toggle Button
        const btnMute = document.createElement('button');
        btnMute.className = `btn-card-action btn-node-enable ${!node.enabled ? 'active-mute' : ''}`;
        btnMute.innerText = node.enabled ? 'Mute' : 'Unmute';
        btnMute.addEventListener('click', () => {
            engine.updateNode(node.id, { enabled: !node.enabled });
            renderNodesRack();
            syncJsonTextarea();
        });
        actions.appendChild(btnMute);

        // Solo Toggle Button
        const btnSolo = document.createElement('button');
        btnSolo.className = `btn-card-action btn-node-solo ${node.solo ? 'active-solo' : ''}`;
        btnSolo.innerText = node.solo ? 'Solo ON' : 'Solo';
        btnSolo.addEventListener('click', () => {
            engine.updateNode(node.id, { solo: !node.solo });
            renderNodesRack();
            syncJsonTextarea();
        });
        actions.appendChild(btnSolo);

        // Bypass Toggle Button (Filter, Waveshaper, Delay, Gain)
        if (node.type !== 'oscillator' && node.type !== 'noise') {
            const btnBypass = document.createElement('button');
            btnBypass.className = `btn-card-action btn-node-bypass ${node.bypass ? 'active-bypass' : ''}`;
            btnBypass.innerText = node.bypass ? 'Bypassed' : 'Bypass';
            btnBypass.addEventListener('click', () => {
                engine.updateNode(node.id, { bypass: !node.bypass });
                renderNodesRack();
                syncJsonTextarea();
            });
            actions.appendChild(btnBypass);
        }

        // Duplicate Button
        const btnDup = document.createElement('button');
        btnDup.className = 'btn-card-action btn-node-dup';
        btnDup.innerText = 'Dup';
        btnDup.title = 'Duplicate this node';
        btnDup.addEventListener('click', () => {
            engine.duplicateNode(node.id);
            refreshAllUI();
        });
        actions.appendChild(btnDup);

        // Delete Button
        const btnDel = document.createElement('button');
        btnDel.className = 'btn-card-action btn-node-del';
        btnDel.innerText = '×';
        btnDel.title = 'Delete node';
        btnDel.addEventListener('click', () => {
            engine.removeNode(node.id);
            refreshAllUI();
        });
        actions.appendChild(btnDel);

        header.appendChild(headerLeft);
        header.appendChild(actions);
        card.appendChild(header);

        // Direct Connectivity Bar
        const routingBar = document.createElement('div');
        routingBar.className = 'node-routing-bar';

        const routingLabel = document.createElement('span');
        routingLabel.className = 'routing-label';
        routingLabel.innerText = 'Outputs To:';
        routingBar.appendChild(routingLabel);

        // Active output connection tags
        const outConnections = engine.patch.connections.filter(c => c.from === node.id);
        for (const c of outConnections) {
            const pill = document.createElement('span');
            pill.className = 'routing-pill';

            const targetName = c.to === 'master' ? 'Master Out' : (engine.patch.nodes.find(n => n.id === c.to)?.name || c.to);
            pill.innerHTML = `${targetName} <span class="pill-del" title="Disconnect">×</span>`;

            pill.querySelector('.pill-del').addEventListener('click', () => {
                engine.disconnect(node.id, c.to);
                refreshAllUI();
            });
            routingBar.appendChild(pill);
        }

        // Dropdown to connect to other nodes or master
        const connectSelect = document.createElement('select');
        connectSelect.className = 'connect-target-select';

        const defOption = document.createElement('option');
        defOption.value = '';
        defOption.innerText = '+ Connect to...';
        connectSelect.appendChild(defOption);

        // Eligible targets: all nodes (except self and pure sources) + master not already connected
        const connectedSet = new Set(outConnections.map(c => c.to));
        const eligibleTargets = [];

        for (const other of engine.patch.nodes) {
            if (other.id !== node.id && !connectedSet.has(other.id) && other.type !== 'oscillator' && other.type !== 'noise') {
                eligibleTargets.push({ id: other.id, label: other.name });
            }
        }
        if (!connectedSet.has('master')) {
            eligibleTargets.push({ id: 'master', label: 'Master Output' });
        }

        for (const target of eligibleTargets) {
            const opt = document.createElement('option');
            opt.value = target.id;
            opt.innerText = target.label;
            connectSelect.appendChild(opt);
        }

        connectSelect.addEventListener('change', (e) => {
            const targetId = e.target.value;
            if (targetId) {
                const connected = engine.connect(node.id, targetId);
                if (!connected) {
                    alert('Cannot connect: would create circular feedback loop or invalid route.');
                }
                refreshAllUI();
            }
        });
        routingBar.appendChild(connectSelect);

        card.appendChild(routingBar);

        // Type-Specific Parameters Grid
        const paramsGrid = document.createElement('div');
        paramsGrid.className = 'node-params-grid';
        buildNodeParameterControls(node, paramsGrid);
        card.appendChild(paramsGrid);

        nodesRack.appendChild(card);
    }
}

function buildNodeParameterControls(node, container) {
    const p = node.params || {};

    if (node.type === 'oscillator') {
        createSelectControl(container, node.id, 'waveform', 'Waveform', p.waveform || 'sawtooth', [
            'sawtooth', 'sine', 'triangle', 'square'
        ], true);

        createSelectControl(container, node.id, 'freqMode', 'Frequency Mode', p.freqMode || 'harmonic', [
            'harmonic', 'fixed'
        ], false);

        createSliderControl(container, node.id, 'mult', 'Harmonic Mult', p.mult ?? 1.0, 0.25, 16.0, 0.05, (v) => `${v.toFixed(2)}x`);
        createSliderControl(container, node.id, 'freqHz', 'Fixed Frequency', p.freqHz ?? 100, 20, 4000, 1, (v) => `${Math.round(v)} Hz`);
        createSliderControl(container, node.id, 'detune', 'Detune (cts)', p.detune ?? 0, -1200, 1200, 1, (v) => `${Math.round(v)} cts`);
        createSliderControl(container, node.id, 'gain', 'Base Gain', p.gain ?? 0.5, 0, 2.0, 0.01, (v) => v.toFixed(2));
        createSliderControl(container, node.id, 'throttleModGain', 'Throttle -> Gain', p.throttleModGain ?? 0.0, -1.0, 2.0, 0.05, (v) => (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2)));
        createSliderControl(container, node.id, 'rpmModGain', 'RPM -> Gain', p.rpmModGain ?? 0.0, -1.0, 2.0, 0.05, (v) => (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2)));
    } else if (node.type === 'noise') {
        createSelectControl(container, node.id, 'noiseType', 'Noise Color', p.noiseType || 'pink', [
            'pink', 'white', 'brown'
        ], true);

        createSliderControl(container, node.id, 'gain', 'Base Gain', p.gain ?? 0.3, 0, 2.0, 0.01, (v) => v.toFixed(2));
        createSliderControl(container, node.id, 'throttleModGain', 'Throttle -> Gain', p.throttleModGain ?? 0.2, -1.0, 2.0, 0.05, (v) => (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2)));
        createSliderControl(container, node.id, 'rpmModGain', 'RPM -> Gain', p.rpmModGain ?? 0.1, -1.0, 2.0, 0.05, (v) => (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2)));
    } else if (node.type === 'filter') {
        createSelectControl(container, node.id, 'filterType', 'Filter Type', p.filterType || 'peaking', [
            'peaking', 'lowpass', 'highpass', 'bandpass', 'notch', 'lowshelf', 'highshelf', 'allpass'
        ], true);

        createSliderControl(container, node.id, 'frequency', 'Cutoff / Center Freq', p.frequency ?? 500, 20, 10000, 5, (v) => `${Math.round(v)} Hz`);
        createSliderControl(container, node.id, 'Q', 'Resonance (Q)', p.Q ?? 2.0, 0.1, 25.0, 0.1, (v) => v.toFixed(1));
        createSliderControl(container, node.id, 'filterGain', 'Filter Gain / Boost', p.filterGain ?? 6.0, -24.0, 24.0, 0.5, (v) => `${v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1)} dB`);
        createSliderControl(container, node.id, 'rpmModFreq', 'RPM -> Freq Shift', p.rpmModFreq ?? 0, -2000, 4000, 20, (v) => (v > 0 ? `+${Math.round(v)} Hz` : `${Math.round(v)} Hz`));
        createSliderControl(container, node.id, 'throttleModFreq', 'Throttle -> Freq Shift', p.throttleModFreq ?? 0, -2000, 4000, 20, (v) => (v > 0 ? `+${Math.round(v)} Hz` : `${Math.round(v)} Hz`));
        createSliderControl(container, node.id, 'outGain', 'Output Level', p.outGain ?? 1.0, 0, 2.0, 0.01, (v) => v.toFixed(2));
    } else if (node.type === 'waveshaper') {
        createSelectControl(container, node.id, 'curveType', 'Saturation Curve', p.curveType || 'soft_tanh', [
            'soft_tanh', 'hard_clip', 'asymmetric', 'foldback'
        ], true);

        createSliderControl(container, node.id, 'drive', 'Drive / Saturation', p.drive ?? 20, 0, 100, 1, (v) => `${Math.round(v)}%`);
        createSliderControl(container, node.id, 'mix', 'Dry / Wet Mix', p.mix ?? 1.0, 0, 1.0, 0.01, (v) => `${Math.round(v * 100)}%`);
        createSliderControl(container, node.id, 'outputGain', 'Output Gain', p.outputGain ?? 1.0, 0, 2.0, 0.01, (v) => v.toFixed(2));
    } else if (node.type === 'delay') {
        createSliderControl(container, node.id, 'delayMs', 'Delay Time', p.delayMs ?? 4.0, 0.1, 50.0, 0.1, (v) => `${v.toFixed(1)} ms`);
        createSliderControl(container, node.id, 'feedback', 'Feedback Gain', p.feedback ?? -0.5, -0.95, 0.95, 0.01, (v) => v.toFixed(2));
        createSliderControl(container, node.id, 'mix', 'Dry / Wet Mix', p.mix ?? 0.5, 0, 1.0, 0.01, (v) => `${Math.round(v * 100)}%`);
    } else if (node.type === 'gain') {
        createSliderControl(container, node.id, 'gain', 'Gain Level', p.gain ?? 1.0, 0, 3.0, 0.01, (v) => v.toFixed(2));
        createSliderControl(container, node.id, 'throttleModGain', 'Throttle -> Gain', p.throttleModGain ?? 0.0, -2.0, 2.0, 0.05, (v) => (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2)));
        createSliderControl(container, node.id, 'rpmModGain', 'RPM -> Gain', p.rpmModGain ?? 0.0, -2.0, 2.0, 0.05, (v) => (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2)));
    }
}

function createSelectControl(container, nodeId, paramKey, label, currentVal, options, requiresRebuild = false) {
    const wrap = document.createElement('div');
    wrap.className = 'param-control';

    const meta = document.createElement('div');
    meta.className = 'param-meta';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'param-name';
    nameSpan.innerText = label;
    meta.appendChild(nameSpan);
    wrap.appendChild(meta);

    const sel = document.createElement('select');
    for (const optVal of options) {
        const opt = document.createElement('option');
        opt.value = optVal;
        opt.innerText = optVal;
        if (optVal === currentVal) opt.selected = true;
        sel.appendChild(opt);
    }

    sel.addEventListener('change', (e) => {
        engine.updateNode(nodeId, { params: { [paramKey]: e.target.value } });
        syncJsonTextarea();
        if (requiresRebuild) {
            renderPatchBay();
        }
    });

    wrap.appendChild(sel);
    container.appendChild(wrap);
}

function createSliderControl(container, nodeId, paramKey, label, currentVal, min, max, step, formatFn) {
    const wrap = document.createElement('div');
    wrap.className = 'param-control';

    const meta = document.createElement('div');
    meta.className = 'param-meta';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'param-name';
    nameSpan.innerText = label;

    const valSpan = document.createElement('span');
    valSpan.id = `param-val-${nodeId}-${paramKey}`;
    valSpan.className = 'param-val-readout';
    valSpan.innerText = formatFn ? formatFn(currentVal) : currentVal;

    meta.appendChild(nameSpan);
    meta.appendChild(valSpan);
    wrap.appendChild(meta);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = min;
    slider.max = max;
    slider.step = step;
    slider.value = currentVal;
    slider.setAttribute('data-node-id', nodeId);
    slider.setAttribute('data-param', paramKey);

    // Silky smooth live update on drag without re-rendering DOM
    slider.addEventListener('input', (e) => {
        const numVal = parseFloat(e.target.value);
        valSpan.innerText = formatFn ? formatFn(numVal) : numVal;
        engine.updateNode(nodeId, { params: { [paramKey]: numVal } });
    });

    slider.addEventListener('change', () => {
        syncJsonTextarea();
    });

    wrap.appendChild(slider);
    container.appendChild(wrap);
}

// --- 5. DUAL VISUALIZERS: SPECTRUM + FILTER TRANSFER CURVES & OSCILLOSCOPE ---
function renderVisualizers() {
    requestAnimationFrame(renderVisualizers);

    renderSpectrumAndFilterResponse();
    renderOscilloscope();
}

function renderSpectrumAndFilterResponse() {
    const w = spectrumCanvas.width;
    const h = spectrumCanvas.height;

    spectrumCtx.fillStyle = '#060709';
    spectrumCtx.fillRect(0, 0, w, h);

    const padLeft = 40;
    const padRight = 15;
    const padTop = 15;
    const padBottom = 22;
    const plotW = w - padLeft - padRight;
    const plotH = h - padTop - padBottom;

    const minFreq = (freqScaleMode === 'linear') ? 0 : 20;
    const maxFreq = 12000;
    const minDb = -24;
    const maxDb = 24;

    function freqToX(f) {
        if (freqScaleMode === 'linear') {
            return padLeft + (Math.max(0, f) / maxFreq) * plotW;
        } else {
            const clamped = Math.max(20, Math.min(maxFreq, f));
            const norm = Math.log10(clamped / 20) / Math.log10(maxFreq / 20);
            return padLeft + norm * plotW;
        }
    }

    function dbToY(db) {
        const clamped = Math.max(minDb, Math.min(maxDb, db));
        return padTop + plotH * (1 - (clamped - minDb) / (maxDb - minDb));
    }

    // Grid: dB Horizontal Lines
    spectrumCtx.lineWidth = 1;
    const dbLines = [24, 12, 0, -12, -24];
    for (const db of dbLines) {
        const y = dbToY(db);
        spectrumCtx.strokeStyle = (db === 0) ? '#4b5563' : '#1f242d';
        spectrumCtx.beginPath();
        spectrumCtx.moveTo(padLeft, y);
        spectrumCtx.lineTo(padLeft + plotW, y);
        spectrumCtx.stroke();

        spectrumCtx.fillStyle = '#6b7280';
        spectrumCtx.font = '9px Consolas, monospace';
        spectrumCtx.textAlign = 'right';
        spectrumCtx.fillText(`${db > 0 ? `+${db}` : db}dB`, padLeft - 4, y + 3);
    }

    // Grid: Frequency Vertical Lines
    const freqMarkers = (freqScaleMode === 'linear')
        ? [2000, 4000, 6000, 8000, 10000]
        : [50, 100, 200, 500, 1000, 2000, 5000, 10000];

    for (const f of freqMarkers) {
        const x = freqToX(f);
        spectrumCtx.strokeStyle = '#1a1e26';
        spectrumCtx.beginPath();
        spectrumCtx.moveTo(x, padTop);
        spectrumCtx.lineTo(x, padTop + plotH);
        spectrumCtx.stroke();

        spectrumCtx.fillStyle = '#6b7280';
        spectrumCtx.font = '9px Consolas, monospace';
        spectrumCtx.textAlign = 'center';
        const label = f >= 1000 ? `${f / 1000}k` : `${f}`;
        spectrumCtx.fillText(label, x, h - 6);
    }

    // Live FFT Spectrum Bars (when audio is active)
    if (isRunning && engine.analyser) {
        const bufferLength = engine.analyser.frequencyBinCount;
        const freqData = new Uint8Array(bufferLength);
        engine.analyser.getByteFrequencyData(freqData);

        const sampleRate = (engine.ctx && engine.ctx.sampleRate) ? engine.ctx.sampleRate : 48000;
        const binHz = (sampleRate / 2) / bufferLength;

        spectrumCtx.fillStyle = 'rgba(56, 211, 159, 0.25)';
        for (let i = 0; i < bufferLength; i++) {
            const freq = i * binHz;
            if (freq > maxFreq) break;
            const x = freqToX(freq);
            const valNorm = freqData[i] / 255;
            const barH = valNorm * plotH;
            const barW = Math.max(1, (plotW / bufferLength) * 3);
            spectrumCtx.fillRect(x, padTop + plotH - barH, barW, barH);
        }
    }

    // Harmonic / Fundamental Alignment Markers (cyan guide ticks)
    const calcState = engine.calculateState(currentRPM, throttleInput);
    const f0 = calcState.f0;

    // Draw Fundamental f0
    if (f0 >= minFreq && f0 <= maxFreq) {
        const f0X = freqToX(f0);
        spectrumCtx.strokeStyle = 'rgba(34, 211, 238, 0.8)';
        spectrumCtx.setLineDash([4, 3]);
        spectrumCtx.lineWidth = 1.5;
        spectrumCtx.beginPath();
        spectrumCtx.moveTo(f0X, padTop);
        spectrumCtx.lineTo(f0X, padTop + plotH);
        spectrumCtx.stroke();
        spectrumCtx.setLineDash([]);

        spectrumCtx.fillStyle = '#22d3ee';
        spectrumCtx.font = '10px Consolas, monospace';
        spectrumCtx.textAlign = 'center';
        spectrumCtx.fillText(`f0: ${Math.round(f0)}Hz`, f0X, padTop + 10);
    }

    // Active Harmonic Ticks from Oscillators
    const oscNodes = engine.patch.nodes.filter(n => n.type === 'oscillator' && n.enabled);
    for (const osc of oscNodes) {
        const p = osc.params || {};
        const mult = p.mult ?? 1.0;
        const harmFreq = (p.freqMode === 'fixed') ? (p.freqHz ?? 100) : (f0 * mult);
        if (harmFreq >= minFreq && harmFreq <= maxFreq) {
            const hx = freqToX(harmFreq);
            spectrumCtx.fillStyle = 'rgba(34, 211, 238, 0.5)';
            spectrumCtx.fillRect(hx - 1, padTop + plotH - 12, 2, 12);
        }
    }

    // Analytical Biquad Filter Frequency Response Curves
    const numPoints = 160;
    const testFreqs = new Float32Array(numPoints);
    for (let i = 0; i < numPoints; i++) {
        if (freqScaleMode === 'linear') {
            testFreqs[i] = (i / (numPoints - 1)) * maxFreq;
        } else {
            const ratio = i / (numPoints - 1);
            testFreqs[i] = 20 * Math.pow(maxFreq / 20, ratio);
        }
    }

    const filterNodes = engine.patch.nodes.filter(n => n.type === 'filter' && n.enabled);
    const compositeDb = new Float32Array(numPoints).fill(0);

    // Draw each active filter curve
    let filterColorIndex = 0;
    for (const flt of filterNodes) {
        const color = FILTER_COLORS[filterColorIndex % FILTER_COLORS.length];
        filterColorIndex++;

        const responseDb = engine.getFilterFrequencyResponse(flt.id, testFreqs);

        spectrumCtx.strokeStyle = color;
        spectrumCtx.lineWidth = 2.0;
        spectrumCtx.beginPath();

        for (let i = 0; i < numPoints; i++) {
            const x = freqToX(testFreqs[i]);
            const y = dbToY(responseDb[i]);
            compositeDb[i] += responseDb[i];

            if (i === 0) spectrumCtx.moveTo(x, y);
            else spectrumCtx.lineTo(x, y);
        }
        spectrumCtx.stroke();
    }

    // Composite Series Response Curve (yellow/amber curve) if multiple filters
    if (filterNodes.length > 1) {
        spectrumCtx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
        spectrumCtx.lineWidth = 1.5;
        spectrumCtx.setLineDash([2, 2]);
        spectrumCtx.beginPath();
        for (let i = 0; i < numPoints; i++) {
            const x = freqToX(testFreqs[i]);
            const y = dbToY(compositeDb[i]);
            if (i === 0) spectrumCtx.moveTo(x, y);
            else spectrumCtx.lineTo(x, y);
        }
        spectrumCtx.stroke();
        spectrumCtx.setLineDash([]);
    }

    // Filter Response Legend
    let legendX = padLeft + 8;
    const legendY = padTop + 24;
    spectrumCtx.font = '9px Consolas, monospace';
    spectrumCtx.textAlign = 'left';

    filterColorIndex = 0;
    for (const flt of filterNodes) {
        const color = FILTER_COLORS[filterColorIndex % FILTER_COLORS.length];
        filterColorIndex++;

        const st = calcState.nodeStates[flt.id] || {};
        const fc = Math.round(st.frequency || flt.params.frequency || 500);

        spectrumCtx.fillStyle = color;
        spectrumCtx.fillRect(legendX, legendY + (filterColorIndex - 1) * 12 - 7, 8, 8);
        spectrumCtx.fillText(`${flt.name} (${fc}Hz)`, legendX + 12, legendY + (filterColorIndex - 1) * 12);
    }
}

function renderOscilloscope() {
    const w = scopeCanvas.width;
    const h = scopeCanvas.height;

    scopeCtx.fillStyle = '#060709';
    scopeCtx.fillRect(0, 0, w, h);

    // Center Zero Line
    scopeCtx.strokeStyle = '#1e242d';
    scopeCtx.lineWidth = 1;
    scopeCtx.beginPath();
    scopeCtx.moveTo(0, h / 2);
    scopeCtx.lineTo(w, h / 2);
    scopeCtx.stroke();

    if (!isRunning || !engine.analyser) {
        // Idle line with gentle glow
        scopeCtx.strokeStyle = 'rgba(56, 211, 159, 0.3)';
        scopeCtx.lineWidth = 1.5;
        scopeCtx.beginPath();
        scopeCtx.moveTo(0, h / 2);
        scopeCtx.lineTo(w, h / 2);
        scopeCtx.stroke();
        return;
    }

    const timeBuffer = new Uint8Array(engine.analyser.fftSize);
    engine.analyser.getByteTimeDomainData(timeBuffer);

    scopeCtx.strokeStyle = '#38d39f';
    scopeCtx.lineWidth = 2.0;
    scopeCtx.shadowColor = 'rgba(56, 211, 159, 0.5)';
    scopeCtx.shadowBlur = 4;
    scopeCtx.beginPath();

    const sliceW = w / timeBuffer.length;
    let x = 0;
    for (let i = 0; i < timeBuffer.length; i++) {
        const v = timeBuffer[i] / 128.0; // [0..2], 1.0 is center
        const y = (v * h) / 2;

        if (i === 0) scopeCtx.moveTo(x, y);
        else scopeCtx.lineTo(x, y);

        x += sliceW;
    }

    scopeCtx.stroke();
    scopeCtx.shadowBlur = 0;
}

// Kick off initialization on DOM ready
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}

export { engine, sim, init };
