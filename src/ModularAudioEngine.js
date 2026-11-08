/**
 * ModularAudioEngine.js
 * 
 * Modular DSP Audio Engine for the Parking Simulator Audio Workbench.
 * Supports configurable node graphs (oscillators, noise generators, biquad filters,
 * waveshapers, gain stages, delay/comb resonators) with real-time modulation from
 * engine RPM and throttle.
 */

export const DEFAULT_NODE_PARAMS = {
    oscillator: {
        waveform: 'sawtooth',
        freqMode: 'harmonic',
        mult: 1.0,
        freqHz: 100,
        detune: 0,
        gain: 0.5,
        throttleModGain: 0.0,
        rpmModGain: 0.0
    },
    noise: {
        noiseType: 'pink',
        gain: 0.3,
        throttleModGain: 0.2,
        rpmModGain: 0.1
    },
    filter: {
        filterType: 'peaking',
        frequency: 500,
        Q: 2.0,
        filterGain: 6.0,
        rpmModFreq: 0,
        throttleModFreq: 0,
        outGain: 1.0
    },
    waveshaper: {
        curveType: 'soft_tanh',
        drive: 20,
        mix: 1.0,
        outputGain: 1.0
    },
    gain: {
        gain: 1.0,
        throttleModGain: 0.0,
        rpmModGain: 0.0
    },
    delay: {
        delayMs: 4.0,
        feedback: -0.5,
        mix: 0.5
    }
};

