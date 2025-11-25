// ==UserScript==
// @name         X.com AI Content Detector
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  为X.com上的文章建立AI内容检测评分系统，帮助用户识别高质量内容。
// @author       Your Name
// @match        https://x.com/*
// @match        https://twitter.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const SystemPrompt = `
请对以下文字进行深度分析，评估其由人工智能生成的概率。

## 分析角度包括但不限于：

1. 语言风格与结构特征：是否具有高度模式化、排比式列举？是否存在过度口语化、网络化表达（如“别……不然……”、“直接导致……”）？句式是否过于流畅但缺乏真实情感或深度思考？
2. 逻辑一致性与因果关系：内容中是否存在不合常理的因果推导？例如将现代概念（如“跳槽”“自我推销”“分公司/总公司”）强行套用于古代人物或历史事件。
3. 事实准确性：是否出现明显的历史、文化或常识性错误？例如对人物行为动机、时代背景或事件结果的误读。
4. 创新性与深度：内容是否只是简单罗列“教训”而缺乏独特见解或批判性思考？是否存在过度简化复杂历史现象的现象？
5. 情感与语气：是否带有夸张、煽动性或“鸡汤式”说教口吻？是否频繁使用感叹号、反问句等增强情绪的表达方式？
6. 请综合以上维度，给出一个判断结果（0-100%）和简要理由。

## 输出格式要求： 评估完成后，请严格按照以下四个字段，以行为单位输出最终结果。每个字段只包含其内容，不包含额外的解释或说明。

summary: 一句话总结内容主题（不超过20字）
score: 评分（0-10分，0代表最低分，完全没有阅读的必要，10代表最高分，一定要仔细阅读）
flags: 问题标签1,问题标签2,问题标签3,问题标签4,问题标签5（用英文逗号分隔，最多5个问题标签，若无问题则留空）
reason: 评分原因的简要说明（不超过20字）
analysis_process: 详细描述分析过程，以及给出该评分的理由。

