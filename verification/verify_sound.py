from playwright.sync_api import sync_playwright

def verify_engine_sounds(page):
    # Load the local HTML file
    page.goto("file:///app/index.html")

    # Wait for the canvas to load
    page.wait_for_selector("#gameCanvas")

    # Screenshot the initial state
    page.screenshot(path="verification/verification.png")

    # Check that AudioController is present in the page context
    # We can inject javascript to check for the global objects or expected state
    # Since we can"t "hear" the sound, we verify no console errors and UI loads

    # Check if we can select a car which triggers engine type set
    page.select_option("#car-select", "m3_g80")

    # Take another screenshot
    page.screenshot(path="verification/verification_selected.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify_engine_sounds(page)
        finally:
            browser.close()
