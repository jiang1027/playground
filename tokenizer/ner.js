// ========== 配置 ==========
let API_CONFIG = {
    baseUrl: 'http://192.168.31.201:1234/v1',  // LM Studio 默认地址
    model: 'qwen/qwen3-30b-a3b',  // 从服务器获取
    apiKey: 'lm-studio'  // LM Studio 不需要真实 key，但 API 格式需要
};

// 分段处理配置
const CHUNK_CONFIG = {
    maxCharsPerChunk: 5000,  // 每段最大字符数
    overlapChars: 500,       // 段与段之间的重叠字符，避免实体被切断
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

// ========== 进度条控制 ==========
function updateProgress(current, total, text = '') {
    const $el = $('#progress-text');
    
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    $el.text(text || `处理中: ${current}/${total} 段`);
    // 用背景渐变表现进度
    $el.css('background', `linear-gradient(90deg, #b8e6c1 0%, #b8e6c1 ${percent}%, #e9ecef ${percent}%, #e9ecef 100%)`);
}

function resetProgress() {
    $('#progress-text').text('').css('background', '#e9ecef');
}

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
    // refreshModelList();
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
    
    // 重置进度条
    resetProgress();
    
    // 清空之前的识别结果
    $resultDisplay.empty();

    const systemPrompt = `你是一个专业的开放域知识抽取与概念归纳引擎。你的任务是分析用户提供的文本，并从中提取所有重要、有意义的**概念**或**实体**。

**【核心指令】**
1. **概念归纳：** 对于提取的每一个概念，你必须根据其语义内容，为其创造一个最恰当、最简洁的**中文类别标签**。禁止使用PERSON, TIME, LOCATION, ORGANIZATION等预设标签。
2. **唯一性：** 提取的概念文本必须是唯一的，不得重复。
3. **输出格式：** 请以 TSV (Tab-Separated Values) 格式返回结果，使用制表符 '\t' 分隔。

**【输出示例及格式要求】**
text\tconcept_type
万维网之父\t人物身份
信息传播\t抽象概念
巴黎\t城市
清华大学\t机构名称
1991年\t具体时间

**【第二部分：关系/边】 (保持不变，但关系类型也应是开放域)**
... (使用 --- LINKS --- 分隔，并要求模型为关系也发明标签) ...

**终止信号:** 在完成所有数据提取后，立即停止输出，不要有任何额外文字或解释。
`;


    // 检查是否需要分段处理
    const chunks = splitTextIntoChunks(text, CHUNK_CONFIG.maxCharsPerChunk, CHUNK_CONFIG.overlapChars);
    
    if (chunks.length > 1) {
        logger.info(`文本较长 (${text.length} 字符)，将分 ${chunks.length} 段处理`);
    }

    let allEntities = [];
    
    try {
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            
            // 更新进度条
            updateProgress(i, chunks.length, `处理中: ${i + 1}/${chunks.length} 段`);
            
            if (chunks.length > 1) {
                logger.info(`处理第 ${i + 1}/${chunks.length} 段 (位置 ${chunk.start}-${chunk.end}，${chunk.text.length} 字符)`);
            }

            const userPrompt = `请分析以下文本中的命名实体：

${chunk.text}`;

            // 使用流式模式获取原始内容（含可能的 <think> 标签）
            const result = await callOpenAIAPIStreaming(systemPrompt, userPrompt);
            const rawContent = result.content;
            
            if (i === chunks.length - 1 || chunks.length === 1) {
                logger.success('流式接收完成');
            }

            // 提取思维链内容
            const thoughtBlocks = extractThoughtBlocks(rawContent);
            if (thoughtBlocks.length) {
                thoughtBlocks.forEach((b, j) => {
                    logger.info(`[${b.tag}${b.orphan ? ' (未闭合)' : ''}] 第${j + 1}段长度 ${b.content.length} 字符`);
                });
            } else if (chunks.length === 1) {
                logger.info('未检测到 <think>/<no_think> 内容');
            }

            // 清洗后内容用于解析实体
            const cleaned = stripThinkBlocks(rawContent);
            const entities = parseEntitiesFromResponse(cleaned);
            
            // 合并并去重
            allEntities = allEntities.concat(entities);
            allEntities = deduplicateEntities(allEntities);
            
            if (chunks.length > 1) {
                logger.info(`第 ${i + 1} 段识别到 ${entities.length} 个实体，累计 ${allEntities.length} 个（已去重）`);
            }
            
            // 每段完成后立即更新显示（显示去重后的汇总）
            displayEntities(allEntities, text);
        }
        
        // 完成进度
        updateProgress(chunks.length, chunks.length, '处理完成');
        
        logger.success(`识别到 ${allEntities.length} 个实体 (已剥离思维链、去重)`);
        
        // 延迟清除进度条
        setTimeout(resetProgress, 2000);
        
    } catch (error) {
        resetProgress();
        logger.error(`API 调用失败: ${error.message}`);
        throw error;
    }
}

