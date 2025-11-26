// ========== 语义分块测试 - Semantic Chunking ==========

// ========== 配置 ==========
let API_CONFIG = {
    baseUrl: 'http://192.168.31.201:1234/v1',  // OpenAI 兼容 API 地址 (如 LM Studio)
    model: '',  // 从服务器获取
    apiKey: 'lm-studio'  // API Key
};

// LLM 高级参数
let LLM_OPTIONS = {
    temperature: 0.1,
    repeat_penalty: 1.1,
    top_k: 40
};

// 分块配置
let CHUNK_CONFIG = {
    maxChunkSize: 1000,      // 最大块大小（字符）
    minChunkSize: 100,       // 最小块大小（字符）
    similarityThreshold: 0.5, // 相似度阈值
    method: 'semantic',       // 分块方法: semantic, sentence, paragraph, fixed
    
    // 长文本分段处理配置
    maxCharsPerRequest: 4000, // 单次请求最大字符数
    overlapChars: 200,        // 重叠字符数
};

// ========== DOM 引用 ==========
let $logList, $logContainer;
let $inputText, $btnChunk, $btnCancel, $btnClear, $resultDisplay;
let $apiBaseUrl, $apiModel, $btnRefreshModels, $modelStatus;
let $btnOpenFile, $fileInput, $fileInfo;

// 用于取消流式请求
let currentAbortController = null;

// 日志节流控制
let logScrollPending = false;

// ========== 日志工具 ==========
function log(message, type = 'info') {
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    const $li = $('<li>')
        .addClass(`log-${type}`)
        .html(`<span class="log-time">[${time}]</span>${$('<div>').text(message).html()}`);

    $logList.append($li);
    
    // 限制日志条目数量
    const maxLogItems = 500;
    const $items = $logList.children();
    if ($items.length > maxLogItems) {
        $items.slice(0, $items.length - maxLogItems).remove();
    }
    
    // 节流滚动
    if (!logScrollPending) {
        logScrollPending = true;
        requestAnimationFrame(() => {
            $logContainer.scrollTop($logContainer[0].scrollHeight);
            logScrollPending = false;
        });
    }
}

const logger = {
    info: (msg) => log(msg, 'info'),
    success: (msg) => log(msg, 'success'),
    error: (msg) => log(msg, 'error'),
    warn: (msg) => log(msg, 'warn')
};

