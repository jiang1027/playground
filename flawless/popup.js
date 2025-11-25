document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("disagreeButton");
    if (!button) {
        console.warn("Disagree button missing in popup");
        return;
    }

    button.addEventListener("click", () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const [activeTab] = tabs;
            if (!activeTab || activeTab.id === undefined) {
                console.warn("No active tab available for messaging");
                return;
            }

            chrome.tabs.sendMessage(activeTab.id, { type: "DISAGREE_CLICKED" }, () => {
                if (chrome.runtime.lastError) {
                    console.warn("Failed to notify content script", chrome.runtime.lastError.message);
                }

                // close the popup after sending the message
                window.close();
            });
        });
    });
});
