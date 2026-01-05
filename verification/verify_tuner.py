from playwright.sync_api import sync_playwright
import time

def verify_tuner():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Access the tuner via the local server we will start
        try:
            page.goto("http://localhost:8080/src/audio_tuner.html")
            page.wait_for_load_state("networkidle")
        except Exception as e:
            print(f"Failed to load page: {e}")
            return

        print(f"Page Title: {page.title()}")

        # Take screenshot of initial state
        page.screenshot(path="verification/tuner_initial.png")

        # Interact: Start Engine
        # Check if button exists
        if page.is_visible("#btn-ignition"):
            page.click("#btn-ignition")
            # Wait for visualizer to likely draw something / button state change
            time.sleep(1)
            page.screenshot(path="verification/tuner_running.png")
        else:
            print("Ignition button not found")

        # Interact: Change Preset to V8
        if page.is_visible("#preset-select"):
            page.select_option("#preset-select", "v8")
            time.sleep(0.5)
            page.screenshot(path="verification/tuner_v8.png")

        # Interact: Add Harmonic
        if page.is_visible("#btn-add-harmonic"):
            page.click("#btn-add-harmonic")
            time.sleep(0.5)
            page.screenshot(path="verification/tuner_harmonic.png")

        browser.close()

if __name__ == "__main__":
    verify_tuner()
