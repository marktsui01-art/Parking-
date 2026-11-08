import { jest } from '@jest/globals';
import { ModularAudioEngine, MODULAR_PATCH_PRESETS, DEFAULT_NODE_PARAMS } from '../../src/ModularAudioEngine.js';

describe('ModularAudioEngine - Graph Model & Preset Loading', () => {
    test('Default constructor loads "series_peaking_formants" preset', () => {
        const engine = new ModularAudioEngine();
        expect(engine.patch).toBeDefined();
        expect(engine.patch.name).toBe('Series Formant Chain + Load Lowpass');
        expect(engine.patch.nodes.length).toBeGreaterThanOrEqual(8);
        expect(engine.patch.connections.length).toBeGreaterThanOrEqual(8);
    });

    test('All 5 standard presets exist and load cleanly', () => {
        const requiredPresets = [
            'series_peaking_formants',
            'parallel_bandpass_bank',
            'raw_harmonics',
            'comb_waveguide_lab',
            'blank_canvas'
        ];

        for (const key of requiredPresets) {
            expect(MODULAR_PATCH_PRESETS[key]).toBeDefined();
            const engine = new ModularAudioEngine(key);
            expect(engine.patch.nodes.length).toBeGreaterThan(0);
            expect(engine.patch.baseRPM).toBe(900);
            expect(engine.patch.redlineRPM).toBe(7500);
        }
    });

    test('Throws error when loading unknown preset', () => {
        const engine = new ModularAudioEngine();
        expect(() => engine.loadPreset('invalid_preset_name')).toThrow(/Unknown preset/);
    });

    test('exportPatch returns a deep-cloned patch object', () => {
        const engine = new ModularAudioEngine('blank_canvas');
        const exported = engine.exportPatch();

        expect(exported.name).toBe('Minimal Single Oscillator');
        expect(exported.nodes.length).toBe(engine.patch.nodes.length);

        // Mutating export should not affect engine's internal patch
        exported.name = 'Mutated Name';
        exported.nodes[0].name = 'Mutated Node';
        expect(engine.patch.name).toBe('Minimal Single Oscillator');
        expect(engine.patch.nodes[0].name).not.toBe('Mutated Node');
    });

    test('loadPatch loads custom patch configuration', () => {
        const engine = new ModularAudioEngine();
        const customPatch = {
            name: 'Custom V6 Test Patch',
            baseRPM: 800,
            redlineRPM: 7000,
            cylinders: 6,
            masterGain: 0.8,
            nodes: [
                { id: 'osc_1', type: 'oscillator', name: 'Main Osc', enabled: true, params: { mult: 1.5 } },
                { id: 'flt_1', type: 'filter', name: 'Main Filter', enabled: true, params: { frequency: 450 } }
            ],
            connections: [
                { from: 'osc_1', to: 'flt_1' },
                { from: 'flt_1', to: 'master' }
            ]
        };

        engine.loadPatch(customPatch);
        expect(engine.patch.name).toBe('Custom V6 Test Patch');
        expect(engine.patch.baseRPM).toBe(800);
        expect(engine.patch.redlineRPM).toBe(7000);
        expect(engine.patch.cylinders).toBe(6);
        expect(engine.patch.nodes.length).toBe(2);
        expect(engine.patch.connections.length).toBe(2);
    });
});

describe('ModularAudioEngine - Node Management', () => {
    let engine;

    beforeEach(() => {
        engine = new ModularAudioEngine('blank_canvas');
    });

    test('addNode creates nodes with unique IDs and merged default params', () => {
        const initialCount = engine.patch.nodes.length;
        const newNode = engine.addNode('filter', { frequency: 1800, Q: 3.5 }, 'Hi-Q Resonator');

        expect(engine.patch.nodes.length).toBe(initialCount + 1);
        expect(newNode.id).toMatch(/^flt_/);
        expect(newNode.name).toBe('Hi-Q Resonator');
        expect(newNode.type).toBe('filter');
        expect(newNode.params.frequency).toBe(1800);
        expect(newNode.params.Q).toBe(3.5);
        expect(newNode.params.filterType).toBe(DEFAULT_NODE_PARAMS.filter.filterType);
        expect(newNode.enabled).toBe(true);
        expect(newNode.bypass).toBe(false);
    });

    test('duplicateNode clones node parameters and incoming/outgoing connections', () => {
        // blank_canvas has osc_1 -> flt_1 -> master
        const copy = engine.duplicateNode('flt_1');
        expect(copy).toBeDefined();
        expect(copy.id).not.toBe('flt_1');
        expect(copy.name).toContain('Copy');
        expect(copy.params.frequency).toBe(1200);

        // Check duplicated incoming connection: osc_1 -> copy.id
        const incoming = engine.patch.connections.filter(c => c.to === copy.id);
        expect(incoming.some(c => c.from === 'osc_1')).toBe(true);

        // Check duplicated outgoing connection: copy.id -> master
        const outgoing = engine.patch.connections.filter(c => c.from === copy.id);
        expect(outgoing.some(c => c.to === 'master')).toBe(true);

        // DuplicateNode alias also works
        const copy2 = engine.DuplicateNode('osc_1');
        expect(copy2).toBeDefined();
        expect(copy2.id).not.toBe('osc_1');
    });

    test('removeNode removes the node and all connected edges', () => {
        // Add a node and connect it
        const extra = engine.addNode('gain', { gain: 1.5 });
        engine.connect('flt_1', extra.id);
        engine.connect(extra.id, 'master');

        expect(engine.patch.nodes.some(n => n.id === extra.id)).toBe(true);
        expect(engine.patch.connections.some(c => c.from === extra.id || c.to === extra.id)).toBe(true);

        const removed = engine.removeNode(extra.id);
        expect(removed).toBe(true);
        expect(engine.patch.nodes.some(n => n.id === extra.id)).toBe(false);
        expect(engine.patch.connections.some(c => c.from === extra.id || c.to === extra.id)).toBe(false);
    });

    test('updateNode modifies properties and merges params', () => {
        const updated = engine.updateNode('flt_1', {
            name: 'Renamed Lowpass',
            bypass: true,
            params: { frequency: 950 }
        });

        expect(updated).toBeDefined();
        expect(updated.name).toBe('Renamed Lowpass');
        expect(updated.bypass).toBe(true);
        expect(updated.params.frequency).toBe(950);
        expect(updated.params.Q).toBe(1.0); // original preserved
    });
});

