import { Actor } from "apify";
import { PlaywrightCrawler, RequestQueue } from "crawlee";
import { router } from "./routes.js";
import { makeAllLinks } from "./parser.js";

await Actor.init();

const input = await Actor.getInput();
export const maximumEmails = input.pagesToScrape || 20;

// Proxy configuration setup
const proxyConfiguration = await Actor.createProxyConfiguration(
    input.proxyConfiguration,
);

// Generate initial requests
const startUrls = makeAllLinks(input);

// Initialize and populate request queue
export const requestQueue = await RequestQueue.open();
for (const { url, userData } of startUrls) {
    try {
        await requestQueue.addRequest({ url, userData });
    } catch (e) {
        console.error("Error adding request to queue:", e);
    }
}

export const totalLinks = startUrls.length;

// Configure Playwright crawler with stealth setup
const crawler = new PlaywrightCrawler({
    requestQueue,
    proxyConfiguration,
    maxConcurrency: 1,
    requestHandler: router,
    launchContext: {
        launchOptions: {
            headless: true,
            args: ["--disable-gpu"],
        },
    },
});

await crawler.run();
await Actor.exit();