export const MODULAR_PATCH_PRESETS = {
    series_peaking_formants: {
        name: 'Series Formant Chain + Load Lowpass',
        baseRPM: 900,
        redlineRPM: 7500,
        cylinders: 4,
        masterGain: 0.7,
        nodes: [
            { id: 'osc_1', type: 'oscillator', name: 'Harmonic 1x (Fundamental)', enabled: true, bypass: false, solo: false, params: { waveform: 'sawtooth', freqMode: 'harmonic', mult: 1.0, gain: 0.6 } },
            { id: 'osc_2', type: 'oscillator', name: 'Harmonic 2x', enabled: true, bypass: false, solo: false, params: { waveform: 'sawtooth', freqMode: 'harmonic', mult: 2.0, gain: 0.45 } },
            { id: 'osc_3', type: 'oscillator', name: 'Harmonic 3x', enabled: true, bypass: false, solo: false, params: { waveform: 'triangle', freqMode: 'harmonic', mult: 3.0, gain: 0.3 } },
            { id: 'shaper_1', type: 'waveshaper', name: 'Saturation Stage', enabled: true, bypass: false, solo: false, params: { curveType: 'soft_tanh', drive: 25, mix: 1.0, outputGain: 0.85 } },
            { id: 'flt_f1', type: 'filter', name: 'Formant F1 (160Hz)', enabled: true, bypass: false, solo: false, params: { filterType: 'peaking', frequency: 160, Q: 3.0, filterGain: 8.0, rpmModFreq: 0, throttleModFreq: 0, outGain: 1.0 } },
            { id: 'flt_f2', type: 'filter', name: 'Formant F2 (520Hz)', enabled: true, bypass: false, solo: false, params: { filterType: 'peaking', frequency: 520, Q: 3.5, filterGain: 7.0, rpmModFreq: 0, throttleModFreq: 0, outGain: 1.0 } },
            { id: 'flt_f3', type: 'filter', name: 'Formant F3 (1250Hz)', enabled: true, bypass: false, solo: false, params: { filterType: 'peaking', frequency: 1250, Q: 4.0, filterGain: 6.0, rpmModFreq: 0, throttleModFreq: 0, outGain: 1.0 } },
            { id: 'flt_load', type: 'filter', name: 'Load Lowpass', enabled: true, bypass: false, solo: false, params: { filterType: 'lowpass', frequency: 800, Q: 1.0, rpmModFreq: 1200, throttleModFreq: 2400, outGain: 1.0 } }
        ],
        connections: [
            { from: 'osc_1', to: 'shaper_1' },
            { from: 'osc_2', to: 'shaper_1' },
            { from: 'osc_3', to: 'shaper_1' },
            { from: 'shaper_1', to: 'flt_f1' },
            { from: 'flt_f1', to: 'flt_f2' },
            { from: 'flt_f2', to: 'flt_f3' },
            { from: 'flt_f3', to: 'flt_load' },
            { from: 'flt_load', to: 'master' }
        ]
    },

    parallel_bandpass_bank: {
        name: 'Parallel Bandpass Formant Bank',
        baseRPM: 900,
        redlineRPM: 7500,
        cylinders: 4,
        masterGain: 0.7,
        nodes: [
            { id: 'osc_1', type: 'oscillator', name: 'Oscillator 1x', enabled: true, bypass: false, solo: false, params: { waveform: 'sawtooth', freqMode: 'harmonic', mult: 1.0, gain: 0.5 } },
            { id: 'osc_2', type: 'oscillator', name: 'Oscillator 2x', enabled: true, bypass: false, solo: false, params: { waveform: 'sawtooth', freqMode: 'harmonic', mult: 2.0, gain: 0.35 } },
            { id: 'noise_1', type: 'noise', name: 'Pink Noise Exciter', enabled: true, bypass: false, solo: false, params: { noiseType: 'pink', gain: 0.25, throttleModGain: 0.2, rpmModGain: 0.1 } },
            { id: 'flt_bp1', type: 'filter', name: 'Bandpass 220Hz', enabled: true, bypass: false, solo: false, params: { filterType: 'bandpass', frequency: 220, Q: 4.0, outGain: 0.8 } },
            { id: 'flt_bp2', type: 'filter', name: 'Bandpass 780Hz', enabled: true, bypass: false, solo: false, params: { filterType: 'bandpass', frequency: 780, Q: 5.0, outGain: 0.7 } },
            { id: 'flt_bp3', type: 'filter', name: 'Bandpass 1650Hz', enabled: true, bypass: false, solo: false, params: { filterType: 'bandpass', frequency: 1650, Q: 5.0, outGain: 0.6 } }
        ],
        connections: [
            { from: 'osc_1', to: 'flt_bp1' },
            { from: 'osc_1', to: 'flt_bp2' },
            { from: 'osc_1', to: 'flt_bp3' },
            { from: 'osc_2', to: 'flt_bp1' },
            { from: 'osc_2', to: 'flt_bp2' },
            { from: 'osc_2', to: 'flt_bp3' },
            { from: 'noise_1', to: 'flt_bp1' },
            { from: 'noise_1', to: 'flt_bp2' },
            { from: 'noise_1', to: 'flt_bp3' },
            { from: 'flt_bp1', to: 'master' },
            { from: 'flt_bp2', to: 'master' },
            { from: 'flt_bp3', to: 'master' }
        ]
    },

    raw_harmonics: {
        name: 'Raw Harmonic Series Lab',
        baseRPM: 900,
        redlineRPM: 7500,
        cylinders: 4,
        masterGain: 0.7,
        nodes: [
            { id: 'osc_sub', type: 'oscillator', name: 'Sub-Harmonic 0.5x', enabled: true, bypass: false, solo: false, params: { waveform: 'sine', freqMode: 'harmonic', mult: 0.5, gain: 0.4 } },
            { id: 'osc_fund', type: 'oscillator', name: 'Fundamental 1.0x', enabled: true, bypass: false, solo: false, params: { waveform: 'sawtooth', freqMode: 'harmonic', mult: 1.0, gain: 0.5 } },
            { id: 'osc_h2', type: 'oscillator', name: 'Harmonic 2.0x', enabled: true, bypass: false, solo: false, params: { waveform: 'triangle', freqMode: 'harmonic', mult: 2.0, gain: 0.35 } },
            { id: 'osc_h4', type: 'oscillator', name: 'Harmonic 4.0x', enabled: true, bypass: false, solo: false, params: { waveform: 'square', freqMode: 'harmonic', mult: 4.0, gain: 0.15 } },
            { id: 'flt_lp', type: 'filter', name: 'Unconnected Lowpass', enabled: true, bypass: false, solo: false, params: { filterType: 'lowpass', frequency: 1500, Q: 1.5, outGain: 1.0 } }
        ],
        connections: [
            { from: 'osc_sub', to: 'master' },
            { from: 'osc_fund', to: 'master' },
            { from: 'osc_h2', to: 'master' },
            { from: 'osc_h4', to: 'master' }
        ]
    },

    comb_waveguide_lab: {
        name: '1D Pipe Comb / Delay Resonator',
        baseRPM: 900,
        redlineRPM: 7500,
        cylinders: 4,
        masterGain: 0.7,
        nodes: [
            { id: 'osc_1', type: 'oscillator', name: 'Exciter Osc', enabled: true, bypass: false, solo: false, params: { waveform: 'sawtooth', freqMode: 'harmonic', mult: 1.0, gain: 0.5 } },
            { id: 'noise_1', type: 'noise', name: 'Exciter Noise', enabled: true, bypass: false, solo: false, params: { noiseType: 'pink', gain: 0.2, throttleModGain: 0.25, rpmModGain: 0.1 } },
            { id: 'shaper_1', type: 'waveshaper', name: 'Exciter Shaper', enabled: true, bypass: false, solo: false, params: { curveType: 'soft_tanh', drive: 20, mix: 1.0, outputGain: 0.8 } },
            { id: 'delay_1', type: 'delay', name: 'Pipe Resonator (3.5ms)', enabled: true, bypass: false, solo: false, params: { delayMs: 3.5, feedback: -0.65, mix: 0.7 } },
            { id: 'flt_lp', type: 'filter', name: 'Acoustic Radiator Lowpass', enabled: true, bypass: false, solo: false, params: { filterType: 'lowpass', frequency: 2500, Q: 1.0, outGain: 1.0 } }
        ],
        connections: [
            { from: 'osc_1', to: 'shaper_1' },
            { from: 'noise_1', to: 'shaper_1' },
            { from: 'shaper_1', to: 'delay_1' },
            { from: 'delay_1', to: 'flt_lp' },
            { from: 'flt_lp', to: 'master' }
        ]
    },

    blank_canvas: {
        name: 'Minimal Single Oscillator',
        baseRPM: 900,
        redlineRPM: 7500,
        cylinders: 4,
        masterGain: 0.7,
        nodes: [
            { id: 'osc_1', type: 'oscillator', name: 'Sawtooth 1.0x', enabled: true, bypass: false, solo: false, params: { waveform: 'sawtooth', freqMode: 'harmonic', mult: 1.0, gain: 0.6 } },
            { id: 'flt_1', type: 'filter', name: 'Lowpass Filter', enabled: true, bypass: false, solo: false, params: { filterType: 'lowpass', frequency: 1200, Q: 1.0, outGain: 1.0 } }
        ],
        connections: [
            { from: 'osc_1', to: 'flt_1' },
            { from: 'flt_1', to: 'master' }
        ]
    }
};

const PREFIX_MAP = {
    oscillator: 'osc',
    noise: 'noise',
    filter: 'flt',
    waveshaper: 'shaper',
    gain: 'gain',
    delay: 'delay'
};

export class ModularAudioEngine {
    constructor(initialPresetKey = 'series_peaking_formants') {
        this.ctx = null;
        this.masterGainNode = null;
        this.analyser = null;
        this.audioNodes = new Map();
        this.isPlaying = false;
        this.currentRPM = 900;
        this.currentThrottle = 0;
        this._idCounter = 1;
        this.patch = null;

        if (initialPresetKey) {
            this.loadPreset(initialPresetKey);
        }
    }