describe('ModularAudioEngine - Connection Validation & Topology', () => {
    let engine;

    beforeEach(() => {
        engine = new ModularAudioEngine('blank_canvas');
    });

    test('connect establishes valid edge and disconnect removes it', () => {
        const noise = engine.addNode('noise');
        const ok = engine.connect(noise.id, 'flt_1');
        expect(ok).toBe(true);
        expect(engine.patch.connections.some(c => c.from === noise.id && c.to === 'flt_1')).toBe(true);

        const disconnected = engine.disconnect(noise.id, 'flt_1');
        expect(disconnected).toBe(true);
        expect(engine.patch.connections.some(c => c.from === noise.id && c.to === 'flt_1')).toBe(false);
    });

    test('Prevents duplicate connections', () => {
        // blank_canvas already has osc_1 -> flt_1
        const dup = engine.connect('osc_1', 'flt_1');
        expect(dup).toBe(false);
    });

    test('Prevents self-loops', () => {
        const selfLoop = engine.connect('flt_1', 'flt_1');
        expect(selfLoop).toBe(false);
    });

    test('Prevents cycles in audio routing', () => {
        // osc_1 -> flt_1 -> master
        // Adding flt_1 -> osc_1 would create cycle osc_1 -> flt_1 -> osc_1
        const cycle = engine.connect('flt_1', 'osc_1');
        expect(cycle).toBe(false);

        // Transitive cycle: A -> B -> C -> A
        const nA = engine.addNode('gain', {}, 'Node A');
        const nB = engine.addNode('gain', {}, 'Node B');
        const nC = engine.addNode('gain', {}, 'Node C');
        engine.connect(nA.id, nB.id);
        engine.connect(nB.id, nC.id);
        const cycleTransitive = engine.connect(nC.id, nA.id);
        expect(cycleTransitive).toBe(false);
    });

    test('rewireFiltersTopology("series") chains filters sequentially to master', () => {
        engine.loadPreset('series_peaking_formants');
        engine.rewireFiltersTopology('series');

        const filters = engine.patch.nodes.filter(n => n.type === 'filter');
        const shapers = engine.patch.nodes.filter(n => n.type === 'waveshaper');

        // Shaper should feed first filter
        const shaperToF1 = engine.patch.connections.find(c => c.from === shapers[0].id);
        expect(shaperToF1).toBeDefined();
        expect(shaperToF1.to).toBe(filters[0].id);

        // Filters chain sequentially
        for (let i = 0; i < filters.length - 1; i++) {
            const edge = engine.patch.connections.find(c => c.from === filters[i].id);
            expect(edge).toBeDefined();
            expect(edge.to).toBe(filters[i + 1].id);
        }

        // Last filter connects to master
        const lastEdge = engine.patch.connections.find(c => c.from === filters[filters.length - 1].id);
        expect(lastEdge).toBeDefined();
        expect(lastEdge.to).toBe('master');
    });

    test('rewireFiltersTopology("parallel") connects feed to every filter and each filter to master', () => {
        engine.loadPreset('series_peaking_formants');
        engine.rewireFiltersTopology('parallel');

        const filters = engine.patch.nodes.filter(n => n.type === 'filter');
        const shapers = engine.patch.nodes.filter(n => n.type === 'waveshaper');
        const feedId = shapers[0].id;

        // Feed connects to all filters
        for (const flt of filters) {
            const fromFeed = engine.patch.connections.some(c => c.from === feedId && c.to === flt.id);
            expect(fromFeed).toBe(true);

            const toMaster = engine.patch.connections.some(c => c.from === flt.id && c.to === 'master');
            expect(toMaster).toBe(true);
        }
    });
});

describe('ModularAudioEngine - calculateState Modulation Math', () => {
    test('Calculates f0 and harmonic frequencies accurately', () => {
        const engine = new ModularAudioEngine('blank_canvas');
        // blank_canvas has osc_1 at mult 1.0
        // At 3000 RPM, f0 = 3000 / 60 = 50 Hz
        const st3000 = engine.calculateState(3000, 0);
        expect(st3000.f0).toBe(50);
        expect(st3000.nodeStates['osc_1'].frequency).toBe(50);

        // At 6000 RPM, f0 = 6000 / 60 = 100 Hz
        const st6000 = engine.calculateState(6000, 0);
        expect(st6000.f0).toBe(100);
        expect(st6000.nodeStates['osc_1'].frequency).toBe(100);
    });

    test('Harmonic multipliers and fixed frequency modes', () => {
        const engine = new ModularAudioEngine('raw_harmonics');
        // sub (0.5x), fund (1.0x), h2 (2.0x), h4 (4.0x)
        const st = engine.calculateState(3600, 0); // f0 = 60 Hz
        expect(st.f0).toBe(60);
        expect(st.nodeStates['osc_sub'].frequency).toBe(30);
        expect(st.nodeStates['osc_fund'].frequency).toBe(60);
        expect(st.nodeStates['osc_h2'].frequency).toBe(120);
        expect(st.nodeStates['osc_h4'].frequency).toBe(240);

        // Fixed frequency test
        engine.addNode('oscillator', { freqMode: 'fixed', freqHz: 440 }, 'Fixed A440');
        const fixedNode = engine.patch.nodes.find(n => n.name === 'Fixed A440');
        const stFixed = engine.calculateState(1200, 0);
        expect(stFixed.nodeStates[fixedNode.id].frequency).toBe(440);
    });

    test('Normalized RPM calculation clamps between 0.0 and 1.0', () => {
        const engine = new ModularAudioEngine(); // baseRPM: 900, redlineRPM: 7500
        const stIdle = engine.calculateState(900, 0);
        expect(stIdle.rpmNorm).toBe(0.0);

        const stBelow = engine.calculateState(500, 0);
        expect(stBelow.rpmNorm).toBe(0.0);

        const stRedline = engine.calculateState(7500, 0);
        expect(stRedline.rpmNorm).toBe(1.0);

        const stAbove = engine.calculateState(9000, 0);
        expect(stAbove.rpmNorm).toBe(1.0);

        const stMid = engine.calculateState(4200, 0); // (4200 - 900) / 6600 = 3300 / 6600 = 0.5
        expect(stMid.rpmNorm).toBeCloseTo(0.5, 4);
    });

    test('Oscillator & Noise gain modulation with throttle and RPM', () => {
        const engine = new ModularAudioEngine('blank_canvas');
        const osc = engine.addNode('oscillator', {
            gain: 0.4,
            throttleModGain: 0.5,
            rpmModGain: 0.2
        });
        const noise = engine.addNode('noise', {
            gain: 0.1,
            throttleModGain: 0.3,
            rpmModGain: 0.1
        });

        // At idle and zero throttle: gain = baseGain
        const stIdle = engine.calculateState(900, 0);
        expect(stIdle.nodeStates[osc.id].gain).toBeCloseTo(0.4, 4);
        expect(stIdle.nodeStates[noise.id].gain).toBeCloseTo(0.1, 4);

        // At full throttle and redline: gain = baseGain + throttleMod + rpmMod
        const stMax = engine.calculateState(7500, 1.0);
        expect(stMax.nodeStates[osc.id].gain).toBeCloseTo(0.4 + 0.5 + 0.2, 4);
        expect(stMax.nodeStates[noise.id].gain).toBeCloseTo(0.1 + 0.3 + 0.1, 4);
    });

    test('Stationary formants vs RPM/throttle-modulated filters', () => {
        const engine = new ModularAudioEngine('series_peaking_formants');
        // Formant F1 (160 Hz) has rpmModFreq = 0, throttleModFreq = 0 (stationary acoustic cavity resonance)
        // Load Lowpass (800 Hz) has rpmModFreq = 1200, throttleModFreq = 2400 (opens up with load)

        const stIdle = engine.calculateState(900, 0);
        expect(stIdle.nodeStates['flt_f1'].frequency).toBe(160);
        expect(stIdle.nodeStates['flt_load'].frequency).toBe(800);

        const stMid = engine.calculateState(4200, 0.5); // rpmNorm = 0.5, throttle = 0.5
        expect(stMid.nodeStates['flt_f1'].frequency).toBe(160); // stationary!
        // Load lowpass shifts: 800 + 1200 * 0.5 + 2400 * 0.5 = 800 + 600 + 1200 = 2600 Hz
        expect(stMid.nodeStates['flt_load'].frequency).toBeCloseTo(2600, 1);

        const stMax = engine.calculateState(7500, 1.0); // rpmNorm = 1.0, throttle = 1.0
        expect(stMax.nodeStates['flt_f1'].frequency).toBe(160);
        // Load lowpass shifts: 800 + 1200 + 2400 = 4400 Hz
        expect(stMax.nodeStates['flt_load'].frequency).toBeCloseTo(4400, 1);
    });
});

