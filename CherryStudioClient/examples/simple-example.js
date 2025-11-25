const { _electron: electron } = require('@playwright/test');

/**
 * 简单的 Electron 应用启动示例
 * 可以直接运行此脚本来测试 Electron 应用的启动和基本操作
 * 
 * 运行方式：node examples/simple-example.js
 */

async function main() {
  console.log('🚀 正在启动 Electron 应用...');

  // 配置你的 Electron 应用路径
  const ELECTRON_APP_PATH = 'path/to/your/electron/main.js'; // 修改为实际路径
  
  try {
    // 启动 Electron 应用
    const electronApp = await electron.launch({
      args: [ELECTRON_APP_PATH],
      // timeout: 30000, // 启动超时时间
    });

    console.log('✅ Electron 应用已启动');

    // 获取第一个窗口
    const window = await electronApp.firstWindow();
    console.log('📱 获取到主窗口');

    // 等待页面加载
    await window.waitForLoadState('domcontentloaded');
    console.log('📄 页面加载完成');

    // 获取窗口标题
    const title = await window.title();
    console.log(`📋 窗口标题: ${title}`);

    // 获取当前 URL
    const url = window.url();
    console.log(`🔗 当前 URL: ${url}`);

    // 示例操作：点击某个按钮（根据实际情况修改选择器）
    // await window.click('button#myButton');
    // console.log('🖱️  点击了按钮');

    // 示例操作：填充输入框（根据实际情况修改选择器）
    // await window.fill('input#username', '测试用户');
    // console.log('⌨️  填充了输入框');

    // 截图
    await window.screenshot({ path: 'screenshots/example.png' });
    console.log('📸 已保存截图到 screenshots/example.png');

    // 等待 5 秒观察
    console.log('⏳ 等待 5 秒...');
    await window.waitForTimeout(5000);

    // 关闭应用
    await electronApp.close();
    console.log('👋 Electron 应用已关闭');

  } catch (error) {
    console.error('❌ 发生错误:', error.message);
    process.exit(1);
  }
}

// 运行主函数
main();