// ========== 进度条控制 ==========
function updateProgress(text, percent = -1) {
    const $el = $('#progress-text');
    $el.text(text);
    
    if (percent >= 0) {
        $el.css('background', `linear-gradient(90deg, #b8e6c1 0%, #b8e6c1 ${percent}%, #e9ecef ${percent}%, #e9ecef 100%)`);
    } else {
        $el.css('background', '#e9ecef');
    }
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
    $btnChunk = $('#btn-chunk');
    $btnCancel = $('#btn-cancel');
    $btnClear = $('#btn-clear');
    $resultDisplay = $('#result-display');

    // 配置面板元素
    $apiBaseUrl = $('#api-base-url');
    $apiModel = $('#api-model');
    $btnRefreshModels = $('#btn-refresh-models');
    $modelStatus = $('#model-status');
    
    const $apiKey = $('#api-key');

    // 文件操作元素
    $btnOpenFile = $('#btn-open-file');
    $fileInput = $('#file-input');
    $fileInfo = $('#file-info');

    // 高级选项折叠
    $('#advanced-toggle').on('click', function() {
        $(this).toggleClass('expanded');
        $('#advanced-options').toggleClass('show');
    });

    // 高级选项值变更
    $('#opt-temperature').on('change', function() {
        LLM_OPTIONS.temperature = parseFloat($(this).val()) || 0.1;
        logger.info(`Temperature 已设置为: ${LLM_OPTIONS.temperature}`);
    });

    $('#opt-repeat-penalty').on('change', function() {
        LLM_OPTIONS.repeat_penalty = parseFloat($(this).val()) || 1.1;
        logger.info(`Repeat Penalty 已设置为: ${LLM_OPTIONS.repeat_penalty}`);
    });

    $('#opt-top-k').on('change', function() {
        LLM_OPTIONS.top_k = parseInt($(this).val()) || 40;
        logger.info(`Top K 已设置为: ${LLM_OPTIONS.top_k}`);
    });

    // 分块配置变更
    $('#cfg-max-chunk-size').on('change', function() {
        CHUNK_CONFIG.maxChunkSize = parseInt($(this).val()) || 1000;
        logger.info(`最大块大小已设置为: ${CHUNK_CONFIG.maxChunkSize} 字符`);
    });

    $('#cfg-min-chunk-size').on('change', function() {
        CHUNK_CONFIG.minChunkSize = parseInt($(this).val()) || 100;
        logger.info(`最小块大小已设置为: ${CHUNK_CONFIG.minChunkSize} 字符`);
    });

    $('#cfg-similarity-threshold').on('change', function() {
        CHUNK_CONFIG.similarityThreshold = parseFloat($(this).val()) || 0.5;
        logger.info(`相似度阈值已设置为: ${CHUNK_CONFIG.similarityThreshold}`);
    });

    $('#cfg-chunking-method').on('change', function() {
        CHUNK_CONFIG.method = $(this).val();
        logger.info(`分块方法已设置为: ${CHUNK_CONFIG.method}`);
    });

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

    // 打开文件按钮
    $btnOpenFile.on('click', function() {
        $fileInput.click();
    });

    // 文件选择处理
    $fileInput.on('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            $inputText.val(event.target.result);
            $fileInfo.text(`已加载: ${file.name} (${formatFileSize(file.size)})`);
            logger.success(`已加载文件: ${file.name}, 大小: ${formatFileSize(file.size)}, 字符数: ${event.target.result.length}`);
        };
        reader.onerror = function() {
            logger.error(`读取文件失败: ${file.name}`);
            $fileInfo.text('文件读取失败');
        };
        reader.readAsText(file);
    });

    // 清空日志
    $btnClear.on('click', () => {
        $logList.empty();
        logger.info('日志已清空');
    });

    // 取消按钮
    $btnCancel.on('click', () => {
        if (currentAbortController) {
            currentAbortController.abort();
            logger.warn('用户取消了分块操作');
        }
    });

    // 开始分块按钮
    $btnChunk.on('click', async () => {
        const text = $inputText.val().trim();

        if (!text) {
            logger.warn('请输入要分块的文本');
            return;
        }

        logger.info(`开始分块，文本长度: ${text.length} 字符`);
        $btnChunk.prop('disabled', true);
        $btnCancel.prop('disabled', false);

        // 更新统计信息
        $('#stat-original-length').text(`${text.length} 字符`);

        try {
            await performChunking(text);
        } catch (error) {
            if (error.name === 'AbortError') {
                logger.warn('分块操作已取消');
            } else {
                logger.error(`分块失败: ${error.message}`);
            }
        } finally {
            $btnChunk.prop('disabled', false);
            $btnCancel.prop('disabled', true);
            currentAbortController = null;
        }
    });

    // 页面加载完成
    logger.info('语义分块测试页面已加载');
    logger.info('请输入文本或打开本地文件，然后点击"开始分块"按钮');
});

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

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