describe('ModularAudioEngine - Solo, Mute, and Bypass Logic', () => {
    test('Soloing osc_1 in series_peaking_formants mutes sibling oscillators while keeping downstream chain active', () => {
        const engine = new ModularAudioEngine('series_peaking_formants');
        // Solo osc_1
        engine.updateNode('osc_1', { solo: true });

        const st = engine.calculateState(3000, 0.5);
        expect(st.hasSolo).toBe(true);

        // osc_1 should be active and audible
        expect(st.nodeStates['osc_1'].active).toBe(true);
        expect(st.nodeStates['osc_1'].gain).toBeGreaterThan(0);

        // osc_2 and osc_3 are not soloed and should be muted
        expect(st.nodeStates['osc_2'].active).toBe(false);
        expect(st.nodeStates['osc_2'].gain).toBe(0);
        expect(st.nodeStates['osc_3'].active).toBe(false);
        expect(st.nodeStates['osc_3'].gain).toBe(0);

        // Downstream chain nodes must remain active
        const downstreamIds = ['shaper_1', 'flt_f1', 'flt_f2', 'flt_f3', 'flt_load'];
        for (const id of downstreamIds) {
            expect(st.nodeStates[id].active).toBe(true);
        }

        // Unsoloing restores normal state
        engine.updateNode('osc_1', { solo: false });
        const stRestored = engine.calculateState(3000, 0.5);
        expect(stRestored.hasSolo).toBe(false);
        expect(stRestored.nodeStates['osc_2'].gain).toBeGreaterThan(0);
        expect(stRestored.nodeStates['osc_3'].gain).toBeGreaterThan(0);
    });

    test('Soloing flt_bp2 in parallel_bandpass_bank keeps upstream sources and flt_bp2 active while muting sibling filters', () => {
        const engine = new ModularAudioEngine('parallel_bandpass_bank');
        engine.updateNode('flt_bp2', { solo: true });

        const st = engine.calculateState(3000, 0.5);
        expect(st.hasSolo).toBe(true);

        // Upstream sources must remain active
        expect(st.nodeStates['osc_1'].active).toBe(true);
        expect(st.nodeStates['osc_1'].gain).toBeGreaterThan(0);
        expect(st.nodeStates['osc_2'].active).toBe(true);
        expect(st.nodeStates['osc_2'].gain).toBeGreaterThan(0);
        expect(st.nodeStates['noise_1'].active).toBe(true);
        expect(st.nodeStates['noise_1'].gain).toBeGreaterThan(0);

        // flt_bp2 is soloed and active
        expect(st.nodeStates['flt_bp2'].active).toBe(true);
        expect(st.nodeStates['flt_bp2'].outGain).toBeGreaterThan(0);

        // Sibling filters flt_bp1 and flt_bp3 must be muted
        expect(st.nodeStates['flt_bp1'].active).toBe(false);
        expect(st.nodeStates['flt_bp1'].outGain).toBe(0);
        expect(st.nodeStates['flt_bp3'].active).toBe(false);
        expect(st.nodeStates['flt_bp3'].outGain).toBe(0);
    });

    test('Soloing both osc_1 and flt_bp2 in parallel_bandpass_bank isolates single path and mutes other sources and filters', () => {
        const engine = new ModularAudioEngine('parallel_bandpass_bank');
        engine.updateNode('osc_1', { solo: true });
        engine.updateNode('flt_bp2', { solo: true });

        const st = engine.calculateState(3000, 0.5);
        expect(st.hasSolo).toBe(true);

        // Only osc_1 and flt_bp2 remain active
        expect(st.nodeStates['osc_1'].active).toBe(true);
        expect(st.nodeStates['osc_1'].gain).toBeGreaterThan(0);
        expect(st.nodeStates['flt_bp2'].active).toBe(true);
        expect(st.nodeStates['flt_bp2'].outGain).toBeGreaterThan(0);

        // osc_2, noise_1, flt_bp1, and flt_bp3 must be muted
        expect(st.nodeStates['osc_2'].active).toBe(false);
        expect(st.nodeStates['osc_2'].gain).toBe(0);
        expect(st.nodeStates['noise_1'].active).toBe(false);
        expect(st.nodeStates['noise_1'].gain).toBe(0);
        expect(st.nodeStates['flt_bp1'].active).toBe(false);
        expect(st.nodeStates['flt_bp1'].outGain).toBe(0);
        expect(st.nodeStates['flt_bp3'].active).toBe(false);
        expect(st.nodeStates['flt_bp3'].outGain).toBe(0);
    });

    test('Disabled node has active=false and gain=0', () => {
        const engine = new ModularAudioEngine('blank_canvas');
        engine.updateNode('osc_1', { enabled: false });

        const st = engine.calculateState(3000, 0.5);
        expect(st.nodeStates['osc_1'].enabled).toBe(false);
        expect(st.nodeStates['osc_1'].active).toBe(false);
        expect(st.nodeStates['osc_1'].gain).toBe(0);
    });

    test('Bypass parameter behavior across node types', () => {
        const engine = new ModularAudioEngine('comb_waveguide_lab');

        // Bypass delay and waveshaper
        engine.updateNode('delay_1', { bypass: true });
        engine.updateNode('shaper_1', { bypass: true });

        const st = engine.calculateState(3000, 0.5);
        expect(st.nodeStates['delay_1'].bypass).toBe(true);
        expect(st.nodeStates['delay_1'].mix).toBe(0); // Dry pass-through

        expect(st.nodeStates['shaper_1'].bypass).toBe(true);
        expect(st.nodeStates['shaper_1'].mix).toBe(0); // Dry pass-through
    });
});

