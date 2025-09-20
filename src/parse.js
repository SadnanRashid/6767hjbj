const makeProviderArray = (input) => {
    const { scrapeGmail, scrapeOutlook, scrapeYahoo, scrapeCustom } = input;

    let providers = [];

    if (Array.isArray(scrapeCustom)) {
        providers = scrapeCustom
            .filter((email) => email !== "example.com")
            .map((email) => (email.startsWith("@") ? email.slice(1) : email));
    }

    const predefined = [
        { enabled: scrapeGmail, domain: "gmail.com" },
        { enabled: scrapeOutlook, domain: "outlook.com" },
        { enabled: scrapeYahoo, domain: "yahoo.com" },
    ];

    for (const { enabled, domain } of predefined) {
        if (enabled && !providers.includes(domain)) {
            providers.push(domain);
        }
    }

    // 🛑 If empty, default to ["gmail.com"]
    if (providers.length === 0) {
        providers.push("gmail.com");
    }

    return providers;
};

export const makeSingleLink = (input) => {
    const { keyword = "" } = input;
    const providers = makeProviderArray(input);

    const domainQuery = providers.map((domain) => `"@${domain}"`).join(" OR ");
    const query = `${keyword} (${domainQuery}) site:instagram.com/`;
    const encodedUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&start=0`;

    return {
        url: encodedUrl,
        userData: {
            label: "search",
            keyword,
            providers,
        },
    };
};