export const extractEmails = (data, userData) => {
    try {
        const { keyword } = userData;

        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const emails = data?.description?.match(emailRegex);
        let array = [];

        if (emails) {
            const filteredEmails = emails.filter((email) => {
                const isValidDomain =
                    !/\.(png|jpg|jpeg|gif|bmp|svg|webp|pdf|doc|docx|xls|xlsx)$/i.test(
                        email,
                    );
                const isValidFormat =
                    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(
                        email,
                    );
                const isValidMailDomain =
                    email.split("@")[1].split(".").length === 2;
                return isValidDomain && isValidFormat && isValidMailDomain;
            });

            array = [...new Set(filteredEmails)];
        }

        if (array.length > 0) {
            return {
                emails: array,
                link: data.link,
                keyword: keyword?.replace("+", " ") || "",
            };
        } else {
            return false;
        }
    } catch (error) {
        console.log("Error in extraction: ", error);
        return false;
    }
};