describe('ModularAudioEngine - Biquad Frequency Response & Filter Fallback', () => {
    let engine;

    beforeEach(() => {
        engine = new ModularAudioEngine();
    });

    test('Bypassed filter returns 0 dB across all test frequencies', () => {
        engine.updateNode('flt_f1', { bypass: true });
        const testFreqs = new Float32Array([50, 160, 500, 1000, 5000]);
        const response = engine.getFilterFrequencyResponse('flt_f1', testFreqs);

        expect(response.length).toBe(testFreqs.length);
        for (let i = 0; i < response.length; i++) {
            expect(response[i]).toBe(0);
        }
    });

    test('Peaking filter exhibits boost at center frequency and ~0 dB far away', () => {
        // Formant F1 is peaking filter at 160 Hz with +8 dB boost, Q = 3.0
        const testFreqs = new Float32Array([20, 160, 2000]);
        const response = engine.getFilterFrequencyResponse('flt_f1', testFreqs);

        // At center frequency (160 Hz), response should be very close to +8 dB
        expect(response[1]).toBeCloseTo(8.0, 1);

        // Far away from center, response approaches 0 dB
        expect(response[0]).toBeCloseTo(0, 1);
        expect(response[2]).toBeCloseTo(0, 1);
    });

    test('Lowpass filter passes low frequencies and attenuates high frequencies', () => {
        // Load lowpass at idle has 800 Hz cutoff, Q = 1.0 (so response at cutoff equals Q = 1.0 -> 0 dB)
        const testFreqs = new Float32Array([100, 800, 2000, 8000]);
        const response = engine.getFilterFrequencyResponse('flt_load', testFreqs);

        // Well below cutoff (100 Hz): close to 0 dB
        expect(response[0]).toBeCloseTo(0, 0);

        // At resonance/cutoff (800 Hz) with Q = 1.0: response matches Q in dB (0 dB)
        expect(response[1]).toBeCloseTo(0, 1);

        // Above cutoff (2000 Hz): attenuated
        expect(response[2]).toBeLessThan(-10);

        // Well above cutoff (8000 Hz): deeply attenuated
        expect(response[3]).toBeLessThan(-30);

        // Set Butterworth Q = 0.7071: response at cutoff should be ~ -3 dB
        engine.updateNode('flt_load', { params: { Q: 0.7071 } });
        const bwResponse = engine.getFilterFrequencyResponse('flt_load', new Float32Array([800]));
        expect(bwResponse[0]).toBeCloseTo(-3.0, 1);
    });

    test('Bandpass filter peaks at center frequency and rolls off on both sides', () => {
        engine.loadPreset('parallel_bandpass_bank');
        // flt_bp2 is bandpass at 780 Hz
        const testFreqs = new Float32Array([100, 780, 5000]);
        const response = engine.getFilterFrequencyResponse('flt_bp2', testFreqs);

        // Peak at 780 Hz should be ~0 dB
        expect(response[1]).toBeCloseTo(0, 1);

        // Substantially attenuated below and above
        expect(response[0]).toBeLessThan(-10);
        expect(response[2]).toBeLessThan(-10);
    });
});

