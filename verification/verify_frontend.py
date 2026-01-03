from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()

    page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
    page.on("pageerror", lambda exc: print(f"PAGE ERROR: {exc}"))

    try:
        # We will run a server on port 8080
        page.goto("http://localhost:8080/index.html")

        # Wait for canvas
        try:
            page.wait_for_selector("#gameCanvas", timeout=5000)
        except:
            print("Timeout waiting for canvas.")

        # Check car select options
        options = page.eval_on_selector_all("#car-select option", "opts => opts.map(o => o.value)")
        print(f"Options: {options}")

        if not options:
            print("No options found. JS execution might have failed.")
            page.screenshot(path="verification/verification_failed.png")
            return

        # Select car to trigger change event
        page.select_option("#car-select", "m3_g80")

        # Click start level (first button)
        page.click(".level-btn")

        # Wait a bit
        page.wait_for_timeout(1000)

        # Screenshot
        page.screenshot(path="verification/verification.png")
        print("Verification screenshot taken.")

    except Exception as e:
        print(f"SCRIPT ERROR: {e}")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
