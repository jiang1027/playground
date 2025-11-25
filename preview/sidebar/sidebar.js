const activeTabUrlElement = document.getElementById('active-tab-url');

refreshActiveTabUrl();

chrome.tabs.onActivated.addListener(() => {
    refreshActiveTabUrl();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!tab?.active) {
        return;
    }

    if (changeInfo.status === 'complete' || changeInfo.url) {
        refreshActiveTabUrl(tab);
    }
});

async function refreshActiveTabUrl(tabFromEvent) {
    try {
        const tab = tabFromEvent ?? await getActiveTab();
        const url = tab?.url ? tab.url : '未找到可用的标签页。';
        activeTabUrlElement.textContent = url;
    } catch (error) {
        console.warn('Unable to resolve active tab url:', error);
        activeTabUrlElement.textContent = '无法读取当前标签页地址。';
    }
}

function getActiveTab() {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const runtimeError = chrome.runtime.lastError;

            if (runtimeError) {
                reject(new Error(runtimeError.message));
                return;
            }

            resolve(tabs?.[0]);
        });
    });
}