describe('ModularAudioEngine - Topology-Aware Composite Filter Response', () => {
    test('Series chain composite dB response equals the sum of individual filter dB responses', () => {
        const engine = new ModularAudioEngine('series_peaking_formants');
        const testFreqs = new Float32Array([100, 160, 520, 800, 1250, 3000]);
        const compositeDb = engine.getCompositeFilterFrequencyResponse(testFreqs);

        const activeFilters = engine.patch.nodes.filter(n => n.type === 'filter' && n.enabled);
        expect(activeFilters.length).toBe(4);

        const individualDbs = activeFilters.map(f => engine.getFilterFrequencyResponse(f.id, testFreqs));

        expect(compositeDb.length).toBe(testFreqs.length);
        for (let i = 0; i < testFreqs.length; i++) {
            let expectedSum = 0;
            for (const indDb of individualDbs) {
                expectedSum += indDb[i];
            }
            expect(compositeDb[i]).toBeCloseTo(expectedSum, 3);
        }
    });

    test('Parallel bandpass bank preserves strong passband peaks > -6 dB instead of summing stopband attenuation', () => {
        const engine = new ModularAudioEngine('parallel_bandpass_bank');
        const centerFreqs = new Float32Array([220, 780, 1650]);
        const compositeDb = engine.getCompositeFilterFrequencyResponse(centerFreqs);

        // Verify that composite response at resonant center frequencies exhibits strong peaks (> -6 dB)
        for (let i = 0; i < centerFreqs.length; i++) {
            expect(compositeDb[i]).toBeGreaterThan(-6.0);
        }

        // Contrast with naive dB summing where stopbands add to <= -40 dB
        const activeFilters = engine.patch.nodes.filter(n => n.type === 'filter' && n.enabled);
        const individualDbs = activeFilters.map(f => engine.getFilterFrequencyResponse(f.id, centerFreqs));
        for (let i = 0; i < centerFreqs.length; i++) {
            let naiveSum = 0;
            for (const indDb of individualDbs) {
                naiveSum += indDb[i];
            }
            expect(naiveSum).toBeLessThan(-40);
        }
    });

    test('Returns array of zeros when no active filters are present', () => {
        const engine = new ModularAudioEngine('blank_canvas');
        engine.updateNode('flt_1', { enabled: false });

        const testFreqs = new Float32Array([100, 500, 1000]);
        const compositeDb = engine.getCompositeFilterFrequencyResponse(testFreqs);

        expect(compositeDb.length).toBe(testFreqs.length);
        for (let i = 0; i < compositeDb.length; i++) {
            expect(compositeDb[i]).toBe(0);
        }
    });

    test('Propagates series reachability through intermediate non-filter nodes', () => {
        const engine = new ModularAudioEngine('blank_canvas');
        // flt_1 is lowpass at 1200 Hz
        // Add a gain node and a second filter flt_2
        const gainNode = engine.addNode('gain', { gain: 1.0 }, 'Inter Gain');
        const flt2 = engine.addNode('filter', { filterType: 'highpass', frequency: 300, Q: 1.0 }, 'Post Highpass');

        // Rewire: osc_1 -> flt_1 -> gainNode -> flt2 -> master
        engine.disconnect('flt_1', 'master');
        engine.connect('flt_1', gainNode.id);
        engine.connect(gainNode.id, flt2.id);
        engine.connect(flt2.id, 'master');

        const testFreqs = new Float32Array([200, 600, 2000]);
        const compositeDb = engine.getCompositeFilterFrequencyResponse(testFreqs);

        const db1 = engine.getFilterFrequencyResponse('flt_1', testFreqs);
        const db2 = engine.getFilterFrequencyResponse(flt2.id, testFreqs);

        for (let i = 0; i < testFreqs.length; i++) {
            expect(compositeDb[i]).toBeCloseTo(db1[i] + db2[i], 3);
        }
    });
});

