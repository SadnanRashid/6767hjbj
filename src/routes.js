import { Dataset, createPuppeteerRouter } from "crawlee";
import { extractEmails } from "./extractor.js";
// import { totalLinks } from "./main.js";
import { Actor } from "apify";
// import { requestQueue, maximumEmails } from "./main.js";

export const router = createPuppeteerRouter();

let done = 1;

let limit = 0;
const dupliChecker = new Set();

router.addHandler("search", async ({ request, page, log, proxyInfo }) => {
    try {
        console.log(`Using proxy: ${proxyInfo}`);
        log.info(
            `Scraping emails for email domain ${request?.userData?.provider} and keyword ${request?.userData?.keyword}, url: ${request.url}`,
        );
        // Set status message
        await Actor.setStatusMessage(`Scraping emails, Found: ${limit} emails`);
        done++;

        // Extract data
        const data = await page.evaluate(() => {
            // Check if it has recaptcha
            const recaptcha = document.querySelector("#rc-anchor-container");
            if (recaptcha) {
                log.error(
                    `Captcha verification required. Please configure proxy for better results.`,
                );
                return;
            }

            const results = [];
            const items = document.querySelectorAll(".MjjYud");
            items.forEach((item) => {
                const titleElement = item.querySelector("h3");
                const linkElement = item.querySelector("a");
                const descriptionElement = item.querySelector(".VwiC3b");

                const title = titleElement ? titleElement.innerText : null;
                const link = linkElement ? linkElement.href : null;
                const description = descriptionElement
                    ? descriptionElement.textContent
                    : null;

                if (title && link) {
                    // Only include items with valid title and link
                    results.push({ title, link, description });
                }
            });
            return results;
        });

        for (const item of data) {
            const emails = extractEmails(item, request?.userData);
            if (emails) {
                if (emails.emails.length > 0) {
                    for (let i = 0; i < emails.emails.length; i++) {
                        if (
                            !dupliChecker.has(emails.emails[i]) &&
                            limit < maximumEmails
                        ) {
                            limit = limit + 1;
                            await Dataset.pushData({
                                email: emails.emails[i],
                                link: emails.link,
                                keyword: emails.keyword,
                            });
                            // console.log(
                            //     {
                            //         email: emails.emails[i],
                            //         link: emails.link,
                            //         keyword: emails.keyword,
                            //         limit: limit,
                            //         sourcelink: request.url,
                            //         provider: request.userData.provider,
                            //     },
                            //     emails.emails.length
                            // );
                            dupliChecker.add(emails.emails[i]);
                        }
                    }

                    // await Dataset.pushData(emails);
                }
            }
        }

        // Checker
        const hasNextPage = await page.evaluate(() => {
            const nextButton = document.querySelector("#pnnext");
            return !!nextButton;
        });
        console.log("nextpage: ", hasNextPage);

        if (hasNextPage) {
            // Determine the next page's link
            const nextPageUrl = await page.evaluate(() => {
                const nextButton = document.querySelector("#pnnext");
                return nextButton ? nextButton.href : null;
            });

            let link = "";
            if (nextPageUrl && limit < maximumEmails) {
                // log.info(`Next page found: ${nextPageUrl}`);
                try {
                    if (request?.userData?.keyword) {
                        link = `https://www.google.com/search?q=site:pinterest.com+${
                            request?.userData?.keyword
                        }+"@${request?.userData?.provider}"&start=${
                            request?.userData?.pagenum * 2
                        }0`;
                    } else {
                        link = `https://www.google.com/search?q=site:pinterest.com+"@${request?.userData?.provider}"&start=${request?.userData?.pagenum}0`;
                    }
                    // console.log(link, "Added LINK");
                    await requestQueue.addRequest({
                        url: link,
                        userData: {
                            label: "search",
                            provider: request.userData.provider,
                            keyword: request.userData.keyword || "",
                            pagesToScrape: request.userData.pagesToScrape,
                            pagenum: request.userData.pagenum + 1,
                        },
                    });
                } catch (e) {
                    log.info("Faced some minor issue, Continuing...");
                }
            }
        } else {
            // log.info(
            //     `No more scrapable emails found for ${request?.userData?.provider} and ${request?.userData?.keyword}`
            // );
        }
    } catch (error) {
        log.error(error);
    }
});

router.addDefaultHandler(async ({ request, page, log }) => {
    const title = await page.title();
    const url = await page.url;
    console.log(url, "----");
});