// 将文本分割成多个块
function splitTextIntoChunks(text, maxChars, overlap) {
    if (text.length <= maxChars) {
        return [{ text, start: 0, end: text.length }];
    }
    
    const chunks = [];
    let start = 0;
    
    // 句子结束符搜索范围：取 maxChars 的 10% 或至少 200 字符
    const searchRange = Math.max(200, Math.floor(maxChars * 0.1));
    // 每段最小有效长度（扣除重叠后）：确保每段至少贡献 maxChars - overlap 的新内容
    const minEffectiveLength = maxChars - overlap;
    
    while (start < text.length) {
        // 计算理想的结束位置
        let end = Math.min(start + maxChars, text.length);
        
        // 如果不是最后一段，尝试在句子结束处分割
        if (end < text.length) {
            const searchStart = Math.max(end - searchRange, start + minEffectiveLength);
            
            // 只有当搜索范围有效时才查找句子边界
            if (searchStart < end) {
                const searchText = text.slice(searchStart, end);
                
                // 查找最后一个句子结束符（中文句号、感叹号、问号、换行）
                const sentenceEnders = /[。！？\n]/g;
                let lastMatch = null;
                let match;
                while ((match = sentenceEnders.exec(searchText)) !== null) {
                    lastMatch = match;
                }
                
                if (lastMatch) {
                    end = searchStart + lastMatch.index + 1;
                }
            }
        }
        
        chunks.push({
            text: text.slice(start, end),
            start: start,
            end: end
        });
        
        // 如果已经到达文本末尾，退出
        if (end >= text.length) {
            break;
        }
        
        // 下一段起始位置 = 当前段结束位置 - 重叠
        start = end - overlap;
    }
    
    console.log(`[splitTextIntoChunks] 文本长度: ${text.length}, maxChars: ${maxChars}, overlap: ${overlap}, 分段数: ${chunks.length}`);
    chunks.forEach((c, i) => console.log(`  段${i + 1}: ${c.start}-${c.end} (${c.end - c.start}字符)`));
    
    return chunks;
}

// 去重实体（根据文本和类型）
function deduplicateEntities(entities) {
    const seen = new Map();
    
    entities.forEach(entity => {
        const key = `${entity.text}|${entity.type}`;
        if (!seen.has(key)) {
            seen.set(key, entity);
        } else {
            // 如果已存在，保留位置更靠前的
            const existing = seen.get(key);
            if (entity.start < existing.start) {
                seen.set(key, entity);
            }
        }
    });
    
    return Array.from(seen.values());
}