describe('ModularAudioEngine - Web Audio Lifecycle & Mock Integration', () => {
    class MockAudioNode {
        constructor() {
            const gain = { setValueAtTime: jest.fn((v) => { gain.value = v; }), value: 1 };
            this.gain = gain;
            const frequency = { setValueAtTime: jest.fn((v) => { frequency.value = v; }), value: 440 };
            this.frequency = frequency;
            const detune = { setValueAtTime: jest.fn((v) => { detune.value = v; }), value: 0 };
            this.detune = detune;
            const Q = { setValueAtTime: jest.fn((v) => { Q.value = v; }), value: 1 };
            this.Q = Q;
            const delayTime = { setValueAtTime: jest.fn((v) => { delayTime.value = v; }), value: 0 };
            this.delayTime = delayTime;
        }
        connect = jest.fn();
        disconnect = jest.fn();
        start = jest.fn();
        stop = jest.fn();
    }

    class MockBiquadFilter extends MockAudioNode {
        getFrequencyResponse = jest.fn((freqs, magOutput, phaseOutput) => {
            for (let i = 0; i < freqs.length; i++) {
                magOutput[i] = 1.0; // 0 dB
                phaseOutput[i] = 0;
            }
        });
    }

    class MockAudioContext {
        currentTime = 0;
        sampleRate = 48000;
        state = 'running';
        destination = new MockAudioNode();
        createGain() { return new MockAudioNode(); }
        createOscillator() { return new MockAudioNode(); }
        createBiquadFilter() { return new MockBiquadFilter(); }
        createWaveShaper() { return new MockAudioNode(); }
        createDelay() { return new MockAudioNode(); }
        createBufferSource() { return new MockAudioNode(); }
        createAnalyser() {
            const a = new MockAudioNode();
            a.fftSize = 2048;
            return a;
        }
        createBuffer(channels, length, sampleRate) {
            return {
                getChannelData: () => new Float32Array(length)
            };
        }
        close = jest.fn().mockResolvedValue();
        resume = jest.fn().mockResolvedValue();
    }

    test('Gracefully handles init and stop in environments without native AudioContext', () => {
        const engine = new ModularAudioEngine('blank_canvas');
        expect(engine.isPlaying).toBe(false);

        // Should not throw even in Node.js where AudioContext is undefined
        expect(() => engine.init()).not.toThrow();
        expect(engine.isPlaying).toBe(true);

        expect(() => engine.update(2500, 0.4)).not.toThrow();
        expect(() => engine.stop()).not.toThrow();
        expect(engine.isPlaying).toBe(false);
    });

    test('Integrates with Web Audio mock context if present', () => {
        globalThis.AudioContext = MockAudioContext;

        const engine = new ModularAudioEngine('blank_canvas');
        engine.init();

        expect(engine.ctx).toBeDefined();
        expect(engine.isPlaying).toBe(true);
        expect(engine.getMasterGain()).toBeDefined();
        expect(engine.getAnalyser()).toBeDefined();

        // Updating live engine
        const state = engine.update(4000, 0.7);
        expect(state.rpm).toBe(4000);
        expect(state.throttle).toBe(0.7);

        // Filter response using mock getFrequencyResponse
        const testFreqs = new Float32Array([100, 1000]);
        const response = engine.getFilterFrequencyResponse('flt_1', testFreqs);
        expect(response[0]).toBeCloseTo(0, 2);

        // Teardown
        engine.stop();
        expect(engine.isPlaying).toBe(false);
        expect(engine.ctx).toBeNull();

        delete globalThis.AudioContext;
    });

    test('Live WaveShaperNode drive curve regeneration updates curve in place when active', () => {
        globalThis.AudioContext = MockAudioContext;
        try {
            const engine = new ModularAudioEngine('series_peaking_formants');
            engine.init();

            const shaperNodeObj = engine.audioNodes.get('shaper_1');
            expect(shaperNodeObj).toBeDefined();
            expect(shaperNodeObj.shaperNode).toBeDefined();

            const initialCurve = shaperNodeObj.shaperNode.curve;
            expect(initialCurve).toBeInstanceOf(Float32Array);
            expect(initialCurve.length).toBe(2048);

            // In soft_tanh with drive: 25, mid-range point (sample index 1228 corresponding to x ~ 0.2)
            const testIndex = 1228;
            const initialVal = initialCurve[testIndex];

            // Keep reference to initial oscillator to confirm oscillators are not torn down/recreated
            const initialOscNode = engine.audioNodes.get('osc_1')?.oscNode;
            expect(initialOscNode).toBeDefined();

            // Calling updateNode with drive: 80
            engine.updateNode('shaper_1', { params: { drive: 80 } });

            const updatedLiveShaper = engine.audioNodes.get('shaper_1');
            expect(updatedLiveShaper).toBe(shaperNodeObj);

            const updatedCurve = updatedLiveShaper.shaperNode.curve;
            expect(updatedCurve).toBeInstanceOf(Float32Array);
            expect(updatedCurve).not.toBe(initialCurve);
            expect(updatedCurve.length).toBe(2048);

            // With higher drive saturation (80 vs 25), the transfer curve saturates faster towards 1.0
            expect(updatedCurve[testIndex]).toBeGreaterThan(initialVal);

            // Confirm graph was not rebuilt (oscillator instance unchanged)
            expect(engine.audioNodes.get('osc_1')?.oscNode).toBe(initialOscNode);

            // Confirm patch node params reflect the update
            const patchNode = engine.patch.nodes.find(n => n.id === 'shaper_1');
            expect(patchNode.params.drive).toBe(80);

            // Also test live curveType change in place
            engine.updateNode('shaper_1', { params: { curveType: 'hard_clip' } });
            const hardClipCurve = engine.audioNodes.get('shaper_1').shaperNode.curve;
            expect(hardClipCurve).not.toBe(updatedCurve);
            expect(hardClipCurve).toBeInstanceOf(Float32Array);
            expect(engine.audioNodes.get('osc_1')?.oscNode).toBe(initialOscNode);

            engine.stop();
        } finally {
            delete globalThis.AudioContext;
        }
    });

    test('Muting a delay node sets outGain to 0 and updates live output gain to 0', () => {
        globalThis.AudioContext = MockAudioContext;
        try {
            const engine = new ModularAudioEngine('comb_waveguide_lab');

            // Verify state when enabled
            let state = engine.calculateState(3000, 0.5);
            expect(state.nodeStates['delay_1'].enabled).toBe(true);
            expect(state.nodeStates['delay_1'].outGain).toBe(1);

            // Verify state when muted (enabled: false)
            engine.updateNode('delay_1', { enabled: false });
            state = engine.calculateState(3000, 0.5);
            expect(state.nodeStates['delay_1'].enabled).toBe(false);
            expect(state.nodeStates['delay_1'].outGain).toBe(0);

            // Verify state when re-enabled
            engine.updateNode('delay_1', { enabled: true });
            state = engine.calculateState(3000, 0.5);
            expect(state.nodeStates['delay_1'].enabled).toBe(true);
            expect(state.nodeStates['delay_1'].outGain).toBe(1);

            // Initialize engine with mock AudioContext
            engine.init();
            const delayLive = engine.audioNodes.get('delay_1');
            expect(delayLive).toBeDefined();
            expect(delayLive.output.gain.value).toBe(1);

            // Muting delay_1 while engine is active updates live output gain value to 0
            engine.updateNode('delay_1', { enabled: false });
            expect(engine.calculateState(3000, 0.5).nodeStates['delay_1'].outGain).toBe(0);
            expect(delayLive.output.gain.value).toBe(0);
            expect(delayLive.output.gain.setValueAtTime).toHaveBeenCalledWith(0, expect.any(Number));

            // Re-enabling delay_1 restores live output gain value to 1
            engine.updateNode('delay_1', { enabled: true });
            expect(engine.calculateState(3000, 0.5).nodeStates['delay_1'].outGain).toBe(1);
            expect(delayLive.output.gain.value).toBe(1);
            expect(delayLive.output.gain.setValueAtTime).toHaveBeenCalledWith(1, expect.any(Number));

            engine.stop();
        } finally {
            delete globalThis.AudioContext;
        }
    });

    test('Consistent Q mapping between Web Audio BiquadFilterNode (dB for lowpass/highpass) and RBJ cookbook Q', () => {
        globalThis.AudioContext = MockAudioContext;
        try {
            const engine = new ModularAudioEngine('blank_canvas');

            // 1. Direct verification of _toWebAudioQ helper
            // Lowpass and highpass: Q_dB = 20 * log10(Q)
            expect(engine._toWebAudioQ('lowpass', 1.0)).toBeCloseTo(0, 5);
            expect(engine._toWebAudioQ('lowpass', 0.70710678)).toBeCloseTo(-3.0103, 3);
            expect(engine._toWebAudioQ('lowpass', 2.0)).toBeCloseTo(6.0206, 3);
            expect(engine._toWebAudioQ('highpass', 1.0)).toBeCloseTo(0, 5);
            expect(engine._toWebAudioQ('highpass', 2.0)).toBeCloseTo(6.0206, 3);

            // Peaking and bandpass: dimensionless Q preserved directly
            expect(engine._toWebAudioQ('peaking', 2.0)).toBe(2.0);
            expect(engine._toWebAudioQ('peaking', 4.5)).toBe(4.5);
            expect(engine._toWebAudioQ('bandpass', 3.0)).toBe(3.0);
            expect(engine._toWebAudioQ('notch', 5.0)).toBe(5.0);

            // 2. Integration in buildGraph() and update() with live filterNode
            const fltLP = engine.addNode('filter', { filterType: 'lowpass', Q: 1.0, frequency: 1000 }, 'Test LP');
            const fltHP = engine.addNode('filter', { filterType: 'highpass', Q: 2.0, frequency: 200 }, 'Test HP');
            const fltPeak = engine.addNode('filter', { filterType: 'peaking', Q: 3.5, frequency: 800 }, 'Test Peak');
            const fltBP = engine.addNode('filter', { filterType: 'bandpass', Q: 4.0, frequency: 1200 }, 'Test BP');

            engine.connect('osc_1', fltLP.id);
            engine.connect(fltLP.id, fltHP.id);
            engine.connect(fltHP.id, fltPeak.id);
            engine.connect(fltPeak.id, fltBP.id);
            engine.connect(fltBP.id, 'master');

            engine.init();

            const lpLive = engine.audioNodes.get(fltLP.id);
            const hpLive = engine.audioNodes.get(fltHP.id);
            const peakLive = engine.audioNodes.get(fltPeak.id);
            const bpLive = engine.audioNodes.get(fltBP.id);

            // Verify buildGraph() converted Q values properly for Web Audio biquad
            expect(lpLive.filterNode.Q.value).toBeCloseTo(0, 5); // 20 * log10(1.0) = 0 dB
            expect(hpLive.filterNode.Q.value).toBeCloseTo(6.0206, 3); // 20 * log10(2.0) = 6.0206 dB
            expect(peakLive.filterNode.Q.value).toBe(3.5); // Dimensionless Q
            expect(bpLive.filterNode.Q.value).toBe(4.0); // Dimensionless Q

            // Update Q via updateNode and update(rpm, throttle)
            engine.updateNode(fltLP.id, { params: { Q: 0.70710678 } });
            engine.updateNode(fltHP.id, { params: { Q: 4.0 } });
            engine.updateNode(fltPeak.id, { params: { Q: 6.0 } });
            engine.updateNode(fltBP.id, { params: { Q: 8.5 } });

            engine.update(3000, 0.5);

            expect(lpLive.filterNode.Q.value).toBeCloseTo(-3.0103, 3); // 20 * log10(0.70710678) = -3.0103 dB
            expect(hpLive.filterNode.Q.value).toBeCloseTo(12.0412, 3); // 20 * log10(4.0) = 12.0412 dB
            expect(peakLive.filterNode.Q.value).toBe(6.0); // Dimensionless Q
            expect(bpLive.filterNode.Q.value).toBe(8.5); // Dimensionless Q

            engine.stop();
        } finally {
            delete globalThis.AudioContext;
        }
    });
});

