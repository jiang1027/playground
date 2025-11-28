// ========== Preact 组件化 NER 页面 ==========
// 从 htmPreact 全局对象中获取所需的函数和 hooks
const { html, Component, useState, useEffect, useRef } = htmPreact;

// ========== 1. 通用滑块组件 ==========
function SliderControl({ label, value, min, max, step, onChange }) {
    const handleChange = (e) => {
        const newValue = parseFloat(e.target.value);
        onChange?.(newValue);
    };

    return html`
        <div class="slider-control">
            <label class="slider-label">${label}:</label>
            <input 
                type="range" 
                class="slider-input"
                value=${value}
                min=${min}
                max=${max}
                step=${step}
                onInput=${handleChange}
            />
            <span class="slider-value">${value}</span>
        </div>
    `;
}

// ========== 2. 通用可折叠区块组件 ==========
function CollapsibleBlock({ title, children, className = '', headerClass = '', defaultCollapsed = false, draggable = false, cardId = '', onOrderChange }) {
    const [collapsed, setCollapsed] = useState(defaultCollapsed);
    const blockRef = useRef(null);

    useEffect(() => {
        if (!draggable || !blockRef.current || typeof interact === 'undefined') return;

        const element = blockRef.current;
        const handle = element.querySelector('.collapsible-title');
        
        if (!handle) return;

        // 初始化order属性
        if (!element.style.order) {
            const siblings = Array.from(element.parentElement.children).filter(el => 
                el.classList.contains('collapsible-block')
            );
            const index = siblings.indexOf(element);
            element.style.order = index.toString();
        }

        let originalOrder = element.style.order;
        let lastSwapTime = 0;
        const swapDelay = 100; // 防抖延迟100ms

        const interactInstance = interact(element)
            .draggable({
                allowFrom: '.collapsible-title',
                inertia: false,
                autoScroll: true,
                listeners: {
                    start(event) {
                        originalOrder = event.target.style.order;
                        event.target.classList.add('dragging');
                        event.target.style.zIndex = '1000';
                        lastSwapTime = 0;
                        
                        // 只固定宽度，让高度由内容自然决定
                        const rect = event.target.getBoundingClientRect();
                        event.target.style.width = `${rect.width}px`;
                        event.target.style.flexShrink = '0';
                    },
                    move(event) {
                        const target = event.target;
                        const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
                        const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;
                        
                        target.style.transform = `translate(${x}px, ${y}px)`;
                        target.setAttribute('data-x', x);
                        target.setAttribute('data-y', y);
                        
                        // 防抖：限制交换频率
                        const now = Date.now();
                        if (now - lastSwapTime < swapDelay) return;
                        
                        // 获取所有卡片
                        const siblings = Array.from(target.parentElement.children).filter(el => 
                            el !== target && el.classList.contains('collapsible-block')
                        );
                        
                        if (siblings.length === 0) return;
                        
                        // 获取拖动卡片的中心点
                        const targetRect = target.getBoundingClientRect();
                        const targetCenter = {
                            x: targetRect.left + targetRect.width / 2,
                            y: targetRect.top + targetRect.height / 2
                        };
                        
                        // 找到被拖动卡片中心点覆盖的卡片
                        let hoveredSibling = null;
                        
                        for (const sibling of siblings) {
                            const siblingRect = sibling.getBoundingClientRect();
                            
                            // 检查中心点是否在这个卡片范围内
                            if (
                                targetCenter.x >= siblingRect.left &&
                                targetCenter.x <= siblingRect.right &&
                                targetCenter.y >= siblingRect.top &&
                                targetCenter.y <= siblingRect.bottom
                            ) {
                                hoveredSibling = sibling;
                                break;
                            }
                        }
                        
                        if (hoveredSibling) { // 中心点覆盖到某个卡片时交换
                            const targetOrder = parseInt(target.style.order || '0');
                            const siblingOrder = parseInt(hoveredSibling.style.order || '0');
                            
                            if (targetOrder !== siblingOrder) {
                                lastSwapTime = now;
                                
                                // 临时禁用transition
                                target.style.transition = 'none';
                                
                                // 保存当前视觉位置
                                const currentX = targetRect.left;
                                const currentY = targetRect.top;
                                
                                // 交换order
                                target.style.order = siblingOrder.toString();
                                hoveredSibling.style.order = targetOrder.toString();
                                
                                // 通知父组件顺序变化
                                if (onOrderChange) {
                                    const allCards = Array.from(target.parentElement.children)
                                        .filter(el => el.classList.contains('collapsible-block'))
                                        .sort((a, b) => parseInt(a.style.order || '0') - parseInt(b.style.order || '0'))
                                        .map(el => el.getAttribute('data-card-id'))
                                        .filter(Boolean);
                                    onOrderChange(allCards);
                                }
                                
                                // 强制重排
                                target.offsetHeight;
                                
                                // 计算新位置
                                const newRect = target.getBoundingClientRect();
                                const offsetX = currentX - newRect.left;
                                const offsetY = currentY - newRect.top;
                                
                                // 更新transform基准
                                const newX = x + offsetX;
                                const newY = y + offsetY;
                                
                                target.setAttribute('data-x', newX);
                                target.setAttribute('data-y', newY);
                                target.style.transform = `translate(${newX}px, ${newY}px)`;
                            }
                        }
                    },
                    end(event) {
                        const target = event.target;
                        target.classList.remove('dragging');
                        target.style.zIndex = '';
                        target.style.transform = '';
                        target.style.width = '';
                        target.style.flexShrink = '';
                        target.removeAttribute('data-x');
                        target.removeAttribute('data-y');
                    }
                }
            });

        return () => {
            interactInstance.unset();
        };
    }, [draggable]);

    const toggleCollapse = (e) => {
        e.stopPropagation();
        setCollapsed(!collapsed);
    };

    return html`
        <div 
            ref=${blockRef}
            class="collapsible-block ${className} ${draggable ? 'draggable' : ''}"
            data-card-id=${cardId}
        >
            <div class="collapsible-header ${collapsed ? 'collapsed' : ''} ${headerClass}">
                <span class="collapsible-title">${title}</span>
                <span class="collapsible-toggle" onClick=${toggleCollapse}></span>
            </div>
            <div class="collapsible-content ${collapsed ? 'collapsed' : ''}">
                ${children}
            </div>
        </div>
    `;
}

