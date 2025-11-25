console.log('background.js loaded');

// 创建右键菜单项
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'preview-link',
        title: 'Preview in Sidebar',
        contexts: ['link']  // 只在链接上显示
    });
    
    console.log('Context menu created');

    if (chrome.sidePanel) {
        if (chrome.sidePanel.setPanelBehavior) {
            chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => {
                console.warn('Unable to set side panel behavior:', error);
            });
        }

        if (chrome.sidePanel.setOptions) {
            chrome.sidePanel.setOptions({ path: 'sidebar/sidebar.html', enabled: true }).catch((error) => {
                console.warn('Unable to set side panel options:', error);
            });
        }
    }
});

chrome.action.onClicked.addListener(async (tab) => {
    if (!chrome.sidePanel || !chrome.sidePanel.open) {
        return;
    }

    try {
        const target = tab?.windowId ? { windowId: tab.windowId } : {};
        await chrome.sidePanel.open(target);
    } catch (error) {
        console.warn('Unable to open side panel on action click:', error);
    }
});

// 监听右键菜单点击事件
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'preview-link') {
        console.log('Preview menu clicked for URL:', info.linkUrl);
        
        // 发送消息到 content script，告诉它预览这个链接
        chrome.tabs.sendMessage(tab.id, {
            action: 'preview-link',
            url: info.linkUrl
        });
    }
});
