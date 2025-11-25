# Cherry Studio Playwright 自动化 - 元素定位指南

## 🎯 如何定位 HTML 元素

### 方法1：使用开发者工具（最推荐）

1. **启动 Cherry Studio**
2. **按 `Ctrl+Shift+I`** 打开开发者工具
3. **点击"选择元素"按钮** 或按 `Ctrl+Shift+C`
4. **鼠标悬停在想要操作的元素上**
5. 在 Elements 标签中可以看到：
   - 元素的 `id` 属性
   - 元素的 `class` 属性
   - 元素的文本内容
   - 其他属性（data-*, aria-* 等）

### 方法2：运行元素定位脚本

```bash
node examples/element-locator.js
```

这个脚本会：
- 启动 Cherry Studio
- 自动分析页面结构
- 列出所有按钮和输入框
- 保存界面截图
- 提供调试建议

## 📋 常用选择器示例

### 1. 通过 ID 定位
```javascript
await window.click('#send-button');
await window.fill('#message-input', '你好');
```

### 2. 通过 Class 定位
```javascript
await window.click('.submit-btn');
await window.click('.chat-message');
```

### 3. 通过文本内容定位（最实用）
```javascript
// 精确匹配
await window.click('text=发送');
await window.click('text=新建对话');

// 模糊匹配
await window.click('text=/发送|Send/i');
await window.click('button:has-text("提交")');
```

### 4. 通过占位符定位输入框
```javascript
await window.fill('[placeholder="请输入消息"]', '测试消息');
await window.fill('[placeholder*="输入"]', '内容');  // 部分匹配
```

### 5. 通过属性定位
```javascript
await window.click('[data-testid="send-btn"]');
await window.click('[aria-label="关闭"]');
await window.click('[title="设置"]');
```

### 6. 组合选择器
```javascript
// 标签 + Class
await window.click('button.primary');

// 标签 + 文本
await window.click('button:has-text("确定")');

// 父子关系
await window.click('.dialog button.confirm');

// 第N个元素
await window.click('button >> nth=0');  // 第一个按钮
```

### 7. 通过角色定位（Accessibility）
```javascript
await window.click('role=button[name="发送"]');
await window.fill('role=textbox[name="消息"]', '内容');
```

## 🔍 实用调试技巧

### 在浏览器控制台中测试选择器

打开 Cherry Studio 的开发者工具（Ctrl+Shift+I），在 Console 中输入：

```javascript
// 测试选择器是否有效
document.querySelector('#my-button');
document.querySelectorAll('.message');

// 查看所有按钮
document.querySelectorAll('button');

// 查看所有输入框
document.querySelectorAll('input, textarea');

// 查找包含特定文本的元素
Array.from(document.querySelectorAll('*')).filter(el => 
  el.textContent.includes('发送')
);
```

### 使用 Playwright Inspector

```bash
npx playwright test --debug
```

Playwright Inspector 会：
- 逐步执行测试
- 高亮显示定位的元素
- 允许你实时修改选择器
- 显示元素的截图

### 使用 Locator 的调试方法

```javascript
// 打印匹配的元素数量
const count = await window.locator('button').count();
console.log(`找到 ${count} 个按钮`);

// 检查元素是否可见
const isVisible = await window.locator('#my-button').isVisible();
console.log(`按钮可见: ${isVisible}`);

// 获取元素文本
const text = await window.locator('.title').textContent();
console.log(`标题: ${text}`);
```

## ⚡ 实际操作示例

### 示例1：在聊天应用中发送消息

```javascript
const { test, _electron: electron } = require('@playwright/test');

test('发送消息', async () => {
  const electronApp = await electron.launch({
    executablePath: 'C:\\Program Files\\Cherry Studio\\Cherry Studio.exe'
  });
  
  const window = await electronApp.firstWindow();
  await window.waitForLoadState('domcontentloaded');

  // 方式1: 通过占位符定位输入框
  await window.fill('[placeholder*="输入"]', '你好，这是测试消息');
  
  // 方式2: 通过文本定位发送按钮
  await window.click('text=发送');
  
  // 或者按回车发送
  // await window.press('[placeholder*="输入"]', 'Enter');
  
  await window.waitForTimeout(2000);
  await electronApp.close();
});
```

### 示例2：点击菜单项

```javascript
test('打开设置', async () => {
  const electronApp = await electron.launch({
    executablePath: 'C:\\Program Files\\Cherry Studio\\Cherry Studio.exe'
  });
  
  const window = await electronApp.firstWindow();
  
  // 点击设置按钮（可能是齿轮图标）
  await window.click('[aria-label="设置"]');
  // 或
  await window.click('button:has-text("设置")');
  // 或
  await window.click('[title="设置"]');
  
  await electronApp.close();
});
```

### 示例3：等待特定元素出现

```javascript
test('等待消息加载', async () => {
  const electronApp = await electron.launch({
    executablePath: 'C:\\Program Files\\Cherry Studio\\Cherry Studio.exe'
  });
  
  const window = await electronApp.firstWindow();
  
  // 发送消息
  await window.fill('[placeholder*="输入"]', '测试');
  await window.click('text=发送');
  
  // 等待回复出现（假设回复有特定的 class）
  await window.waitForSelector('.assistant-message', { timeout: 10000 });
  
  // 获取回复内容
  const reply = await window.textContent('.assistant-message >> last');
  console.log('收到回复:', reply);
  
  await electronApp.close();
});
```

## 📌 常见问题

### Q1: 元素找不到？
**A:** 
1. 检查元素是否已加载：`await window.waitForSelector('selector', { timeout: 5000 })`
2. 使用开发者工具确认选择器正确
3. 元素可能在 iframe 中，需要先切换 frame

### Q2: 元素不可点击？
**A:**
1. 等待元素可见：`await window.waitForSelector('selector', { state: 'visible' })`
2. 滚动到元素：`await window.locator('selector').scrollIntoViewIfNeeded()`
3. 检查是否有遮挡层

### Q3: 如何处理动态内容？
**A:**
```javascript
// 使用等待策略
await window.waitForSelector('.dynamic-content');
await window.waitForLoadState('networkidle');

// 或使用轮询
await window.waitForFunction(() => {
  return document.querySelector('.data').innerText.length > 0;
});
```

### Q4: 如何操作 Shadow DOM？
**A:**
```javascript
// 使用 >>> 穿透 Shadow DOM
await window.click('custom-element >>> button');
```

## 🎓 最佳实践

1. **优先使用稳定的选择器**：data-testid > aria-label > text > class > 位置
2. **避免使用容易变化的选择器**：复杂的 CSS 路径、nth-child
3. **添加等待时间**：确保元素已加载
4. **使用有意义的测试名称**：便于调试
5. **截图保存关键步骤**：便于排查问题

## 📚 更多资源

- [Playwright 选择器文档](https://playwright.dev/docs/selectors)
- [Playwright 最佳实践](https://playwright.dev/docs/best-practices)
- [CSS 选择器参考](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors)
