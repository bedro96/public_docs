import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


here = Path(__file__).resolve().parent
artifact = (here / "kstar.html").as_uri()
index = (here.parent / "index.html").as_uri()
screens = os.environ.get("KSTAR_SCREEN_DIR")


def shot(locator, name, scale="css"):
    if screens:
        locator.screenshot(path=str(Path(screens) / f"kstar-{name}.png"), scale=scale)


with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path=os.environ.get("CHROME_PATH", "/usr/bin/google-chrome"))
    page = browser.new_page(viewport={"width": 1440, "height": 1000}, offline=True)
    failures = []
    requests = []
    page.on("pageerror", lambda error: failures.append(str(error)))
    page.on("console", lambda message: failures.append(message.text) if message.type == "error" else None)
    page.on("request", lambda request: requests.append(request.url))
    page.goto(artifact)
    expect(page.locator("html")).to_have_attribute("data-enhanced", "")
    expect(page.locator(".lead-metrics dd")).to_have_text(["48초", "102초", "300초"])
    expect(page.locator("#record meter")).to_have_count(6)
    assert page.locator("#record meter").evaluate_all("(nodes) => nodes.map(n => n.value)") == [2, 8, 20, 30, 48, 300]
    assert page.locator("#sources li").count() >= 12
    assert page.locator("a[href^='#']").evaluate_all("(nodes) => nodes.every(n => document.getElementById(n.hash.slice(1)))")
    assert page.locator("#inspector-plate use").evaluate("(n) => n.getBBox().width") > 500
    shot(page.locator(".hero"), "hero")

    for button in page.locator(".component").all():
        button.click()
        part = button.get_attribute("data-part")
        expect(page.locator("#inspector-plate .machine")).to_have_attribute("data-focus", part)
        expect(page.locator("#part-readout")).to_have_text(button.locator("span").nth(1).inner_text())
        expect(button).to_have_attribute("aria-pressed", "true")
        assert page.locator("#component-note p").count() == 2
    page.locator(".component").last.press("Home")
    expect(page.locator(".component").first).to_be_focused()
    page.locator(".component").first.press("ArrowRight")
    expect(page.locator(".component").nth(1)).to_be_focused()
    expect(page.locator("#inspector-plate .machine")).to_have_attribute("data-focus", "tf")
    shot(page.locator("#inspector-plate"), "tf-light")
    page.locator(".theme").click()
    expect(page.locator("html")).to_have_attribute("data-theme", "dark")
    shot(page.locator("#inspector-plate"), "tf-dark")
    page.locator(".theme").click()

    expect(page.locator("#previous")).to_be_disabled()
    page.locator("#next").click()
    expect(page.locator("#flow")).to_have_attribute("data-step", "toroidal")
    page.locator(".flow-controls button").nth(1).press("ArrowRight")
    expect(page.locator("#flow")).to_have_attribute("data-step", "helical")
    expect(page.locator("#step-card h3")).to_contain_text("자기력선이 꼬인다")
    shot(page.locator("#field-plate"), "helical")
    page.locator("#play").click()
    expect(page.locator(".tracer")).to_be_visible()
    x = page.locator(".tracer").get_attribute("cx")
    page.wait_for_timeout(175)
    assert x != page.locator(".tracer").get_attribute("cx")
    expect(page.locator("#flow")).to_have_attribute("data-step", "control", timeout=7500)
    page.locator("#play").click()
    expect(page.locator(".tracer")).to_be_hidden()
    page.locator(".flow-controls button").last.press("End")
    expect(page.locator("#flow")).to_have_attribute("data-step", "exhaust")
    expect(page.locator("#next")).to_be_disabled()
    shot(page.locator("#field-plate"), "exhaust")
    page.locator("#reset").click()
    expect(page.locator("#flow")).to_have_attribute("data-step", "seed")
    assert not failures, failures
    assert all(url.startswith("file:") for url in requests), requests
    page.close()

    mobile = browser.new_page(viewport={"width": 390, "height": 844}, has_touch=True, reduced_motion="reduce", offline=True)
    mobile.goto(artifact)
    assert mobile.evaluate("document.documentElement.scrollWidth === innerWidth")
    shot(mobile.locator(".hero"), "phone")
    mobile.locator(".flow-controls button").nth(2).tap()
    expect(mobile.locator("#flow")).to_have_attribute("data-step", "helical")
    mobile.locator("#play").click()
    expect(mobile.locator(".tracer")).to_be_hidden()
    expect(mobile.locator("#flow")).to_have_attribute("data-step", "control", timeout=7500)
    expect(mobile.locator(".tracer")).to_be_hidden()
    mobile.close()

    no_js = browser.new_page(java_script_enabled=False, offline=True)
    no_js.goto(artifact)
    expect(no_js.locator(".static-components > div").first).to_be_visible()
    expect(no_js.locator(".static-flow > li").last).to_be_visible()
    expect(no_js.locator(".component-list")).to_be_hidden()
    no_js.close()

    listing = browser.new_page(offline=True)
    listing.goto(index)
    assert listing.locator(".stop").count() == 9
    listing.locator("[data-cat='sci'].cat").click()
    assert listing.locator(".stop:visible").count() == 2
    listing.locator("#q").fill("KSTAR")
    assert listing.locator(".stop:visible").count() == 1
    listing.get_by_role("link", name="KSTAR — 1억 도를 가두는 법").click()
    expect(listing).to_have_url(artifact)
    expect(listing.locator("h1")).to_contain_text("KSTAR")
    browser.close()

print("Passed offline Chrome checks: cutaway, flow playback, mobile, reduced motion, no JS, citations and docs index.")
