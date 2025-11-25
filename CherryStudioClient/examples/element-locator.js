const { _electron: electron } = require('@playwright/test');

/**
 * 如何定位 Electron 应用中的 HTML 元素
 * 
 * 运行方式：node examples/element-locator.js
 */

async function main() {
  console.log('🚀 正在启动 Cherry Studio...');

  const ELECTRON_APP_PATH = 'C:\\Program Files\\Cherry Studio\\Cherry Studio.exe';
  
  try {
    // 启动应用
    const electronApp = await electron.launch({
      executablePath: ELECTRON_APP_PATH,
      timeout: 30000,
      
      // 可选配置
      // headless: false, // Electron 默认就是 headed 模式（显示窗口）
      
      // 启动参数 - 可以传递给 Electron 应用
      args: [
        // '--no-sandbox',           // 禁用沙箱（某些情况下需要）
        // '--disable-gpu',          // 禁用 GPU 加速
        // '--window-position=0,0',  // 窗口位置
        // '--window-size=1280,720', // 窗口大小
      ],
      
      // 环境变量
      // env: {
      //   ...process.env,
      //   NODE_ENV: 'test'
      // }
    });

    console.log('✅ Cherry Studio 已启动');

    // 获取主窗口
    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    console.log('📄 页面加载完成\n');

    // ========================================
    // 方法1：打开开发者工具来查看元素
    // ========================================
    console.log('💡 提示：在 Cherry Studio 窗口中按 Ctrl+Shift+I 打开开发者工具');
    console.log('   然后使用"选择元素"工具（Ctrl+Shift+C）来查看元素的选择器\n');

    // ========================================
    // 方法2：使用 Playwright 的 evaluate 获取页面结构
    // ========================================
    console.log('📊 正在分析页面结构...\n');

    // 获取所有按钮
    const buttons = await window.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.slice(0, 10).map(btn => ({
        text: btn.innerText || btn.textContent,
        id: btn.id,
        className: btn.className,
        tagName: btn.tagName
      }));
    });

    console.log('🔘 找到的按钮（前10个）:');
    buttons.forEach((btn, index) => {
      console.log(`  ${index + 1}. 文本: "${btn.text}" | ID: ${btn.id || '无'} | Class: ${btn.className || '无'}`);
    });

    // 获取所有输入框
    const inputs = await window.evaluate(() => {
      const inputElements = Array.from(document.querySelectorAll('input, textarea'));
      return inputElements.slice(0, 10).map(input => ({
        type: input.type,
        placeholder: input.placeholder,
        id: input.id,
        name: input.name,
        className: input.className
      }));
    });

    console.log('\n⌨️  找到的输入框（前10个）:');
    inputs.forEach((input, index) => {
      console.log(`  ${index + 1}. 类型: ${input.type} | Placeholder: "${input.placeholder}" | ID: ${input.id || '无'}`);
    });

    // ========================================
    // 方法3：使用不同的选择器策略
    // ========================================
    console.log('\n🎯 常用的元素定位方法:\n');

    // 1. 通过文本内容查找
    console.log('1️⃣  通过文本内容查找:');
    console.log('   await window.click(\'text=发送\');  // 查找包含"发送"文本的元素');
    console.log('   await window.click(\'button:has-text("提交")\');  // 查找包含"提交"的按钮\n');

    // 2. 通过占位符查找输入框
    console.log('2️⃣  通过占位符查找输入框:');
    console.log('   await window.fill(\'[placeholder="请输入内容"]\', \'测试\');\n');

    // 3. 通过 CSS 选择器
    console.log('3️⃣  通过 CSS 选择器:');
    console.log('   await window.click(\'.send-button\');  // Class');
    console.log('   await window.click(\'#submit-btn\');  // ID');
    console.log('   await window.click(\'button.primary\');  // 标签+Class\n');

    // 4. 通过属性
    console.log('4️⃣  通过属性查找:');
    console.log('   await window.click(\'[data-testid="send"]\');');
    console.log('   await window.click(\'[aria-label="关闭"]\');\n');

    // ========================================
    // 方法4：实际尝试查找元素
    // ========================================
    console.log('🔍 尝试查找常见元素...\n');

    // 尝试查找一些常见的元素
    const commonSelectors = [
      'button',
      'input',
      'textarea',
      '[contenteditable]',
      '.message',
      '.chat',
      '[placeholder]'
    ];

    for (const selector of commonSelectors) {
      try {
        const count = await window.locator(selector).count();
        if (count > 0) {
          console.log(`✅ 找到 ${count} 个 "${selector}" 元素`);
          
          // 获取第一个元素的详细信息
          const firstElement = window.locator(selector).first();
          const isVisible = await firstElement.isVisible().catch(() => false);
          if (isVisible) {
            const text = await firstElement.textContent().catch(() => '');
            if (text && text.trim()) {
              console.log(`   第一个元素文本: "${text.trim().substring(0, 50)}..."`);
            }
          }
        }
      } catch (error) {
        // 忽略查找失败的选择器
      }
    }

    // ========================================
    // 方法5：获取页面的完整 HTML（用于调试）
    // ========================================
    console.log('\n📄 获取页面 HTML 结构（前 1000 个字符）:');
    const htmlContent = await window.evaluate(() => {
      return document.body.innerHTML;
    });
    console.log(htmlContent.substring(0, 1000));
    console.log('...\n');

    // ========================================
    // 方法6：截图保存当前界面
    // ========================================
    await window.screenshot({ path: 'screenshots/cherry-studio-current.png' });
    console.log('📸 已保存当前界面截图到: screenshots/cherry-studio-current.png\n');

    // ========================================
    // 实用的调试技巧
    // ========================================
    console.log('💡 调试技巧:');
    console.log('1. 在 Cherry Studio 中按 Ctrl+Shift+I 打开开发者工具');
    console.log('2. 在 Console 中输入: document.querySelectorAll(\'button\')');
    console.log('3. 使用 Elements 标签查看 DOM 结构');
    console.log('4. 右键元素 -> 检查，查看选择器');
    console.log('5. 使用 Playwright Inspector: npx playwright test --debug\n');

    // 等待用户查看
    console.log('⏳ 保持应用打开 10 秒，请在此期间打开开发者工具查看元素...');
    await window.waitForTimeout(10000);

    // 关闭应用
    await electronApp.close();
    console.log('👋 Cherry Studio 已关闭');

  } catch (error) {
    console.error('❌ 发生错误:', error.message);
    console.error('\n可能的原因:');
    console.error('1. Cherry Studio 路径不正确');
    console.error('2. 应用启动时间过长（超过30秒）');
    console.error('3. 应用需要管理员权限');
    console.error('4. 端口被占用或其他进程冲突\n');
    process.exit(1);
  }
}

// 运行主函数
main();
