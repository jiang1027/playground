const DEFAULT_OLLAMA_BASE_URL = "https://ollama-ai.weifu.heiyu.space";
const DEFAULT_OLLAMA_MODEL = "gemma3:4b";
const STORAGE_KEYS = {
    baseUrl: "ollamaBaseUrl",
    model: "ollamaModel"
};

async function loadSettings() {
    return new Promise((resolve) => {
        chrome.storage.sync.get({
            [STORAGE_KEYS.baseUrl]: DEFAULT_OLLAMA_BASE_URL,
            [STORAGE_KEYS.model]: DEFAULT_OLLAMA_MODEL
        }, (items) => {
            resolve({
                baseUrl: items[STORAGE_KEYS.baseUrl],
                model: items[STORAGE_KEYS.model]
            });
        });
    });
}

async function fetchSentiment(text) {
    const { baseUrl, model } = await loadSettings();
    const endpoint = `${baseUrl.replace(/\/$/, "")}/api/chat`;

    const systemPrompt = `你是一个杠精，对于每一个用户输入，用一句话进行总结，要求如下。
1. 极尽调侃和揶揄的能力，使用辛辣的语言，提出富有哲理的反对意见
2. 如果无法分析出用户的文章的内容，返回空字符串
`;

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model,
            stream: false,
            messages: [
                {
                    role: "system",
                    content: systemPrompt,
                },
                {
                    role: "user",
                    content: text
                }
            ]
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const sentiment = data?.message?.content?.trim();

    if (!sentiment) {
        throw new Error("Ollama returned an empty response");
    }

    return sentiment;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== "ANALYZE_SENTIMENT") {
        return;
    }

    if (!message.text || typeof message.text !== "string") {
        sendResponse({ error: "Invalid text payload" });
        return;
    }

    (async () => {
        try {
            const sentiment = await fetchSentiment(message.text);
            sendResponse({ sentiment });
        } catch (error) {
            console.warn("Ollama request failed", error);
            sendResponse({ error: error.message || "Sentiment request failed" });
        }
    })();

    return true;
});