    /**
     * Load one of the built-in presets by key.
     * @param {string} presetKey 
     */
    loadPreset(presetKey) {
        const preset = MODULAR_PATCH_PRESETS[presetKey];
        if (!preset) {
            throw new Error(`Unknown preset: "${presetKey}". Available presets: ${Object.keys(MODULAR_PATCH_PRESETS).join(', ')}`);
        }
        this.loadPatch(preset);
    }

    /**
     * Load an arbitrary patch configuration object.
     * @param {object} patchObject 
     */
    loadPatch(patchObject) {
        if (!patchObject || typeof patchObject !== 'object') {
            throw new Error('Invalid patch object');
        }

        this.patch = {
            name: patchObject.name || 'Custom Patch',
            baseRPM: patchObject.baseRPM !== undefined ? patchObject.baseRPM : 900,
            redlineRPM: patchObject.redlineRPM !== undefined ? patchObject.redlineRPM : 7500,
            cylinders: patchObject.cylinders !== undefined ? patchObject.cylinders : 4,
            masterGain: patchObject.masterGain !== undefined ? patchObject.masterGain : 0.7,
            nodes: Array.isArray(patchObject.nodes) ? JSON.parse(JSON.stringify(patchObject.nodes)) : [],
            connections: Array.isArray(patchObject.connections) ? JSON.parse(JSON.stringify(patchObject.connections)) : []
        };

        // Ensure all nodes have complete default properties
        for (const node of this.patch.nodes) {
            if (node.enabled === undefined) node.enabled = true;
            if (node.bypass === undefined) node.bypass = false;
            if (node.solo === undefined) node.solo = false;
            const defaults = DEFAULT_NODE_PARAMS[node.type] || {};
            node.params = { ...defaults, ...(node.params || {}) };
        }

        this._updateIdCounter();

        if (this.ctx) {
            this.buildGraph();
            this.update(this.currentRPM, this.currentThrottle);
        }
    }

    /**
     * Export a deep clone of the current patch.
     * @returns {object}
     */
    exportPatch() {
        return JSON.parse(JSON.stringify(this.patch));
    }

