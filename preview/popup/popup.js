
console.log('popup.js loaded');

const btnTest = document.getElementById("btn_test");
if (btnTest) {
    btnTest.onclick = function() {
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            chrome.tabs.sendMessage(
                tabs[0].id,
                {
                    action: "testaction",
                    tabId: tabs[0].id
                },
                function(response) {
                    console.log('Response from content script:', response);
                    // window.close();
                }
            );
        });
    };
}
