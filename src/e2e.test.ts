import { Builder, By, Key, ThenableWebDriver, until, WebElement } from 'selenium-webdriver';
import * as chrome from 'selenium-webdriver/chrome';

describe('Selenium Test Suite', () => {
    let driver: ThenableWebDriver;
    const options: chrome.Options = new chrome.Options();
    options.addArguments('--load-extension=dist');

    const cab = "https://cab.brown.edu/";

    beforeAll(() => {
        driver = new Builder()
            .withCapabilities(options)
            .build();
        driver.manage().window().maximize();
    });

    beforeEach(() => localStorage.clear());

    afterAll(() => {
        driver.quit();
        localStorage.clear()
    });

    it("should be able to load CAB", () => {
        driver.get(cab).then(() => {
            driver.getCurrentUrl().then(currentUrl => {
                expect(currentUrl).toEqual(cab);
            });
        });
    });

    /**
     * Find the results of a search on CAB
     * @param query term to search for
     */
    async function searchResults(query: string): Promise<WebElement[]> {
        // Enter search and submit
        const searchBox = await driver.findElement(By.id('crit-keyword'));
        searchBox.sendKeys(query, Key.ENTER);

        // Wait for results to load
        const results = await driver.wait(
            until.elementsLocated(By.className('result')), 1000);

        return results;
    }

    class ScoredElements {
        constructor(public courses: WebElement[], public profs: WebElement[]) { }

        async verify() {
            for (const elt of this.courses.concat(this.profs)) {
                // Color changed away from default
                expect(await elt.getCssValue('color')).not.toBe('rgba(68, 68, 68, 1)');

                // Hover text is raw 1-5 score
                const score = Number.parseFloat(await elt.getAttribute('title'));
                expect(score).toBeLessThanOrEqual(5);
                expect(score).toBeGreaterThanOrEqual(1);

                // data-score (used for styling) is 0-1
                const dataScore = Number.parseFloat(await elt.getAttribute('data-score'));
                expect(dataScore).toBeLessThanOrEqual(1);
                expect(dataScore).toBeGreaterThanOrEqual(0);
            }
        }
    }

    /**
     * Find all scored course and professor elements in current search results,
     * verifying that they have been properly scored
     */
    async function scoredElements(): Promise<ScoredElements> {
        await driver.wait(until.elementsLocated(By.className('scored')), 20000);
        const scored = new ScoredElements(
            await driver.findElements(By.className('scored--course')),
            await driver.findElements(By.className('scored--prof')));
        await scored.verify();
        return scored;
    }

    it("should inject scores for courses known to have reviews", async () => {
        await driver.get(cab);

        // Search for CS courses
        const results = await searchResults("CSCI");
        expect(results.length).toBeGreaterThan(1);

        // There are certainly multiple CS courses and professors with reviews
        const scored = await scoredElements();
        expect(scored.courses.length).toBeGreaterThan(1);
        expect(scored.profs.length).toBeGreaterThan(1);
    }, 30000);

    it("should inject professor scores for each section of a course", async () => {
        await driver.get(cab);

        // Search for course with many sections
        const results = await searchResults("MATH 0100");
        expect(results.length).toBeGreaterThan(1);
        expect(await driver.findElements(By.className('result--group-start'))).toHaveLength(1);

        // Verify that multiple sections are scored
        const scored = await scoredElements();
        expect(scored.courses).toHaveLength(1);
        expect(scored.profs.length).toBeGreaterThan(1);
    }, 30000);
});