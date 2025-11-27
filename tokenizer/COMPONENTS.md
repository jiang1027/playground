# NER 页面 Preact + HTM 组件化重构

## 概述

使用 Preact + HTM 将 NER 页面重构为现代化的组件架构，所有功能都被拆分为独立、可复用的组件。

## 核心组件

### 1. **CollapsibleBlock** - 通用可折叠区块组件
可复用的折叠面板组件，所有其他组件都使用它作为容器。

**Props:**
- `title`: 标题文本
- `children`: 子内容
- `className`: 自定义CSS类
- `headerClass`: 标题栏自定义CSS类
- `defaultCollapsed`: 默认是否折叠

**特性:**
- 点击标题切换展开/折叠
- 动画过渡效果
- 箭头指示当前状态

---

### 2. **LLMConfig** - LLM配置组件
管理 API 配置，包括服务器地址、模型选择和 API Key。

**Props:**
- `onConfigChange`: 配置变更回调 `(config) => {}`
- `onLog`: 日志输出回调 `(message, type) => {}`

**State:**
- `baseUrl`: API 服务器地址
- `model`: 选中的模型
- `apiKey`: API 密钥
- `models`: 可用模型列表
- `status`: 状态文本
- `statusType`: 状态类型 (loading/success/error)

**功能:**
- 从服务器获取模型列表
- 实时更新配置
- 状态指示器显示当前状态

---

### 3. **UserInput** - 用户输入组件
提供文本输入和操作按钮。

**Props:**
- `onAnalyze`: 开始分析回调 `(text) => {}`
- `onCancel`: 取消分析回调
- `onClearLog`: 清空日志回调
- `onLog`: 日志输出回调

**State:**
- `text`: 输入的文本内容
- `analyzing`: 是否正在分析

**功能:**
- 文本输入框
- 开始分析/取消分析/清空日志按钮
- 按钮禁用状态管理

**Public Methods:**
- `setAnalyzing(analyzing)`: 外部控制分析状态

---

### 4. **Statistics** - 统计信息组件
显示性能统计数据。

**Props:**
- `stats`: 统计数据对象
  ```javascript
  {
    ttft: "首Token延迟",
    totalTime: "总耗时",
    promptTokens: "输入Tokens",
    completionTokens: "输出Tokens",
    totalTokens: "总Tokens",
    speed: "生成速度",
    finishReason: "完成原因"
  }
  ```

**特性:**
- 响应式网格布局
- 蓝色主题配色
- 自动适配不同屏幕

---

### 5. **ModelOutput** - 模型输出组件
显示模型的原始输出和进度信息。

**Props:**
- `progress`: 进度文本
- `streamOutput`: 流式输出内容

**特性:**
- 进度条显示
- 滚动查看长输出
- 等宽字体显示

---

### 6. **ResultDisplay** - 显示结果组件
以结构化方式展示识别出的实体。

**Props:**
- `entities`: 实体对象
  ```javascript
  {
    'PERSON': ['张三', '李四'],
    'TIME': ['明天下午3点'],
    'LOCATION': ['北京会议室']
  }
  ```

**特性:**
- 按类型分组显示
- 彩色标签区分实体类型
- 空状态提示

**支持的实体类型:**
- PERSON (人物) - 红色
- TIME (时间) - 绿色
- LOCATION (地点) - 蓝色
- ORGANIZATION (组织) - 橙色
- THING (事物) - 紫色
- RELATIONSHIP (关系) - 青色
- EVENT (事件) - 黄色

---

### 7. **LogPanel** - 日志组件
显示系统日志和调试信息。

**Props:**
- `logs`: 日志数组
  ```javascript
  [
    { time: "14:30:25", message: "分析完成", type: "success" },
    { time: "14:30:20", message: "开始分析", type: "info" }
  ]
  ```

**特性:**
- 自动滚动到最新日志
- 不同类型日志的颜色区分
- 时间戳显示

**日志类型:**
- `info` - 蓝色
- `success` - 绿色
- `error` - 红色
- `warn` - 橙色

