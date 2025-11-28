// ========== NER 分析器模块 ==========
// 负责使用 LLM 对文本进行两阶段命名实体识别和关系抽取

const systemPromptPhase1 = `
<no_think></no_think>
请阅读以下文本，分析其核心主题。
你的任务是定义适合构建"概念星云图"的元数据结构。
请列出文本中最重要的**实体类型**（例如：人物、地点、算法、药物...）。
请列出实体之间可能存在的**关系类型**（例如：属于、位于、导致、发明...）。

输出格式要求（不要输出多余废话）：
ENTITIES: 类型1, 类型2, 类型3
RELATIONS: 关系1, 关系2, 关系3
`;

const systemPromptPhase2 = `
<no_think></no_think>
你的任务是从文本中提取指定类型的实体和关系。
请严格按照指定的实体类型和关系类型进行提取，不要添加其他类型。

输出格式要求（使用制表符分隔，不要输出多余废话）：
ENTITY	实体类型	实体名称
RELATION	关系类型	主体	客体

例如：
ENTITY	人物	张三
ENTITY	地点	北京
RELATION	工作于	张三	ABC公司
`;


class NERAnalyzer {
    constructor(config = {}) {
        // API 配置
        this.baseUrl = config.baseUrl || 'http://192.168.31.201:1234/v1';
        this.model = config.model || '';
        this.apiKey = config.apiKey || 'lm-studio';
        this.temperature = config.temperature || 0.7;
        this.topK = config.topK || 40;
        this.repeatPenalty = config.repeatPenalty || 1.1;

        // 文本处理配置
        this.chunkSize = config.chunkSize || 2000; // 每次处理的文本长度
        this.overlapSize = config.overlapSize || 200; // 重叠部分长度

        // 内部状态
        this.abortController = null;
        this.isAnalyzing = false;
        this.currentPhase = null; // 'phase1', 'phase2', null
        
        // 累积统计
        this.accumulatedStats = {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            totalTime: 0,
            chunksProcessed: 0,
            totalChunks: 0
        };
        this.analysisStartTime = null;

        // 回调函数
        this.onProgress = config.onProgress || (() => {});
        this.onLog = config.onLog || (() => {});
        this.onStreamOutput = config.onStreamOutput || (() => {});
        this.onStats = config.onStats || (() => {});
        this.onPhase1Complete = config.onPhase1Complete || (() => {});
        this.onPhase2Complete = config.onPhase2Complete || (() => {});
    }

    // 更新配置
    updateConfig(config) {
        if (config.baseUrl !== undefined) this.baseUrl = config.baseUrl;
        if (config.model !== undefined) this.model = config.model;
        if (config.apiKey !== undefined) this.apiKey = config.apiKey;
        if (config.temperature !== undefined) this.temperature = config.temperature;
        if (config.topK !== undefined) this.topK = config.topK;
        if (config.repeatPenalty !== undefined) this.repeatPenalty = config.repeatPenalty;
        if (config.chunkSize !== undefined) this.chunkSize = config.chunkSize;
        if (config.overlapSize !== undefined) this.overlapSize = config.overlapSize;
    }

    // 将文本分割成块（智能断句）
    splitTextIntoChunks(text) {
        const chunks = [];
        let start = 0;
        
        // 定义断句标点符号
        const sentenceEnders = ['。', '！', '？', '；', '\n', '.', '!', '?', ';'];

        while (start < text.length) {
            let end = Math.min(start + this.chunkSize, text.length);
            
            // 如果不是最后一块，尝试在标点符号处断句
            if (end < text.length) {
                let bestBreakPoint = end;
                let searchStart = Math.max(start, end - 100); // 在目标位置前100字符内搜索断句点
                
                // 从目标位置向前搜索最近的标点符号
                for (let i = end - 1; i >= searchStart; i--) {
                    if (sentenceEnders.includes(text[i])) {
                        bestBreakPoint = i + 1; // 在标点符号之后断开
                        break;
                    }
                }
                
                end = bestBreakPoint;
            }
            
            chunks.push(text.substring(start, end));
            
            if (end === text.length) break;
            
            // 计算下一个块的起始位置（考虑重叠）
            start = Math.max(start + 1, end - this.overlapSize);
        }

        return chunks;
    }

    // 解析 TSV 格式的响应
    parseTSV(tsvText) {
        const lines = tsvText.trim().split('\n');
        const result = [];

        for (const line of lines) {
            if (!line.trim()) continue;
            const parts = line.split('\t').map(p => p.trim());
            if (parts.length >= 2) {
                result.push(parts);
            }
        }

        return result;
    }

