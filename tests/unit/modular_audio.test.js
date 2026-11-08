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
    test('Soloing a node mutes non-soloed nodes', () => {
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

        // Unsoloing restores normal state
        engine.updateNode('osc_1', { solo: false });
        const stRestored = engine.calculateState(3000, 0.5);
        expect(stRestored.hasSolo).toBe(false);
        expect(stRestored.nodeStates['osc_2'].gain).toBeGreaterThan(0);
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

describe('ModularAudioEngine - Web Audio Lifecycle & Mock Integration', () => {
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
        // Construct a mock AudioContext
        class MockAudioNode {
            constructor() {
                this.gain = { setValueAtTime: jest.fn(), value: 1 };
                this.frequency = { setValueAtTime: jest.fn(), value: 440 };
                this.detune = { setValueAtTime: jest.fn(), value: 0 };
                this.Q = { setValueAtTime: jest.fn(), value: 1 };
                this.delayTime = { setValueAtTime: jest.fn(), value: 0 };
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
});