// 流式调用 OpenAI 兼容 API (使用 fetch)
async function callOpenAIAPIStreaming(systemPrompt, userPrompt) {
    const url = `${API_CONFIG.baseUrl}/chat/completions`;
    logger.info(`(stream) 请求地址: ${url}`);

    // 创建 AbortController 用于取消请求
    currentAbortController = new AbortController();

    // 统计信息
    const stats = {
        startTime: Date.now(),
        firstTokenTime: null,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        finishReason: ''
    };

    // 不重置统计显示，保留上次的数据

    // 清空输出容器
    const $streamBox = $('#stream-output').empty();
    const streamBoxEl = $streamBox[0];

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_CONFIG.apiKey}`
        },
        body: JSON.stringify({
            model: API_CONFIG.model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.1,
            repeat_penalty: 1.3,  // 重复惩罚，防止模型陷入重复输出循环
            top_k: 30, // 确保模型考虑更多的次优选择，打破局部最优模式
            stream: true,
            stream_options: { include_usage: true }
        }),
        signal: currentAbortController.signal
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    // 流式读取
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let accumulated = '';
    let tokenCount = 0;
    let lastSpeedUpdate = 0;  // 上次更新速度的时间
    
    // === 调试：重复检测 ===
    const DEBUG_REPEAT = false;  // 开关：是否启用详细调试日志
    let readCount = 0;           // reader.read() 调用次数
    let lastContentCheck = 0;    // 上次检查内容重复的长度

    while (true) {
        const { done, value } = await reader.read();
        readCount++;
        
        if (value) {
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            
            // 调试：记录原始数据块（仅当 DEBUG_REPEAT 开启时）
            if (DEBUG_REPEAT && chunk.length > 0) {
                console.log(`[DEBUG read #${readCount}] 收到 ${value.byteLength} 字节, 解码后 ${chunk.length} 字符`);
            }
        }
        
        // 调试：监控 buffer 大小
        if (DEBUG_REPEAT && readCount % 50 === 0) {
            console.log(`[DEBUG] 已读取 ${readCount} 次, buffer大小: ${buffer.length}, 累计输出: ${accumulated.length} 字符`);
        }
        
        // 查找最后一个换行符
        const lastNewlineIdx = buffer.lastIndexOf('\n');
        
        // 没有完整行且未结束，继续等待
        if (lastNewlineIdx === -1 && !done) {
            continue;
        }
        
        // 提取可处理的数据
        const completeData = done ? buffer : buffer.slice(0, lastNewlineIdx);
        buffer = done ? '' : buffer.slice(lastNewlineIdx + 1);
        
        // 逐行处理 SSE
        for (const line of completeData.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) continue;
            
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === '[DONE]') {
                console.log('[DEBUG] 收到 [DONE] 信号');
                continue;
            }
            
            try {
                const json = JSON.parse(dataStr);
                
                if (json.usage) {
                    stats.promptTokens = json.usage.prompt_tokens || 0;
                    stats.completionTokens = json.usage.completion_tokens || 0;
                    stats.totalTokens = json.usage.total_tokens || 0;
                }
                
                if (json.choices?.[0]?.finish_reason) {
                    stats.finishReason = json.choices[0].finish_reason;
                    if (DEBUG_REPEAT) {
                        console.log(`[DEBUG] 收到 finish_reason: ${stats.finishReason}`);
                    }
                }
                
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) {
                    if (stats.firstTokenTime === null) {
                        stats.firstTokenTime = Date.now();
                        $('#stat-ttft').text(`${stats.firstTokenTime - stats.startTime} ms`);
                    }
                    tokenCount++;
                    accumulated += delta;
                    streamBoxEl.appendChild(document.createTextNode(delta));
                    streamBoxEl.scrollTop = streamBoxEl.scrollHeight;
                    
                    // 实时更新输出 token 数
                    $('#stat-completion-tokens').text(`${tokenCount} (接收中...)`);
                    
                    // 每秒更新一次速度
                    const now = Date.now();
                    if (now - lastSpeedUpdate > 1000) {
                        lastSpeedUpdate = now;
                        const elapsed = (now - stats.startTime) / 1000;
                        const speed = elapsed > 0 ? tokenCount / elapsed : 0;
                        $('#stat-speed').text(`${speed.toFixed(1)} tokens/s`);
                    }
                }
            } catch (e) {
                // JSON 解析失败，跳过
                if (DEBUG_REPEAT) {
                    console.warn(`[DEBUG] JSON解析失败: ${e.message}, 原始数据: ${dataStr.slice(0, 100)}`);
                }
            }
        }
        
        if (done) {
            if (DEBUG_REPEAT) {
                console.log(`[DEBUG] 流结束. 总共读取 ${readCount} 次, 输出 ${accumulated.length} 字符, ${tokenCount} tokens`);
            }
            break;
        }
    }

    // 完成统计
    const totalTime = Date.now() - stats.startTime;
    const totalSeconds = totalTime / 1000;

    if (stats.completionTokens === 0) {
        stats.completionTokens = tokenCount;
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

    const reasonMap = {
        'stop': { text: '✅ stop (正常结束)', color: '#5cb85c' },
        'length': { text: '⚠️ length (被截断)', color: '#d9534f' }
    };
    const reasonInfo = reasonMap[stats.finishReason] || { text: stats.finishReason || 'unknown', color: '' };
    $('#stat-finish-reason').text(reasonInfo.text).css('color', reasonInfo.color);

    logger.info(`统计: 输入${stats.promptTokens} + 输出${stats.completionTokens} = ${stats.totalTokens} tokens`);
    logger.info(`耗时: ${totalSeconds.toFixed(2)}s, 速度: ${speed.toFixed(1)} tokens/s`);

    return {
        content: accumulated.trim(),
        stats
    };
}

