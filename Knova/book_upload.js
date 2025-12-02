const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { v5: uuidv5 } = require('uuid');

// 目标服务器配置
const TEST_URL = 'https://n8n.weifu.heiyu.space/webhook-test/knova-upload';
const PRODUCTION_URL = 'https://n8n.weifu.heiyu.space/webhook/knova-upload';

// 图像基础URL - 根据实际服务器地址修改
// 当前工程的server.js是一个默认可用的图床服务
// 请确保server.js正在运行，且端口和IP地址正确
//
const imageBaseURL = 'http://192.168.31.200:3000/pages/';

// images目录路径
const IMAGES_DIR = path.join(__dirname, 'pages');

// 图书名字
const BOOK_NAME = 'Programming the Microsoft Windows Driver Model';

// 图书的namespace
const BOOK_NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341'; 


/**
 * 上传JSON数据到指定URL
 * @param {string} url - 目标URL
 * @param {object} data - 要上传的JSON对象
 * @returns {Promise} 
 */
function uploadJSON(url, data) {
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
                console.log(`状态码: ${res.statusCode}`);
                console.log(`响应头: ${JSON.stringify(res.headers)}`);
                console.log(`响应内容: ${responseData}`);
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: responseData
                });
            });
        });

        req.on('error', (error) => {
            console.error(`请求错误: ${error.message}`);
            reject(error);
        });

        // 发送JSON数据
        req.write(jsonData);
        req.end();
    });
}

// 主函数
async function main() {
    let targetUrl = PRODUCTION_URL;
    let pagesToUpload = Infinity;

    const argv = process.argv.slice(2);
    for (const arg of argv) {
        if (arg.startsWith('test')) {
            targetUrl = TEST_URL;
            pagesToUpload = 1;
            console.log('使用测试URL:', targetUrl);
        }
    }

    // get stable bookId from book name
    //
    const bookId = uuidv5(BOOK_NAME, BOOK_NAMESPACE);
    console.log('bookId:', bookId);

    // list all files in the images directory
    //
    const imageFiles = fs.readdirSync(IMAGES_DIR).filter(file => {
        const filePath = path.join(IMAGES_DIR, file);
        return fs.statSync(filePath).isFile();
    });
    console.log('image file count ', imageFiles.length);


    // upload all images to the n8n workflow
    //
    const filesToUpload = imageFiles.slice(0, pagesToUpload); 
    let index = 1;

    for (const fileName of filesToUpload) {
        const jsonData = {
            title: BOOK_NAME,
            bookId: bookId,      
            pages: [
                {
                    page: index,
                    image: imageBaseURL + fileName,
                }
            ],
        };

        try {
            console.log(`上传第 ${index} 页: ${fileName}`);
            const response = await uploadJSON(targetUrl, jsonData);
            console.log(`上传第 ${index} / ${filesToUpload.length} 页 成功`);
            index++;
        } catch (error) {
            console.error(`上传第 ${index} 页 失败:`, error);
            break;
        }
    }
}

// 执行
main();
