#!/usr/bin/env node

/**
 * scripts/measure_histograms.mjs
 * 
 * Playwright Live Web Audio High-Resolution Spectral & Warble Profiler.
 * 
 * Sets analyser.fftSize = 16384 (~2.93 Hz resolution) and analyser.smoothingTimeConstant = 0.5.
 * Measures:
 *   1. 12 Perceptual Acoustic Sub-Bands (dBFS, 15-frame average)
 *   2. Individual Engine Order Peaks (1.0x, 1.5x, 3.0x, 4.5x, 6.0x, 9.0x, 12.0x, 18.0x)
 *   3. Harmonic Warble / Beating Depth (%) with noise temporarily muted
 *   4. Spectral Centroid, Peak, RMS, Crest Factor, Max Slew
 */

import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const SUB_BANDS = [
    { name: '40-80Hz (Sub)', min: 40, max: 80 },
    { name: '80-125Hz (Low Chest / 1x)', min: 80, max: 125 },
    { name: '125-200Hz (Upper Chest / 1.5x)', min: 125, max: 200 },
    { name: '200-315Hz (Low-Mid Body)', min: 200, max: 315 },
    { name: '315-500Hz (Core 3x)', min: 315, max: 500 },
    { name: '500-800Hz (Throat / 6x)', min: 500, max: 800 },
    { name: '800-1.25k (Upper-Mid / 9x)', min: 800, max: 1250 },
    { name: '1.25-2k (Header Rasp)', min: 1250, max: 2000 },
    { name: '2k-3.15k (Metallic Zing)', min: 2000, max: 3150 },
    { name: '3.15-5k (High Zing / Bite)', min: 3150, max: 5000 },
    { name: '5-8k (Upper Treble)', min: 5000, max: 8000 },
    { name: '8-12k (Ultrasonic Fizz)', min: 8000, max: 12000 }
];

const ENGINE_ORDERS = [1.0, 1.5, 3.0, 4.5, 6.0, 9.0, 12.0, 18.0];

const BOXER_POINTS = [
    { label: 'Idle (900 RPM, 0%)', rpm: 900, throttle: 0.0 },
    { label: 'Mid-Pull (3500 RPM, 50%)', rpm: 3500, throttle: 0.50 },
    { label: 'Upper-Mid (5500 RPM, 80%)', rpm: 5500, throttle: 0.80 },
    { label: 'High-RPM (6500 RPM, 90%)', rpm: 6500, throttle: 0.90 },
    { label: 'Redline WOT (7400 RPM, 100%)', rpm: 7400, throttle: 1.00 }
];

const F1_POINT = { label: 'F1 Redline WOT (19000 RPM, 100%)', rpm: 19000, throttle: 1.00 };