describe('Boxer-6 (boxer_6_cayman) Acoustic & Load-RPM Verification', () => {
    let engine;

    beforeEach(() => {
        engine = new ModularAudioEngine('boxer_6_cayman');
    });

    test('1. Steep -24 dB/oct High-Frequency Roll-Off & Buzz Rejection', () => {
        // Idle (900 RPM, 0% Throttle)
        engine.currentRPM = 900;
        engine.currentThrottle = 0;
        const stateIdle = engine.calculateState(900, 0);
        expect(stateIdle.nodeStates['flt_exh_lp'].frequency).toBe(240);
        expect(stateIdle.nodeStates['flt_exh_lp2'].frequency).toBe(360);

        const comp145 = engine.getCompositeFilterFrequencyResponse([145])[0];
        const comp2500 = engine.getCompositeFilterFrequencyResponse([2500])[0];
        const idleAtten = comp2500 - comp145;
        // Composite response at 2500 Hz is attenuated by more than -45 dB relative to 145 Hz
        expect(idleAtten).toBeLessThan(-45);

        // In 3,000-6,000 RPM range (e.g. 4500 RPM, 50% Throttle)
        engine.currentRPM = 4500;
        engine.currentThrottle = 0.5;
        const dualLp150 = engine.getFilterFrequencyResponse('flt_exh_lp', [150])[0] +
                          engine.getFilterFrequencyResponse('flt_exh_lp2', [150])[0];
        const dualLp350 = engine.getFilterFrequencyResponse('flt_exh_lp', [350])[0] +
                          engine.getFilterFrequencyResponse('flt_exh_lp2', [350])[0];
        const dualLp3500 = engine.getFilterFrequencyResponse('flt_exh_lp', [3500])[0] +
                           engine.getFilterFrequencyResponse('flt_exh_lp2', [3500])[0];

        // Cascaded dual lowpass attenuates harsh 3500 Hz synth buzz by at least -25 dB relative to 150-350 Hz body band
        expect(dualLp3500 - dualLp150).toBeLessThanOrEqual(-25);
        expect(dualLp3500 - dualLp350).toBeLessThanOrEqual(-25);

        // Also verify composite response attenuation
        const compBodyMid = engine.getCompositeFilterFrequencyResponse([250])[0];
        const compBuzz = engine.getCompositeFilterFrequencyResponse([3500])[0];
        expect(compBuzz - compBodyMid).toBeLessThan(-25);
    });

    test('2. Strong Low & Low-Mid Body (60–350 Hz) Across 3,000–6,000 RPM', () => {
        const testRPMs = [3500, 4500, 5500];
        const throttle = 0.60;

        for (const rpm of testRPMs) {
            const state = engine.calculateState(rpm, throttle);
            engine.currentRPM = rpm;
            engine.currentThrottle = throttle;

            const f0 = rpm / 60;
            const fBlock = state.nodeStates['osc_block10'].frequency;
            const fBank = state.nodeStates['osc_bank15'].frequency;

            // osc_block10 (1.0x, 58–92 Hz)
            expect(fBlock).toBeCloseTo(f0 * 1.0, 1);
            expect(fBlock).toBeGreaterThanOrEqual(58);
            expect(fBlock).toBeLessThanOrEqual(92);
            expect(state.nodeStates['osc_block10'].gain).toBeGreaterThan(0.65);

            // osc_bank15 (1.5x, 87.5–137.5 Hz)
            expect(fBank).toBeCloseTo(f0 * 1.5, 1);
            expect(fBank).toBeGreaterThanOrEqual(87.5);
            expect(fBank).toBeLessThanOrEqual(137.5);
            expect(state.nodeStates['osc_bank15'].gain).toBeGreaterThan(0.65);

            // Composite filter response across 100-350 Hz body band provides warm positive boost (> +3 dB average across [145, 220, 300] Hz)
            const r145 = engine.getCompositeFilterFrequencyResponse([145])[0];
            const r220 = engine.getCompositeFilterFrequencyResponse([220])[0];
            const r300 = engine.getCompositeFilterFrequencyResponse([300])[0];
            const avgBoost = (r145 + r220 + r300) / 3;

            expect(avgBoost).toBeGreaterThan(3.0);
            expect(r145).toBeGreaterThan(3.0);
            expect(r220).toBeGreaterThan(3.0);
            expect(r300).toBeGreaterThan(3.0);
        }
    });

    test('3. Load Sensitivity (0% Overrun vs 100% WOT at 4500 RPM and 6000 RPM)', () => {
        for (const rpm of [4500, 6000]) {
            const sOverrun = engine.calculateState(rpm, 0);
            const sWot = engine.calculateState(rpm, 1);

            // Opening throttle from 0% to 100% opens both flt_exh_lp (+550 Hz) and flt_exh_lp2 (+750 Hz)
            const shiftLP1 = sWot.nodeStates['flt_exh_lp'].frequency - sOverrun.nodeStates['flt_exh_lp'].frequency;
            const shiftLP2 = sWot.nodeStates['flt_exh_lp2'].frequency - sOverrun.nodeStates['flt_exh_lp2'].frequency;
            expect(shiftLP1).toBeCloseTo(550, 1);
            expect(shiftLP2).toBeCloseTo(750, 1);

            // Increases combustion turbulence (noise_intake)
            expect(sWot.nodeStates['noise_intake'].gain).toBeGreaterThan(sOverrun.nodeStates['noise_intake'].gain);
            expect(sWot.nodeStates['noise_intake'].gain - sOverrun.nodeStates['noise_intake'].gain).toBeCloseTo(0.38, 2);

            // Raises composite filter response at 900 Hz by at least +10 dB
            engine.currentRPM = rpm;
            engine.currentThrottle = 0;
            const comp900_overrun = engine.getCompositeFilterFrequencyResponse([900])[0];
            engine.currentThrottle = 1;
            const comp900_wot = engine.getCompositeFilterFrequencyResponse([900])[0];
            const diff900 = comp900_wot - comp900_overrun;

            if (rpm === 4500) {
                expect(diff900).toBeGreaterThanOrEqual(10.0);
            } else {
                expect(diff900).toBeGreaterThanOrEqual(9.5);
                // Also at 1000 Hz at 6000 RPM it increases by > +10 dB
                engine.currentThrottle = 0;
                const comp1000_overrun = engine.getCompositeFilterFrequencyResponse([1000])[0];
                engine.currentThrottle = 1;
                const comp1000_wot = engine.getCompositeFilterFrequencyResponse([1000])[0];
                expect(comp1000_wot - comp1000_overrun).toBeGreaterThanOrEqual(10.0);
            }
        }
    });

    test('4. Monotonic Spectral Centroid & Smooth Sweep Continuity (900–7400 RPM)', () => {
        const operatingPoints = [
            { rpm: 900, throttle: 0.0, label: 'Idle' },
            { rpm: 2800, throttle: 0.4, label: 'Low-Mid' },
            { rpm: 5200, throttle: 0.8, label: 'High' },
            { rpm: 7400, throttle: 1.0, label: 'Redline WOT' }
        ];

        const centroids = [];
        const fire30Gains = [];
        const wail60Gains = [];
        const oscIds = ['osc_block10', 'osc_bank15', 'osc_fire30', 'osc_bank45', 'osc_wail60'];

        for (const pt of operatingPoints) {
            const state = engine.calculateState(pt.rpm, pt.throttle);
            const g30 = state.nodeStates['osc_fire30'].gain;
            const g60 = state.nodeStates['osc_wail60'].gain;

            fire30Gains.push(g30);
            wail60Gains.push(g60);

            let num = 0;
            let den = 0;
            for (const id of oscIds) {
                const st = state.nodeStates[id];
                num += st.frequency * st.gain;
                den += st.gain;
            }
            centroids.push(num / den);
        }

        // osc_fire30 and osc_wail60 grow with RPM and throttle
        for (let i = 1; i < operatingPoints.length; i++) {
            expect(fire30Gains[i]).toBeGreaterThan(fire30Gains[i - 1]);
            expect(wail60Gains[i]).toBeGreaterThan(wail60Gains[i - 1]);
        }
        expect(fire30Gains[3] / fire30Gains[0]).toBeGreaterThan(1.8);
        expect(wail60Gains[3] / wail60Gains[0]).toBeGreaterThan(3.5);

        // Weighted oscillator spectral centroid increases monotonically
        for (let i = 1; i < centroids.length; i++) {
            expect(centroids[i]).toBeGreaterThan(centroids[i - 1]);
        }

        // Smooth RPM sweep continuity (900 to 7400 RPM in 100 RPM steps)
        let prevF15 = 0;
        let prevF30 = 0;
        let prevF60 = 0;
        let crossed145_f15 = false;
        let crossed145_f30 = false;
        let crossed275_f30 = false;
        let crossed680_f60 = false;

        for (let rpm = 900; rpm <= 7400; rpm += 100) {
            const state = engine.calculateState(rpm, 0.5);

            for (const [id, ns] of Object.entries(state.nodeStates)) {
                if (ns.frequency !== undefined) {
                    expect(Number.isNaN(ns.frequency)).toBe(false);
                    expect(Number.isFinite(ns.frequency)).toBe(true);
                    expect(ns.frequency).toBeGreaterThan(0);
                    expect(ns.frequency).toBeLessThanOrEqual(20000);
                }
                if (ns.gain !== undefined) {
                    expect(Number.isNaN(ns.gain)).toBe(false);
                    expect(Number.isFinite(ns.gain)).toBe(true);
                    expect(ns.gain).toBeGreaterThanOrEqual(0);
                }
            }

            const f15 = state.nodeStates['osc_bank15'].frequency;
            const f30 = state.nodeStates['osc_fire30'].frequency;
            const f60 = state.nodeStates['osc_wail60'].frequency;

            if (rpm > 900) {
                expect(f15).toBeGreaterThan(prevF15);
                expect(f30).toBeGreaterThan(prevF30);
                expect(f60).toBeGreaterThan(prevF60);
            }

            if (f15 >= 145 && prevF15 < 145) crossed145_f15 = true;
            if (f30 >= 145 && prevF30 < 145) crossed145_f30 = true;
            if (f30 >= 275 && prevF30 < 275) crossed275_f30 = true;
            if (f60 >= 680 && prevF60 < 680) crossed680_f60 = true;

            prevF15 = f15;
            prevF30 = f30;
            prevF60 = f60;
        }

        expect(crossed145_f15).toBe(true);
        expect(crossed145_f30).toBe(true);
        expect(crossed275_f30).toBe(true);
        expect(crossed680_f60).toBe(true);
    });
});
