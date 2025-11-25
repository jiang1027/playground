const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright 配置文件
 * 文档: https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  // 测试文件目录
  testDir: './tests',
  
  // 每个测试的最大执行时间
  timeout: 30 * 1000,
  
  // 每个断言的超时时间
  expect: {
    timeout: 5000
  },
  
  // 失败后重试次数
  retries: 0,
  
  // 并行执行的测试数量
  workers: 1, // Electron 应用建议设置为 1，避免多实例冲突
  
  // 报告配置
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }]
  ],
  
  // 全局配置
  use: {
    // 操作前等待时间
    actionTimeout: 10000,
    
    // 截图配置
    screenshot: 'only-on-failure',
    
    // 录制视频
    video: 'retain-on-failure',
    
    // 追踪配置（用于调试）
    trace: 'on-first-retry',
  },

  // 测试结果输出目录
  outputDir: 'test-results/',

  // 项目配置
  projects: [
    {
      name: 'electron',
      testMatch: '**/*.spec.js',
    },
  ],
});
