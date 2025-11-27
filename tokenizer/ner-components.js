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
function CollapsibleBlock({ title, children, className = '', headerClass = '', defaultCollapsed = false, draggable = false }) {
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
function LLMConfig({ onConfigChange, onLog }) {
    const [baseUrl, setBaseUrl] = useState('http://192.168.31.201:1234/v1');
    const [model, setModel] = useState('');
    const [apiKey, setApiKey] = useState('lm-studio');
    const [models, setModels] = useState([]);
    const [status, setStatus] = useState('');
    const [statusType, setStatusType] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [temperature, setTemperature] = useState(0.7);
    const [topK, setTopK] = useState(40);
    const [repeatPenalty, setRepeatPenalty] = useState(1.1);

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

    const handleBaseUrlChange = (e) => {
        const newBaseUrl = e.target.value.trim();
        setBaseUrl(newBaseUrl);
        onConfigChange?.({ baseUrl: newBaseUrl, model, apiKey, temperature, topK, repeatPenalty });
    };

    const handleModelChange = (e) => {
        const newModel = e.target.value;
        setModel(newModel);
        onConfigChange?.({ baseUrl, model: newModel, apiKey, temperature, topK, repeatPenalty });
        onLog?.(`已选择模型: ${newModel || '(未选择)'}`, 'info');
    };

    const handleApiKeyChange = (e) => {
        const newApiKey = e.target.value.trim() || 'lm-studio';
        setApiKey(newApiKey);
        onConfigChange?.({ baseUrl, model, apiKey: newApiKey, temperature, topK, repeatPenalty });
    };

    const handleTemperatureChange = (e) => {
        const newTemp = parseFloat(e.target.value);
        setTemperature(newTemp);
        onConfigChange?.({ baseUrl, model, apiKey, temperature: newTemp, topK, repeatPenalty });
    };

    const handleTopKChange = (e) => {
        const newTopK = parseInt(e.target.value);
        setTopK(newTopK);
        onConfigChange?.({ baseUrl, model, apiKey, temperature, topK: newTopK, repeatPenalty });
    };

    const handleRepeatPenaltyChange = (e) => {
        const newPenalty = parseFloat(e.target.value);
        setRepeatPenalty(newPenalty);
        onConfigChange?.({ baseUrl, model, apiKey, temperature, topK, repeatPenalty: newPenalty });
    };

    const toggleAdvanced = () => {
        setShowAdvanced(!showAdvanced);
    };

    const refreshModels = async () => {
        setStatus('加载中...');
        setStatusType('loading');
        onLog?.(`正在从 ${baseUrl} 获取模型列表...`, 'info');

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

            if (modelList.length > 0) {
                const firstModel = modelList[0].id;
                setModel(firstModel);
                onConfigChange?.({ baseUrl, model: firstModel, apiKey, temperature, topK, repeatPenalty });
            }

            onLog?.(`获取到 ${modelList.length} 个模型`, 'success');
        } catch (error) {
            setStatus('获取失败');
            setStatusType('error');
            onLog?.(`获取模型列表失败: ${error.message}`, 'error');
        }
    };

    return html`
        <${CollapsibleBlock} title="API 配置" draggable=${true}>
            <div class="config-row">
                <label for="api-base-url">API 地址:</label>
                <input 
                    type="text" 
                    id="api-base-url" 
                    value=${baseUrl}
                    onInput=${handleBaseUrlChange}
                    placeholder="http://192.168.31.201:1234/v1"
                />
                <button id="btn-refresh-models" onClick=${refreshModels} title="刷新模型列表">
                    🔄 刷新
                </button>
            </div>
            <div class="config-row">
                <label for="api-model">模型:</label>
                <select id="api-model" value=${model} onChange=${handleModelChange}>
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
                    onInput=${handleApiKeyChange}
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
                            onConfigChange?.({ baseUrl, model, apiKey, temperature: val, topK, repeatPenalty });
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
                            onConfigChange?.({ baseUrl, model, apiKey, temperature, topK: val, repeatPenalty });
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
                            onConfigChange?.({ baseUrl, model, apiKey, temperature, topK, repeatPenalty: val });
                        }}
                    />
                </div>
            `}
        <//>
    `;
}

// ========== 4. 用户输入组件 ==========
function UserInput({ onAnalyze, onCancel, onClearLog, onLog, analyzingProp = false }) {
    const [text, setText] = useState('张三和李四将于明天下午3点在北京会议室讨论新项目的合作事宜。');
    const [analyzing, setAnalyzing] = useState(analyzingProp);

    // 同步外部传入的 analyzing 状态
    useEffect(() => {
        setAnalyzing(analyzingProp);
    }, [analyzingProp]);

    const handleTextChange = (e) => {
        setText(e.target.value);
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
        <${CollapsibleBlock} title="输入文本" draggable=${true}>
            <textarea 
                id="input-text" 
                value=${text}
                onInput=${handleTextChange}
                placeholder="请在此粘贴或输入要分析的文本..."
            />
            <div class="button-row">
                <button 
                    id="btn-analyze" 
                    onClick=${handleAnalyze}
                    disabled=${analyzing}
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
        <//>
    `;
}