// ========== 3. LLM配置组件 ==========
function LLMConfig({ initialConfig, onConfigChange, onLog }) {
    const [baseUrl, setBaseUrl] = useState(initialConfig.api.baseUrl);
    const [model, setModel] = useState(initialConfig.api.model);
    const [apiKey, setApiKey] = useState(initialConfig.api.apiKey);
    const [models, setModels] = useState([]);
    const [status, setStatus] = useState('');
    const [statusType, setStatusType] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(initialConfig.ui.showAdvanced);
    const [temperature, setTemperature] = useState(initialConfig.advanced.temperature);
    const [topK, setTopK] = useState(initialConfig.advanced.topK);
    const [repeatPenalty, setRepeatPenalty] = useState(initialConfig.advanced.repeatPenalty);

    const updateConfig = () => {
        onConfigChange?.({ 
            baseUrl, 
            model, 
            apiKey,
            temperature,
            topK,
            repeatPenalty
        });
    };

    const handleBaseUrlBlur = (e) => {
        const newBaseUrl = e.target.value.trim();
        if (newBaseUrl !== baseUrl) {
            setBaseUrl(newBaseUrl);
            onConfigChange?.({ baseUrl: newBaseUrl, model, apiKey, temperature, topK, repeatPenalty, showAdvanced });
            onLog?.(`API 地址已更改: ${newBaseUrl}`, 'info');
        }
    };

    const handleBaseUrlKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.target.blur(); // 按回车时失去焦点，触发 onBlur
        }
    };

    const handleModelChange = (e) => {
        const newModel = e.target.value;
        setModel(newModel);
        onConfigChange?.({ baseUrl, model: newModel, apiKey, temperature, topK, repeatPenalty, showAdvanced });
        onLog?.(`已选择模型: ${newModel || '(未选择)'}`, 'info');
    };

    const handleApiKeyBlur = (e) => {
        const newApiKey = e.target.value.trim();
        if (newApiKey !== apiKey) {
            setApiKey(newApiKey);
            onConfigChange?.({ baseUrl, model, apiKey: newApiKey, temperature, topK, repeatPenalty, showAdvanced });
        }
    };

    const handleApiKeyKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.target.blur(); // 按回车时失去焦点，触发 onBlur
        }
    };

    const toggleAdvanced = () => {
        const newShowAdvanced = !showAdvanced;
        setShowAdvanced(newShowAdvanced);
        onConfigChange?.({ baseUrl, model, apiKey, temperature, topK, repeatPenalty, showAdvanced: newShowAdvanced });
    };

    // 组件挂载时自动验证配置
    useEffect(() => {
        if (baseUrl) {
            // 如果有保存的配置，自动验证
            refreshModels(true); // 传入 true 表示是初始化验证
        }
    }, []); // 只在组件挂载时执行一次

    const refreshModels = async (isInitialValidation = false) => {
        setStatus('加载中...');
        setStatusType('loading');
        
        if (!isInitialValidation) {
            onLog?.(`正在从 ${baseUrl} 获取模型列表...`, 'info');
        }

        try {
            const response = await fetch(`${baseUrl}/models`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            const modelList = data.data || [];
            
            setModels(modelList);
            setStatus(`${modelList.length} 个模型`);
            setStatusType('success');

            if (!isInitialValidation) {
                onLog?.(`获取到 ${modelList.length} 个模型`, 'success');
            }

            // 验证已保存的模型是否仍然有效
            if (modelList.length > 0 && model) {
                const modelExists = modelList.some(m => m.id === model);
                if (modelExists) {
                    // 模型仍然有效，保持选择
                    onConfigChange?.({ baseUrl, model, apiKey, temperature, topK, repeatPenalty, showAdvanced });
                    if (isInitialValidation) {
                        onLog?.(`已验证模型配置: ${model}`, 'success');
                    }
                } else {
                    // 模型已失效，清除选择
                    setModel('');
                    onConfigChange?.({ baseUrl, model: '', apiKey, temperature, topK, repeatPenalty, showAdvanced });
                    onLog?.(`保存的模型 "${model}" 已不可用，请重新选择`, 'warn');
                }
            } else if (modelList.length > 0 && !model) {
                // 没有保存的模型，自动选择第一个
                const firstModel = modelList[0].id;
                setModel(firstModel);
                onConfigChange?.({ baseUrl, model: firstModel, apiKey, temperature, topK, repeatPenalty, showAdvanced });
                if (!isInitialValidation) {
                    onLog?.(`已自动选择模型: ${firstModel}`, 'info');
                }
            } else if (modelList.length === 0 && model) {
                // 服务器没有模型，清除保存的选择
                setModel('');
                onConfigChange?.({ baseUrl, model: '', apiKey, temperature, topK, repeatPenalty, showAdvanced });
                onLog?.(`服务器无可用模型`, 'warn');
            }
        } catch (error) {
            setStatus('获取失败');
            setStatusType('error');
            onLog?.(`获取模型列表失败: ${error.message}`, 'error');
            
            // 连接失败时，如果有保存的模型也清除（因为无法验证）
            if (model) {
                setModel('');
                onConfigChange?.({ baseUrl, model: '', apiKey, temperature, topK, repeatPenalty, showAdvanced });
                if (!isInitialValidation) {
                    onLog?.(`无法连接到服务器，已清除模型选择`, 'warn');
                }
            }
        }
    };

    return html`
        <div class="config-row">
            <label for="api-base-url">API 地址:</label>
            <input 
                type="text" 
                id="api-base-url" 
                value=${baseUrl}
                onBlur=${handleBaseUrlBlur}
                onKeyDown=${handleBaseUrlKeyDown}
                placeholder="http://192.168.31.201:1234/v1"
            />
            <button id="btn-refresh-models" onClick=${refreshModels} title="刷新模型列表">
                🔄 刷新
            </button>
        </div>
        <div class="config-row">
            <label for="api-model">模型:</label>
            <select 
                id="api-model" 
                value=${model} 
                onChange=${handleModelChange}
                style=${!model ? 'border-color: #dc3545; background-color: #fff5f5;' : ''}
            >
                ${models.length === 0 
                    ? html`<option value="">-- 请先刷新模型列表 --</option>`
                    : models.map(m => html`<option value=${m.id}>${m.id}</option>`)
                }
            </select>
            ${status && html`<span class="status-indicator ${statusType}">${status}</span>`}
        </div>
        <div class="config-row">
            <label for="api-key">API Key:</label>
            <input 
                type="text" 
                id="api-key" 
                value=${apiKey}
                onBlur=${handleApiKeyBlur}
                onKeyDown=${handleApiKeyKeyDown}
                placeholder="可选，LM Studio 不需要"
            />
        </div>
        <div class="config-row">
            <button 
                class="btn-toggle-advanced" 
                onClick=${toggleAdvanced}
                style="width: 100%; text-align: left; padding: 8px 10px; background: #f8f9fa; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;"
            >
                ${showAdvanced ? '▼ 隐藏高级配置' : '▶ 显示高级配置'}
            </button>
        </div>
        ${showAdvanced && html`
            <div class="advanced-config">
                <${SliderControl}
                    label="Temperature"
                    value=${temperature}
                    min=${0}
                    max=${2}
                    step=${0.1}
                    onChange=${(val) => {
                        setTemperature(val);
                        onConfigChange?.({ baseUrl, model, apiKey, temperature: val, topK, repeatPenalty, showAdvanced });
                    }}
                />
                <${SliderControl}
                    label="Top K"
                    value=${topK}
                    min=${1}
                    max=${100}
                    step=${1}
                    onChange=${(val) => {
                        setTopK(val);
                        onConfigChange?.({ baseUrl, model, apiKey, temperature, topK: val, repeatPenalty, showAdvanced });
                    }}
                />
                <${SliderControl}
                    label="Repeat Penalty"
                    value=${repeatPenalty}
                    min=${1}
                    max=${2}
                    step=${0.1}
                    onChange=${(val) => {
                        setRepeatPenalty(val);
                        onConfigChange?.({ baseUrl, model, apiKey, temperature, topK, repeatPenalty: val, showAdvanced });
                    }}
                />
            </div>
        `}
    `;
}