// 将文本分割成多个块
function splitTextIntoChunks(text, maxChars, overlap) {
    if (text.length <= maxChars) {
        return [{ text, start: 0, end: text.length }];
    }
    
    const chunks = [];
    let start = 0;
    
    while (start < text.length) {
        // 1. 确定 End
        let end = Math.min(start + maxChars, text.length);
        
        // 如果不是最后一段，需要找到合适的断句点
        if (end < text.length) {
            // 在 [end - searchRange, end] 范围内寻找最佳切分点
            const searchRange = Math.max(200, Math.floor(maxChars * 0.1));
            const searchStart = Math.max(start + maxChars * 0.5, end - searchRange); 
            const searchText = text.slice(searchStart, end);
            
            // 优先级：段落 > 句子 > 短句 > 空格
            const patterns = [
                /\n\s*\n/g,  // 段落
                /[。！？]/g,   // 句子
                /[，；]/g,     // 短句
                /\s/g         // 单词边界
            ];
            
            let bestEnd = -1;
            
            for (let pattern of patterns) {
                let match;
                let lastMatchIndex = -1;
                while ((match = pattern.exec(searchText)) !== null) {
                    lastMatchIndex = match.index;
                }
                
                if (lastMatchIndex !== -1) {
                    // 重新获取匹配长度以确保准确
                    pattern.lastIndex = lastMatchIndex;
                    const m = pattern.exec(searchText);
                    bestEnd = searchStart + lastMatchIndex + m[0].length;
                    break; 
                }
            }
            
            if (bestEnd !== -1) {
                end = bestEnd;
            }
        }
        
        chunks.push({
            text: text.slice(start, end),
            start: start,
            end: end
        });
        
        if (end >= text.length) break;
        
        // 2. 确定下一段的 Start
        // 目标：从 end 回退 overlap 长度，然后向前寻找最近的句子开头
        // 这样可以避免 "劳动力" 被切成 "动力"
        let nextStart = Math.max(0, end - overlap);
        
        if (nextStart > 0) {
            // 在回退点附近寻找句子边界
            let foundBoundary = false;
            
            // 向前找 (优先)
            for (let i = nextStart; i >= Math.max(start + 1, end - overlap - 200); i--) {
                if (/[。！？\n]/.test(text[i])) {
                    nextStart = i + 1;
                    foundBoundary = true;
                    break;
                }
            }
            
            // 如果向前没找到，尝试向后找 (但不能超过 end)
            if (!foundBoundary) {
                 for (let i = nextStart; i < end; i++) {
                    if (/[。！？\n]/.test(text[i])) {
                        nextStart = i + 1;
                        foundBoundary = true;
                        break;
                    }
                }
            }
        }
        
        // 防止死循环：如果计算出的 nextStart <= start，强制前进
        if (nextStart <= start) {
            nextStart = start + Math.floor(maxChars / 2); 
        }
        
        start = nextStart;
    }
    
    return chunks;
}

// 去重分块
function deduplicateChunks(chunks) {
    const uniqueChunks = [];
    
    for (const chunk of chunks) {
        let isDuplicate = false;
        const cleanContent = chunk.content.replace(/\s+/g, '');
        
        for (const existing of uniqueChunks) {
            const existingContent = existing.content.replace(/\s+/g, '');
            
            // 检查包含关系
            // 如果现有块包含新块，或者新块包含现有块，视为重复
            if (existingContent.includes(cleanContent)) {
                isDuplicate = true;
                break;
            }
            
            if (cleanContent.includes(existingContent)) {
                // 新块包含旧块，用新块替换旧块（保留更完整的信息）
                existing.content = chunk.content;
                existing.title = chunk.title;
                existing.summary = chunk.summary;
                existing.id = chunk.id; // 保持 ID 或更新 ID 视情况而定，这里简单替换内容
                isDuplicate = true;
                break;
            }
        }
        
        if (!isDuplicate) {
            uniqueChunks.push(chunk);
        }
    }
    
    return uniqueChunks;
}

// 刷新模型列表 (OpenAI 兼容 API)
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
        // OpenAI 兼容的模型列表接口
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

// 执行分块操作
async function performChunking(text) {
    resetProgress();
    $resultDisplay.empty();
    $('#stream-output').empty();

    const method = CHUNK_CONFIG.method;
    let chunks = [];

    switch (method) {
        case 'semantic':
            logger.info('使用语义分块方法 (LLM)...');
            chunks = await semanticChunking(text);
            break;
        case 'sentence':
            logger.info('使用句子边界分块方法...');
            chunks = sentenceChunking(text);
            break;
        case 'paragraph':
            logger.info('使用段落分块方法...');
            chunks = paragraphChunking(text);
            break;
        case 'fixed':
            logger.info('使用固定长度分块方法...');
            chunks = fixedChunking(text);
            break;
        default:
            logger.warn(`未知的分块方法: ${method}`);
            return;
    }

    // 显示结果
    displayChunks(chunks);

    // 更新统计
    updateStats(text, chunks);

    logger.success(`分块完成，共 ${chunks.length} 个块`);
}

