// ========== 配置 ==========
let API_CONFIG = {
    baseUrl: 'http://192.168.31.201:1234/v1',  // LM Studio 默认地址
    model: 'qwen/qwen3-30b-a3b',  // 从服务器获取
    apiKey: 'lm-studio'  // LM Studio 不需要真实 key，但 API 格式需要
};

// ========== 辅助工具 ==========
// 剥离 <think> 与 <no_think> 标签内容，返回清理后的文本
function stripThinkBlocks(text) {
    if (!text) return text;
    // 正常闭合的标签
    let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/<no_think>[\s\S]*?<\/no_think>/gi, '');
    // 未闭合的残缺标签 (容错) - 删除起始标签到末尾
    cleaned = cleaned.replace(/<think>[\s\S]*$/i, '')
        .replace(/<no_think>[\s\S]*$/i, '');
    return cleaned.trim();
}

// 抽取 <think>/<no_think> 内容，供日志或后续可视化
function extractThoughtBlocks(text) {
    const blocks = [];
    if (!text) return blocks;
    const regex = /<(think|no_think)>([\s\S]*?)<\/(think|no_think)>/gi;
    let match;
    while ((match = regex.exec(text)) !== null) {
        blocks.push({ tag: match[1], content: match[2].trim() });
    }
    // 容错：只有起始标签没有闭合
    const orphanThink = text.match(/<think>([\s\S]*)$/i);
    if (orphanThink) {
        blocks.push({ tag: 'think', content: orphanThink[1].trim(), orphan: true });
    }
    const orphanNoThink = text.match(/<no_think>([\s\S]*)$/i);
    if (orphanNoThink) {
        blocks.push({ tag: 'no_think', content: orphanNoThink[1].trim(), orphan: true });
    }
    return blocks;
}

// ========== 日志工具 ==========
let $logList, $logContainer;
let $inputText, $btnAnalyze, $btnCancelAnalyze, $btnClearLog, $resultSection, $resultDisplay;
// 配置面板元素
let $apiBaseUrl, $apiModel, $apiKey, $btnRefreshModels, $modelStatus;
// 用于取消流式请求
let currentAbortController = null;

function log(message, type = 'info') {
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    const $li = $('<li>')
        .addClass(`log-${type}`)
        .html(`<span class="log-time">[${time}]</span>${$('<div>').text(message).html()}`);

    $logList.append($li);
    // 自动滚动到底部
    $logContainer.scrollTop($logContainer[0].scrollHeight);
}

// 日志快捷方法
const logger = {
    info: (msg) => log(msg, 'info'),
    success: (msg) => log(msg, 'success'),
    error: (msg) => log(msg, 'error'),
    warn: (msg) => log(msg, 'warn')
};

// ========== 主逻辑 ==========
$(document).ready(function () {
    // 初始化 DOM 引用
    $logList = $('#log-list');
    $logContainer = $('#log-container');
    $inputText = $('#input-text');
    $btnAnalyze = $('#btn-analyze');
    $btnCancelAnalyze = $('#btn-cancel-analyze');
    $btnClearLog = $('#btn-clear-log');
    $resultSection = $('#result-section');
    $resultDisplay = $('#result-display');

    // 配置面板元素
    $apiBaseUrl = $('#api-base-url');
    $apiModel = $('#api-model');
    $apiKey = $('#api-key');
    $btnRefreshModels = $('#btn-refresh-models');
    $modelStatus = $('#model-status');

    // 初始状态：取消按钮禁用
    $btnCancelAnalyze.prop('disabled', true);

    // 刷新模型列表按钮
    $btnRefreshModels.on('click', refreshModelList);

    // 模型选择变化时更新配置
    $apiModel.on('change', function () {
        API_CONFIG.model = $(this).val();
        logger.info(`已选择模型: ${API_CONFIG.model || '(未选择)'}`);
    });

    // API 地址变化时更新配置
    $apiBaseUrl.on('change', function () {
        API_CONFIG.baseUrl = $(this).val().trim();
        logger.info(`API 地址已更新: ${API_CONFIG.baseUrl}`);
    });

    // API Key 变化时更新配置
    $apiKey.on('change', function () {
        API_CONFIG.apiKey = $(this).val().trim() || 'lm-studio';
        logger.info('API Key 已更新');
    });

    // 清空日志
    $btnClearLog.on('click', () => {
        $logList.empty();
        logger.info('日志已清空');
    });

    // 取消分析按钮点击事件
    $btnCancelAnalyze.on('click', () => {
        if (currentAbortController) {
            currentAbortController.abort();
            logger.warn('用户取消了分析');
        }
    });

    // 分析按钮点击事件
    $btnAnalyze.on('click', async () => {
        const text = $inputText.val().trim();

        if (!text) {
            logger.warn('请输入要分析的文本');
            return;
        }

        logger.info(`开始分析文本，长度: ${text.length} 字符`);
        $btnAnalyze.prop('disabled', true);
        $btnCancelAnalyze.prop('disabled', false);

        try {
            // TODO: 在这里添加 NER 分析逻辑
            await analyzeNER(text);
        } catch (error) {
            if (error.name === 'AbortError') {
                logger.warn('分析已取消');
            } else {
                logger.error(`分析失败: ${error.message}`);
            }
        } finally {
            $btnAnalyze.prop('disabled', false);
            $btnCancelAnalyze.prop('disabled', true);
            currentAbortController = null;
        }
    });

    // 页面加载完成
    logger.info('NER 测试页面已加载');
    logger.info('请输入文本后点击"开始分析"按钮');

    // 自动尝试加载模型列表
    refreshModelList();
});