    _updateIdCounter() {
        let max = 1;
        for (const n of this.patch.nodes) {
            const parts = n.id.split('_');
            const num = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(num) && num >= max) {
                max = num + 1;
            }
        }
        this._idCounter = max;
    }

    /**
     * Add a node to the patch.
     * @param {'oscillator' | 'noise' | 'filter' | 'waveshaper' | 'gain' | 'delay'} type 
     * @param {object} customParams 
     * @param {string|null} customName 
     * @returns {object} The created node
     */
    addNode(type, customParams = {}, customName = null) {
        const prefix = PREFIX_MAP[type] || 'node';
        let id = `${prefix}_${this._idCounter++}`;
        while (this.patch.nodes.some(n => n.id === id)) {
            id = `${prefix}_${this._idCounter++}`;
        }

        const typeCap = type.charAt(0).toUpperCase() + type.slice(1);
        const name = customName || `${typeCap} (${id})`;
        const defaults = DEFAULT_NODE_PARAMS[type] || {};

        const node = {
            id,
            type,
            name,
            enabled: true,
            bypass: false,
            solo: false,
            params: { ...defaults, ...customParams }
        };

        this.patch.nodes.push(node);

        if (this.ctx) {
            this.buildGraph();
            this.update(this.currentRPM, this.currentThrottle);
        }

        return node;
    }

    /**
     * Duplicate an existing node, cloning its params and incoming/outgoing edges.
     * @param {string} nodeId 
     * @returns {object|null} The duplicated node
     */
    duplicateNode(nodeId) {
        const orig = this.patch.nodes.find(n => n.id === nodeId);
        if (!orig) return null;

        let newId = `${orig.id}_copy`;
        let counter = 1;
        while (this.patch.nodes.some(n => n.id === newId)) {
            newId = `${orig.id}_copy_${counter++}`;
        }

        const newNode = {
            id: newId,
            type: orig.type,
            name: `${orig.name} (Copy)`,
            enabled: orig.enabled !== false,
            bypass: !!orig.bypass,
            solo: !!orig.solo,
            params: JSON.parse(JSON.stringify(orig.params || {}))
        };

        this.patch.nodes.push(newNode);

        // Duplicate incoming connections
        const incoming = this.patch.connections.filter(c => c.to === nodeId);
        for (const c of incoming) {
            this.patch.connections.push({ from: c.from, to: newId });
        }

        // Duplicate outgoing connections
        const outgoing = this.patch.connections.filter(c => c.from === nodeId);
        for (const c of outgoing) {
            this.patch.connections.push({ from: newId, to: c.to });
        }

        if (this.ctx) {
            this.buildGraph();
            this.update(this.currentRPM, this.currentThrottle);
        }

        return newNode;
    }

    DuplicateNode(nodeId) {
        return this.duplicateNode(nodeId);
    }

    /**
     * Remove a node and all connections referencing it.
     * @param {string} nodeId 
     * @returns {boolean}
     */
    removeNode(nodeId) {
        const index = this.patch.nodes.findIndex(n => n.id === nodeId);
        if (index === -1) return false;

        this.patch.nodes.splice(index, 1);
        this.patch.connections = this.patch.connections.filter(c => c.from !== nodeId && c.to !== nodeId);

        if (this.ctx) {
            this.buildGraph();
            this.update(this.currentRPM, this.currentThrottle);
        }

        return true;
    }

    /**
     * Update node properties or merge params.
     * @param {string} nodeId 
     * @param {object} partialUpdate 
     * @returns {object|null}
     */
    updateNode(nodeId, partialUpdate) {
        const node = this.patch.nodes.find(n => n.id === nodeId);
        if (!node) return null;

        if (partialUpdate.name !== undefined) node.name = partialUpdate.name;
        if (partialUpdate.enabled !== undefined) node.enabled = !!partialUpdate.enabled;
        if (partialUpdate.bypass !== undefined) node.bypass = !!partialUpdate.bypass;
        if (partialUpdate.solo !== undefined) node.solo = !!partialUpdate.solo;

        let structuralChange = false;
        if (partialUpdate.params) {
            if (partialUpdate.params.waveform !== undefined && partialUpdate.params.waveform !== node.params.waveform) {
                structuralChange = true;
            }
            if (partialUpdate.params.noiseType !== undefined && partialUpdate.params.noiseType !== node.params.noiseType) {
                structuralChange = true;
            }
            if (partialUpdate.params.curveType !== undefined && partialUpdate.params.curveType !== node.params.curveType) {
                structuralChange = true;
            }
            if (partialUpdate.params.filterType !== undefined && partialUpdate.params.filterType !== node.params.filterType) {
                structuralChange = true;
            }
            node.params = { ...node.params, ...partialUpdate.params };
        }

        if (this.ctx) {
            if (structuralChange) {
                this.buildGraph();
            }
            this.update(this.currentRPM, this.currentThrottle);
        }

        return node;
    }

    /**
     * Add a directed connection from `fromId` to `toId`.
     * Validates node existence, prevents duplicate edges, self-loops, and cycles.
     * @param {string} fromId 
     * @param {string} toId ('master' or valid node id)
     * @returns {boolean} True if successfully connected
     */
    connect(fromId, toId) {
        if (!fromId || !toId) return false;
        if (fromId === toId) return false;

        const fromExists = this.patch.nodes.some(n => n.id === fromId);
        if (!fromExists) return false;

        const toExists = toId === 'master' || this.patch.nodes.some(n => n.id === toId);
        if (!toExists) return false;

        const alreadyConnected = this.patch.connections.some(c => c.from === fromId && c.to === toId);
        if (alreadyConnected) return false;

        // Cycle check: check if fromId is reachable starting from toId
        if (toId !== 'master') {
            const visited = new Set();
            const queue = [toId];
            let hasCycle = false;
            while (queue.length > 0) {
                const curr = queue.shift();
                if (curr === fromId) {
                    hasCycle = true;
                    break;
                }
                visited.add(curr);
                for (const c of this.patch.connections) {
                    if (c.from === curr && !visited.has(c.to) && c.to !== 'master') {
                        queue.push(c.to);
                    }
                }
            }
            if (hasCycle) return false;
        }

        this.patch.connections.push({ from: fromId, to: toId });

        if (this.ctx) {
            this.rebuildConnections();
        }

        return true;
    }

    /**
     * Remove a directed connection.
     * @param {string} fromId 
     * @param {string} toId 
     * @returns {boolean} True if successfully disconnected
     */
    disconnect(fromId, toId) {
        const index = this.patch.connections.findIndex(c => c.from === fromId && c.to === toId);
        if (index === -1) return false;

        this.patch.connections.splice(index, 1);

        if (this.ctx) {
            this.rebuildConnections();
        }

        return true;
    }

    /**
     * Convenience helper to rewire source nodes and filters in series or parallel.
     * @param {'series' | 'parallel'} mode 
     */
    rewireFiltersTopology(mode = 'series') {
        const sources = this.patch.nodes.filter(n => n.type === 'oscillator' || n.type === 'noise');
        const shapers = this.patch.nodes.filter(n => n.type === 'waveshaper');
        const filters = this.patch.nodes.filter(n => n.type === 'filter');

        const sourceIds = new Set(sources.map(n => n.id));
        const shaperIds = new Set(shapers.map(n => n.id));
        const filterIds = new Set(filters.map(n => n.id));

        // Filter out existing connections among sources, shapers, filters, and to master
        this.patch.connections = this.patch.connections.filter(c => {
            const isFromRelevant = sourceIds.has(c.from) || shaperIds.has(c.from) || filterIds.has(c.from);
            const isToRelevant = filterIds.has(c.to) || shaperIds.has(c.to) || c.to === 'master';
            return !(isFromRelevant && isToRelevant);
        });

        // Determine feed nodes into the filter bank
        let feedNodeIds = [];
        if (shapers.length > 0) {
            const primaryShaper = shapers[0];
            for (const s of sources) {
                this.patch.connections.push({ from: s.id, to: primaryShaper.id });
            }
            feedNodeIds = [primaryShaper.id];
        } else {
            feedNodeIds = sources.map(s => s.id);
        }

        if (filters.length === 0) {
            for (const feedId of feedNodeIds) {
                this.patch.connections.push({ from: feedId, to: 'master' });
            }
        } else if (mode === 'parallel') {
            for (const flt of filters) {
                for (const feedId of feedNodeIds) {
                    this.patch.connections.push({ from: feedId, to: flt.id });
                }
                this.patch.connections.push({ from: flt.id, to: 'master' });
            }
        } else {
            // 'series'
            for (const feedId of feedNodeIds) {
                this.patch.connections.push({ from: feedId, to: filters[0].id });
            }
            for (let i = 0; i < filters.length - 1; i++) {
                this.patch.connections.push({ from: filters[i].id, to: filters[i + 1].id });
            }
            this.patch.connections.push({ from: filters[filters.length - 1].id, to: 'master' });
        }

        if (this.ctx) {
            this.rebuildConnections();
        }
    }

    /**
     * Pure function (requires no AudioContext) that calculates the exact state
     * of every node in the patch for given RPM and throttle values.
     * 
     * @param {number} rpm Engine RPM
     * @param {number} throttle Throttle position [0..1]
     * @returns {object} Calculated state including nodeStates map
     */
    calculateState(rpm, throttle = 0) {
        const currentRPM = Number(rpm) || 0;
        const currentThrottle = Math.max(0, Math.min(1, Number(throttle) || 0));

        const baseRPM = this.patch.baseRPM !== undefined ? this.patch.baseRPM : 900;
        const redlineRPM = this.patch.redlineRPM !== undefined ? this.patch.redlineRPM : 7500;
        const cylinders = this.patch.cylinders !== undefined ? this.patch.cylinders : 4;

        const f0 = currentRPM / 60;
        const firingFreq = f0 * (cylinders / 2);
        const rpmNorm = Math.max(0, Math.min(1, (currentRPM - baseRPM) / Math.max(1, redlineRPM - baseRPM)));

        const hasSolo = this.patch.nodes.some(n => n.solo === true && n.enabled !== false);
        const nodeStates = {};

        for (const node of this.patch.nodes) {
            const isEnabled = node.enabled !== false;
            const isSoloed = !!node.solo;
            const isBypassed = !!node.bypass;
            const effectiveActive = hasSolo ? (isEnabled && isSoloed) : isEnabled;
            const p = node.params || {};

            const state = {
                id: node.id,
                type: node.type,
                name: node.name,
                enabled: isEnabled,
                solo: isSoloed,
                bypass: isBypassed,
                active: effectiveActive
            };

            if (node.type === 'oscillator') {
                const mult = p.mult !== undefined ? p.mult : 1.0;
                const freqHz = p.freqHz !== undefined ? p.freqHz : 100;
                const freq = (p.freqMode === 'fixed') ? freqHz : Math.max(0, f0 * mult);
                const baseGain = p.gain !== undefined ? p.gain : 0.5;
                const modGain = (p.throttleModGain || 0) * currentThrottle + (p.rpmModGain || 0) * rpmNorm;
                const gain = effectiveActive ? Math.max(0, baseGain + modGain) : 0;

                state.frequency = freq;
                state.detune = p.detune || 0;
                state.gain = gain;
                state.waveform = p.waveform || 'sawtooth';
                state.freqMode = p.freqMode || 'harmonic';
                state.mult = mult;
            } else if (node.type === 'noise') {
                const baseGain = p.gain !== undefined ? p.gain : 0.3;
                const modGain = (p.throttleModGain || 0) * currentThrottle + (p.rpmModGain || 0) * rpmNorm;
                const gain = effectiveActive ? Math.max(0, baseGain + modGain) : 0;

                state.noiseType = p.noiseType || 'pink';
                state.gain = gain;
            } else if (node.type === 'filter') {
                const baseFreq = p.frequency !== undefined ? p.frequency : 500;
                const modShift = (p.rpmModFreq || 0) * rpmNorm + (p.throttleModFreq || 0) * currentThrottle;
                const freq = Math.max(20, Math.min(20000, baseFreq + modShift));

                state.filterType = p.filterType || 'peaking';
                state.frequency = freq;
                state.Q = p.Q !== undefined ? p.Q : 2.0;
                state.filterGain = p.filterGain !== undefined ? p.filterGain : 6.0;
                state.outGain = effectiveActive ? (p.outGain !== undefined ? p.outGain : 1.0) : 0;
            } else if (node.type === 'waveshaper') {
                state.curveType = p.curveType || 'soft_tanh';
                state.drive = p.drive !== undefined ? p.drive : 20;
                state.mix = isBypassed ? 0 : (p.mix !== undefined ? p.mix : 1.0);
                state.outputGain = effectiveActive ? (p.outputGain !== undefined ? p.outputGain : 1.0) : 0;
            } else if (node.type === 'gain') {
                const baseGain = p.gain !== undefined ? p.gain : 1.0;
                const modGain = (p.throttleModGain || 0) * currentThrottle + (p.rpmModGain || 0) * rpmNorm;
                const gain = isBypassed ? 1.0 : (effectiveActive ? Math.max(0, baseGain + modGain) : 0);

                state.gain = gain;
            } else if (node.type === 'delay') {
                const delayMs = p.delayMs !== undefined ? p.delayMs : 4.0;
                state.delayMs = delayMs;
                state.delayTime = delayMs / 1000;
                state.feedback = p.feedback !== undefined ? p.feedback : -0.5;
                state.mix = isBypassed ? 0 : (p.mix !== undefined ? p.mix : 0.5);
            }

            nodeStates[node.id] = state;
        }

        return {
            rpm: currentRPM,
            throttle: currentThrottle,
            rpmNorm,
            f0,
            firingFreq,
            hasSolo,
            masterGain: this.patch.masterGain !== undefined ? this.patch.masterGain : 0.7,
            nodeStates
        };
    }

    /**
     * Compute the magnitude response (in dB) across an array of frequencies for a filter node.
     * Uses live BiquadFilterNode if available, or falls back to an exact 2nd-order biquad math model.
     * Returns 0 dB across all frequencies if bypass is true.
     * 
     * @param {string} nodeId 
     * @param {Float32Array|number[]} freqHzArray 
     * @returns {Float32Array} Magnitude response in dB
     */
    getFilterFrequencyResponse(nodeId, freqHzArray) {
        const floatArray = (freqHzArray instanceof Float32Array) ? freqHzArray : new Float32Array(freqHzArray);
        const node = this.patch.nodes.find(n => n.id === nodeId);
        if (!node || node.type !== 'filter') {
            return new Float32Array(floatArray.length).fill(0);
        }

        if (node.bypass) {
            return new Float32Array(floatArray.length).fill(0);
        }

        // Check if Web Audio live biquad filter is active
        const live = this.audioNodes.get(nodeId);
        if (live && live.filterNode && typeof live.filterNode.getFrequencyResponse === 'function') {
            const magResponse = new Float32Array(floatArray.length);
            const phaseResponse = new Float32Array(floatArray.length);
            live.filterNode.getFrequencyResponse(floatArray, magResponse, phaseResponse);
            const dbResponse = new Float32Array(floatArray.length);
            for (let i = 0; i < magResponse.length; i++) {
                dbResponse[i] = 20 * Math.log10(Math.max(1e-6, magResponse[i]));
            }
            return dbResponse;
        }

        // Mathematical fallback
        const state = this.calculateState(this.currentRPM, this.currentThrottle);
        const st = state.nodeStates[nodeId] || {};
        const filterType = st.filterType || node.params.filterType || 'peaking';
        const f0 = st.frequency !== undefined ? st.frequency : (node.params.frequency ?? 500);
        const Q = st.Q !== undefined ? st.Q : (node.params.Q ?? 2.0);
        const filterGain = st.filterGain !== undefined ? st.filterGain : (node.params.filterGain ?? 6.0);
        const fs = (this.ctx && this.ctx.sampleRate) ? this.ctx.sampleRate : 48000;

        return this._calculateBiquadDbResponse(filterType, f0, Q, filterGain, fs, floatArray);
    }

    _calculateBiquadDbResponse(type, f0, Q, gainDb, fs, freqArray) {
        const w0 = (2 * Math.PI * f0) / fs;
        const cosW = Math.cos(w0);
        const sinW = Math.sin(w0);
        const A = Math.pow(10, gainDb / 40);
        const qVal = Math.max(0.001, Q);
        const alpha = sinW / (2 * qVal);

        let b0 = 1, b1 = 0, b2 = 0, a0 = 1, a1 = 0, a2 = 0;
        switch (type) {
            case 'lowpass':
                b0 = (1 - cosW) / 2;
                b1 = 1 - cosW;
                b2 = (1 - cosW) / 2;
                a0 = 1 + alpha;
                a1 = -2 * cosW;
                a2 = 1 - alpha;
                break;
            case 'highpass':
                b0 = (1 + cosW) / 2;
                b1 = -(1 + cosW);
                b2 = (1 + cosW) / 2;
                a0 = 1 + alpha;
                a1 = -2 * cosW;
                a2 = 1 - alpha;
                break;
            case 'bandpass':
                b0 = alpha;
                b1 = 0;
                b2 = -alpha;
                a0 = 1 + alpha;
                a1 = -2 * cosW;
                a2 = 1 - alpha;
                break;
            case 'notch':
                b0 = 1;
                b1 = -2 * cosW;
                b2 = 1;
                a0 = 1 + alpha;
                a1 = -2 * cosW;
                a2 = 1 - alpha;
                break;
            case 'peaking':
                b0 = 1 + alpha * A;
                b1 = -2 * cosW;
                b2 = 1 - alpha * A;
                a0 = 1 + alpha / A;
                a1 = -2 * cosW;
                a2 = 1 - alpha / A;
                break;
            case 'allpass':
                b0 = 1 - alpha;
                b1 = -2 * cosW;
                b2 = 1 + alpha;
                a0 = 1 + alpha;
                a1 = -2 * cosW;
                a2 = 1 - alpha;
                break;
            case 'lowshelf': {
                const sq = 2 * Math.sqrt(A) * alpha;
                b0 = A * ((A + 1) - (A - 1) * cosW + sq);
                b1 = 2 * A * ((A - 1) - (A + 1) * cosW);
                b2 = A * ((A + 1) - (A - 1) * cosW - sq);
                a0 = (A + 1) + (A - 1) * cosW + sq;
                a1 = -2 * ((A - 1) + (A + 1) * cosW);
                a2 = (A + 1) + (A - 1) * cosW - sq;
                break;
            }
            case 'highshelf': {
                const sq = 2 * Math.sqrt(A) * alpha;
                b0 = A * ((A + 1) + (A - 1) * cosW + sq);
                b1 = -2 * A * ((A - 1) + (A + 1) * cosW);
                b2 = A * ((A + 1) - (A - 1) * cosW - sq);
                a0 = (A + 1) - (A - 1) * cosW + sq;
                a1 = 2 * ((A - 1) - (A + 1) * cosW);
                a2 = (A + 1) - (A - 1) * cosW - sq;
                break;
            }
            default:
                b0 = 1; b1 = 0; b2 = 0; a0 = 1; a1 = 0; a2 = 0;
        }

        const result = new Float32Array(freqArray.length);
        for (let i = 0; i < freqArray.length; i++) {
            const f = freqArray[i];
            const w = (2 * Math.PI * f) / fs;
            const cos1 = Math.cos(w);
            const sin1 = Math.sin(w);
            const cos2 = Math.cos(2 * w);
            const sin2 = Math.sin(2 * w);

            const numRe = b0 + b1 * cos1 + b2 * cos2;
            const numIm = -(b1 * sin1 + b2 * sin2);
            const denRe = a0 + a1 * cos1 + a2 * cos2;
            const denIm = -(a1 * sin1 + a2 * sin2);

            const mag2 = (numRe * numRe + numIm * numIm) / Math.max(1e-12, (denRe * denRe + denIm * denIm));
            result[i] = 20 * Math.log10(Math.max(1e-6, Math.sqrt(mag2)));
        }
        return result;
    }

    /**
     * Web Audio lifecycle initialization / start.
     */
    init() {
        const AudioContextClass = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) ||
            (typeof globalThis !== 'undefined' && (globalThis.AudioContext || globalThis.webkitAudioContext));

        if (!AudioContextClass) {
            this.isPlaying = true;
            return;
        }

        if (!this.ctx) {
            this.ctx = new AudioContextClass();
        }

        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }

        this.masterGainNode = this.ctx.createGain();
        this.masterGainNode.gain.setValueAtTime(this.patch.masterGain ?? 0.7, this.ctx.currentTime);

        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 2048;

        this.masterGainNode.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);

        this.buildGraph();
        this.isPlaying = true;
        this.update(this.currentRPM, this.currentThrottle);
    }

    start() {
        return this.init();
    }

    /**
     * Stop and tear down live Web Audio graph.
     */
    stop() {
        this._tearDownGraph();

        if (this.masterGainNode) {
            try { this.masterGainNode.disconnect(); } catch (e) {}
            this.masterGainNode = null;
        }

        if (this.analyser) {
            try { this.analyser.disconnect(); } catch (e) {}
            this.analyser = null;
        }

        if (this.ctx && typeof this.ctx.close === 'function') {
            try { this.ctx.close().catch(() => {}); } catch (e) {}
            this.ctx = null;
        }

        this.isPlaying = false;
    }

    _tearDownGraph() {
        for (const [id, wrapper] of this.audioNodes) {
            if (wrapper.oscNode) {
                try { wrapper.oscNode.stop(); wrapper.oscNode.disconnect(); } catch (e) {}
            }
            if (wrapper.sourceNode) {
                try { wrapper.sourceNode.stop(); wrapper.sourceNode.disconnect(); } catch (e) {}
            }
            if (wrapper.output) {
                try { wrapper.output.disconnect(); } catch (e) {}
            }
            if (wrapper.input && wrapper.input !== wrapper.output) {
                try { wrapper.input.disconnect(); } catch (e) {}
            }
        }
        this.audioNodes.clear();
    }

    /**
     * Rebuild the entire Web Audio node graph.
     */
    buildGraph() {
        if (!this.ctx) return;

        this._tearDownGraph();

        for (const node of this.patch.nodes) {
            const p = node.params || {};

            if (node.type === 'oscillator') {
                const osc = this.ctx.createOscillator();
                osc.type = p.waveform || 'sawtooth';
                osc.frequency.setValueAtTime(100, this.ctx.currentTime);
                osc.detune.setValueAtTime(p.detune || 0, this.ctx.currentTime);

                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(p.gain ?? 0.5, this.ctx.currentTime);

                osc.connect(gain);
                try { osc.start(0); } catch (e) {}

                this.audioNodes.set(node.id, {
                    input: null,
                    output: gain,
                    oscNode: osc,
                    gainNode: gain
                });
            } else if (node.type === 'noise') {
                const buffer = this._createNoiseBuffer(p.noiseType || 'pink');
                const src = this.ctx.createBufferSource();
                src.buffer = buffer;
                src.loop = true;

                const gain = this.ctx.createGain();
                gain.gain.setValueAtTime(p.gain ?? 0.3, this.ctx.currentTime);

                src.connect(gain);
                try { src.start(0); } catch (e) {}

                this.audioNodes.set(node.id, {
                    input: null,
                    output: gain,
                    sourceNode: src,
                    gainNode: gain
                });
            } else if (node.type === 'filter') {
                const inputGain = this.ctx.createGain();
                const biquad = this.ctx.createBiquadFilter();
                biquad.type = p.filterType || 'peaking';
                biquad.frequency.setValueAtTime(p.frequency ?? 500, this.ctx.currentTime);
                biquad.Q.setValueAtTime(p.Q ?? 2.0, this.ctx.currentTime);
                biquad.gain.setValueAtTime(p.filterGain ?? 6.0, this.ctx.currentTime);

                const wetGain = this.ctx.createGain();
                const dryGain = this.ctx.createGain();
                const outGain = this.ctx.createGain();
                outGain.gain.setValueAtTime(p.outGain ?? 1.0, this.ctx.currentTime);

                inputGain.connect(biquad);
                biquad.connect(wetGain);
                wetGain.connect(outGain);

                inputGain.connect(dryGain);
                dryGain.connect(outGain);

                this.audioNodes.set(node.id, {
                    input: inputGain,
                    output: outGain,
                    filterNode: biquad,
                    wetGain,
                    dryGain,
                    outGain
                });
            } else if (node.type === 'waveshaper') {
                const inputGain = this.ctx.createGain();
                const shaper = this.ctx.createWaveShaper();
                shaper.curve = this._generateWaveShaperCurve(p.curveType || 'soft_tanh', p.drive ?? 20);
                try { shaper.oversample = '4x'; } catch (e) {}

                const wetGain = this.ctx.createGain();
                const dryGain = this.ctx.createGain();
                const outputGain = this.ctx.createGain();
                outputGain.gain.setValueAtTime(p.outputGain ?? 1.0, this.ctx.currentTime);

                inputGain.connect(shaper);
                shaper.connect(wetGain);
                wetGain.connect(outputGain);

                inputGain.connect(dryGain);
                dryGain.connect(outputGain);

                this.audioNodes.set(node.id, {
                    input: inputGain,
                    output: outputGain,
                    shaperNode: shaper,
                    wetGain,
                    dryGain,
                    outputGain
                });
            } else if (node.type === 'gain') {
                const inputGain = this.ctx.createGain();
                const gainNode = this.ctx.createGain();
                gainNode.gain.setValueAtTime(p.gain ?? 1.0, this.ctx.currentTime);

                inputGain.connect(gainNode);

                this.audioNodes.set(node.id, {
                    input: inputGain,
                    output: gainNode,
                    gainNode
                });
            } else if (node.type === 'delay') {
                const inputGain = this.ctx.createGain();
                const delayNode = this.ctx.createDelay(1.0);
                delayNode.delayTime.setValueAtTime((p.delayMs ?? 4.0) / 1000, this.ctx.currentTime);

                const feedback = this.ctx.createGain();
                feedback.gain.setValueAtTime(p.feedback ?? -0.5, this.ctx.currentTime);

                const wetGain = this.ctx.createGain();
                const dryGain = this.ctx.createGain();
                const outputNode = this.ctx.createGain();

                inputGain.connect(delayNode);
                delayNode.connect(feedback);
                feedback.connect(delayNode);

                delayNode.connect(wetGain);
                wetGain.connect(outputNode);

                inputGain.connect(dryGain);
                dryGain.connect(outputNode);

                this.audioNodes.set(node.id, {
                    input: inputGain,
                    output: outputNode,
                    delayNode,
                    feedbackNode: feedback,
                    wetGain,
                    dryGain
                });
            }
        }

        this.rebuildConnections();
    }

    /**
     * Rebuild all audio node directed connections in the Web Audio context.
     */
    rebuildConnections() {
        if (!this.ctx) return;

        // Disconnect all current node outputs
        for (const [id, wrapper] of this.audioNodes) {
            try { wrapper.output.disconnect(); } catch (e) {}
        }

        for (const c of this.patch.connections) {
            const src = this.audioNodes.get(c.from);
            if (!src || !src.output) continue;

            if (c.to === 'master') {
                if (this.masterGainNode) {
                    try { src.output.connect(this.masterGainNode); } catch (e) {}
                }
            } else {
                const dst = this.audioNodes.get(c.to);
                if (dst && dst.input) {
                    try { src.output.connect(dst.input); } catch (e) {}
                }
            }
        }
    }

    /**
     * Update audio engine with current RPM and throttle.
     * Computes state and updates all live audio nodes.
     * 
     * @param {number} rpm 
     * @param {number} throttle 
     * @returns {object} The calculated state
     */
    update(rpm, throttle = 0) {
        this.currentRPM = rpm;
        this.currentThrottle = throttle;

        const state = this.calculateState(rpm, throttle);

        if (this.ctx) {
            const t = this.ctx.currentTime;

            if (this.masterGainNode) {
                this.masterGainNode.gain.setValueAtTime(state.masterGain, t);
            }

            for (const node of this.patch.nodes) {
                const st = state.nodeStates[node.id];
                const live = this.audioNodes.get(node.id);
                if (!st || !live) continue;

                if (node.type === 'oscillator') {
                    live.oscNode.frequency.setValueAtTime(st.frequency, t);
                    live.oscNode.detune.setValueAtTime(st.detune, t);
                    live.gainNode.gain.setValueAtTime(st.gain, t);
                } else if (node.type === 'noise') {
                    live.gainNode.gain.setValueAtTime(st.gain, t);
                } else if (node.type === 'filter') {
                    live.filterNode.frequency.setValueAtTime(st.frequency, t);
                    live.filterNode.Q.setValueAtTime(st.Q, t);
                    live.filterNode.gain.setValueAtTime(st.filterGain, t);
                    live.outGain.gain.setValueAtTime(st.outGain, t);

                    if (st.bypass) {
                        live.wetGain.gain.setValueAtTime(0, t);
                        live.dryGain.gain.setValueAtTime(1, t);
                    } else {
                        live.wetGain.gain.setValueAtTime(1, t);
                        live.dryGain.gain.setValueAtTime(0, t);
                    }
                } else if (node.type === 'waveshaper') {
                    live.outputGain.gain.setValueAtTime(st.outputGain, t);
                    live.wetGain.gain.setValueAtTime(st.mix, t);
                    live.dryGain.gain.setValueAtTime(1 - st.mix, t);
                } else if (node.type === 'gain') {
                    live.gainNode.gain.setValueAtTime(st.gain, t);
                } else if (node.type === 'delay') {
                    live.delayNode.delayTime.setValueAtTime(st.delayTime, t);
                    live.feedbackNode.gain.setValueAtTime(st.feedback, t);
                    live.wetGain.gain.setValueAtTime(st.mix, t);
                    live.dryGain.gain.setValueAtTime(1 - st.mix, t);
                }
            }
        }

        return state;
    }

    _createNoiseBuffer(type) {
        const sampleRate = (this.ctx && this.ctx.sampleRate) ? this.ctx.sampleRate : 48000;
        const bufferSize = sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
        const data = buffer.getChannelData(0);

        if (type === 'white') {
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
        } else if (type === 'brown') {
            let lastOut = 0.0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                data[i] = (lastOut + 0.02 * white) / 1.02;
                lastOut = data[i];
                data[i] *= 3.5;
            }
        } else {
            // Paul Kellet pink noise filter
            let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                b3 = 0.86650 * b3 + white * 0.3104856;
                b4 = 0.55000 * b4 + white * 0.5329522;
                b5 = -0.7616 * b5 - white * 0.0168980;
                data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
                b6 = white * 0.115926;
            }
        }

        return buffer;
    }

    _generateWaveShaperCurve(curveType, drive) {
        const samples = 2048;
        const curve = new Float32Array(samples);
        const d = Math.max(0, drive);

        if (curveType === 'hard_clip') {
            const k = 1 + d * 0.15;
            for (let i = 0; i < samples; i++) {
                const x = (i * 2) / samples - 1;
                curve[i] = Math.max(-1, Math.min(1, x * k));
            }
        } else if (curveType === 'asymmetric') {
            const k = 1 + d * 0.15;
            for (let i = 0; i < samples; i++) {
                const x = (i * 2) / samples - 1;
                if (x > 0) {
                    curve[i] = (1 - Math.exp(-k * x)) / (1 - Math.exp(-k));
                } else {
                    curve[i] = -(1 - Math.exp(k * 0.5 * x)) / (1 - Math.exp(-k * 0.5));
                }
            }
        } else if (curveType === 'foldback') {
            const k = 1 + d * 0.1;
            for (let i = 0; i < samples; i++) {
                const x = (i * 2) / samples - 1;
                curve[i] = Math.sin(k * x * Math.PI * 0.5);
            }
        } else {
            // soft_tanh
            const k = 1 + d * 0.2;
            const denom = Math.tanh(k);
            for (let i = 0; i < samples; i++) {
                const x = (i * 2) / samples - 1;
                curve[i] = Math.tanh(k * x) / denom;
            }
        }

        return curve;
    }

    getAnalyser() {
        return this.analyser;
    }

    getMasterGain() {
        return this.masterGainNode;
    }

    getPatch() {
        return this.patch;
    }
}