// ========== 分块方法 ==========

// 语义分块 (使用 LLM)
async function semanticChunking(text) {
    if (!API_CONFIG.model) {
        logger.error('请先选择模型');
        throw new Error('未选择模型');
    }

    // 1. 预分段
    const segments = splitTextIntoChunks(text, CHUNK_CONFIG.maxCharsPerRequest, CHUNK_CONFIG.overlapChars);
    
    if (segments.length > 1) {
        logger.info(`文本较长 (${text.length} 字符)，已预分为 ${segments.length} 段进行处理`);
    }

    let allChunks = [];
    
    try {
        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            updateProgress(`正在处理第 ${i + 1}/${segments.length} 段...`, Math.round((i / segments.length) * 100));
            
            if (segments.length > 1) {
                logger.info(`处理第 ${i + 1}/${segments.length} 段 (${segment.text.length} 字符)`);
            }

            const systemPrompt = `你是一个文本分块专家。你的任务是将用户提供的长文本按照语义边界进行分割，使每个分块保持语义完整性和独立性。

**【分块原则】**
1. **语义完整性**: 每个分块应该包含一个完整的主题或概念
2. **上下文独立**: 每个分块在不依赖其他分块的情况下也能被理解
3. **大小适中**: 每个分块大小在 ${CHUNK_CONFIG.minChunkSize}-${CHUNK_CONFIG.maxChunkSize} 字符之间
4. **自然边界**: 优先在段落、章节、主题转换处进行分割

**【输出格式】**
请使用 JSON 数组格式返回分块结果，每个分块包含：
- "title": 分块的简短标题（5-15字）
- "summary": 分块内容的一句话摘要
- "content": 分块的原文内容

示例输出：
\`\`\`json
[
  {"title": "人工智能概述", "summary": "介绍AI的定义和研究领域", "content": "人工智能（Artificial Intelligence..."},
  {"title": "深度学习技术", "summary": "说明深度学习的原理和应用", "content": "深度学习是机器学习的一个子领域..."}
]
\`\`\`

**【重要提醒】**
- 只输出 JSON 数组，不要有其他解释文字
- content 字段必须是原文的直接引用，不要修改原文
- 确保所有原文内容都被包含在分块中，不要遗漏`;

            const userPrompt = `请将以下文本按语义边界进行分块：

${segment.text}`;

            const result = await callOllamaAPIStreaming(systemPrompt, userPrompt);
            // 剥离可能存在的 <think> 标签内容
            const content = stripThinkBlocks(result.content);

            // 解析 JSON 响应
            const segmentChunks = parseChunksFromResponse(content);
            
            // 合并
            allChunks = allChunks.concat(segmentChunks);
            
            // 简单的去重（针对重叠部分）
            allChunks = deduplicateChunks(allChunks);
        }
        
        // 重新编号
        allChunks.forEach((chunk, index) => {
            chunk.id = index + 1;
            if (!chunk.title) chunk.title = `分块 ${index + 1}`;
        });
        
        updateProgress('语义分块完成', 100);
        return allChunks;
        
    } catch (error) {
        resetProgress();
        throw error;
    }
}

// 句子边界分块
function sentenceChunking(text) {
    const chunks = [];
    
    // 按句子分割
    const sentencePattern = /[^。！？\n]+[。！？\n]?/g;
    const sentences = text.match(sentencePattern) || [];
    
    let currentChunk = '';
    let chunkId = 1;
    
    for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > CHUNK_CONFIG.maxChunkSize && currentChunk.length >= CHUNK_CONFIG.minChunkSize) {
            chunks.push({
                id: chunkId++,
                title: `分块 ${chunkId - 1}`,
                summary: currentChunk.slice(0, 50) + '...',
                content: currentChunk.trim()
            });
            currentChunk = '';
        }
        currentChunk += sentence;
    }
    
    // 添加最后一个分块
    if (currentChunk.trim()) {
        chunks.push({
            id: chunkId,
            title: `分块 ${chunkId}`,
            summary: currentChunk.slice(0, 50) + '...',
            content: currentChunk.trim()
        });
    }
    
    return chunks;
}

