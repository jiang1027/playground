const express = require('express');
const path = require('path');
const os = require('os');

const app = express();
const PORT = 3000;

// 图片目录配置 - 可以修改为你需要的目录
const IMAGES_DIR = path.join(__dirname, 'images');

// 静态文件服务 - 提供图片访问
app.use('/images', express.static(IMAGES_DIR));

// 获取本机IP地址
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // 跳过内部地址和非IPv4地址
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

// 首页 - 显示使用说明
app.get('/', (req, res) => {
    const localIP = getLocalIP();
    res.send(`
        <h1>图床服务</h1>
        <p>图片访问地址格式：</p>
        <code>http://${localIP}:${PORT}/images/&lt;图片文件名&gt;</code>
        <br><br>
        <p>例如：</p>
        <code>http://${localIP}:${PORT}/images/example.jpg</code>
    `);
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log(`图床服务已启动！`);
    console.log(`本地访问: http://localhost:${PORT}`);
    console.log(`网络访问: http://${localIP}:${PORT}`);
    console.log(`图片目录: ${IMAGES_DIR}`);
});