// 刷新模型列表
async function refreshModelList() {
    const baseUrl = $apiBaseUrl.val().trim();
    if (!baseUrl) {
        logger.warn('请输入 API 地址');
        return;
    }

    API_CONFIG.baseUrl = baseUrl;

    $btnRefreshModels.prop('disabled', true);
    $modelStatus.removeClass('success error').addClass('loading').text('加载中...');
    logger.info(`正在从 ${baseUrl} 获取模型列表...`);

    try {
        const response = await fetch(`${baseUrl}/models`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${API_CONFIG.apiKey}`
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const models = data.data || [];

        // 清空并填充模型列表
        $apiModel.empty();

        if (models.length === 0) {
            $apiModel.append('<option value="">-- 未找到可用模型 --</option>');
            $modelStatus.removeClass('loading success').addClass('error').text('无模型');
            logger.warn('服务器未返回可用模型');
        } else {
            models.forEach(model => {
                const modelId = model.id || model.name;
                $apiModel.append(`<option value="${modelId}">${modelId}</option>`);
            });

            // 自动选择第一个模型
            API_CONFIG.model = models[0].id || models[0].name;
            $apiModel.val(API_CONFIG.model);

            $modelStatus.removeClass('loading error').addClass('success').text(`${models.length} 个模型`);
            logger.success(`获取到 ${models.length} 个模型: ${models.map(m => m.id || m.name).join(', ')}`);
        }
    } catch (error) {
        $apiModel.empty().append('<option value="">-- 获取失败 --</option>');
        $modelStatus.removeClass('loading success').addClass('error').text('连接失败');
        logger.error(`获取模型列表失败: ${error.message}`);
        logger.info('请确保 LM Studio 已启动并加载了模型');
    } finally {
        $btnRefreshModels.prop('disabled', false);
    }
}

// NER 分析函数
async function analyzeNER(text) {
    logger.info('调用 LLM API 进行 NER 分析...');

    const systemPrompt = `你是一个专业的命名实体识别(NER)助手。请从用户输入的文本中提取以下类型的实体：
- PERSON: 人物姓名
- TIME: 时间表达式
- LOCATION: 地点、位置
- ORGANIZATION: 组织、机构、公司
- THING: 具体事物、物品
- EVENT: 事件
- RELATIONSHIP: 人物之间的关系描述

请以 JSON 数组格式返回结果，每个实体包含以下字段：
- text: 实体文本
- type: 实体类型（使用上述大写英文标识）
- start: 在原文中的起始位置（字符索引，从0开始）
- end: 在原文中的结束位置（不包含该位置的字符）

只返回 JSON 数组，不要有其他解释文字。如果没有识别到任何实体，返回空数组 []。`;

    const userPrompt = `请分析以下文本中的命名实体：

${text}`;

    try {
        // 使用流式模式获取原始内容（含可能的 <think> 标签）
        const result = await callOpenAIAPIStreaming(systemPrompt, userPrompt);
        const rawContent = result.content;
        logger.success('流式接收完成');

        // 提取思维链内容
        const thoughtBlocks = extractThoughtBlocks(rawContent);
        if (thoughtBlocks.length) {
            thoughtBlocks.forEach((b, i) => {
                logger.info(`[${b.tag}${b.orphan ? ' (未闭合)' : ''}] 第${i + 1}段长度 ${b.content.length} 字符`);
            });
        } else {
            logger.info('未检测到 <think>/<no_think> 内容');
        }

        // 清洗后内容用于解析实体
        const cleaned = stripThinkBlocks(rawContent);
        const entities = parseEntitiesFromResponse(cleaned);
        logger.success(`识别到 ${entities.length} 个实体 (已剥离思维链)`);
        displayEntities(entities, text);
    } catch (error) {
        logger.error(`API 调用失败: ${error.message}`);
        throw error;
    }
}

// 普通调用 OpenAI 兼容 API (非流式)
async function callOpenAIAPI(systemPrompt, userPrompt) {
    const url = `${API_CONFIG.baseUrl}/chat/completions`;
    logger.info(`请求地址: ${url}`);

    // 创建显示容器
    let $streamBox = $('#stream-output');
    if ($streamBox.length === 0) {
        $streamBox = $('<div id="stream-output" style="margin-top:10px;padding:8px;border:1px dashed #ccc;background:#fcfcfc;white-space:pre-wrap;font-size:12px;max-height:300px;overflow:auto;"></div>');
        $resultSection.append($('<h3 style="margin-top:15px;">原始模型输出</h3>'));
        $resultSection.append($streamBox);
    } else {
        $streamBox.empty();
    }
    $resultSection.addClass('visible');

    const requestBody = {
        model: API_CONFIG.model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        // max_tokens: 32768,
        stream: false
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_CONFIG.apiKey}`
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    // 调试：输出完整响应
    console.log('[FULL RESPONSE]', data);
    console.log('[RAW CONTENT]', data.choices?.[0]?.message?.content);

    // 检查是否被截断
    const finishReason = data.choices?.[0]?.finish_reason;
    if (finishReason === 'length') {
        logger.warn('⚠️ 输出被截断！模型达到了 max_tokens 限制');
    } else {
        logger.info(`完成原因: ${finishReason}`);
    }

    const content = data.choices?.[0]?.message?.content || '';

    // 显示原始内容（使用 text() 确保标签不被解析）
    $streamBox.text(content);

    logger.info(`响应完成，内容长度: ${content.length}`);

    return content;
}

// 流式调用 OpenAI 兼容 API (SSE)
async function callOpenAIAPIStreaming(systemPrompt, userPrompt) {
    const url = `${API_CONFIG.baseUrl}/chat/completions`;
    logger.info(`(stream) 请求地址: ${url}`);

    // 创建 AbortController 用于取消请求
    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;

    // 统计信息
    const stats = {
        startTime: Date.now(),
        firstTokenTime: null,
        endTime: null,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        finishReason: ''
    };

    // 重置统计显示
    $('#stat-ttft, #stat-total-time, #stat-prompt-tokens, #stat-completion-tokens, #stat-total-tokens, #stat-speed, #stat-finish-reason').text('计算中...').css('color', '');

    // 清空输出容器
    const $streamBox = $('#stream-output').empty();
    $resultSection.addClass('visible');

    const requestBody = {
        model: API_CONFIG.model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        // 不设置 max_tokens，让模型使用其最大上下文长度
        stream: true,
        stream_options: { include_usage: true }  // 请求返回 token 统计
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_CONFIG.apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: signal  // 添加取消信号
    });

    if (!response.ok || !response.body) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let accumulated = '';
    let buffer = '';
    let tokenCount = 0;  // 本地计数（备用）

    let chunkIndex = 0;
    let cancelled = false;
    
    // 性能优化：批量更新 DOM
    let pendingText = '';
    let lastUIUpdate = 0;
    const UI_UPDATE_INTERVAL = 50;  // 每 50ms 更新一次 UI
    let lastSpeedUpdate = 0;
    const SPEED_UPDATE_INTERVAL = 200;  // 每 200ms 更新一次速度
    
    // 获取原生 DOM 元素用于直接操作
    const streamBoxEl = $streamBox[0];

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // 检查是否已取消
            if (signal.aborted) {
                cancelled = true;
                break;
            }

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            // 处理按 \n\n 分隔的 SSE 事件
            let idx;
            while ((idx = buffer.indexOf('\n\n')) !== -1) {
                const line = buffer.slice(0, idx).trim();
                buffer = buffer.slice(idx + 2);
                
                if (!line || !line.startsWith('data:')) continue;
                
                const dataStr = line.slice(5).trim();
                if (dataStr === '[DONE]') continue;
                
                try {
                    const json = JSON.parse(dataStr);

                    // 提取 usage 信息（如果有）
                    if (json.usage) {
                        stats.promptTokens = json.usage.prompt_tokens || 0;
                        stats.completionTokens = json.usage.completion_tokens || 0;
                        stats.totalTokens = json.usage.total_tokens || 0;
                    }

                    // 提取完成原因
                    const finishReason = json.choices?.[0]?.finish_reason;
                    if (finishReason) {
                        stats.finishReason = finishReason;
                    }

                    const delta = json.choices?.[0]?.delta?.content;
                    if (delta != null && delta !== '') {
                        // 记录首个 token 时间
                        if (stats.firstTokenTime === null) {
                            stats.firstTokenTime = Date.now();
                            const ttft = stats.firstTokenTime - stats.startTime;
                            $('#stat-ttft').text(`${ttft} ms`);
                            logger.info(`首Token延迟 (TTFT): ${ttft} ms`);
                        }

                        tokenCount++;
                        accumulated += delta;
                        pendingText += delta;
                        
                        // 批量更新 DOM（限制更新频率）
                        const now = Date.now();
                        if (now - lastUIUpdate >= UI_UPDATE_INTERVAL) {
                            // 使用 createTextNode 比 jQuery 更快
                            streamBoxEl.appendChild(document.createTextNode(pendingText));
                            streamBoxEl.scrollTop = streamBoxEl.scrollHeight;
                            pendingText = '';
                            lastUIUpdate = now;
                            
                            // 限制速度更新频率
                            if (now - lastSpeedUpdate >= SPEED_UPDATE_INTERVAL) {
                                const elapsed = (now - stats.startTime) / 1000;
                                if (elapsed > 0) {
                                    $('#stat-speed').text(`${(tokenCount / elapsed).toFixed(1)} tokens/s`);
                                }
                                lastSpeedUpdate = now;
                            }
                        }
                    }
                } catch (e) {
                    // 非 JSON 行，原样输出
                    accumulated += dataStr + '\n';
                    pendingText += dataStr + '\n';
                }
            }
            chunkIndex++;
        }
        
        // 刷新剩余的待输出文本
        if (pendingText) {
            streamBoxEl.appendChild(document.createTextNode(pendingText));
            streamBoxEl.scrollTop = streamBoxEl.scrollHeight;
        }
    } catch (e) {
        if (e.name === 'AbortError') {
            cancelled = true;
        } else {
            throw e;
        }
    } finally {
        // 如果取消了，尝试关闭 reader
        if (cancelled) {
            try {
                await reader.cancel();
            } catch (e) {
                // 忽略关闭错误
            }
        }
    }

    // 完成统计
    stats.endTime = Date.now();
    const totalTime = stats.endTime - stats.startTime;
    const totalSeconds = totalTime / 1000;

    // 如果 API 没有返回 token 统计，使用本地计数
    if (stats.completionTokens === 0) {
        stats.completionTokens = tokenCount;
        // 粗略估算输入 tokens (中文约1.5字符/token，英文约4字符/token)
        stats.promptTokens = Math.ceil((systemPrompt.length + userPrompt.length) / 2);
        stats.totalTokens = stats.promptTokens + stats.completionTokens;
    }

    // 更新统计面板
    $('#stat-total-time').text(`${totalTime} ms (${totalSeconds.toFixed(2)}s)`);
    $('#stat-prompt-tokens').text(stats.promptTokens);
    $('#stat-completion-tokens').text(stats.completionTokens);
    $('#stat-total-tokens').text(stats.totalTokens);

    const speed = totalSeconds > 0 ? stats.completionTokens / totalSeconds : 0;
    $('#stat-speed').text(`${speed.toFixed(1)} tokens/s`);

    // 完成原因显示
    let finishReasonText = stats.finishReason || 'unknown';
    if (cancelled) {
        finishReasonText = '⛔ cancelled (用户取消)';
        stats.finishReason = 'cancelled';
        $('#stat-finish-reason').css('color', '#f0ad4e');
    } else if (stats.finishReason === 'length') {
        finishReasonText = '⚠️ length (被截断)';
        $('#stat-finish-reason').css('color', '#d9534f');
    } else if (stats.finishReason === 'stop') {
        finishReasonText = '✅ stop (正常结束)';
        $('#stat-finish-reason').css('color', '#5cb85c');
    }
    $('#stat-finish-reason').text(finishReasonText);

    if (cancelled) {
        logger.warn(`流式传输已取消，已接收: ${accumulated.length} 字符`);
    } else {
        logger.info(`流式累计完成，长度: ${accumulated.length}`);
    }
    logger.info(`统计: 输入${stats.promptTokens} + 输出${stats.completionTokens} = ${stats.totalTokens} tokens`);
    logger.info(`耗时: ${totalSeconds.toFixed(2)}s, 速度: ${speed.toFixed(1)} tokens/s`);

    // 如果取消了，抛出 AbortError 让调用方知道
    if (cancelled) {
        const error = new Error('用户取消');
        error.name = 'AbortError';
        throw error;
    }

    // 返回完整内容和统计信息
    return {
        content: accumulated.trim(),
        stats: stats
    };
}

