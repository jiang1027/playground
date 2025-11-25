# Electron 应用 Playwright 自动化操作环境

使用 Playwright 自动化操作 Electron 应用程序，支持模拟用户点击、输入文本等各种交互操作。

## 📦 安装依赖

### 1. 安装 Node.js 依赖包

```bash
npm install
```

### 2. 安装 Playwright 浏览器（可选）

```bash
npm run install:browsers
```

> 注意：操作 Electron 应用不需要额外的浏览器，这一步可以跳过。

## 🚀 快速开始

### 1. 配置 Electron 应用路径

编辑 `tests/electron-automation.spec.js` 文件，修改以下配置：

```javascript
// 将路径改为你的 Electron 应用主进程文件
const ELECTRON_APP_PATH = 'path/to/your/electron/main.js';

// 或者指定可执行文件路径
electronApp = await electron.launch({
  args: [ELECTRON_APP_PATH],
  executablePath: 'path/to/your/app.exe', // Windows 上的 .exe 文件
});
```

### 2. 调整选择器

根据你的 Electron 应用的实际 DOM 结构，修改测试脚本中的选择器：

```javascript
// 使用开发者工具查看元素选择器
await window.click('button#myButton');  // ID 选择器
await window.fill('.username-input', 'user');  // Class 选择器
await window.click('button[data-test="submit"]');  // 属性选择器
```

💡 **提示**：在 Electron 应用中按 `Ctrl+Shift+I` 打开开发者工具查看元素。

## 🧪 运行测试

### 运行所有测试

```bash
npm test
```

### 使用 UI 模式运行（推荐）

```bash
npm run test:ui
```

UI 模式提供可视化界面，可以：
- 逐步执行测试
- 查看每一步的截图
- 实时调试

### 调试模式运行

```bash
npm run test:debug
```

调试模式会暂停执行，允许你逐步检查每个操作。

### 运行特定测试文件

```bash
npx playwright test tests/electron-automation.spec.js
```

### 运行特定测试用例

```bash
npx playwright test -g "示例1：基本点击和输入操作"
```

## 📚 常用 API

### 点击操作

```javascript
await window.click('button#submit');           // 左键单击
await window.dblclick('.item');                 // 双击
await window.click('.menu', { button: 'right' }); // 右键点击
```

### 输入操作

```javascript
await window.fill('input#name', '张三');        // 快速填充
await window.type('textarea', '文本', { delay: 100 }); // 模拟打字
await window.press('input#search', 'Enter');   // 按键
```

### 选择操作

```javascript
await window.check('input[type="checkbox"]');  // 勾选
await window.uncheck('input[type="checkbox"]'); // 取消勾选
await window.selectOption('select#city', 'Beijing'); // 下拉选择
```

### 等待操作

```javascript
await window.waitForSelector('.result');        // 等待元素出现
await window.waitForTimeout(1000);              // 等待指定时间
await window.waitForLoadState('domcontentloaded'); // 等待页面加载
```

### 获取信息

```javascript
const text = await window.textContent('.title'); // 获取文本
const value = await window.getAttribute('input', 'value'); // 获取属性
const isVisible = await window.isVisible('.modal'); // 检查可见性
const title = await window.title();              // 获取标题
```

### 执行 JavaScript

```javascript
const result = await window.evaluate(() => {
  return document.querySelector('.data').innerText;
});
```

### 截图

```javascript
await window.screenshot({ path: 'screenshot.png' }); // 整页截图
const element = await window.$('.element');
await element.screenshot({ path: 'element.png' });   // 元素截图
```

## 🔍 查找元素的方法

| 选择器类型 | 示例 | 说明 |
|---------|------|------|
| ID | `#myButton` | 通过 ID 查找 |
| Class | `.btn-primary` | 通过类名查找 |
| 标签 | `button` | 通过标签名查找 |
| 属性 | `[data-test="submit"]` | 通过属性查找 |
| 文本 | `text=提交` | 通过文本内容查找 |
| CSS | `div > button.active` | CSS 选择器 |
| XPath | `//button[@id='submit']` | XPath 表达式 |

## 📁 项目结构

```
CherryStudioClient/
├── tests/                          # 测试脚本目录
│   └── electron-automation.spec.js # Electron 自动化测试示例
├── playwright.config.js            # Playwright 配置文件
├── package.json                    # 项目配置文件
├── playwright-report/              # HTML 测试报告（运行后生成）
├── test-results/                   # 测试结果和截图（运行后生成）
└── screenshots/                    # 自定义截图保存目录
```

## ⚙️ 高级配置

### 处理多窗口

```javascript
// 等待新窗口打开
const [newWindow] = await Promise.all([
  electronApp.waitForEvent('window'),
  window.click('button#openNewWindow')
]);

// 在新窗口中操作
await newWindow.fill('input', '数据');
```

### 处理对话框

```javascript
window.on('dialog', async dialog => {
  console.log(dialog.message());
  await dialog.accept(); // 或 dialog.dismiss()
});
```

### 监控网络请求

```javascript
window.on('request', request => console.log(request.url()));
window.on('response', response => console.log(response.status()));
```

### 键盘快捷键

```javascript
await window.press('body', 'Control+A');  // Ctrl+A
await window.press('body', 'Control+C');  // Ctrl+C
await window.press('body', 'F5');         // F5
```

## 🐛 调试技巧

1. **打开开发者工具**：在应用中按 `Ctrl+Shift+I`
2. **使用 UI 模式**：`npm run test:ui` 可视化调试
3. **添加等待时间**：`await window.waitForTimeout(2000)` 观察操作
4. **截图**：在关键步骤添加截图，便于排查问题
5. **查看 trace**：失败时自动生成追踪文件，可以回放操作

## 📝 注意事项

1. **路径配置**：确保 `ELECTRON_APP_PATH` 指向正确的 Electron 主进程文件
2. **选择器准确性**：使用开发者工具检查元素选择器
3. **等待元素**：确保在操作前元素已加载完成
4. **单实例运行**：Electron 应用建议设置 `workers: 1` 避免冲突
5. **异步操作**：所有操作都需要使用 `await` 关键字

## 🔗 相关资源

- [Playwright 官方文档](https://playwright.dev/)
- [Playwright Electron API](https://playwright.dev/docs/api/class-electron)
- [Electron 文档](https://www.electronjs.org/)

## 📄 许可证

ISC
