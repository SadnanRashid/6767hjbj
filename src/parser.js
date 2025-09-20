const makeProviderArray = (input) => {
    const { scrapeGmail, scrapeOutlook, scrapeYahoo, scrapeCustom } = input;

    // Process scrapeCustom: Remove "example.com" and strip "@" if it exists at the start
    let custom = [];
    if (scrapeCustom && scrapeCustom.length > 0) {
        custom = scrapeCustom
            .filter((email) => email !== "example.com")
            .map((email) => (email.startsWith("@") ? email.slice(1) : email));
    }

    // Add predefined domains if they are enabled and not already in the list
    if (scrapeGmail && custom.indexOf("gmail.com") === -1) {
        custom.push("gmail.com");
    }
    if (scrapeOutlook && custom.indexOf("outlook.com") === -1) {
        custom.push("outlook.com");
    }
    if (scrapeYahoo && custom.indexOf("yahoo.com") === -1) {
        custom.push("yahoo.com");
    }

    return custom;
};

export const makeAllLinks = (input) => {
    // const link = "site:linkedin.com/in/ intitle:software engineer";
    const allLinks = [];
    const allProviders = makeProviderArray(input);
    const { keyword, pagesToScrape } = input;

    const nProv = allProviders.length;

    if (keyword && keyword.length > 0) {
        const nL = keyword.length;
        // console.log("Location is present");
        for (let i = 0; i < nL; i++) {
            for (let j = 0; j < nProv; j++) {
                const provider = allProviders[j];
                const link = providerMake(provider, keyword[i], pagesToScrape);
                allLinks.push(...link);
            }
        }
    } else {
        // console.log("Location is not present", location);
        for (let j = 0; j < nProv; j++) {
            const provider = allProviders[j];
            const link = providerMake(provider, "", pagesToScrape);
            allLinks.push(...link);
        }
    }

    return allLinks;
};

const providerMake = (provider, profession, pagesToScrape) => {
    const links = [];
    provider = provider.toLowerCase();
    profession = profession.toLowerCase();
    profession = profession.replace(" ", "+");

    // for (let i = 0; i < 1; i++) {
    let link = "";

    if (profession) {
        link = `https://www.google.com/search?q=site:pinterest.com+${profession}+"@${provider}"&start=0`;
    } else {
        link = `https://www.google.com/search?q=site:pinterest.com+"@${provider}"&start=0`;
    }

    links.push({
        url: link,
        userData: {
            label: "search",
            provider,
            keyword: profession,
            pagenum: 0,
        },
    });
    // }

    return links;
};