// 段落分块
function paragraphChunking(text) {
    const chunks = [];
    
    // 按段落分割（空行或多个换行符）
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
    
    let currentChunk = '';
    let chunkId = 1;
    
    for (const paragraph of paragraphs) {
        const trimmedPara = paragraph.trim();
        
        if (currentChunk.length + trimmedPara.length + 2 > CHUNK_CONFIG.maxChunkSize && currentChunk.length >= CHUNK_CONFIG.minChunkSize) {
            chunks.push({
                id: chunkId++,
                title: `分块 ${chunkId - 1}`,
                summary: currentChunk.slice(0, 50) + '...',
                content: currentChunk.trim()
            });
            currentChunk = '';
        }
        
        if (currentChunk) {
            currentChunk += '\n\n';
        }
        currentChunk += trimmedPara;
    }
    
    // 添加最后一个分块
    if (currentChunk.trim()) {
        chunks.push({
            id: chunkId,
            title: `分块 ${chunkId}`,
            summary: currentChunk.slice(0, 50) + '...',
            content: currentChunk.trim()
        });
    }
    
    return chunks;
}

// 固定长度分块
function fixedChunking(text) {
    const chunks = [];
    const maxSize = CHUNK_CONFIG.maxChunkSize;
    
    let start = 0;
    let chunkId = 1;
    
    while (start < text.length) {
        let end = Math.min(start + maxSize, text.length);
        
        // 尝试在句子边界处分割
        if (end < text.length) {
            const searchStart = Math.max(end - 100, start);
            const searchText = text.slice(searchStart, end);
            const lastSentenceEnd = Math.max(
                searchText.lastIndexOf('。'),
                searchText.lastIndexOf('！'),
                searchText.lastIndexOf('？'),
                searchText.lastIndexOf('\n')
            );
            
            if (lastSentenceEnd > 0) {
                end = searchStart + lastSentenceEnd + 1;
            }
        }
        
        const content = text.slice(start, end).trim();
        if (content) {
            chunks.push({
                id: chunkId++,
                title: `分块 ${chunkId - 1}`,
                summary: content.slice(0, 50) + '...',
                content: content
            });
        }
        
        start = end;
    }
    
    return chunks;
}

// 解析 LLM 响应中的分块
function parseChunksFromResponse(responseText) {
    try {
        let jsonStr = responseText.trim();
        
        // 移除可能的 markdown 代码块标记
        const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch) {
            jsonStr = codeBlockMatch[1].trim();
        }
        
        // 尝试解析 JSON
        const chunks = JSON.parse(jsonStr);
        
        if (!Array.isArray(chunks)) {
            logger.warn('响应不是有效的 JSON 数组');
            return [];
        }
        
        // 验证和规范化分块
        return chunks.map((chunk, index) => ({
            id: chunk.id || index + 1,
            title: chunk.title || `分块 ${index + 1}`,
            summary: chunk.summary || '',
            content: chunk.content || ''
        })).filter(chunk => chunk.content);
        
    } catch (e) {
        logger.error(`解析分块响应失败: ${e.message}`);
        logger.warn('原始响应: ' + responseText.slice(0, 200) + '...');
        
        // 尝试备用解析方式
        return fallbackParsing(responseText);
    }
}

// 备用解析方式
function fallbackParsing(text) {
    logger.info('尝试备用解析方式...');
    
    // 按段落分块作为备用方案
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
    
    return paragraphs.map((content, index) => ({
        id: index + 1,
        title: `分块 ${index + 1}`,
        summary: content.slice(0, 50) + '...',
        content: content.trim()
    }));
}