// ========== 4. 用户输入组件 ==========
function UserInput({ onAnalyze, onCancel, onClearLog, onLog, analyzingProp = false, hasModel = false }) {
    const [text, setText] = useState('张三和李四将于明天下午3点在北京会议室讨论新项目的合作事宜。');
    const [analyzing, setAnalyzing] = useState(analyzingProp);
    const [textLength, setTextLength] = useState(0);
    const fileInputRef = useRef(null);

    // 同步外部传入的 analyzing 状态
    useEffect(() => {
        setAnalyzing(analyzingProp);
    }, [analyzingProp]);

    // 更新文本长度
    useEffect(() => {
        setTextLength(text.length);
    }, [text]);

    const handleTextChange = (e) => {
        setText(e.target.value);
    };

    const handleLoadFile = () => {
        fileInputRef.current?.click();
    };

    const handleFileSelected = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.txt')) {
            onLog?.('请选择 .txt 文件', 'warn');
            return;
        }

        try {
            const content = await file.text();
            setText(content);
            onLog?.(`已加载文件: ${file.name} (${content.length} 字符)`, 'success');
        } catch (error) {
            onLog?.(`加载文件失败: ${error.message}`, 'error');
        }

        // 清空文件输入，允许重复选择同一文件
        e.target.value = '';
    };

    const handleAnalyze = () => {
        if (!text.trim()) {
            onLog?.('请输入要分析的文本', 'warn');
            return;
        }
        setAnalyzing(true);
        onAnalyze?.(text);
    };

    const handleCancel = () => {
        setAnalyzing(false);
        onCancel?.();
    };

    const handleClearLog = () => {
        onClearLog?.();
    };

    return html`
        ${textLength > 0 && html`
            <div style="padding: 8px; background: #f0f8ff; border-radius: 4px; margin-bottom: 10px; font-size: 13px; color: #555;">
                📄 文本长度: <strong>${textLength}</strong> 字符
            </div>
        `}
        
        <textarea 
            id="input-text" 
            value=${text}
            onInput=${handleTextChange}
            placeholder="请在此粘贴或输入要分析的文本..."
        />

        <input 
            type="file" 
            ref=${fileInputRef}
            accept=".txt"
            style="display: none;"
            onChange=${handleFileSelected}
        />

        <div class="button-row">
            <button 
                id="btn-load-file" 
                onClick=${handleLoadFile}
                disabled=${analyzing}
                title="从文件加载文本"
            >
                📁 加载文件
            </button>
            <button 
                id="btn-analyze" 
                onClick=${handleAnalyze}
                disabled=${analyzing || !hasModel}
                title=${!hasModel ? '请先在API配置中刷新并选择模型' : '开始分析文本'}
            >
                开始分析
            </button>
            <button 
                id="btn-cancel-analyze" 
                onClick=${handleCancel}
                disabled=${!analyzing}
            >
                取消分析
            </button>
            <button id="btn-clear-log" onClick=${handleClearLog}>
                清空日志
            </button>
        </div>
    `;
}

