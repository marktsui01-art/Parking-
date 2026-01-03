from playwright.sync_api import sync_playwright

def verify_game_load():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            page.goto("http://127.0.0.1:8080")
            page.wait_for_selector("#gameCanvas")
            page.wait_for_selector("#ui-layer")

            # Click Level 1 to start game
            page.get_by_role("button", name="Level 1: The Basics").click()

            # Wait for game to start (level chooser hidden)
            page.wait_for_selector("#level-chooser", state="hidden")

            # Take screenshot of gameplay
            page.screenshot(path="verification/gameplay.png")
            print("Screenshot taken at verification/gameplay.png")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_game_load()