// ========== 5. 统计信息组件 ==========
function Statistics({ stats = {} }) {
    return html`
            <${CollapsibleBlock} 
                title="📊 统计信息" 
                className="statistics-block"
                headerClass="stats-header"
                draggable=${true}
            >
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-label">⏱️ 首Token延迟:</span>
                        <span>${stats.ttft || '-'}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">⏱️ 总耗时:</span>
                        <span>${stats.totalTime || '-'}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">📥 输入Tokens:</span>
                        <span>${stats.promptTokens || '-'}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">📤 输出Tokens:</span>
                        <span>${stats.completionTokens || '-'}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">📊 总Tokens:</span>
                        <span>${stats.totalTokens || '-'}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">⚡ 生成速度:</span>
                        <span>${stats.speed || '-'}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">✅ 完成原因:</span>
                        <span>${stats.finishReason || '-'}</span>
                    </div>
                </div>
            <//>
        `;
}

// ========== 6. 模型输出组件 ==========
function ModelOutput({ progress = '', streamOutput = '' }) {
    return html`
        <${CollapsibleBlock} title="原始模型输出" draggable=${true}>
            ${progress && html`<div id="progress-text">${progress}</div>`}
            <div id="stream-output">${streamOutput}</div>
        </>
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
        <${CollapsibleBlock} title="识别结果" draggable=${true}>
            <div id="result-display">
                ${!hasEntities 
                    ? html`<div style="color: #999; text-align: center; padding: 20px;">暂无识别结果</div>`
                    : Object.keys(entities).map(type => renderEntityGroup(type, entities[type]))
                }
            </div>
        <//>
    `;
}

// ========== 8. 日志组件 ==========
function LogPanel({ logs = [] }) {
    const logContainerRef = useRef(null);

    useEffect(() => {
        // 自动滚动到底部
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs]);

    return html`
        <${CollapsibleBlock} title="日志输出" draggable=${true}>
            <div id="log-container" ref=${logContainerRef}>
                <ul id="log-list">
                    ${logs.map((log, index) => html`
                        <li key=${index} class="log-${log.type}">
                            <span class="log-time">[${log.time}]</span>
                            ${log.message}
                        </li>
                    `)}
                </ul>
            </div>
        <//>
    `;
}

// ========== 9. 主应用组件 ==========
function App() {
    const [config, setConfig] = useState({
        baseUrl: 'http://192.168.31.201:1234/v1',
        model: '',
        apiKey: 'lm-studio'
    });
    const [stats, setStats] = useState({});
    const [progress, setProgress] = useState('');
    const [streamOutput, setStreamOutput] = useState('');
    const [entities, setEntities] = useState({});
    const [logs, setLogs] = useState([]);
    const [analyzing, setAnalyzing] = useState(false);
    
    const abortControllerRef = useRef(null);

    useEffect(() => {
        addLog('页面已加载', 'info');
    }, []);

    // 配置变更
    const handleConfigChange = (newConfig) => {
        setConfig(newConfig);
    };

    // 添加日志
    const addLog = (message, type = 'info') => {
        const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        setLogs(prevLogs => [...prevLogs, { time, message, type }]);
    };

    // 清空日志
    const handleClearLog = () => {
        setLogs([]);
        addLog('日志已清空', 'info');
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
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            addLog('已取消分析', 'warn');
        }
        setAnalyzing(false);
    };

    // 执行分析（这里需要整合原来的分析逻辑）
    const performAnalysis = async (text) => {
        // 这里应该整合 ner.js 中的分析逻辑
        // 暂时留空，后续实现
        addLog('分析功能待整合...', 'info');
    };

    return html`
        <div id="container">
            <h2>NER 概念提取测试</h2>
            <div class="main-layout">
                <${LLMConfig} 
                    onConfigChange=${handleConfigChange}
                    onLog=${addLog}
                />
                <${UserInput}
                    onAnalyze=${handleAnalyze}
                    onCancel=${handleCancel}
                    onClearLog=${handleClearLog}
                    onLog=${addLog}
                    analyzingProp=${analyzing}
                />
                <${ResultDisplay} entities=${entities} />
                <${Statistics} stats=${stats} />
                <${ModelOutput} progress=${progress} streamOutput=${streamOutput} />
                <${LogPanel} logs=${logs} />
            </div>
        </div>
    `;
}