// 从 LLM 响应中解析概念 TSV（开放域知识抽取）
function parseEntitiesFromResponse(responseText) {
    try {
        let tsvStr = responseText.trim();

        // 如果响应被 markdown 代码块包裹，提取其中的内容
        const codeBlockMatch = tsvStr.match(/```(?:tsv)?\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) {
            tsvStr = codeBlockMatch[1].trim();
        }

        // 按行分割
        const lines = tsvStr.split('\n').map(line => line.trim()).filter(line => line.length > 0);

        if (lines.length === 0) {
            logger.warn('TSV 响应为空');
            return [];
        }

        // 检查表头（第一行应为 "text\tconcept_type" 或 "text\ttype"）
        const header = lines[0].toLowerCase();
        const hasValidHeader = header.includes('text') && (header.includes('concept_type') || header.includes('type'));
        
        if (!hasValidHeader) {
            logger.warn(`TSV 表头格式不正确: ${lines[0]}`);
            // 尝试继续解析，假设没有表头
        }

        const entities = [];
        const startIdx = hasValidHeader ? 1 : 0;

        for (let i = startIdx; i < lines.length; i++) {
            const line = lines[i];
            // 使用制表符分割
            const parts = line.split('\t');
            
            if (parts.length >= 2) {
                const text = parts[0].trim();
                // 保留原始中文类别标签，不再强制大写
                const type = parts[1].trim();
                
                if (text && type) {
                    entities.push({ text, type });
                } else {
                    logger.warn(`跳过无效行: ${line}`);
                }
            } else {
                // 尝试用多个空格分割（容错）
                const spaceParts = line.split(/\s{2,}/);
                if (spaceParts.length >= 2) {
                    const text = spaceParts[0].trim();
                    const type = spaceParts[1].trim();
                    if (text && type) {
                        entities.push({ text, type });
                        logger.warn(`使用空格分隔解析: ${line}`);
                    }
                } else {
                    logger.warn(`跳过无法解析的行: ${line}`);
                }
            }
        }

        return entities;
    } catch (e) {
        logger.error(`TSV 解析失败: ${e.message}`);
        logger.warn(`原始内容: ${responseText}`);
        return [];
    }
}

// 显示概念结果（开放域知识抽取）
function displayEntities(entities, originalText) {
    $resultDisplay.empty();

    if (entities.length === 0) {
        $resultDisplay.text('未识别到概念');
        return;
    }

    // 按类型分组
    const grouped = {};

    // 分组
    entities.forEach(entity => {
        const type = entity.type;
        if (!grouped[type]) {
            grouped[type] = [];
        }
        grouped[type].push(entity);
    });

    // 按概念数量降序排列，数量相同则按类别名排序
    const sortedTypes = Object.keys(grouped).sort((a, b) => {
        const countDiff = grouped[b].length - grouped[a].length;
        if (countDiff !== 0) return countDiff;
        return a.localeCompare(b, 'zh-CN');
    });

    // 为不同类型生成不同的颜色（基于类型名的哈希）
    function getTypeColor(type) {
        let hash = 0;
        for (let i = 0; i < type.length; i++) {
            hash = type.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 70%, 90%)`;
    }

    // 渲染每个分类
    sortedTypes.forEach(type => {
        const typeLabel = `🏷️ ${type}`;
        const $group = $('<div class="entity-group"></div>');
        const $header = $('<div class="entity-group-header"></div>').text(`${typeLabel} (${grouped[type].length})`);
        const $content = $('<div class="entity-group-content"></div>');

        const bgColor = getTypeColor(type);

        grouped[type].forEach(entity => {
            const $span = $('<span>')
                .addClass('entity')
                .css({
                    'background-color': bgColor,
                    'border-color': `hsl(${Math.abs(type.split('').reduce((a, c) => c.charCodeAt(0) + ((a << 5) - a), 0)) % 360}, 50%, 60%)`
                })
                .text(entity.text);
            $content.append($span);
        });

        $group.append($header).append($content);
        $resultDisplay.append($group);

        logger.info(`${typeLabel}: ${grouped[type].map(e => e.text).join(', ')}`);
    });

    logger.success(`共识别 ${entities.length} 个概念，分为 ${sortedTypes.length} 类`);
}