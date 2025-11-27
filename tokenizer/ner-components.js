// ========== Preact 组件化 NER 页面 ==========
// 从 htmPreact 全局对象中获取所需的函数和 hooks
const { html, Component, useState, useEffect, useRef } = htmPreact;

// ========== 1. 通用可折叠区块组件 ==========
function CollapsibleBlock({ title, children, className = '', headerClass = '', defaultCollapsed = false }) {
    const [collapsed, setCollapsed] = useState(defaultCollapsed);

    const toggleCollapse = () => {
        setCollapsed(!collapsed);
    };

    return html`
        <div class="collapsible-block ${className}">
            <div 
                class="collapsible-header ${collapsed ? 'collapsed' : ''} ${headerClass}"
                onClick=${toggleCollapse}
            >
                ${title}
            </div>
            <div class="collapsible-content ${collapsed ? 'collapsed' : ''}">
                ${children}
            </div>
        </div>
    `;
}

// ========== 2. LLM配置组件 ==========
function LLMConfig({ onConfigChange, onLog }) {
    const [baseUrl, setBaseUrl] = useState('http://192.168.31.201:1234/v1');
    const [model, setModel] = useState('');
    const [apiKey, setApiKey] = useState('lm-studio');
    const [models, setModels] = useState([]);
    const [status, setStatus] = useState('');
    const [statusType, setStatusType] = useState('');

    const handleBaseUrlChange = (e) => {
        const newBaseUrl = e.target.value.trim();
        setBaseUrl(newBaseUrl);
        onConfigChange?.({ baseUrl: newBaseUrl, model, apiKey });
    };

    const handleModelChange = (e) => {
        const newModel = e.target.value;
        setModel(newModel);
        onConfigChange?.({ baseUrl, model: newModel, apiKey });
        onLog?.(`已选择模型: ${newModel || '(未选择)'}`, 'info');
    };

    const handleApiKeyChange = (e) => {
        const newApiKey = e.target.value.trim() || 'lm-studio';
        setApiKey(newApiKey);
        onConfigChange?.({ baseUrl, model, apiKey: newApiKey });
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
                onConfigChange?.({ baseUrl, model: firstModel, apiKey });
            }

            onLog?.(`获取到 ${modelList.length} 个模型`, 'success');
        } catch (error) {
            setStatus('获取失败');
            setStatusType('error');
            onLog?.(`获取模型列表失败: ${error.message}`, 'error');
        }
    };

    return html`
        <${CollapsibleBlock} title="API 配置">
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
        <//>
    `;
}

// ========== 3. 用户输入组件 ==========
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
        <${CollapsibleBlock} title="输入文本">
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

// ========== 4. 统计信息组件 ==========
function Statistics({ stats = {} }) {
    return html`
            <${CollapsibleBlock} 
                title="📊 统计信息" 
                className="statistics-block"
                headerClass="stats-header"
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

// ========== 5. 模型输出组件 ==========
function ModelOutput({ progress = '', streamOutput = '' }) {
    return html`
        <${CollapsibleBlock} title="原始模型输出">
            ${progress && html`<div id="progress-text">${progress}</div>`}
            <div id="stream-output">${streamOutput}</div>
        </>
    `;
}

// ========== 6. 显示结果组件 ==========
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
        <${CollapsibleBlock} title="识别结果">
            <div id="result-display">
                ${!hasEntities 
                    ? html`<div style="color: #999; text-align: center; padding: 20px;">暂无识别结果</div>`
                    : Object.keys(entities).map(type => renderEntityGroup(type, entities[type]))
                }
            </div>
        <//>
    `;
}

// ========== 7. 日志组件 ==========
function LogPanel({ logs = [] }) {
    const logContainerRef = useRef(null);

    useEffect(() => {
        // 自动滚动到底部
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs]);

    return html`
        <${CollapsibleBlock} title="日志输出">
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

// ========== 8. 主应用组件 ==========
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
                <div class="left-column">
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
                </div>
                <div class="right-column">
                    <${Statistics} stats=${stats} />
                    <${ModelOutput} progress=${progress} streamOutput=${streamOutput} />
                    <${LogPanel} logs=${logs} />
                </div>
            </div>
        </div>
    `;
}

// ========== 组件已定义完成，可直接使用 ==========
// 所有组件（App, CollapsibleBlock, LLMConfig, UserInput, Statistics, ModelOutput, ResultDisplay, LogPanel）
// 现在都可以在全局作用域中使用


