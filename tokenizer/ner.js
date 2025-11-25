// ========== 日志工具 ==========
let $logList, $logContainer;
let $inputText, $btnAnalyze, $btnClearLog, $resultSection, $resultDisplay;

function log(message, type = 'info') {
    const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    const $li = $('<li>')
        .addClass(`log-${type}`)
        .html(`<span class="log-time">[${time}]</span>${$('<div>').text(message).html()}`);

    $logList.append($li);
    // 自动滚动到底部
    $logContainer.scrollTop($logContainer[0].scrollHeight);
}

// 日志快捷方法
const logger = {
    info: (msg) => log(msg, 'info'),
    success: (msg) => log(msg, 'success'),
    error: (msg) => log(msg, 'error'),
    warn: (msg) => log(msg, 'warn')
};

// ========== 主逻辑 ==========
$(document).ready(function() {
    // 初始化 DOM 引用
    $logList = $('#log-list');
    $logContainer = $('#log-container');
    $inputText = $('#input-text');
    $btnAnalyze = $('#btn-analyze');
    $btnClearLog = $('#btn-clear-log');
    $resultSection = $('#result-section');
    $resultDisplay = $('#result-display');

    // 清空日志
    $btnClearLog.on('click', () => {
        $logList.empty();
        logger.info('日志已清空');
    });

    // 分析按钮点击事件
    $btnAnalyze.on('click', async () => {
        const text = $inputText.val().trim();

        if (!text) {
            logger.warn('请输入要分析的文本');
            return;
        }

        logger.info(`开始分析文本，长度: ${text.length} 字符`);
        $btnAnalyze.prop('disabled', true);

        try {
            // TODO: 在这里添加 NER 分析逻辑
            await analyzeNER(text);
        } catch (error) {
            logger.error(`分析失败: ${error.message}`);
        } finally {
            $btnAnalyze.prop('disabled', false);
        }
    });

    // 页面加载完成
    logger.info('NER 测试页面已加载');
    logger.info('请输入文本后点击"开始分析"按钮');
});

// NER 分析函数（待实现）
async function analyzeNER(text) {
    logger.info('NER 分析功能待实现...');

    // 模拟示例输出
    const mockEntities = [
        { text: '张三', type: 'PERSON', start: 0, end: 2 },
        { text: '李四', type: 'PERSON', start: 3, end: 5 },
        { text: '明天下午3点', type: 'TIME', start: 7, end: 13 },
        { text: '北京会议室', type: 'LOCATION', start: 14, end: 19 },
        { text: '新项目', type: 'THING', start: 21, end: 24 }
    ];

    logger.success(`模拟识别到 ${mockEntities.length} 个实体`);

    // 显示结果
    displayEntities(mockEntities, text);
}

// 显示实体结果
function displayEntities(entities, originalText) {
    $resultSection.addClass('visible');
    $resultDisplay.empty();

    if (entities.length === 0) {
        $resultDisplay.text('未识别到实体');
        return;
    }

    entities.forEach(entity => {
        const $span = $('<span>')
            .addClass(`entity entity-${entity.type}`)
            .text(`${entity.text} [${entity.type}]`)
            .attr('title', `位置: ${entity.start}-${entity.end}`);

        $resultDisplay.append($span);
        logger.info(`实体: "${entity.text}" -> ${entity.type} (${entity.start}-${entity.end})`);
    });
}