// ========== 5. 统计信息组件 ==========
function Statistics({ stats = {} }) {
    return html`
        <div class="stats-grid">
            ${stats.currentPhase && html`
                <div class="stat-item stat-highlight">
                    <span class="stat-label">🔄 当前阶段:</span>
                    <span>${stats.currentPhase}</span>
                </div>
            `}
            ${stats.chunksProgress && html`
                <div class="stat-item stat-highlight">
                    <span class="stat-label">📑 处理进度:</span>
                    <span>${stats.chunksProgress}</span>
                </div>
            `}
            <div class="stat-item">
                <span class="stat-label">⏱️ 首Token延迟:</span>
                <span>${stats.ttft || '-'}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">⏱️ 本次耗时:</span>
                <span>${stats.totalTime || '-'}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">📥 本次输入:</span>
                <span>${stats.promptTokens || '-'}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">📤 本次输出:</span>
                <span>${stats.completionTokens || '-'}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">📊 本次总计:</span>
                <span>${stats.totalTokens || '-'}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">⚡ 生成速度:</span>
                <span>${stats.speed || '-'}</span>
            </div>
            ${stats.accumulatedPromptTokens !== undefined && html`
                <div class="stat-item stat-accumulated">
                    <span class="stat-label">📥 累积输入:</span>
                    <span>${stats.accumulatedPromptTokens}</span>
                </div>
            `}
            ${stats.accumulatedCompletionTokens !== undefined && html`
                <div class="stat-item stat-accumulated">
                    <span class="stat-label">📤 累积输出:</span>
                    <span>${stats.accumulatedCompletionTokens}</span>
                </div>
            `}
            ${stats.accumulatedTotalTokens !== undefined && html`
                <div class="stat-item stat-accumulated">
                    <span class="stat-label">📊 累积总计:</span>
                    <span>${stats.accumulatedTotalTokens}</span>
                </div>
            `}
            ${stats.totalElapsedTime && html`
                <div class="stat-item stat-accumulated">
                    <span class="stat-label">⏱️ 累积耗时:</span>
                    <span>${stats.totalElapsedTime}</span>
                </div>
            `}
            <div class="stat-item">
                <span class="stat-label">✅ 完成原因:</span>
                <span>${stats.finishReason || '-'}</span>
            </div>
        </div>
    `;
}