`;


    // 默认配置
    const DEFAULT_CONFIG = {
        ollamaUrl: 'http://192.168.31.221:1234',
        apiKey: '',
        model: 'qwen3-vl-30b-a3b-instruct',
        systemPrompt: SystemPrompt
    };

    // 从存储加载配置
    let config = {
        ollamaUrl: GM_getValue('ollamaUrl', DEFAULT_CONFIG.ollamaUrl),
        apiKey: GM_getValue('apiKey', DEFAULT_CONFIG.apiKey),
        model: GM_getValue('model', DEFAULT_CONFIG.model),
        systemPrompt: GM_getValue('systemPrompt', DEFAULT_CONFIG.systemPrompt)
    };

    // 输出配置到控制台，便于调试
    console.log('AI检测器配置:', config);

    // 已处理的文章ID集合
    const processedArticles = new Set();

    // AI评分可用状态
    let aiScoringEnabled = false;

    // 添加样式
    GM_addStyle(`
        .ai-detector-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
            border-radius: 10px;
            font-size: 11px;
            font-weight: bold;
            color: white;
            margin-left: 8px;
            position: relative;
            top: -2px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }

        .ai-detector-config-modal {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 10000;
            width: 400px;
        }

        .ai-detector-config-modal h3 {
            margin-top: 0;
            color: #333;
        }

        .ai-detector-config-modal label {
            display: block;
            margin-top: 15px;
            color: #555;
            font-weight: bold;
        }

        .ai-detector-config-modal input {
            width: 100%;
            padding: 8px;
            margin-top: 5px;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-sizing: border-box;
        }

        .ai-detector-config-modal select {
            width: 100%;
            padding: 8px;
            margin-top: 5px;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-sizing: border-box;
        }

        .ai-detector-model-row {
            display: flex;
            gap: 8px;
            align-items: flex-end;
        }

        .ai-detector-model-row > div {
            flex: 1;
        }

        .ai-detector-refresh-btn {
            padding: 8px 16px !important;
            margin-top: 0 !important;
            min-width: 80px;
        }

        .ai-detector-config-modal button {
            margin-top: 20px;
            padding: 10px 20px;
            background: #1da1f2;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            margin-right: 10px;
        }

        .ai-detector-config-modal button:hover {
            background: #1991db;
        }

        .ai-detector-config-modal button.cancel {
            background: #666;
        }

        .ai-detector-config-modal button.cancel:hover {
            background: #555;
        }

        .ai-detector-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            z-index: 9999;
        }

        // /* 修改推特导航栏字体大小 */
        // header nav[role="navigation"] * {
        //     font-size: 18px !important;
        // }

        // header nav[role="navigation"] a > div,
        // header nav[role="navigation"] button > div {
        //     padding: 2px !important;
        // }

        // header[role="banner"] > div > div > div {
        //     width: 200px !important;
        // }
    `);

    // 创建配置界面
    function createConfigModal() {
        // 创建背景遮罩
        const backdrop = document.createElement('div');
        backdrop.className = 'ai-detector-backdrop';

        // 创建模态框
        const modal = document.createElement('div');
        modal.className = 'ai-detector-config-modal';
        modal.innerHTML = `
            <h3>AI检测器配置</h3>
            <label>
                Ollama服务器地址:
                <input type="text" id="ai-detector-ollama-url" value="${config.ollamaUrl}" placeholder="http://localhost:11434">
            </label>
            <label>
                API Key (可选):
                <input type="text" id="ai-detector-api-key" value="${config.apiKey}" placeholder="留空如果不需要">
            </label>
            <label>
                模型名称:
                <div class="ai-detector-model-row">
                    <div>
                        <select id="ai-detector-model">
                            <option value="${config.model}">${config.model}</option>
                        </select>
                    </div>
                    <button id="ai-detector-refresh-models" class="ai-detector-refresh-btn">刷新</button>
                </div>
            </label>
            <label>
                系统提示词:
                <textarea id="ai-detector-system-prompt" rows="8" style="width: 100%; padding: 8px; margin-top: 5px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; font-family: monospace; font-size: 12px;">${config.systemPrompt.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
            </label>
            <div>
                <button id="ai-detector-save">保存</button>
                <button id="ai-detector-cancel" class="cancel">取消</button>
            </div>
        `;

        document.body.appendChild(backdrop);
        document.body.appendChild(modal);

        // 刷新模型列表
        const refreshModels = async () => {
            const ollamaUrl = document.getElementById('ai-detector-ollama-url').value;
            const modelSelect = document.getElementById('ai-detector-model');
            const refreshBtn = document.getElementById('ai-detector-refresh-models');

            if (!ollamaUrl) {
                alert('请先输入Ollama服务器地址');
                return;
            }

            refreshBtn.disabled = true;
            refreshBtn.textContent = '加载中...';

            try {
                await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: `${ollamaUrl}/v1/models`,
                        headers: {
                            'Content-Type': 'application/json',
                            ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
                        },
                        onload: function(response) {
                            try {
                                const data = JSON.parse(response.responseText);
                                // OpenAI兼容格式: data.data 是模型数组
                                const models = data.data || [];

                                // 保存当前选中的值
                                const currentValue = modelSelect.value;

                                // 清空并重新填充选项
                                modelSelect.innerHTML = '';

                                if (models.length === 0) {
                                    modelSelect.innerHTML = '<option value="">未找到模型</option>';
                                } else {
                                    models.forEach(model => {
                                        const option = document.createElement('option');
                                        option.value = model.id;
                                        option.textContent = model.id;
                                        modelSelect.appendChild(option);
                                    });

                                    // 恢复之前选中的值（如果存在）
                                    const foundOption = Array.from(modelSelect.options).find(opt => opt.value === currentValue);
                                    if (foundOption) {
                                        modelSelect.value = currentValue;
                                    }
                                }

                                resolve();
                            } catch (error) {
                                reject(new Error('解析模型列表失败: ' + error.message));
                            }
                        },
                        onerror: function(error) {
                            reject(new Error('获取模型列表失败，请检查服务器地址'));
                        }
                    });
                });

                refreshBtn.textContent = '刷新';
                refreshBtn.disabled = false;
            } catch (error) {
                console.error('刷新模型列表失败:', error);
                alert(error.message);
                refreshBtn.textContent = '刷新';
                refreshBtn.disabled = false;
            }
        };

        // 刷新按钮处理
        document.getElementById('ai-detector-refresh-models').onclick = refreshModels;

        // 保存按钮处理
        document.getElementById('ai-detector-save').onclick = () => {
            config.ollamaUrl = document.getElementById('ai-detector-ollama-url').value;
            config.apiKey = document.getElementById('ai-detector-api-key').value;
            config.model = document.getElementById('ai-detector-model').value;
            config.systemPrompt = document.getElementById('ai-detector-system-prompt').value;

            GM_setValue('ollamaUrl', config.ollamaUrl);
            GM_setValue('apiKey', config.apiKey);
            GM_setValue('model', config.model);
            GM_setValue('systemPrompt', config.systemPrompt);

            backdrop.remove();
            modal.remove();

            alert('配置已保存！');
        };

        // 取消按钮处理
        document.getElementById('ai-detector-cancel').onclick = () => {
            backdrop.remove();
            modal.remove();
        };

        // 点击背景关闭
        backdrop.onclick = () => {
            backdrop.remove();
            modal.remove();
        };
    }

    // 注册菜单命令
    GM_registerMenuCommand('配置AI检测器', createConfigModal);

    // 检测模型可用性
    async function checkModelAvailability() {
        console.log('正在检测模型可用性...');

        try {
            const models = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: `${config.ollamaUrl}/v1/models`,
                    headers: {
                        'Content-Type': 'application/json',
                        ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
                    },
                    timeout: 1000,
                    onload: function(response) {
                        try {
                            const data = JSON.parse(response.responseText);
                            resolve(data.data || []);
                        } catch (error) {
                            reject(new Error('解析模型列表失败: ' + error.message));
                        }
                    },
                    onerror: function(error) {
                        reject(new Error('无法连接到服务器'));
                    },
                    ontimeout: function() {
                        reject(new Error('连接超时'));
                    }
                });
            });

            // 检查当前配置的模型是否在列表中
            const modelExists = models.some(m => m.id === config.model);

            if (models.length === 0) {
                console.warn('服务器上没有可用的模型');
                aiScoringEnabled = false;
                return false;
            } else if (!modelExists) {
                console.warn(`配置的模型 "${config.model}" 在服务器上不存在`);
                console.log('可用的模型:', models.map(m => m.id).join(', '));
                aiScoringEnabled = false;
                return false;
            } else {
                console.log(`模型 "${config.model}" 可用，AI评分功能已启用`);
                aiScoringEnabled = true;
                return true;
            }
        } catch (error) {
            console.error('检测模型可用性失败:', error.message);
            aiScoringEnabled = false;
            return false;
        }
    }

    // 获取百分比对应的颜色
    function getColorForScore(score) {
        // 从绿色(0%)到红色(100%)
        const hue = (1 - score / 10) * 120; // 120是绿色，0是红色
        return `hsl(${hue}, 70%, 50%)`;
    }

    // 添加AI检测标记
    function addArticleScore(element, analysisResult) {
        // 检查是否已经添加过标记
        if (element.querySelector('.ai-detector-badge')) {
            return;
        }

        const score = analysisResult.score || 0;
        
        // 构建悬停提示信息
        const tooltipParts = [
            `毒性评分: ${score}/10`,
            `摘要: ${analysisResult.summary || '无'}`,
        ];
        
        if (analysisResult.flags && analysisResult.flags.length > 0) {
            tooltipParts.push(`标签: ${analysisResult.flags.join(', ')}`);
        }
        
        if (analysisResult.reason) {
            tooltipParts.push(`原因: ${analysisResult.reason}`);
        }

        const badge = document.createElement('span');
        badge.className = 'ai-detector-badge';
        badge.textContent = `${score}`;
        badge.style.background = getColorForScore(score);
        badge.title = tooltipParts.join('\n');

        // 寻找合适的位置插入标记

        const getContainerElement = (el) => {
            const elem = el.querySelector('[data-testid="caret"]');
            return getNthParent(elem, 4);
        }

        const elem = getContainerElement(element);

        if (elem) {
            // elem.style.display = 'flex';
            // elem.style.alignItems = 'center';
            elem.appendChild(badge);
        }
    }

    // 调用Ollama API分析内容
    async function analyzeWithOllama(text) {
        const systemPrompt = config.systemPrompt;

        const requestBody = {
            model: config.model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text }
            ],
            stream: false
        };

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: `${config.ollamaUrl}/v1/chat/completions`,
                headers: {
                    'Content-Type': 'application/json',
                    ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
                },
                data: JSON.stringify(requestBody),
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        // OpenAI兼容格式: data.choices[0].message.content
                        const content = data.choices?.[0]?.message?.content || 'score: 1';

                        console.log('文章内容: ', text);
                        console.log('原始结果:', content);

                        // 解析基于行的格式
                        let analysisResult;
                        try {
                            const lines = content.split('\n').map(line => line.trim()).filter(line => line);
                            const result = {};

                            // 解析每一行
                            lines.forEach(line => {
                                const colonIndex = line.indexOf(':');
                                if (colonIndex > 0) {
                                    const key = line.substring(0, colonIndex).trim();
                                    const value = line.substring(colonIndex + 1).trim();
                                    result[key] = value;
                                }
                            });

                            // 提取并验证各个字段
                            const summary = result['summary'] || '无摘要';
                            const score = parseInt(result['score']) || 5;
                            const flags = result['flags'] ? result['flags'].split(',').map(f => f.trim()).filter(f => f) : [];
                            const reason = result['reason'] || '无';

                            analysisResult = {
                                score: Math.min(10, Math.max(0, score)),
                                summary: summary,
                                flags: flags,
                                reason: reason
                            };

                            console.log('解析后的结果:', analysisResult);
                        } catch (parseError) {
                            // 如果解析失败，尝试提取数字作为score
                            console.warn('行格式解析失败，尝试提取数字:', parseError);
                            console.warn('内容:', content);
                            const score = parseInt(content.match(/\d+/)?.[0] || '5', 10);
                            analysisResult = {
                                score: Math.min(10, Math.max(0, score)),
                                summary: "解析失败",
                                flags: [],
                                reason: "解析失败"
                            };
                        }

                        console.log('AI检测结果:', analysisResult);
                        resolve(analysisResult);
                    } catch (error) {
                        console.error('解析响应失败:', error, response.responseText);
                        // 返回默认的分析结果对象
                        resolve({
                            score: 5,
                            summary: "解析失败",
                            flags: [],
                            reason: "解析失败"
                        });
                    }
                },
                onerror: function(error) {
                    console.error('API调用失败:', error);
                    // 返回默认的分析结果对象
                    resolve({
                        score: 5,
                        summary: "API调用失败",
                        flags: [],
                        reason: "API调用失败"
                    });
                }
            });
        });
    }

    // 提取文章文本内容
    function extractArticleText(article) {
        const textElement = article.querySelector('[data-testid="tweetText"]') ||
                           article.querySelector('[lang]') ||
                           article.querySelector('[dir="ltr"]');
        return textElement ? textElement.textContent.trim() : '';
    }

    const Global = {
        articleId: 0,
    };

    // 等待"显示更多"内容加载完成
    function waitForContentExpansion(article, maxWait = 2000) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const checkInterval = setInterval(() => {
                const showMoreButton = article.querySelector('[data-testid="tweet-text-show-more-link"]');
                if (!showMoreButton || Date.now() - startTime > maxWait) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);
        });
    }

    // 处理文章
    async function processArticle(article) {
        // 检查是否有"显示更多"按钮
        const showMoreButton = article.querySelector('[data-testid="tweet-text-show-more-link"]');
        if (showMoreButton) {
            console.log('发现"显示更多"按钮，点击展开...', showMoreButton);

            // 尝试方法1: 找到按钮的Role="button"父元素并点击它
            let clickTarget = showMoreButton.closest('[role="button"]') || showMoreButton;
            console.log('点击目标:', clickTarget);

            // 阻止链接导航但允许其他事件处理
            const preventNavigation = (e) => {
                // 只阻止链接的默认行为，不阻止事件传播
                if (e.target.tagName === 'A' || e.target.closest('a')) {
                    e.preventDefault();
                }
            };

            // 在链接上添加监听器
            const linkElement = showMoreButton.closest('a') || showMoreButton.querySelector('a');
            if (linkElement) {
                linkElement.addEventListener('click', preventNavigation, { capture: true, once: true });
            }

            // 直接点击
            clickTarget.click();

            // 等待内容加载完成
            await waitForContentExpansion(article);
            console.log('内容展开完成');
        }

        // 生成唯一ID
        const text = extractArticleText(article);
        if (!text) return; // 忽略空内容

        const aid = ++Global.articleId;
        const articleId = `article-${aid}`;

        if (processedArticles.has(articleId)) {
            return;
        }

        processedArticles.add(articleId);

        // 为文章添加ID属性，方便定位
        article.setAttribute('data-article-id', articleId);

        // 如果AI评分功能未启用，跳过评分
        if (!aiScoringEnabled) {
            console.log('AI评分功能未启用，跳过文章评分');
            return;
        }

        try {
            const analysisResult = await analyzeWithOllama(text);
            addArticleScore(article, analysisResult);

            // 输出分析结果到控制台
            console.log('文章分析完成:', {
                id: articleId,
                score: analysisResult.score,
                summary: analysisResult.summary,
                flags: analysisResult.flags,
                reason: analysisResult.reason
            });
        } catch (error) {
            console.error('处理文章失败:', error);
        }
    }

    // 创建Intersection Observer
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                processArticle(entry.target);
            }
        });
    }, {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    });

    // 监控新文章
    function observeArticles() {
        // X.com的文章选择器
        const articles = document.querySelectorAll('article[data-testid="tweet"]');
        articles.forEach(article => {
            observer.observe(article);
        });
    }

    // 使用MutationObserver监控DOM变化
    const mutationObserver = new MutationObserver(() => {
        observeArticles();
        hideUpsellElements();
    });

    function getNthParent(element, n) {
        let current = element;
        for (let i = 0; i < n && current; i++) {
            current = current.parentElement;
        }
        return current;
    }


    // 隐藏推广元素
    function hideUpsellElements() {
        // 查找所有包含 data-testid="super-upsell-UpsellCardRenderProperties" 的元素
        const upsellElements = document.querySelectorAll('[data-testid="super-upsell-UpsellCardRenderProperties"]');

        // 获取其父元素的父元素（向上2层）
        const elem = getNthParent(upsellElements[0], 2);
        if (elem) {
            elem.style.display = 'none';
            console.log('已隐藏推广元素');
        }

        // header nav[role="navigation"]

    }

    // 开始监控
    async function startObserving() {
        // 检测模型可用性
        await checkModelAvailability();

        // 隐藏推广元素（初次执行）
        hideUpsellElements();

        observeArticles();
        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // 等待页面加载完成后开始
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(startObserving, 1000);
    } else {
        window.addEventListener('DOMContentLoaded', () => {
            setTimeout(startObserving, 1000);
        });
    }

})();


