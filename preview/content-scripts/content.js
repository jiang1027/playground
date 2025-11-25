console.log('content.js loaded');

function log(messages) {
    console.log(messages);
}

const CurrentUrl = window.location.href;
log('CurrentUrl: ' + CurrentUrl);

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    log(`receive message: ${JSON.stringify(request)}`);
    
    // 处理来自 background 的预览请求
    if (request.action === 'preview-link') {
        previewUrl(request.url);
        sendResponse({ success: true });
    }
});

async function fetchPage(url) {
    const response = await fetch(url, {
        method: 'HEAD'  // 先用 HEAD 请求检查内容类型
    });
    
    if (!response.ok) {
        log('Network response was not ok: ' + response.statusText);
        throw new Error('Network response was not ok: ' + response.statusText);
    }

    // 检查 Content-Type
    const contentType = response.headers.get('Content-Type') || '';
    log('Content-Type: ' + contentType);
    
    // 只处理 HTML 内容
    if (!contentType.includes('text/html')) {
        log('Not HTML content, opening in new tab instead');
        throw new Error('NOT_HTML');
    }

    // 如果是 HTML，再发起 GET 请求获取内容
    const fullResponse = await fetch(url);
    if (!fullResponse.ok) {
        throw new Error('Network response was not ok: ' + fullResponse.statusText);
    }
    
    const text = await fullResponse.text();
    log('Fetched HTML content length: ' + text.length);
    log(text.slice(0, 1000)); 
    return text;
}

// 显示悬浮窗口的函数
function showFloatingWindow() {
    const floatingWindow = document.getElementById('my-floating-window');
    if (floatingWindow) {
        floatingWindow.classList.add('show');
    }
}

// 隐藏悬浮窗口的函数
function hideFloatingWindow() {
    const floatingWindow = document.getElementById('my-floating-window');
    if (floatingWindow) {
        floatingWindow.classList.remove('show');
        
        // 可选：清空 iframe 内容以释放资源
        setTimeout(() => {
            const iframe = document.getElementById('my-iframe');
            if (iframe && !floatingWindow.classList.contains('show')) {
                iframe.srcdoc = '';
            }
        }, 300); // 等待动画完成后清空
    }
}

// 从外部HTML文件加载预览框架
async function createPreviewFrame() {
    try {
        // 加载HTML模板
        const templateUrl = chrome.runtime.getURL('content-scripts/preview-frame.html');
        const response = await fetch(templateUrl);
        const html = await response.text();
        
        // 创建临时容器来解析HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // 获取预览框架元素
        const floatingWindow = tempDiv.querySelector('#my-floating-window');
        
        if (floatingWindow) {
            // 将预览框架添加到页面
            document.body.appendChild(floatingWindow);
            
            // 绑定关闭按钮事件
            const closeButton = floatingWindow.querySelector('#close-floating-window');
            if (closeButton) {
                closeButton.addEventListener('click', hideFloatingWindow);
            }
            
            log('Preview frame created successfully');
        }
    } catch (error) {
        log('Error creating preview frame: ' + error);
    }
}

function hasModifierKey(ev) {
    return ev.ctrlKey || ev.shiftKey || ev.altKey || ev.metaKey;
}

// 预览指定 URL 的函数
function previewUrl(url) {
    log('Previewing URL: ' + url);
    
    // 更新工具栏标题
    const floatingWindow = document.getElementById('my-floating-window');
    if (!floatingWindow) return;
    
    const title = floatingWindow.querySelector('.title');
    if (title) {
        title.textContent = '加载中...';
    }

    // 清空 iframe 内容
    const iframe = document.getElementById('my-iframe');
    if (iframe) {
        iframe.srcdoc = '';
    }

    fetchPage(url).then(content => {
        const iframe = document.getElementById('my-iframe');
        if (iframe) {
            // 显示悬浮窗口（滑入动画）
            showFloatingWindow();


            // 获取基础 URL
            const baseUrl = new URL(url).origin + new URL(url).pathname.substring(0, new URL(url).pathname.lastIndexOf('/') + 1);
            
            // 添加 base 标签和 CSP
            let modifiedHtml = content;
            
            // CSP 策略选择：
            // 选项 1（当前）：允许脚本执行 - 完整功能预览，但安全性较低
            const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src *; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline'; img-src * data:; font-src *; connect-src *;">`;
            
            // 选项 2（安全）：禁用脚本 - 只显示静态内容，更安全
            // const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src * data:; style-src * 'unsafe-inline'; font-src *;">`;
            
            if (modifiedHtml.includes('<head>')) {
                modifiedHtml = modifiedHtml.replace('<head>', `<head><base href="${baseUrl}">${cspMeta}`);
            } else {
                modifiedHtml = `<head><base href="${baseUrl}">${cspMeta}</head>` + modifiedHtml;
            }

            // 使用 srcdoc 加载内容
            iframe.srcdoc = modifiedHtml;

            // 更新工具栏标题
            const pageTitle = new URL(url).hostname;
            if (title) {
                title.textContent = pageTitle;
            }
        }
    })
    .catch(error => {
        log('Error fetching page: ' + error);

        // use browser default behavior for non-HTML links or errors
        window.location.href = url;
        hideFloatingWindow();
    });
}

async function setupEvents() {
    $(window).on('load', function () {
        log('window loaded');

        createPreviewFrame();
    });
}

setupEvents();