// 从 LLM 响应中解析实体 JSON
function parseEntitiesFromResponse(responseText) {
    try {
        // 尝试直接解析
        let jsonStr = responseText.trim();

        // 如果响应被 markdown 代码块包裹，提取其中的 JSON
        const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) {
            jsonStr = codeBlockMatch[1].trim();
        }

        const entities = JSON.parse(jsonStr);

        if (!Array.isArray(entities)) {
            logger.warn('响应不是数组格式，尝试提取');
            return [];
        }

        // 验证每个实体的格式
        return entities.filter(entity => {
            const valid = entity.text && entity.type &&
                typeof entity.start === 'number' &&
                typeof entity.end === 'number';
            if (!valid) {
                logger.warn(`跳过无效实体: ${JSON.stringify(entity)}`);
            }
            return valid;
        });
    } catch (e) {
        logger.error(`JSON 解析失败: ${e.message}`);
        logger.warn(`原始内容: ${responseText}`);
        return [];
    }
}

// 显示实体结果
function displayEntities(entities, originalText) {
    $resultSection.addClass('visible');
    $resultDisplay.empty();

    if (entities.length === 0) {
        $resultDisplay.text('未识别到实体');
        return;
    }

    // 按类型分组
    const grouped = {};
    const typeOrder = ['PERSON', 'ORGANIZATION', 'LOCATION', 'TIME', 'EVENT', 'THING', 'RELATIONSHIP'];
    const typeNames = {
        'PERSON': '👤 人物',
        'ORGANIZATION': '🏢 组织/机构',
        'LOCATION': '📍 地点',
        'TIME': '🕐 时间',
        'EVENT': '📅 事件',
        'THING': '📦 事物',
        'RELATIONSHIP': '🔗 关系'
    };

    // 分组
    entities.forEach(entity => {
        const type = entity.type;
        if (!grouped[type]) {
            grouped[type] = [];
        }
        grouped[type].push(entity);
    });

    // 按预定义顺序显示，未知类型放最后
    const sortedTypes = Object.keys(grouped).sort((a, b) => {
        const idxA = typeOrder.indexOf(a);
        const idxB = typeOrder.indexOf(b);
        if (idxA === -1 && idxB === -1) return a.localeCompare(b);
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
    });

    // 渲染每个分类
    sortedTypes.forEach(type => {
        const typeLabel = typeNames[type] || `🏷️ ${type}`;
        const $group = $('<div class="entity-group"></div>');
        const $header = $('<div class="entity-group-header"></div>').text(`${typeLabel} (${grouped[type].length})`);
        const $content = $('<div class="entity-group-content"></div>');

        grouped[type].forEach(entity => {
            const $span = $('<span>')
                .addClass(`entity entity-${entity.type}`)
                .text(entity.text)
                .attr('title', `位置: ${entity.start}-${entity.end}`);
            $content.append($span);
        });

        $group.append($header).append($content);
        $resultDisplay.append($group);

        logger.info(`${typeLabel}: ${grouped[type].map(e => e.text).join(', ')}`);
    });

    logger.success(`共识别 ${entities.length} 个实体，分为 ${sortedTypes.length} 类`);
}