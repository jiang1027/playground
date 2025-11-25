# 大麦自动抢票

## 基础环境

1. [Node.js](https://nodejs.org/) (推荐使用最新的LTS版本)
2. [Android Studio](https://developer.android.com/studio) (包含ADB工具)
3. [Appium](https://appium.io/) (建议使用Appium Desktop)，根据官网安装步骤进行安装和环境变量配置
4. WebDriverIO
5. 安卓手机一台（已安装大麦App，并登录好账号）
6. 安卓手机已开启开发者模式，并连接到电脑

## 使用方法

1. 克隆本仓库到本地
2. 安装依赖：`npm install`
3. 修改 `test.js` 文件中的配置信息，包括设备信息、抢票
4. 运行`start_appium.bat` 启动 Appium 服务器
5. 运行脚本：`node test.js`
6. 脚本会自动打开大麦App，搜索指定演出，选择票务并提交订单

## 注意事项

1. 真正的抢票过程需要有实际场景进行测试
2. 需要用户预填订单信息，如用户名、手机号等
3. 支付环境未测试

