import { test, expect } from '@playwright/test';

test.describe('Modular DSP Audio Workbench E2E Suite', () => {

    test('Loads workbench UI and verifies core layout components', async ({ page }) => {
        await page.goto('/src/modular_tuner.html');

        // 1. Verify Header title, navigation link, preset selector
        await expect(page).toHaveTitle(/MODULAR DSP WORKBENCH/);
        const headerTitle = page.locator('h1');
        await expect(headerTitle).toContainText('MODULAR DSP WORKBENCH');

        const classicLink = page.locator('#link-classic-tuner');
        await expect(classicLink).toBeVisible();
        await expect(classicLink).toHaveAttribute('href', './audio_tuner.html');

        const presetSelect = page.locator('#preset-select');
        await expect(presetSelect).toBeVisible();
        await expect(presetSelect).toHaveValue('series_peaking_formants');

        // Verify Patch Bay, Visualizers, and Rack exist
        const patchBay = page.locator('#patch-bay');
        await expect(patchBay).toBeVisible();

        const spectrumCanvas = page.locator('#spectrum-canvas');
        await expect(spectrumCanvas).toBeVisible();

        const scopeCanvas = page.locator('#scope-canvas');
        await expect(scopeCanvas).toBeVisible();

        const jsonIO = page.locator('#json-io');
        await expect(jsonIO).toBeVisible();

        // Verify initial node cards count for 'series_peaking_formants' (8 nodes)
        const initialCards = page.locator('.node-card');
        await expect(initialCards).toHaveCount(8);
    });

    test('Adds new nodes and updates node rack cards count', async ({ page }) => {
        await page.goto('/src/modular_tuner.html');

        const initialCards = page.locator('.node-card');
        await expect(initialCards).toHaveCount(8);

        // Add Oscillator
        await page.locator('#btn-add-osc').click();
        await expect(page.locator('.node-card')).toHaveCount(9);

        // Add Filter
        await page.locator('#btn-add-filter').click();
        await expect(page.locator('.node-card')).toHaveCount(10);

        // Verify node count display
        const countDisplay = page.locator('#nodes-count-display');
        await expect(countDisplay).toHaveText('10');
    });

    test('Connects and disconnects nodes via dropdown and routing pills', async ({ page }) => {
        await page.goto('/src/modular_tuner.html');

        // Add a fresh filter node
        await page.locator('#btn-add-filter').click();
        const cards = page.locator('.node-card');
        const lastCard = cards.last();
        const lastNodeId = await lastCard.getAttribute('data-node-id');
        expect(lastNodeId).toBeTruthy();

        // Connect the new node to 'master' via the card's .connect-target-select dropdown
        const targetSelect = lastCard.locator('.connect-target-select');
        await targetSelect.selectOption('master');

        // Verify connection exists in engine.patch.connections
        const hasMasterConn = await page.evaluate((nodeId) => {
            return window.engine.patch.connections.some(c => c.from === nodeId && c.to === 'master');
        }, lastNodeId);
        expect(hasMasterConn).toBe(true);

        // Verify routing pill is rendered in the card
        const pill = lastCard.locator('.routing-pill').first();
        await expect(pill).toBeVisible();
        await expect(pill).toContainText('Master Out');

        // Disconnect using the pill's delete button
        const pillDel = pill.locator('.pill-del');
        await pillDel.click();

        // Verify connection is removed
        const hasMasterConnAfter = await page.evaluate((nodeId) => {
            return window.engine.patch.connections.some(c => c.from === nodeId && c.to === 'master');
        }, lastNodeId);
        expect(hasMasterConnAfter).toBe(false);
    });

    test('Switches presets and wires filters series / parallel', async ({ page }) => {
        await page.goto('/src/modular_tuner.html');

        // Switch to parallel_bandpass_bank preset
        const presetSelect = page.locator('#preset-select');
        await presetSelect.selectOption('parallel_bandpass_bank');

        // Verify nodes count (3 sources + 3 filters = 6 nodes)
        await expect(page.locator('.node-card')).toHaveCount(6);

        // Click Wire Filters Series
        await page.locator('#btn-wire-series').click();
        const seriesConns = await page.evaluate(() => window.engine.patch.connections);
        // Under series, filter 1 should connect to filter 2
        const hasSeriesLink = seriesConns.some(c => c.from === 'flt_bp1' && c.to === 'flt_bp2');
        expect(hasSeriesLink).toBe(true);

        // Click Wire Filters Parallel
        await page.locator('#btn-wire-parallel').click();
        const parallelConns = await page.evaluate(() => window.engine.patch.connections);
        // Under parallel, both flt_bp1 and flt_bp2 connect to master directly
        const flt1ToMaster = parallelConns.some(c => c.from === 'flt_bp1' && c.to === 'master');
        const flt2ToMaster = parallelConns.some(c => c.from === 'flt_bp2' && c.to === 'master');
        expect(flt1ToMaster).toBe(true);
        expect(flt2ToMaster).toBe(true);
    });

    test('Starts audio and sweeps RPM slider to update fundamental f0 and RPM display', async ({ page }) => {
        await page.goto('/src/modular_tuner.html');

        const btnIgnition = page.locator('#btn-ignition');
        await expect(btnIgnition).toHaveText('START AUDIO');

        // Start Audio
        await btnIgnition.click();
        await expect(btnIgnition).toHaveText('STOP AUDIO');
        await expect(btnIgnition).toHaveClass(/active/);

        const isAudioActive = await page.evaluate(() => window.engine.isPlaying);
        expect(isAudioActive).toBe(true);

        // Adjust RPM Slider to 3000 RPM
        const rpmSlider = page.locator('#rpm-slider');
        await rpmSlider.fill('3000');

        const rpmDisplay = page.locator('#rpm-display');
        await expect(rpmDisplay).toHaveText('3000 RPM');

        const f0Display = page.locator('#f0-display');
        // 3000 RPM / 60 = 50.0 Hz
        await expect(f0Display).toHaveText('f0 = 50.0 Hz');

        // Stop Audio
        await btnIgnition.click();
        await expect(btnIgnition).toHaveText('START AUDIO');
        await expect(btnIgnition).not.toHaveClass(/active/);
    });

    test('Navigates cleanly between audio_tuner.html and modular_tuner.html', async ({ page }) => {
        // Start at classic audio tuner
        await page.goto('/src/audio_tuner.html');

        const linkToModular = page.locator('#link-modular-tuner');
        await expect(linkToModular).toBeVisible();
        await expect(linkToModular).toContainText('Modular DSP Workbench');

        // Click link to go to modular tuner
        await linkToModular.click();
        await page.waitForURL('**/modular_tuner.html');
        await expect(page).toHaveTitle(/MODULAR DSP WORKBENCH/);

        // Click link to go back to classic tuner
        const linkBack = page.locator('#link-classic-tuner');
        await linkBack.click();
        await page.waitForURL('**/audio_tuner.html');
        await expect(page.locator('h1')).toContainText('PHYSICAL ENGINE TUNER');
    });

    test('Captures end-to-end verification screenshot of Modular DSP Workbench', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('/src/modular_tuner.html');

        // Select series peaking formants preset
        await page.locator('#preset-select').selectOption('series_peaking_formants');

        // Set RPM to 2400 for a sweet spot visualization
        await page.locator('#rpm-slider').fill('2400');
        await page.locator('#throttle-slider').fill('0.65');

        // Wait a brief tick for canvas visualizers to render frame
        await page.waitForTimeout(300);

        // Save verification screenshot
        await page.screenshot({ path: 'verification/modular_tuner.png', fullPage: true });

        // Verify screenshot file was generated
        const fs = await import('fs');
        expect(fs.existsSync('verification/modular_tuner.png')).toBe(true);
    });

    test('Verifies harmonic multiplier slider (0.5-16.0 step 0.5) and logarithmic scale for freqHz and filter frequency sliders', async ({ page }) => {
        await page.goto('/src/modular_tuner.html');

        // 1. Oscillator mult slider attributes and readout
        const multSlider = page.locator('input[data-node-id="osc_1"][data-param="mult"]');
        await expect(multSlider).toBeVisible();
        await expect(multSlider).toHaveAttribute('min', '0.5');
        await expect(multSlider).toHaveAttribute('max', '16');
        await expect(multSlider).toHaveAttribute('step', '0.5');

        // Check readout format for default mult = 1.0 (should display '1.0x')
        const multVal = page.locator('#param-val-osc_1-mult');
        await expect(multVal).toHaveText('1.0x');

        // Verify stepping behavior / readout update
        await multSlider.fill('2.5');
        await expect(multVal).toHaveText('2.5x');
        const oscMult = await page.evaluate(() => {
            const osc = window.engine.patch.nodes.find(n => n.id === 'osc_1');
            return osc ? osc.params.mult : null;
        });
        expect(oscMult).toBe(2.5);

        // 2. Oscillator freqHz slider attributes
        const oscFreqSlider = page.locator('input[data-node-id="osc_1"][data-param="freqHz"]');
        await expect(oscFreqSlider).toBeVisible();
        await expect(oscFreqSlider).toHaveAttribute('data-scale', 'log');
        await expect(oscFreqSlider).toHaveAttribute('min', '0');
        await expect(oscFreqSlider).toHaveAttribute('max', '1000');
        await expect(oscFreqSlider).toHaveAttribute('step', '1');

        // 3. Filter frequency slider attributes
        const filterFreqSlider = page.locator('input[data-node-id="flt_f1"][data-param="frequency"]');
        await expect(filterFreqSlider).toBeVisible();
        await expect(filterFreqSlider).toHaveAttribute('data-scale', 'log');
        await expect(filterFreqSlider).toHaveAttribute('min', '0');
        await expect(filterFreqSlider).toHaveAttribute('max', '1000');
        await expect(filterFreqSlider).toHaveAttribute('step', '1');

        // Set filter frequency slider to the midpoint (500 out of 1000, i.e. t = 0.5)
        await filterFreqSlider.fill('500');

        // The readout and data-hz should reflect the geometric mean sqrt(20 * 10000) = 447 Hz
        await expect(filterFreqSlider).toHaveAttribute('data-hz', '447');
        const filterVal = page.locator('#param-val-flt_f1-frequency');
        await expect(filterVal).toHaveText('447 Hz');

        // Cutoff frequency in window.engine.patch.nodes is 447 Hz instead of linear midpoint 5010 Hz
        const engineCutoffFreq = await page.evaluate(() => {
            const fltNode = window.engine.patch.nodes.find(n => n.id === 'flt_f1');
            return fltNode ? fltNode.params.frequency : null;
        });
        expect(engineCutoffFreq).toBe(447);
        expect(engineCutoffFreq).not.toBe(5010);

        // 4. Filter Q slider attributes and midpoint logarithmic scaling
        const filterQSlider = page.locator('input[data-node-id="flt_f1"][data-param="Q"]');
        await expect(filterQSlider).toBeVisible();
        await expect(filterQSlider).toHaveAttribute('data-scale', 'log');
        await expect(filterQSlider).toHaveAttribute('min', '0');
        await expect(filterQSlider).toHaveAttribute('max', '1000');
        await expect(filterQSlider).toHaveAttribute('step', '1');

        // Set filter Q slider to midpoint (500 out of 1000, t = 0.5)
        await filterQSlider.fill('500');

        // Midpoint: sqrt(0.1 * 25.0) = sqrt(2.5) ≈ 1.581 -> rounded to step 0.1 is 1.6
        await expect(filterQSlider).toHaveAttribute('data-val', '1.6');
        const filterQVal = page.locator('#param-val-flt_f1-Q');
        await expect(filterQVal).toHaveText('1.6');

        const engineQ = await page.evaluate(() => {
            const fltNode = window.engine.patch.nodes.find(n => n.id === 'flt_f1');
            return fltNode ? fltNode.params.Q : null;
        });
        expect(engineQ).toBe(1.6);
    });

    test('Verifies triggered oscilloscope rising zero-crossing sync on synthetic buffers and live rendering', async ({ page }) => {
        await page.goto('/src/modular_tuner.html');

        // 1. Verify findRisingZeroCrossing pure helper with synthetic waveform buffers
        const testResults = await page.evaluate(() => {
            // Flat buffer (all 128) -> no crossing, should return 0
            const flatBuf = new Uint8Array(2048).fill(128);
            const trigFlat = window.findRisingZeroCrossing(flatBuf);

            // Synthetic buffer with rising crossing with hysteresis at index 15
            // Noise near 128 at index 2 (127 -> 128) without hysteresis (indices 0, 1 are 127 > 126)
            const synthBuf = new Uint8Array(2048).fill(128);
            synthBuf[0] = 127;
            synthBuf[1] = 127;
            synthBuf[2] = 128;
            // Valley below hysteresis threshold (<= 126) at index 12, then rising crossing at 15
            synthBuf[12] = 110;
            synthBuf[13] = 118;
            synthBuf[14] = 126;
            synthBuf[15] = 132;

            const trigSynth = window.findRisingZeroCrossing(synthBuf);

            // Fallback crossing: rising crossing from 127 to 129 at index 8 without hysteresis (no sample <= 126)
            const fallbackBuf = new Uint8Array(2048).fill(127);
            fallbackBuf[8] = 129;
            const trigFallback = window.findRisingZeroCrossing(fallbackBuf);

            return { trigFlat, trigSynth, trigFallback };
        });

        expect(testResults.trigFlat).toBe(0);
        expect(testResults.trigSynth).toBe(15);
        expect(testResults.trigFallback).toBe(8);

        // 2. Start audio and verify oscilloscope status header badge and live rendering
        const btnIgnition = page.locator('#btn-ignition');
        await btnIgnition.click();
        await expect(btnIgnition).toHaveClass(/active/);

        // Verify scope header badge indicates triggered rising zero-crossing sync
        const scopeStatus = page.locator('#scope-status');
        await expect(scopeStatus).toBeVisible();
        await expect(scopeStatus).toContainText('Trig: Rising Zero-Cross');

        // Wait a few animation frames for live rendering
        await page.waitForTimeout(250);

        // Verify scope canvas renders active waveform pixels
        const hasWaveformPixels = await page.evaluate(() => {
            const canvas = document.getElementById('scope-canvas');
            const ctx = canvas.getContext('2d');
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            // Search for non-background pixels (trace color is #38d39f: g > 180, r < 100, b > 100)
            let foundTrace = false;
            for (let i = 0; i < imgData.data.length; i += 4) {
                const r = imgData.data[i];
                const g = imgData.data[i + 1];
                const b = imgData.data[i + 2];
                if (g > 180 && r < 100 && b > 100) {
                    foundTrace = true;
                    break;
                }
            }
            return foundTrace;
        });
        expect(hasWaveformPixels).toBe(true);

        // Stop audio
        await btnIgnition.click();
        await expect(btnIgnition).not.toHaveClass(/active/);
    });

    test('Verifies Boxer-6 (boxer_6_cayman) live Web Audio waveforms and spectral balance across Load x RPM matrix', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('/src/modular_tuner.html');

        // 1. Select boxer_6_cayman preset
        const presetSelect = page.locator('#preset-select');
        await presetSelect.selectOption('boxer_6_cayman');

        // Verify patch name and node count (13 nodes)
        const patchName = await page.evaluate(() => window.engine.patch.name);
        expect(patchName).toBe('Boxer-6 (987.2 Flat-6 Acoustic Model)');
        await expect(page.locator('.node-card')).toHaveCount(13);

        // Start Audio
        const btnIgnition = page.locator('#btn-ignition');
        await btnIgnition.click();
        await expect(btnIgnition).toHaveClass(/active/);

        // Helper to set operating condition
        const setOperatingCondition = async (rpm, throttle) => {
            await page.evaluate(({ r, t }) => {
                const rSlider = document.getElementById('rpm-slider');
                const tSlider = document.getElementById('throttle-slider');
                rSlider.value = r;
                rSlider.dispatchEvent(new Event('input'));
                tSlider.value = t;
                tSlider.dispatchEvent(new Event('input'));
                window.engine.update(r, t);
            }, { r: rpm, t: throttle });
            await page.waitForTimeout(300);
        };

        // Helper to extract Web Audio telemetry from analyser
        const getTelemetry = async () => {
            return await page.evaluate(() => {
                const analyser = window.engine.analyser;
                const ctx = window.engine.ctx;
                const sampleRate = ctx ? ctx.sampleRate : 48000;

                const timeData = new Float32Array(analyser.fftSize);
                analyser.getFloatTimeDomainData(timeData);

                let peak = 0;
                let sumSq = 0;
                let maxSlew = 0;
                for (let i = 0; i < timeData.length; i++) {
                    const absVal = Math.abs(timeData[i]);
                    if (absVal > peak) peak = absVal;
                    sumSq += absVal * absVal;
                    if (i > 0) {
                        const slew = Math.abs(timeData[i] - timeData[i - 1]);
                        if (slew > maxSlew) maxSlew = slew;
                    }
                }
                const rms = Math.sqrt(sumSq / timeData.length);
                const crestFactor = rms > 0 ? (peak / rms) : 0;

                const freqData = new Float32Array(analyser.frequencyBinCount);
                analyser.getFloatFrequencyData(freqData);

                const binWidth = (sampleRate / 2) / analyser.frequencyBinCount;
                let bodyBandEnergy = 0;
                let harshHighEnergy = 0;
                let highBandEnergy = 0;
                let numCentroid = 0;
                let denCentroid = 0;

                for (let i = 0; i < freqData.length; i++) {
                    const binFreq = i * binWidth;
                    const linearMag = Math.pow(10, freqData[i] / 20);
                    const power = linearMag * linearMag;

                    if (binFreq >= 60 && binFreq <= 450) {
                        bodyBandEnergy += power;
                    }
                    if (binFreq >= 2000 && binFreq <= 6000) {
                        harshHighEnergy += power;
                    }
                    if (binFreq >= 800 && binFreq <= 2500) {
                        highBandEnergy += power;
                    }
                    if (binFreq >= 20 && binFreq <= 10000) {
                        numCentroid += binFreq * linearMag;
                        denCentroid += linearMag;
                    }
                }

                const spectralCentroid = denCentroid > 0 ? (numCentroid / denCentroid) : 0;

                return {
                    peak,
                    rms,
                    crestFactor,
                    maxSlew,
                    bodyBandEnergy,
                    harshHighEnergy,
                    bodyToHighRatio: harshHighEnergy > 0 ? (bodyBandEnergy / harshHighEnergy) : Infinity,
                    highBandEnergy,
                    spectralCentroid
                };
            });
        };

        const fs = await import('fs');
        if (!fs.existsSync('verification')) {
            fs.mkdirSync('verification', { recursive: true });
        }

        // State 1: Idle (900 RPM, 0% Throttle)
        await setOperatingCondition(900, 0);
        await page.screenshot({ path: 'verification/boxer6_1_idle.png', fullPage: true });
        const telem1 = await getTelemetry();
        console.log('State 1 (Idle 900 RPM, 0%):', telem1);

        // State 2: Mid-Pull (3500 RPM, 50% Throttle)
        await setOperatingCondition(3500, 0.50);
        await page.screenshot({ path: 'verification/boxer6_2_mid.png', fullPage: true });
        await page.screenshot({ path: 'verification/boxer6_3500rpm.png', fullPage: true });
        const telem2 = await getTelemetry();
        console.log('State 2 (Mid-Pull 3500 RPM, 50%):', telem2);

        // State 3: High-RPM Overrun (5000 RPM, 0% Throttle)
        await setOperatingCondition(5000, 0);
        await page.screenshot({ path: 'verification/boxer6_3_overrun.png', fullPage: true });
        const telem3_overrun = await getTelemetry();
        console.log('State 3 (Overrun 5000 RPM, 0%):', telem3_overrun);

        // State 4a: Upper-Mid Pull (5000 RPM, 75% Throttle)
        await setOperatingCondition(5000, 0.75);
        await page.screenshot({ path: 'verification/boxer6_5000rpm.png', fullPage: true });
        const telem4_midpull = await getTelemetry();
        console.log('State 4a (Upper-Mid Pull 5000 RPM, 75%):', telem4_midpull);

        // State 4b: Redline WOT Wail (7400 RPM, 100% Throttle)
        await setOperatingCondition(7400, 1.0);
        await page.screenshot({ path: 'verification/boxer6_4_wot.png', fullPage: true });
        const telem4_wot = await getTelemetry();
        console.log('State 4b (Redline WOT 7400 RPM, 100%):', telem4_wot);

        // Copy screenshots to /media/documents/2025/gemini_scratch/audio_tuner_screenshots/
        const destDir = '/media/documents/2025/gemini_scratch/audio_tuner_screenshots';
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        const screenshotFiles = [
            'boxer6_1_idle.png',
            'boxer6_2_mid.png',
            'boxer6_3_overrun.png',
            'boxer6_4_wot.png',
            'boxer6_3500rpm.png',
            'boxer6_5000rpm.png'
        ];
        for (const file of screenshotFiles) {
            const srcPath = `verification/${file}`;
            if (fs.existsSync(srcPath)) {
                fs.copyFileSync(srcPath, `${destDir}/${file}`);
            }
        }

        // Verify healthy levels, crest factor, and waveform smoothness (no digital discontinuities)
        const allTelems = [telem1, telem2, telem3_overrun, telem4_midpull, telem4_wot];
        for (const telem of allTelems) {
            expect(telem.peak).toBeGreaterThan(0.05);
            expect(telem.peak).toBeLessThan(0.98);
            expect(telem.crestFactor).toBeGreaterThanOrEqual(1.2);
            expect(telem.crestFactor).toBeLessThanOrEqual(4.0);
            // Slew rate check: sample-to-sample difference should be smooth (< 0.25)
            expect(telem.maxSlew).toBeLessThan(0.25);
        }

        // Body Band Energy (60–450 Hz) vs Harsh High Band Energy (2000–6000 Hz)
        // At 3500 RPM (50% throttle) and 5000 RPM (75% throttle):
        // Body Band Energy is at least 10x greater than 2000–6000 Hz energy
        expect(telem2.bodyToHighRatio).toBeGreaterThanOrEqual(10.0);
        expect(telem4_midpull.bodyToHighRatio).toBeGreaterThanOrEqual(10.0);

        // Verify load sensitivity and spectral progression
        expect(telem4_midpull.highBandEnergy).toBeGreaterThan(telem3_overrun.highBandEnergy);
        expect(telem4_wot.spectralCentroid).toBeGreaterThan(telem1.spectralCentroid);

        // Stop audio
        await btnIgnition.click();
        await expect(btnIgnition).not.toHaveClass(/active/);
    });

});