// ========== 6. 模型输出组件 ==========
function ModelOutput({ progress = '', streamOutput = '' }) {
    const outputRef = useRef(null);

    // 自动滚动到底部
    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [streamOutput]);

    return html`
        <div ref=${outputRef} id="stream-output" style="white-space: pre-wrap; word-wrap: break-word; overflow-y: auto; max-height: 400px; padding: 10px; background: #fafafa; border-radius: 4px;">${streamOutput || '等待模型输出...'}</div>
    `;
}

// ========== 7. 显示结果组件 ==========
function ResultDisplay({ entities = {} }) {
    const typeNames = {
        'PERSON': '人物',
        'TIME': '时间',
        'LOCATION': '地点',
        'ORGANIZATION': '组织',
        'THING': '事物',
        'RELATIONSHIP': '关系',
        'EVENT': '事件'
    };

    const renderEntityGroup = (type, entityList) => {
        if (!entityList || entityList.length === 0) return null;

        return html`
            <div class="entity-group">
                <div class="entity-group-header">${typeNames[type] || type}</div>
                <div class="entity-group-content">
                    ${entityList.map(entity => html`
                        <span class="entity entity-${type}">${entity}</span>
                    `)}
                </div>
            </div>
        `;
    };

    const hasEntities = Object.keys(entities).some(key => entities[key]?.length > 0);

    return html`
        <div id="result-display">
            ${!hasEntities 
                ? html`<div style="color: #999; text-align: center; padding: 20px;">暂无识别结果</div>`
                : Object.keys(entities).map(type => renderEntityGroup(type, entities[type]))
            }
        </div>
    `;
}