    // 解析第一阶段的响应格式: ENTITIES: type1, type2 \n RELATIONS: rel1, rel2
    parsePhase1Response(responseText) {
        const entityTypes = new Set();
        const relationTypes = new Set();

        const lines = responseText.trim().split('\n');
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            
            if (trimmedLine.startsWith('ENTITIES:')) {
                const content = trimmedLine.substring('ENTITIES:'.length).trim();
                const types = content.split(',').map(t => t.trim()).filter(t => t);
                types.forEach(type => entityTypes.add(type));
            } else if (trimmedLine.startsWith('RELATIONS:')) {
                const content = trimmedLine.substring('RELATIONS:'.length).trim();
                const relations = content.split(',').map(r => r.trim()).filter(r => r);
                relations.forEach(rel => relationTypes.add(rel));
            }
        }

        return {
            entityTypes: Array.from(entityTypes),
            relationTypes: Array.from(relationTypes)
        };
    }

    // 第一阶段：预分析，提取实体类型和关系种类
    async phase1Analysis(text) {
        this.currentPhase = 'phase1';
        this.onLog('开始第一阶段：预分析实体类型和关系种类', 'info');
        this.onProgress('第一阶段：预分析中...');

        const chunks = this.splitTextIntoChunks(text);
        this.accumulatedStats.totalChunks = chunks.length;
        this.onLog(`文本已分割为 ${chunks.length} 个块`, 'info');

        const allEntityTypes = new Set();
        const allRelationTypes = new Set();

        for (let i = 0; i < chunks.length; i++) {
            if (!this.isAnalyzing) {
                throw new Error('分析已取消');
            }

            const chunk = chunks[i];
            this.onProgress(`第一阶段：处理块 ${i + 1}/${chunks.length}...`);
            this.onLog(`处理块 ${i + 1}/${chunks.length} (长度: ${chunk.length} 字符)`, 'info');

            try {
                const response = await this.callLLMWithSystem(systemPromptPhase1, chunk, (chunk) => {
                    this.onStreamOutput(chunk);
                });

                // 解析响应
                const parsed = this.parsePhase1Response(response);
                
                // 合并结果
                parsed.entityTypes.forEach(type => allEntityTypes.add(type));
                parsed.relationTypes.forEach(rel => allRelationTypes.add(rel));

                this.onLog(`块 ${i + 1} 处理完成 - 实体类型: ${parsed.entityTypes.join(', ')}, 关系类型: ${parsed.relationTypes.join(', ')}`, 'success');
            } catch (error) {
                if (error.name === 'AbortError') {
                    throw error;
                }
                this.onLog(`块 ${i + 1} 处理失败: ${error.message}`, 'error');
            }
        }

        const result = {
            entityTypes: Array.from(allEntityTypes),
            relationTypes: Array.from(allRelationTypes)
        };

        this.onLog(`第一阶段完成。实体类型: ${result.entityTypes.length}, 关系类型: ${result.relationTypes.length}`, 'success');
        this.onPhase1Complete(result);

        return result;
    }

    // 第二阶段：针对性分析，提取指定的实体和关系
    async phase2Analysis(text, phase1Result) {
        this.currentPhase = 'phase2';
        this.onLog('开始第二阶段：针对性实体和关系提取', 'info');
        this.onProgress('第二阶段：针对性分析中...');

        const { entityTypes, relationTypes } = phase1Result;

        if (entityTypes.length === 0 && relationTypes.length === 0) {
            this.onLog('第一阶段未发现任何实体类型或关系类型，跳过第二阶段', 'warn');
            return { entities: {}, relations: [] };
        }

        const chunks = this.splitTextIntoChunks(text);
        // 重置块计数器为第二阶段
        this.accumulatedStats.chunksProcessed = 0;
        this.accumulatedStats.totalChunks = chunks.length;
        this.onLog(`文本已分割为 ${chunks.length} 个块`, 'info');

        const allEntities = {};
        const allRelations = [];

        // 初始化实体类型
        entityTypes.forEach(type => {
            allEntities[type] = new Set();
        });

        for (let i = 0; i < chunks.length; i++) {
            if (!this.isAnalyzing) {
                throw new Error('分析已取消');
            }

            const chunk = chunks[i];
            this.onProgress(`第二阶段：处理块 ${i + 1}/${chunks.length}...`);
            this.onLog(`处理块 ${i + 1}/${chunks.length} (长度: ${chunk.length} 字符)`, 'info');

            const entityTypesStr = entityTypes.join('、');
            const relationTypesStr = relationTypes.join('、');

            const userPrompt = `需要提取的实体类型：${entityTypesStr}
需要提取的关系类型：${relationTypesStr}

文本：
${chunk}`;

            try {
                const response = await this.callLLMWithSystem(systemPromptPhase2, userPrompt, (chunk) => {
                    this.onStreamOutput(chunk);
                });

                // 解析 TSV 响应
                const parsed = this.parseTSV(response);
                for (const parts of parsed) {
                    const [type, ...values] = parts;
                    
                    if (type === 'ENTITY' && values.length >= 2) {
                        const [entityType, entityName] = values;
                        if (allEntities[entityType]) {
                            allEntities[entityType].add(entityName);
                        }
                    } else if (type === 'RELATION' && values.length >= 3) {
                        const [relationType, subject, object] = values;
                        allRelations.push({
                            type: relationType,
                            subject,
                            object
                        });
                    }
                }

                this.onLog(`块 ${i + 1} 处理完成`, 'success');
            } catch (error) {
                if (error.name === 'AbortError') {
                    throw error;
                }
                this.onLog(`块 ${i + 1} 处理失败: ${error.message}`, 'error');
            }
        }

        // 转换 Set 为 Array
        const result = {
            entities: {},
            relations: allRelations
        };

        for (const [type, entitySet] of Object.entries(allEntities)) {
            result.entities[type] = Array.from(entitySet);
        }

        this.onLog(`第二阶段完成。实体总数: ${Object.values(result.entities).flat().length}, 关系总数: ${result.relations.length}`, 'success');
        this.onPhase2Complete(result);

        return result;
    }

    // 调用 LLM API（带系统提示词）
    async callLLMWithSystem(systemPrompt, userPrompt, onChunk) {
        this.abortController = new AbortController();

        const startTime = Date.now();
        let firstTokenTime = null;
        let fullResponse = '';
        let promptTokens = 0;
        let completionTokens = 0;
        let finishReason = '';

        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: this.temperature,
                    top_k: this.topK,
                    repeat_penalty: this.repeatPenalty,
                    stream: true,
                    stream_options: { include_usage: true }
                }),
                signal: this.abortController.signal
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.trim() || !line.startsWith('data: ')) continue;
                    
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const json = JSON.parse(data);
                        
                        // 记录首 token 时间
                        if (!firstTokenTime && json.choices?.[0]?.delta?.content) {
                            firstTokenTime = Date.now();
                        }

                        // 累积响应内容
                        const content = json.choices?.[0]?.delta?.content || '';
                        fullResponse += content;

                        // 调用回调
                        if (content && onChunk) {
                            onChunk(content);
                        }

                        // 获取 token 统计
                        if (json.usage) {
                            promptTokens = json.usage.prompt_tokens || 0;
                            completionTokens = json.usage.completion_tokens || 0;
                        }

                        // 获取完成原因
                        if (json.choices?.[0]?.finish_reason) {
                            finishReason = json.choices[0].finish_reason;
                        }
                    } catch (e) {
                        // 忽略 JSON 解析错误
                    }
                }
            }

            const endTime = Date.now();
            const totalTime = (endTime - startTime) / 1000;
            const ttft = firstTokenTime ? (firstTokenTime - startTime) / 1000 : 0;
            const speed = completionTokens > 0 ? (completionTokens / totalTime).toFixed(2) : '0';

            // 更新累积统计
            this.accumulatedStats.promptTokens += promptTokens || 0;
            this.accumulatedStats.completionTokens += completionTokens || 0;
            this.accumulatedStats.totalTokens += (promptTokens + completionTokens) || 0;
            this.accumulatedStats.totalTime += totalTime;
            this.accumulatedStats.chunksProcessed++;

            // 计算总耗时
            const totalElapsed = this.analysisStartTime 
                ? (Date.now() - this.analysisStartTime) / 1000 
                : 0;

            // 更新统计信息
            this.onStats({
                currentPhase: this.currentPhase === 'phase1' ? '第一阶段：预分析' : '第二阶段：实体提取',
                chunksProgress: `${this.accumulatedStats.chunksProcessed}/${this.accumulatedStats.totalChunks}`,
                ttft: `${ttft.toFixed(3)}s`,
                totalTime: `${totalTime.toFixed(3)}s`,
                promptTokens: promptTokens || '-',
                completionTokens: completionTokens || '-',
                totalTokens: (promptTokens + completionTokens) || '-',
                speed: `${speed} tokens/s`,
                accumulatedPromptTokens: this.accumulatedStats.promptTokens,
                accumulatedCompletionTokens: this.accumulatedStats.completionTokens,
                accumulatedTotalTokens: this.accumulatedStats.totalTokens,
                totalElapsedTime: `${totalElapsed.toFixed(3)}s`,
                finishReason: finishReason || '-'
            });

            return fullResponse;
        } catch (error) {
            if (error.name === 'AbortError') {
                this.onLog('请求已取消', 'warn');
                throw error;
            }
            throw error;
        }
    }

    // 调用 LLM API
    async callLLM(prompt, onChunk) {
        this.abortController = new AbortController();

        const startTime = Date.now();
        let firstTokenTime = null;
        let fullResponse = '';
        let promptTokens = 0;
        let completionTokens = 0;
        let finishReason = '';

        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        { role: 'user', content: prompt }
                    ],
                    temperature: this.temperature,
                    top_k: this.topK,
                    repeat_penalty: this.repeatPenalty,
                    stream: true,
                    stream_options: { include_usage: true }
                }),
                signal: this.abortController.signal
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.trim() || !line.startsWith('data: ')) continue;
                    
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const json = JSON.parse(data);
                        
                        // 记录首 token 时间
                        if (!firstTokenTime && json.choices?.[0]?.delta?.content) {
                            firstTokenTime = Date.now();
                        }

                        // 累积响应内容
                        const content = json.choices?.[0]?.delta?.content || '';
                        fullResponse += content;

                        // 调用回调
                        if (content && onChunk) {
                            onChunk(content);
                        }

                        // 获取 token 统计
                        if (json.usage) {
                            promptTokens = json.usage.prompt_tokens || 0;
                            completionTokens = json.usage.completion_tokens || 0;
                        }

                        // 获取完成原因
                        if (json.choices?.[0]?.finish_reason) {
                            finishReason = json.choices[0].finish_reason;
                        }
                    } catch (e) {
                        // 忽略 JSON 解析错误
                    }
                }
            }

            const endTime = Date.now();
            const totalTime = (endTime - startTime) / 1000;
            const ttft = firstTokenTime ? (firstTokenTime - startTime) / 1000 : 0;
            const speed = completionTokens > 0 ? (completionTokens / totalTime).toFixed(2) : '0';

            // 更新统计信息
            this.onStats({
                ttft: `${ttft.toFixed(3)}s`,
                totalTime: `${totalTime.toFixed(3)}s`,
                promptTokens: promptTokens || '-',
                completionTokens: completionTokens || '-',
                totalTokens: (promptTokens + completionTokens) || '-',
                speed: `${speed} tokens/s`,
                finishReason: finishReason || '-'
            });

            return fullResponse;
        } catch (error) {
            if (error.name === 'AbortError') {
                this.onLog('请求已取消', 'warn');
                throw error;
            }
            throw error;
        }
    }

    // 开始完整的两阶段分析
    async analyze(text) {
        if (this.isAnalyzing) {
            throw new Error('分析正在进行中');
        }

        if (!this.model) {
            throw new Error('请先选择模型');
        }

        if (!text.trim()) {
            throw new Error('文本内容为空');
        }

        this.isAnalyzing = true;
        
        // 重置累积统计
        this.accumulatedStats = {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            totalTime: 0,
            chunksProcessed: 0,
            totalChunks: 0
        };
        this.analysisStartTime = Date.now();

        try {
            // 第一阶段
            const phase1Result = await this.phase1Analysis(text);

            // 第二阶段
            const phase2Result = await this.phase2Analysis(text, phase1Result);

            this.onProgress('分析完成！');
            this.onLog('两阶段分析全部完成', 'success');

            return {
                phase1: phase1Result,
                phase2: phase2Result
            };
        } catch (error) {
            if (error.name === 'AbortError' || error.message === '分析已取消') {
                this.onLog('分析已取消', 'warn');
                this.onProgress('分析已取消');
            } else {
                this.onLog(`分析失败: ${error.message}`, 'error');
                this.onProgress('分析失败');
                throw error;
            }
        } finally {
            this.isAnalyzing = false;
            this.currentPhase = null;
            this.abortController = null;
        }
    }

    // 停止分析
    stop() {
        if (this.abortController) {
            this.abortController.abort();
            this.isAnalyzing = false;
            this.currentPhase = null;
            this.onLog('正在停止分析...', 'warn');
        }
    }

    // 检查是否正在分析
    isRunning() {
        return this.isAnalyzing;
    }

    // 获取当前阶段
    getCurrentPhase() {
        return this.currentPhase;
    }
}

// 导出模块（支持浏览器环境）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NERAnalyzer;
}
