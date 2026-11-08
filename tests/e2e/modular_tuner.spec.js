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

});