---

### 8. **App** - 主应用组件
整合所有子组件，管理全局状态和业务逻辑。

**State:**
- `config`: LLM 配置
- `stats`: 统计信息
- `progress`: 进度信息
- `streamOutput`: 流式输出
- `entities`: 识别结果
- `logs`: 日志列表

**功能:**
- 统一的状态管理
- 组件间通信协调
- 业务逻辑处理

---

## 使用方式

### HTML 引入
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NER 概念提取测试</title>
    <link rel="stylesheet" href="ner.css">
</head>
<body>
    <div id="app"></div>
    
    <script type="module">
        import { html, render } from 'https://cdn.jsdelivr.net/npm/htm@3.1.1/preact/standalone.module.js';
        import { App } from './ner-components.js';
        
        render(html`<${App} />`, document.getElementById('app'));
    </script>
</body>
</html>
```

### 组件复用示例

#### 单独使用 CollapsibleBlock
```javascript
import { html } from 'htm/preact';
import { CollapsibleBlock } from './ner-components.js';

html`
  <${CollapsibleBlock} title="我的自定义区块">
    <p>这里是内容</p>
  <//>
`
```

#### 单独使用 Statistics
```javascript
const stats = {
    ttft: "120ms",
    totalTime: "2.5s",
    promptTokens: "150",
    completionTokens: "200",
    totalTokens: "350",
    speed: "80 tokens/s",
    finishReason: "stop"
};

html`<${Statistics} stats=${stats} />`
```

---

## 优势

### 1. **模块化**
- 每个功能独立成组件
- 易于维护和测试
- 代码复用性高

### 2. **声明式**
- 使用 JSX-like 语法（HTM）
- UI 与状态自动同步
- 更易理解和调试

### 3. **无构建步骤**
- 直接在浏览器中运行
- 无需 webpack/babel
- 开发更快捷

### 4. **轻量级**
- Preact 仅 3KB
- HTM 仅 700B
- 总体积小于 jQuery

### 5. **扩展性**
- 添加新组件无需修改现有代码
- 统一的接口设计
- 易于集成新功能

---

## 后续扩展

### 添加新组件示例

创建一个新的"导出结果"组件：

```javascript
class ExportResults extends Component {
    handleExport = () => {
        const { entities } = this.props;
        const json = JSON.stringify(entities, null, 2);
        // 导出逻辑
    }

    render({ entities }) {
        return html`
            <${CollapsibleBlock} title="导出结果">
                <button onClick=${this.handleExport}>
                    导出为 JSON
                </button>
            <//>
        `;
    }
}
```

然后在 App 组件中使用：

```javascript
// 在 App 的 render 方法中
<${ExportResults} entities=${entities} />
```

---

## 文件结构

```
tokenizer/
├── ner.html              # 主HTML文件（极简）
├── ner.css               # 样式文件
├── ner-components.js     # 所有Preact组件
└── ner.js                # 原业务逻辑（待整合）
```

---

## 迁移状态

✅ **已完成:**
- 所有UI组件已迁移到 Preact
- 响应式布局保持不变
- 折叠功能完全工作
- 组件化架构完成

⏳ **待完成:**
- 将 `ner.js` 中的分析逻辑整合到 App 组件
- 实现完整的流式输出处理
- 添加错误处理和边界情况

---

## 性能优化

### 已实现:
- 日志自动滚动使用 `componentDidUpdate`
- 避免不必要的重渲染
- 状态更新批处理

### 可优化:
- 大量实体时使用虚拟滚动
- 日志数量限制防止内存泄漏
- 使用 `memo` 优化纯组件

---

## 调试

### 访问组件实例
在浏览器控制台中：
```javascript
// Preact 会将根组件挂载到 window
const app = document.getElementById('app').__preactComponent__;
console.log(app.state);
```

### 状态检查
```javascript
// 查看当前配置
app.state.config

// 查看日志
app.state.logs

// 查看识别结果
app.state.entities
```
