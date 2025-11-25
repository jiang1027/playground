
const OLLAMA_BASE_URL = 'https://ollama-ai.weifu.heiyu.space';
const OLLAMA_API_KEY = 'aaa';
const MODEL = "gemma3:12b";

/**
 * @param {string} text
 */
function translateWithOllama(text, targetLang = 'cn') {
    const cnPrompt = `请将以下markdown格式中的日语翻译成中文，只返回翻译结果，不要添加任何解释，并且保持原有的markdown格式。\n\n`;

    const prompt = targetLang === 'cn' 
        ? cnPrompt + text
        : `Please translate the following Japanese text to ${targetLang}, return only the translation without any explanation. \n\n${text}`;

    return fetch(`${OLLAMA_BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OLLAMA_API_KEY}`
        },
        body: JSON.stringify({
            model: MODEL,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.3,
            max_tokens: 5000,
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.choices && data.choices[0] && data.choices[0].message) {
            return data.choices[0].message.content.trim();
        }
        throw new Error('Invalid response from Ollama API');
    })
    .catch(error => {
        console.error('Translation error:', error);
        return text; // 如果翻译失败，返回原文
    });
}

module.exports = {
    translateText: translateWithOllama,
};