// ========== 8. 日志组件 ==========
function LogPanel({ onMount }) {
    const logContainerRef = useRef(null);
    const logListRef = useRef(null);
    const maxLogs = 1000; // 最多保留 1000 条日志

    useEffect(() => {
        // 组件挂载时，将方法暴露给父组件
        // 空依赖数组确保只在组件挂载时执行一次，避免每次渲染都重新注册方法
        if (onMount) {
            onMount({
                appendLog: (message, type = 'info') => {
                    if (!logListRef.current) return;
                    
                    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
                    
                    // 创建日志项
                    const li = document.createElement('li');
                    li.className = `log-${type}`;
                    
                    const timeSpan = document.createElement('span');
                    timeSpan.className = 'log-time';
                    timeSpan.textContent = `[${time}]`;
                    
                    const textNode = document.createTextNode(` ${message}`);
                    
                    li.appendChild(timeSpan);
                    li.appendChild(textNode);
                    
                    // 添加到列表
                    logListRef.current.appendChild(li);
                    
                    // 限制日志数量
                    const logItems = logListRef.current.children;
                    if (logItems.length > maxLogs) {
                        logListRef.current.removeChild(logItems[0]);
                    }
                    
                    // 自动滚动到底部
                    if (logContainerRef.current) {
                        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
                    }
                },
                clearLogs: () => {
                    if (logListRef.current) {
                        logListRef.current.innerHTML = '';
                    }
                }
            });
        }
    }, []); // 空依赖数组：只在挂载时执行一次

    return html`
        <div id="log-container" ref=${logContainerRef}>
            <ul id="log-list" ref=${logListRef}></ul>
        </div>
    `;
}

