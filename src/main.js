import { Actor, Dataset } from "apify";
import { makeSingleLink } from "./parse.js";
import { extractEmails } from "./extractor.js";
import { chromium } from "playwright";
import proxyChain from "proxy-chain";

await Actor.init();
const input = await Actor.getInput();
export const maximumEmails = input?.pagesToScrape || 20;

// Proxy configuration setup
const proxyConfiguration = await Actor.createProxyConfiguration(
    input?.proxyConfiguration,
);

const startUrl = makeSingleLink(input);
// console.log("start url: ", startUrl);

// helpers
const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function humanType(page, selector, text) {
    const element = await page.$(selector);
    await element.click({ delay: 100 });
    for (const char of text) {
        await element.type(char, { delay: 50 + Math.random() * 100 });
        if (Math.random() > 0.9) await wait(100 + Math.random() * 200);
    }
}

// duplicate checker
const dupliChecker = new Set();
// flag to keep counting and counting and counting lol
let flag = 0;
let newUrl = "";

async function googleSearchScraper() {
    let captchaRetries = 0;
    const maxCaptchaRetries = 10;
    try {
        let currentUrl = startUrl.url;

        // setup proxy
        const proxyUrl = proxyConfiguration
            ? await proxyConfiguration.newUrl()
            : null;
        if (proxyUrl) {
            newUrl = await proxyChain.anonymizeProxy(proxyUrl);
        }

        while (currentUrl && flag < maximumEmails) {
            // Start browser
            const browser = await chromium.launch({
                headless: false,
                proxy: proxyUrl ? { server: newUrl } : undefined,
                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-blink-features=AutomationControlled",
                    // ...(proxyUrl ? [`--proxy-server=${proxyUrl}`] : []),
                ],
            });

            const context = await browser.newContext();
            // {
            //     userAgent:
            //         USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
            //     viewport: {
            //         width: 1366 + Math.floor(Math.random() * 100),
            //         height: 768 + Math.floor(Math.random() * 100),
            //     },
            //     locale: "en-US",
            //     timezoneId: "America/New_York",
            //     geolocation: {
            //         longitude: -74 + Math.random() * 5,
            //         latitude: 40 + Math.random() * 5,
            //     },
            // });

            const page = await context.newPage();

            // console.log(currentUrl, "--x--");
            // Block unnecessary resources
            // await page.route("**/*", (route) => {
            //     const blockResources = ["image", "stylesheet", "font", "media"];
            //     if (blockResources.includes(route.request().resourceType())) {
            //         route.abort();
            //     } else {
            //         route.continue();
            //     }
            // });

            // test the fucking ip
            // const response = await page.goto(
            //     "https://api.ipify.org?format=json",
            //     {
            //         timeout: 30000,
            //     },
            // );
            // console.log(`Current IP: ${await page.content()}`);

            // Navigate with random delay
            await page.goto(currentUrl, {
                waitUntil: "domcontentloaded",
                timeout: 60000,
            });

            // CAPTCHA detection
            const captcha = await page.evaluate(() => {
                return (
                    document.querySelector("form#captcha-form") !== null ||
                    document.body.innerText.includes("CAPTCHA")
                );
            });

            if (captcha) {
                captchaRetries++;
                console.log(`CAPTCHA detected!`);
                if (!newUrl) {
                    console.warn(
                        "No proxy detected. Consider enabling proxy to avoid CAPTCHA.",
                    );
                }

                try {
                    await browser.close();
                } catch (e) {}

                if (captchaRetries >= maxCaptchaRetries) {
                    console.error(
                        `CAPTCHA hit ${maxCaptchaRetries} times. Exiting crawler.`,
                    );
                    await Actor.exit();
                    await proxyChain.closeAnonymizedProxy(newUrl, true);
                    process.exit(1);
                } else {
                    // Wait a bit before retrying
                    await wait(1000);
                    continue; // Retry from the current URL
                }
            }

            // Extract results
            const results = await page.$$eval("div.MjjYud", (els) =>
                els
                    .map((el) => {
                        try {
                            return {
                                title: el.querySelector("h3")?.innerText || "",
                                link: el.querySelector("a[href]")?.href || "",
                                description:
                                    el.querySelector("div.VwiC3b")?.innerText ||
                                    "",
                            };
                        } catch {
                            return null;
                        }
                    })
                    .filter(Boolean),
            );

            // console.log(`Successfully scraped ${results.length} results`);
            // fs.writeFileSync("cookies.json", JSON.stringify(await context.cookies()));

            for (const item of results) {
                if (item.title && item.link) {
                    const emails = extractEmails(
                        {
                            title: item.title,
                            link: item.link,
                            description: item.description,
                        },
                        { keyword: "seo" },
                    );

                    if (emails && emails.emails.length > 0) {
                        for (const email of emails.emails) {
                            if (!dupliChecker.has(email)) {
                                await Dataset.pushData({
                                    email: email,
                                    link: emails.link,
                                    keyword: input?.keyword || "NA",
                                });
                                dupliChecker.add(email);
                                flag = flag + 1;
                            }
                        }
                    }
                }
            }

            console.log("Emails scraped so far: ", flag);

            // check next button and if yes then open link next
            const nextButton = await page.$("a#pnnext");
            if (nextButton) {
                const nextHref = await nextButton.getAttribute("href");

                // Construct full URL for next page
                currentUrl = new URL(nextHref, currentUrl).toString();
                // console.log(`Next page URL: ${currentUrl}`);

                // Add random delay before next page
                // await wait(2000 + Math.random() * 3000);
            } else {
                console.log("No more pages available");
                currentUrl = null;
            }

            //close page
            // await page.close();
            await browser.close();
        }
    } catch (error) {
        console.error("Scraping:", error.message);
    } finally {
        try {
            await proxyChain.closeAnonymizedProxy(newUrl, true);
        } catch (error) {}
    }
}

await googleSearchScraper();

await Actor.exit();

function parseCredentials(urlString) {
    try {
        const url = new URL(urlString);
        return {
            username: url.username,
            password: url.password,
        };
    } catch (error) {
        console.log("Unable to use proxy. Please try again later.");
        return null;
    }
}
