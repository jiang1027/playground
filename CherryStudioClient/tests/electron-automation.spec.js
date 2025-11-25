const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');

/**
 * Electron 应用自动化测试示例
 * 
 * 注意：
 * 1. 需要将 ELECTRON_APP_PATH 替换为你的 Electron 应用主进程文件路径
 * 2. 选择器需要根据实际应用的 DOM 结构调整
 */

// 配置你的 Electron 应用路径（编译好的 .exe 文件）
const ELECTRON_APP_PATH = 'C:\\Program Files\\Cherry Studio\\Cherry Studio.exe'; // 修改为实际路径

test.describe('Electron 应用自动化操作', () => {
  let electronApp;
  let window;

  // 每个测试前启动应用
  test.beforeAll(async () => {
    // 对于编译好的 .exe 文件，使用 executablePath
    electronApp = await electron.launch({
      executablePath: ELECTRON_APP_PATH, // 直接指定可执行文件路径
      // args: ['--no-sandbox'], // 如果需要额外启动参数
      // env: { ...process.env }, // 环境变量
      timeout: 30000, // 启动超时时间（毫秒）
    });

    // 等待并获取第一个窗口
    window = await electronApp.firstWindow();
    
    // 等待页面加载完成
    await window.waitForLoadState('domcontentloaded');
  });

  // 所有测试后关闭应用
  test.afterAll(async () => {
    await electronApp.close();
  });

  test('示例1：基本点击和输入操作', async () => {
    // 点击按钮
    await window.click('button#myButton');

    // 填充输入框
    await window.fill('input#username', '测试用户');
    await window.fill('input#password', '123456');

    // 逐字输入（模拟真实打字）
    await window.type('textarea#message', '这是一条测试消息', { delay: 100 });

    // 按回车键
    await window.press('input#search', 'Enter');

    // 等待元素出现
    await window.waitForSelector('.result-container', { timeout: 5000 });

    // 验证文本内容
    const text = await window.textContent('.result-container');
    expect(text).toContain('期望的文本');
  });

  test('示例2：选择器和多种交互', async () => {
    // 复选框操作
    await window.check('input[type="checkbox"]#agree');
    await window.uncheck('input[type="checkbox"]#newsletter');

    // 单选按钮
    await window.check('input[type="radio"][value="option1"]');

    // 下拉框选择
    await window.selectOption('select#country', 'China');

    // 文件上传（如果需要）
    // await window.setInputFiles('input[type="file"]', 'path/to/file.txt');

    // 悬停操作
    await window.hover('.menu-item');

    // 双击
    await window.dblclick('.editable-field');

    // 右键点击
    await window.click('.context-menu-trigger', { button: 'right' });
  });

  test('示例3：等待和断言', async () => {
    // 等待元素可见
    await window.waitForSelector('.loading', { state: 'visible' });
    await window.waitForSelector('.loading', { state: 'hidden' });

    // 等待导航
    await Promise.all([
      window.waitForNavigation(),
      window.click('a#link')
    ]);

    // 获取元素属性
    const value = await window.getAttribute('input#field', 'value');
    expect(value).toBe('expected value');

    // 获取页面标题
    const title = await window.title();
    expect(title).toBe('Electron App');

    // 检查元素是否可见
    const isVisible = await window.isVisible('.modal');
    expect(isVisible).toBe(true);

    // 检查元素是否启用
    const isEnabled = await window.isEnabled('button#submit');
    expect(isEnabled).toBe(true);
  });

  test('示例4：执行 JavaScript 代码', async () => {
    // 在页面上下文执行 JavaScript
    const result = await window.evaluate(() => {
      return document.querySelector('.data').innerText;
    });
    console.log('获取的数据:', result);

    // 执行带参数的 JavaScript
    const sum = await window.evaluate(({ a, b }) => {
      return a + b;
    }, { a: 5, b: 10 });
    expect(sum).toBe(15);

    // 修改页面内容
    await window.evaluate(() => {
      document.querySelector('.title').innerText = '新标题';
    });
  });

  test('示例5：截图和调试', async () => {
    // 截取整个页面
    await window.screenshot({ path: 'screenshots/full-page.png' });

    // 截取特定元素
    const element = await window.$('.specific-element');
    if (element) {
      await element.screenshot({ path: 'screenshots/element.png' });
    }

    // 获取页面 URL
    const url = window.url();
    console.log('当前 URL:', url);

    // 等待一段时间（调试用）
    await window.waitForTimeout(1000);
  });

  test('示例6：处理对话框', async () => {
    // 监听对话框（alert, confirm, prompt）
    window.on('dialog', async dialog => {
      console.log('对话框消息:', dialog.message());
      await dialog.accept('输入的文本'); // 或 dialog.dismiss()
    });

    // 触发对话框的操作
    await window.click('button#showDialog');
  });

  test('示例7：多窗口操作', async () => {
    // 等待新窗口打开
    const [newWindow] = await Promise.all([
      electronApp.waitForEvent('window'),
      window.click('button#openNewWindow')
    ]);

    // 在新窗口中操作
    await newWindow.waitForLoadState();
    await newWindow.fill('input#data', '新窗口数据');
    
    // 切换回主窗口
    await window.bringToFront();
  });

  test('示例8：键盘快捷键', async () => {
    // Ctrl+A 全选
    await window.press('input#editor', 'Control+A');
    
    // Ctrl+C 复制
    await window.press('input#editor', 'Control+C');
    
    // Ctrl+V 粘贴
    await window.press('input#target', 'Control+V');
    
    // Escape 键
    await window.press('body', 'Escape');
    
    // F5 刷新（如果应用支持）
    await window.press('body', 'F5');
  });

  test('示例9：拖拽操作', async () => {
    // 拖拽元素
    await window.dragAndDrop('.draggable-item', '.drop-zone');
  });

  test('示例10：网络请求监控（可选）', async () => {
    // 监听网络请求
    window.on('request', request => {
      console.log('请求:', request.url());
    });

    window.on('response', response => {
      console.log('响应:', response.url(), response.status());
    });

    // 执行会触发网络请求的操作
    await window.click('button#loadData');
    await window.waitForResponse(response => 
      response.url().includes('/api/data') && response.status() === 200
    );
  });
});