// ========== 9. 主应用组件 ==========
function App() {
    // 统一的配置加载函数
    const loadAppConfig = () => {
        try {
            const saved = localStorage.getItem('ner_app_config');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.error('加载应用配置失败:', e);
        }
        // 默认配置
        return {
            llm: {
                api: {
                    baseUrl: 'http://192.168.31.201:1234/v1',
                    model: '',
                    apiKey: 'lm-studio'
                },
                advanced: {
                    temperature: 0.7,
                    topK: 40,
                    repeatPenalty: 1.1
                },
                ui: {
                    showAdvanced: false
                }
            },
            layout: {
                cardOrder: ['config', 'input', 'result', 'stats', 'output', 'log']
            }
        };
    };

    // 统一的配置保存函数
    const saveAppConfig = (newConfig) => {
        try {
            localStorage.setItem('ner_app_config', JSON.stringify(newConfig));
        } catch (e) {
            console.error('保存应用配置失败:', e);
        }
    };

    const initialConfig = loadAppConfig();
    
    const [appConfig, setAppConfig] = useState(initialConfig);
    const [config, setConfig] = useState({
        baseUrl: initialConfig.llm.api.baseUrl,
        model: initialConfig.llm.api.model,
        apiKey: initialConfig.llm.api.apiKey,
        temperature: initialConfig.llm.advanced.temperature,
        topK: initialConfig.llm.advanced.topK,
        repeatPenalty: initialConfig.llm.advanced.repeatPenalty
    });
    const [stats, setStats] = useState({});
    const [progress, setProgress] = useState('');
    const [streamOutput, setStreamOutput] = useState('');
    const [entities, setEntities] = useState({});
    const [analyzing, setAnalyzing] = useState(false);
    
    const abortControllerRef = useRef(null);
    const logMethods = useRef(null);
    const analyzerRef = useRef(null);

    useEffect(() => {
        // 初始化分析器
        if (typeof NERAnalyzer !== 'undefined') {
            analyzerRef.current = new NERAnalyzer({
                baseUrl: config.baseUrl,
                model: config.model,
                apiKey: config.apiKey,
                temperature: config.temperature,
                topK: config.topK,
                repeatPenalty: config.repeatPenalty,
                onProgress: (message) => setProgress(message),
                onLog: addLog,
                onStreamOutput: (chunk) => {
                    setStreamOutput(prev => prev + chunk);
                },
                onStats: (statsData) => setStats(statsData),
                onPhase1Complete: (result) => {
                    addLog(`第一阶段完成 - 实体类型: ${result.entityTypes.join(', ')}`, 'success');
                    addLog(`第一阶段完成 - 关系类型: ${result.relationTypes.join(', ')}`, 'success');
                },
                onPhase2Complete: (result) => {
                    setEntities(result.entities);
                    addLog(`第二阶段完成 - 提取的实体和关系已更新`, 'success');
                }
            });
        }

        // 页面加载后添加初始日志
        setTimeout(() => {
            addLog('页面已加载', 'info');
        }, 100);
    }, []);

    // 配置变更
    const handleConfigChange = (newConfig) => {
        setConfig(newConfig);
        
        // 更新分析器配置
        if (analyzerRef.current) {
            analyzerRef.current.updateConfig({
                baseUrl: newConfig.baseUrl,
                model: newConfig.model,
                apiKey: newConfig.apiKey,
                temperature: newConfig.temperature,
                topK: newConfig.topK,
                repeatPenalty: newConfig.repeatPenalty
            });
        }
        
        // 更新整体配置
        const updatedAppConfig = {
            ...appConfig,
            llm: {
                api: {
                    baseUrl: newConfig.baseUrl,
                    model: newConfig.model,
                    apiKey: newConfig.apiKey
                },
                advanced: {
                    temperature: newConfig.temperature,
                    topK: newConfig.topK,
                    repeatPenalty: newConfig.repeatPenalty
                },
                ui: {
                    showAdvanced: newConfig.showAdvanced ?? appConfig.llm.ui.showAdvanced
                }
            },
            layout: appConfig.layout
        };
        
        setAppConfig(updatedAppConfig);
        saveAppConfig(updatedAppConfig);
    };

    // 添加日志（直接操作 DOM，不触发组件重渲染）
    const addLog = (message, type = 'info') => {
        logMethods.current?.appendLog(message, type);
    };

    // 清空日志
    const handleClearLog = () => {
        logMethods.current?.clearLogs();
        addLog('日志已清空', 'info');
    };

    // 处理卡片顺序变化
    const handleOrderChange = (newOrder) => {
        const updatedAppConfig = {
            ...appConfig,
            layout: {
                cardOrder: newOrder
            }
        };
        setAppConfig(updatedAppConfig);
        saveAppConfig(updatedAppConfig);
    };

    // 开始分析
    const handleAnalyze = async (text) => {
        if (!config.model) {
            addLog('请先选择模型', 'warn');
            setAnalyzing(false);
            return;
        }

        addLog('开始分析...', 'info');
        setAnalyzing(true);
        setStats({});
        setStreamOutput('');
        setEntities({});
        setProgress('准备中...');

        try {
            await performAnalysis(text);
        } catch (error) {
            addLog(`分析失败: ${error.message}`, 'error');
        } finally {
            setAnalyzing(false);
        }
    };

    // 取消分析
    const handleCancel = () => {
        if (analyzerRef.current && analyzerRef.current.isRunning()) {
            analyzerRef.current.stop();
        }
        setAnalyzing(false);
    };

    // 执行分析
    const performAnalysis = async (text) => {
        if (!analyzerRef.current) {
            addLog('分析器未初始化', 'error');
            return;
        }

        setStreamOutput(''); // 清空之前的输出
        
        try {
            const result = await analyzerRef.current.analyze(text);
            addLog('分析完成！', 'success');
        } catch (error) {
            if (error.message !== '分析已取消') {
                addLog(`分析失败: ${error.message}`, 'error');
            }
        }
    };

    // 定义所有卡片组件的映射
    const cardComponents = {
        'config': {
            component: LLMConfig,
            props: {
                initialConfig: appConfig.llm,
                onConfigChange: handleConfigChange,
                onLog: addLog
            },
            title: 'API 配置'
        },
        'input': {
            component: UserInput,
            props: {
                onAnalyze: handleAnalyze,
                onCancel: handleCancel,
                onClearLog: handleClearLog,
                onLog: addLog,
                analyzingProp: analyzing,
                hasModel: !!config.model
            },
            title: '输入文本'
        },
        'result': {
            component: ResultDisplay,
            props: {
                entities: entities
            },
            title: '识别结果'
        },
        'stats': {
            component: Statistics,
            props: {
                stats: stats
            },
            title: '统计信息'
        },
        'output': {
            component: ModelOutput,
            props: {
                progress: progress,
                streamOutput: streamOutput
            },
            title: '原始模型输出'
        },
        'log': {
            component: LogPanel,
            props: {
                onMount: (methods) => logMethods.current = methods
            },
            title: '日志输出'
        }
    };

    // 根据配置的顺序渲染卡片
    const cardOrder = appConfig.layout.cardOrder || ['config', 'input', 'result', 'stats', 'output', 'log'];
    
    return html`
        <div id="container">
            <h2>NER 概念提取测试</h2>
            <div class="main-layout">
                ${cardOrder.map((cardId, index) => {
                    const card = cardComponents[cardId];
                    if (!card) return null;
                    
                    const CardComponent = card.component;
                    return html`
                        <${CollapsibleBlock}
                            key=${cardId}
                            cardId=${cardId}
                            title=${card.title}
                            draggable=${true}
                            onOrderChange=${handleOrderChange}
                        >
                            <${CardComponent} ...${card.props} />
                        <//>
                    `;
                })}
            </div>
        </div>
    `;
}