function checkHttp(url) {
    return new Promise((resolve) => {
        const req = http.get(url, (res) => {
            resolve(res.statusCode >= 200 && res.statusCode < 400);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(500, () => {
            req.destroy();
            resolve(false);
        });
    });
}

async function ensureServer(port) {
    const url = `http://127.0.0.1:${port}/src/modular_tuner.html`;
    const isUp = await checkHttp(url);
    if (isUp) {
        console.log(`Using existing static server on port ${port}`);
        return null; // No process to kill
    }

    console.log(`Starting http-server on port ${port}...`);
    const serverProc = spawn('npx', ['http-server', '.', '-p', String(port), '-c-1', '--silent'], {
        cwd: REPO_ROOT,
        stdio: 'ignore'
    });

    const start = Date.now();
    while (Date.now() - start < 10000) {
        await new Promise((r) => setTimeout(r, 200));
        if (await checkHttp(url)) {
            console.log(`http-server ready on http://127.0.0.1:${port}`);
            return serverProc;
        }
    }
    serverProc.kill();
    throw new Error(`Timeout waiting for http-server on port ${port}`);
}

async function measurePoint(page, presetKey, pt) {
    return await page.evaluate(async ({ presetKey, pt, subBandsDef, ordersDef }) => {
        // 1. Ensure correct preset
        const presetSelect = document.getElementById('preset-select');
        if (presetSelect && presetSelect.value !== presetKey) {
            presetSelect.value = presetKey;
            presetSelect.dispatchEvent(new Event('change'));
        } else if (window.engine.patch.name !== presetKey) {
            window.engine.loadPreset(presetKey);
        }

        // 2. Set RPM and Throttle
        const rSlider = document.getElementById('rpm-slider');
        const tSlider = document.getElementById('throttle-slider');
        if (rSlider) {
            rSlider.value = pt.rpm;
            rSlider.dispatchEvent(new Event('input'));
        }
        if (tSlider) {
            tSlider.value = pt.throttle;
            tSlider.dispatchEvent(new Event('input'));
        }
        window.engine.update(pt.rpm, pt.throttle);

        // 3. Configure Analyser
        const analyser = window.engine.analyser;
        analyser.fftSize = 16384;
        analyser.smoothingTimeConstant = 0.5;

        const ctx = window.engine.ctx;
        const sampleRate = ctx ? ctx.sampleRate : 48000;
        const binCount = analyser.frequencyBinCount; // 8192
        const binWidth = sampleRate / analyser.fftSize; // ~2.9297 Hz

        // Let the engine and smoothing filter settle (350 ms)
        await new Promise((r) => setTimeout(r, 350));

        // 4. Sample 15 frames spaced by 25 ms for rock-solid frequency data
        const numFrames = 15;
        const sumFreqData = new Float64Array(binCount);
        const tmpFreqData = new Float32Array(binCount);

        for (let f = 0; f < numFrames; f++) {
            analyser.getFloatFrequencyData(tmpFreqData);
            for (let i = 0; i < binCount; i++) {
                sumFreqData[i] += tmpFreqData[i];
            }
            if (f < numFrames - 1) {
                await new Promise((r) => setTimeout(r, 25));
            }
        }

        const avgFreqData = new Float64Array(binCount);
        for (let i = 0; i < binCount; i++) {
            avgFreqData[i] = sumFreqData[i] / numFrames;
        }

        // 5. Integrate Power across 12 Perceptual Acoustic Sub-Bands (dBFS = 10 * log10(sumPower + 1e-18))
        const subBands = {};
        const subBandsArray = [];
        for (const band of subBandsDef) {
            let sumPower = 0;
            for (let i = 0; i < binCount; i++) {
                const binHz = i * binWidth;
                if (binHz >= band.min && binHz < band.max) {
                    sumPower += Math.pow(10, avgFreqData[i] / 10);
                }
            }
            const dbFS = 10 * Math.log10(sumPower + 1e-18);
            subBands[band.name] = Number(dbFS.toFixed(2));
            subBandsArray.push({
                name: band.name,
                min: band.min,
                max: band.max,
                dbFS: Number(dbFS.toFixed(2))
            });
        }

        // 6. Individual Engine Order Peaks
        const f0 = pt.rpm / 60;
        const engineOrders = {};
        for (const mult of ordersDef) {
            const targetHz = f0 * mult;
            let maxBinDb = -120;
            for (let i = 0; i < binCount; i++) {
                const binHz = i * binWidth;
                if (binHz >= targetHz - 8 && binHz <= targetHz + 8) {
                    if (avgFreqData[i] > maxBinDb) {
                        maxBinDb = avgFreqData[i];
                    }
                }
            }
            engineOrders[`${mult.toFixed(1)}x`] = Number(maxBinDb.toFixed(2));
        }

        // 7. Time-domain telemetry (peak, RMS, crestFactor, maxSlew, spectralCentroid) with steady audio
        const fullTime = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(fullTime);
        let peak = 0;
        let sumSqFull = 0;
        let maxSlew = 0;
        for (let i = 0; i < fullTime.length; i++) {
            const absVal = Math.abs(fullTime[i]);
            if (absVal > peak) peak = absVal;
            sumSqFull += absVal * absVal;
            if (i > 0) {
                const slew = Math.abs(fullTime[i] - fullTime[i - 1]);
                if (slew > maxSlew) maxSlew = slew;
            }
        }
        const rms = Math.sqrt(sumSqFull / fullTime.length);
        const crestFactor = rms > 0 ? (peak / rms) : 0;

        let numCentroid = 0;
        let denCentroid = 0;
        for (let i = 0; i < binCount; i++) {
            const binHz = i * binWidth;
            if (binHz >= 20 && binHz <= 12000) {
                const linearMag = Math.pow(10, avgFreqData[i] / 20);
                numCentroid += binHz * linearMag;
                denCentroid += linearMag;
            }
        }
        const spectralCentroid = denCentroid > 0 ? (numCentroid / denCentroid) : 0;

        // 8. Harmonic Warble / Beating Depth (%):
        // Temporarily mute noise nodes, wait 150ms, sample RMS across 30 samples spaced by 25ms (750ms total),
        // compute (maxRms - minRms) / meanRms * 100, then re-enable noise nodes.
        const noiseNodes = window.engine.patch.nodes.filter(n => n.type === 'noise');
        const origNoiseStates = noiseNodes.map(n => ({ id: n.id, enabled: n.enabled }));
        for (const n of noiseNodes) {
            n.enabled = false;
        }
        window.engine.update(pt.rpm, pt.throttle);

        await new Promise(r => setTimeout(r, 150));

        const rmsSamples = [];
        const warbleBuf = new Float32Array(2048);
        for (let s = 0; s < 30; s++) {
            analyser.getFloatTimeDomainData(warbleBuf);
            let sSq = 0;
            for (let i = 0; i < 2048; i++) {
                sSq += warbleBuf[i] * warbleBuf[i];
            }
            rmsSamples.push(Math.sqrt(sSq / 2048));
            if (s < 29) {
                await new Promise(r => setTimeout(r, 25));
            }
        }

        // Restore noise nodes
        for (const orig of origNoiseStates) {
            const n = window.engine.patch.nodes.find(node => node.id === orig.id);
            if (n) n.enabled = orig.enabled;
        }
        window.engine.update(pt.rpm, pt.throttle);

        const warbleMax = Math.max(...rmsSamples);
        const warbleMin = Math.min(...rmsSamples);
        const warbleMean = rmsSamples.reduce((a, b) => a + b, 0) / rmsSamples.length;
        const harmonicWarblePct = warbleMean > 0 ? Number(((warbleMax - warbleMin) / warbleMean * 100).toFixed(2)) : 0;

        return {
            label: pt.label,
            preset: presetKey,
            rpm: pt.rpm,
            throttle: pt.throttle,
            sampleRate,
            fftSize: analyser.fftSize,
            binWidth: Number(binWidth.toFixed(4)),
            subBands,
            subBandsArray,
            engineOrders,
            harmonicWarblePct,
            telemetry: {
                peak: Number(peak.toFixed(4)),
                rms: Number(rms.toFixed(4)),
                crestFactor: Number(crestFactor.toFixed(3)),
                maxSlew: Number(maxSlew.toFixed(4)),
                spectralCentroid: Number(spectralCentroid.toFixed(1))
            }
        };
    }, { presetKey, pt, subBandsDef: SUB_BANDS, ordersDef: ENGINE_ORDERS });
}

function printAsciiSummary(title, points) {
    console.log('\n' + '='.repeat(88));
    console.log(` ${title.toUpperCase()}`);
    console.log('='.repeat(88));

    // Table of Sub-Bands
    console.log('\n--- 12-Band Acoustic Sub-Bands (dBFS) ---');
    const headerCols = ['Sub-Band', ...points.map(p => p.label.split(' ')[0])];
    console.log(headerCols.map(c => c.padEnd(22)).join(' '));
    console.log('-'.repeat(headerCols.length * 23));

    for (const b of SUB_BANDS) {
        const row = [b.name.padEnd(22)];
        for (const pt of points) {
            const db = pt.subBands[b.name];
            row.push(`${db.toFixed(1)} dBFS`.padStart(12).padEnd(22));
        }
        console.log(row.join(' '));
    }

    // Table of Engine Orders
    console.log('\n--- Engine Order Peaks (dBFS) ---');
    const orderCols = ['Order', ...points.map(p => p.label.split(' ')[0])];
    console.log(orderCols.map(c => c.padEnd(16)).join(' '));
    console.log('-'.repeat(orderCols.length * 17));

    for (const mult of ENGINE_ORDERS) {
        const key = `${mult.toFixed(1)}x`;
        const row = [key.padEnd(16)];
        for (const pt of points) {
            const db = pt.engineOrders[key];
            row.push(`${db !== undefined ? db.toFixed(1) : '-'} dBFS`.padStart(10).padEnd(16));
        }
        console.log(row.join(' '));
    }

    // Warble & Telemetry
    console.log('\n--- Warble & Spectral Telemetry ---');
    console.log(['Metric', ...points.map(p => p.label.split(' ')[0])].map(c => c.padEnd(20)).join(' '));
    console.log('-'.repeat((points.length + 1) * 21));

    const metrics = [
        { name: 'Warble Depth (%)', fn: p => `${p.harmonicWarblePct.toFixed(1)}%` },
        { name: 'Spectral Centroid', fn: p => `${p.telemetry.spectralCentroid.toFixed(0)} Hz` },
        { name: 'Peak Amplitude', fn: p => `${p.telemetry.peak.toFixed(3)}` },
        { name: 'RMS Amplitude', fn: p => `${p.telemetry.rms.toFixed(3)}` },
        { name: 'Crest Factor', fn: p => `${p.telemetry.crestFactor.toFixed(2)}` },
        { name: 'Max Slew Rate', fn: p => `${p.telemetry.maxSlew.toFixed(3)}` }
    ];

    for (const m of metrics) {
        const row = [m.name.padEnd(20)];
        for (const pt of points) {
            row.push(m.fn(pt).padStart(10).padEnd(20));
        }
        console.log(row.join(' '));
    }
    console.log('='.repeat(88) + '\n');
}

async function main() {
    const args = process.argv.slice(2);
    let outputPath = null;
    let port = 8099;
    let preset = 'boxer_6_cayman';
    let includeF1 = true;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--output' || args[i] === '-o') {
            outputPath = path.resolve(args[++i]);
        } else if (args[i] === '--port' || args[i] === '-p') {
            port = parseInt(args[++i], 10);
        } else if (args[i] === '--preset') {
            preset = args[++i];
        } else if (args[i] === '--no-f1') {
            includeF1 = false;
        }
    }

    let serverProc = null;
    let browser = null;

    try {
        serverProc = await ensureServer(port);

        console.log('Launching headless Chromium via Playwright...');
        browser = await chromium.launch({
            headless: true,
            args: ['--use-fake-ui-for-media-stream', '--no-sandbox', '--disable-setuid-sandbox']
        });
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const page = await context.newPage();

        const url = `http://127.0.0.1:${port}/src/modular_tuner.html`;
        console.log(`Navigating to ${url}...`);
        await page.goto(url);
        await page.waitForSelector('#btn-ignition');

        // Start Web Audio
        const btnIgnition = page.locator('#btn-ignition');
        const isRunning = await page.evaluate(() => window.engine && window.engine.isPlaying);
        if (!isRunning) {
            await btnIgnition.click();
            await page.waitForTimeout(200);
        }

        console.log(`Profiling preset: ${preset}...`);
        const boxerResults = [];
        for (const pt of BOXER_POINTS) {
            process.stdout.write(`  Measuring ${pt.label}... `);
            const res = await measurePoint(page, preset, pt);
            boxerResults.push(res);
            console.log(`Done (Warble: ${res.harmonicWarblePct}%, Centroid: ${res.telemetry.spectralCentroid} Hz)`);
        }

        printAsciiSummary(`${preset} Acoustic Profile`, boxerResults);

        let f1Result = null;
        if (includeF1) {
            console.log(`Profiling reference preset: f1_golden_era_v10...`);
            process.stdout.write(`  Measuring ${F1_POINT.label}... `);
            f1Result = await measurePoint(page, 'f1_golden_era_v10', F1_POINT);
            console.log(`Done (Warble: ${f1Result.harmonicWarblePct}%, Centroid: ${f1Result.telemetry.spectralCentroid} Hz)`);
            printAsciiSummary('F1 V10 Reference Profile', [f1Result]);
        }

        const fullOutput = {
            timestamp: new Date().toISOString(),
            preset,
            points: boxerResults,
            pointsByLabel: Object.fromEntries(boxerResults.map(p => [p.label, p])),
            f1Reference: f1Result
        };

        if (outputPath) {
            const outDir = path.dirname(outputPath);
            if (!fs.existsSync(outDir)) {
                fs.mkdirSync(outDir, { recursive: true });
            }
            fs.writeFileSync(outputPath, JSON.stringify(fullOutput, null, 2), 'utf8');
            console.log(`\nSuccessfully wrote high-res measurement JSON to: ${outputPath}`);
        }

        return fullOutput;

    } finally {
        if (browser) {
            await browser.close().catch(() => {});
        }
        if (serverProc) {
            console.log('Stopping child http-server...');
            serverProc.kill();
        }
    }
}

// Run if called directly
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
    main().catch(err => {
        console.error('Fatal error in measure_histograms:', err);
        process.exit(1);
    });
}

export { measurePoint, SUB_BANDS, ENGINE_ORDERS };