// 显示分块结果
function displayChunks(chunks) {
    $resultDisplay.empty();
    
    if (chunks.length === 0) {
        $resultDisplay.html('<p style="color: #999; text-align: center;">未生成任何分块</p>');
        return;
    }
    
    chunks.forEach((chunk, index) => {
        const $item = $('<div class="chunk-item"></div>');
        
        const $header = $('<div class="chunk-header"></div>');
        
        // 左侧容器
        const $left = $('<div class="chunk-header-left"></div>');
        $left.append(`<span class="chunk-title">#${chunk.id} ${chunk.title}</span>`);
        if (chunk.summary) {
            $left.append(`<span class="chunk-summary-inline">📝 ${chunk.summary}</span>`);
        }
        
        // 右侧 Meta
        const $meta = $(`<span class="chunk-meta">${chunk.content.length} 字符</span>`);
        
        $header.append($left);
        $header.append($meta);
        
        const $content = $('<div class="chunk-content"></div>');
        $content.text(chunk.content);
        
        $item.append($header);
        $item.append($content);
        $resultDisplay.append($item);
    });
}

// 更新统计信息
function updateStats(originalText, chunks) {
    const totalLength = originalText.length;
    const chunkCount = chunks.length;
    const avgSize = chunkCount > 0 ? Math.round(chunks.reduce((sum, c) => sum + c.content.length, 0) / chunkCount) : 0;
    
    $('#stat-original-length').text(`${totalLength} 字符`);
    $('#stat-chunk-count').text(`${chunkCount} 个`);
    $('#stat-avg-size').text(`${avgSize} 字符`);
}

// 流式调用 OpenAI 兼容 API
async function callOllamaAPIStreaming(systemPrompt, userPrompt) {
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
            temperature: LLM_OPTIONS.temperature,
            repeat_penalty: LLM_OPTIONS.repeat_penalty,
            top_k: LLM_OPTIONS.top_k,
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
    let lastSpeedUpdate = 0;
    let lastDOMUpdate = 0;
    let pendingText = '';

    const flushDOM = () => {
        if (pendingText) {
            streamBoxEl.appendChild(document.createTextNode(pendingText));
            pendingText = '';
        }
        streamBoxEl.scrollTop = streamBoxEl.scrollHeight;
    };

    while (true) {
        const { done, value } = await reader.read();
        
        if (value) {
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
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
                continue;
            }
            
            try {
                const json = JSON.parse(dataStr);
                
                // 更新 token 统计
                if (json.usage) {
                    stats.promptTokens = json.usage.prompt_tokens || 0;
                    stats.completionTokens = json.usage.completion_tokens || 0;
                    stats.totalTokens = json.usage.total_tokens || 0;
                }
                
                // 完成原因
                if (json.choices?.[0]?.finish_reason) {
                    stats.finishReason = json.choices[0].finish_reason;
                }
                
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) {
                    if (stats.firstTokenTime === null) {
                        stats.firstTokenTime = Date.now();
                        $('#stat-ttft').text(`${stats.firstTokenTime - stats.startTime} ms`);
                    }
                    tokenCount++;
                    accumulated += delta;
                    pendingText += delta;
                    
                    const now = Date.now();
                    if (now - lastDOMUpdate > 50) {
                        lastDOMUpdate = now;
                        flushDOM();
                    }
                    
                    if (now - lastSpeedUpdate > 1000) {
                        lastSpeedUpdate = now;
                        const elapsed = (now - stats.startTime) / 1000;
                        const speed = elapsed > 0 ? tokenCount / elapsed : 0;
                        $('#stat-speed').text(`${speed.toFixed(1)} tokens/s`);
                        $('#stat-completion-tokens').text(`${tokenCount} (接收中...)`);
                    }
                }
            } catch (e) {
                // JSON 解析失败，跳过
            }
        }
        
        if (done) {
            flushDOM();
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
    $('#stat-prompt-tokens').text(stats.promptTokens || '-');
    $('#stat-completion-tokens').text(stats.completionTokens);

    const speed = totalSeconds > 0 ? stats.completionTokens / totalSeconds : 0;
    $('#stat-speed').text(`${speed.toFixed(1)} tokens/s`);

    logger.info(`统计: 输入${stats.promptTokens || '?'} + 输出${stats.completionTokens} = ${stats.totalTokens} tokens`);
    logger.info(`耗时: ${totalSeconds.toFixed(2)}s, 速度: ${speed.toFixed(1)} tokens/s`);

    return {
        content: accumulated.trim(),
        stats
    };
}
