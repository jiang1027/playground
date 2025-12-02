const http = require('http');
const https = require('https');
const readline = require('readline');

// 默认URL地址 - 可以修改为实际的服务器地址
const TEST_URL = 'https://n8n.weifu.heiyu.space/webhook-test/knova_chat';
const PRODUCTION_URL = 'https://n8n.weifu.heiyu.space/webhook/knova_chat';

/**
 * 发送JSON数据到指定URL
 * @param {string} url - 目标URL
 * @param {object} data - 要发送的JSON对象
 * @returns {Promise}
 */
function postJSON(url, data) {
    return new Promise((resolve, reject) => {
        const jsonData = JSON.stringify(data);
        const parsedUrl = new URL(url);

        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(jsonData)
            }
        };

        const httpModule = parsedUrl.protocol === 'https:' ? https : http;

        const req = httpModule.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: responseData
                });
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(jsonData);
        req.end();
    });
}

/**
 * 格式化并输出JSON响应
 * @param {string} jsonString - JSON字符串
 */
function formatAndPrintJSON(jsonString) {
    try {
        const jsonObj = JSON.parse(jsonString);
        for (const choice of jsonObj.choices || []) {
            console.log(`<think>\n${choice.message.reasoning}\n</think>\n`);
            console.log(choice.message.content);
        }
        console.log('------------------\n');
    } catch (error) {
        console.log('\n--- 服务器响应（非JSON格式） ---');
        console.log(jsonString);
        console.log('------------------\n');
    }
}

/**
 * 封装readline.question为Promise
 * @param {readline.Interface} rl - readline接口
 * @param {string} prompt - 提示文字
 * @returns {Promise<string>}
 */
function question(rl, prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
            resolve(answer);
        });
    });
}

/**
 * 主函数
 */
async function main() {
    let charUrl = PRODUCTION_URL;
    
    if (process.argv.includes('test')) {
        charUrl = TEST_URL;
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log('========================================');
    console.log('       Book Chat - HTTP 交互客户端');
    console.log('========================================');
    console.log(`目标URL: ${charUrl}`);
    console.log('输入文字后按回车发送，输入 "exit" 或 "quit" 退出程序');
    console.log('----------------------------------------\n');

    // 标准的 read/process/output 循环
    while (true) {
        // Read - 读取用户输入
        const input = await question(rl, '请输入内容: ');
        const trimmedInput = input.trim();

        // 检查是否退出
        if (trimmedInput.toLowerCase() === 'exit' || trimmedInput.toLowerCase() === 'quit') {
            console.log('再见！');
            break;
        }

        // 检查空输入
        if (!trimmedInput) {
            continue;
        }

        // Process - 处理并发送请求
        const requestData = {
            message: trimmedInput,
            timestamp: new Date().toISOString()
        };

        console.log('\n发送数据:', JSON.stringify(requestData));

        try {
            const response = await postJSON(charUrl, requestData);
            
            // Output - 输出响应结果
            console.log(`状态码: ${response.statusCode}`);
            formatAndPrintJSON(response.body);
        } catch (error) {
            console.error(`\n请求错误: ${error.message}\n`);
        }
    }

    rl.close();
}

// 执行
main();
