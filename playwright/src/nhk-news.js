// @ts-check
const { chromium, test, expect } = require('@playwright/test');
const TurndownService = require('turndown');
const { URL } = require('url');
const process = require('process');
const fs = require('fs');
const path = require('path');

const SITE_BASE = 'https://www3.nhk.or.jp/news/';

let options = {
    headless: false,
    batchSize: 10,
    article: '',
};

/**
 * @param {string} url
 */
function getOrigin(url) {
    return new URL(url).origin;
}


/**
 * @param {string} href
 * @param {string} base
 */
function absolutizeURL(href, base) {
    return new URL(href, base).href;
}

/**
 * @param {string} filename
 * @param {string | NodeJS.ArrayBufferView<ArrayBufferLike>} content
 */
function saveToFile(filename, content) {
    const filepath = path.join(__dirname, filename);
    fs.writeFileSync(filepath, content, 'utf-8');
}

/**
 * @param {import("playwright-core").Locator} locator
 * @param {string} baseUrl
 */
async function getMarkdown(locator, baseUrl) {
    const articleHTML = await locator.innerHTML();
    const turndownService = new TurndownService();

    turndownService
        .addRule('removeNoneScreenDiv', {
            filter: (node) => {
                return node.tagName === 'DIV' && node.classList && node.classList.contains('none-screen');
            },
            replacement: () => {
                return ''; 
            }
        })
        .addRule('imageUrl', {
            filter: 'img',
            replacement: (content, node) => {
                // canconical url is in src attribute
                //
                let src = node.getAttribute('src') || '';
                if (!src.startsWith('http://')) {
                    src = baseUrl + src;
                }
                return `![](${src})`;
            }
        });

    return turndownService.turndown(articleHTML);
}

/**
 * wait until the content height stabilizes
 * @param {import("playwright-core").Locator} locator 
 * @param {number} stableTime stable time (milliseconds)
 * @param {number} maxWaitTime max wait time (milliseconds)
 */
async function waitForContentLoaded(locator, stableTime = 2000, maxWaitTime = 15000) {
    let previousHeight = 0;
    let stableStartTime = 0;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
        try {
            const currentHeight = await locator.evaluate(el => el.offsetHeight);
            
            if (currentHeight === previousHeight && currentHeight > 0) {
                if (stableStartTime === 0) {
                    stableStartTime = Date.now();
                } else if (Date.now() - stableStartTime >= stableTime) {
                    return;
                }
            } else {
                stableStartTime = 0;
                previousHeight = currentHeight;
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.log('Error checking height:', error);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    console.log('Max wait time reached, proceeding anyway');
}

async function findArticleLocator(page) {
    const ARTICLE_SELECTORS = [
        'article.module--detail--v3',
        'div.content--detail-body',
        'div.maincontent_body',
        'article.easy-article',
        // 'article[class*="module--detail"]', // 备用模糊匹配
    ];

    for (const selector of ARTICLE_SELECTORS) {
        const locator = page.locator(selector);
        const count = await locator.count();
        if (count > 0) {
            console.log(`Found article using selector: ${selector}`);
            return locator;
        }
    }
    throw new Error(`No article found with any of these selectors: ${ARTICLE_SELECTORS.join(', ')}`);
}

/**
 * @param {import("playwright-core").Page} page
 * @param {string} url
 */
async function getArticle(page, url) {
    const baseUrl = (new URL(url)).origin;

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    console.log('Page loaded');            

    const articleLocator = await findArticleLocator(page);

    await expect(articleLocator).toBeVisible({ timeout: 30000 });

    await waitForContentLoaded(articleLocator);

    await page.bringToFront();
    await page.waitForTimeout(100);

    return await getMarkdown(articleLocator, baseUrl);
}


/**
 * @param {import("playwright-core").Page} page
 * @param {string} url
 */
async function scrapeNHK(page, url) {
    const browser = page.context();

    console.log(`Navigating to ${url} ...`);
    // wait for the page to be fully loaded
    //
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForLoadState('networkidle');
    console.log('Page loaded');

    // get all news links
    //
    const rawItems = await page.locator('a:has(em.title)').evaluateAll(links => 
        links.map(link => {
            const em = link.querySelector('em.title');
            return {
                href: link.getAttribute('href') || '',
                title: (em?.textContent || '').trim()
            };
        }).filter(item => item.href)
    );

    // canonical the URLs and remove duplicates
    //
    let items = rawItems.map(item => {
        return {
            title: item.title,
            url: absolutizeURL(item.href, SITE_BASE)
        };
    });
    items = items.filter((item, index, self) =>
        index === self.findIndex((t) => t.url === item.url)
    );

    console.log(`found ${items.length} news items.`);
    for (const item of items) {
        console.log(`- ${item.title}\n  ${item.url}`);
    }

    const results = [];
    
    // 为 items 添加状态跟踪
    const workItems = items.map((item, index) => ({
        ...item,
        index,
        status: 'pending', // pending, processing, completed, failed
        result: null,
        error: null,
        startTime: null,
        duration: 0
    }));

    let completedCount = 0;
    let activeWorkers = 0;
    let nextItemIndex = 0;
    
    // 工作函数：处理单个页面（增加完成回调）
    async function processItem(workItem, onComplete) {
        let articlePage = null;
        try {
            workItem.status = 'processing';
            workItem.startTime = Date.now();
            activeWorkers++;
            
            articlePage = await browser.newPage();
            console.log(`\n--- [${workItem.index + 1}/${items.length}] Starting: ${workItem.title} ---`);
            
            const content = await getArticle(articlePage, workItem.url);
            
            workItem.result = {
                title: workItem.title,
                url: workItem.url,
                content: content,
                duration: Date.now() - workItem.startTime
            };
            workItem.status = 'completed';
            
            console.log(`[${workItem.index + 1}/${items.length}] Completed: ${workItem.title} (${content.length} chars)`);
            
        } catch (error) {
            workItem.status = 'failed';
            workItem.error = error.message;
            console.error(`[${workItem.index + 1}/${items.length}] Failed: ${workItem.title} - ${error.message}`);
        } finally {
            if (articlePage) {
                await articlePage.close();
            }
            workItem.duration = Date.now() - (workItem.startTime || Date.now());
            activeWorkers--;
            completedCount++;
            onComplete(); // 通知完成
        }
    }
    
    // 启动下一个工作器的函数
    function startNextWorker() {
        if (nextItemIndex < workItems.length && activeWorkers < options.batchSize) {
            const workItem = workItems[nextItemIndex++];
            processItem(workItem, startNextWorker); // 完成后尝试启动下一个
        }
    }
    
    // 启动初始工作器
    for (let i = 0; i < Math.min(options.batchSize, workItems.length); i++) {
        startNextWorker();
    }
    
    // 等待所有任务完成
    while (completedCount < workItems.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 显示统计信息
    const successful = workItems.filter(item => item.status === 'completed');
    const failed = workItems.filter(item => item.status === 'failed');
    
    console.log(`\n=== Final Statistics ===`);
    console.log(`Total items: ${workItems.length}`);
    console.log(`Successful: ${successful.length}`);
    console.log(`Failed: ${failed.length}`);
    
    if (failed.length > 0) {
        console.log(`\nFailed items:`);
        failed.forEach(item => {
            console.log(`- [${item.index + 1}] ${item.title}: ${item.error}`);
            console.log(`  URL: ${item.url}`);
        });
    }
}

/**
 * @param {string[]} argv
 */
function showUsage(argv) {
    const scriptName = path.basename(argv[1]);
    console.log(`Usage: node ${scriptName} [options]
Options:
  --article <url>    Specify the article URL to scrape
  --headless         Use headless (no GUI) browser mode, default is false
  --help             Show this help message
    `);
}

/**
 * @param {string[]} argv
 * @param {object} [defaultOptions={}]
 */
function getOptions(argv, defaultOptions = {}) {
    const opts = { ...options, ...defaultOptions };

    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        switch (arg) {
        case '--article':
            if (i + 1 >= argv.length) {
                console.error('Error: --article requires a URL argument');
                process.exit(1);
            }
            opts.article = argv[i + 1];
            i++;
            break;

        case '--headless':
            opts.headless = true;
            break;

        case '--help':
        default:
            showUsage(argv);
            process.exit(-1);
        }
    }

    return opts;
}

/**
 * @param {string[]} argv
 */
async function run(argv) {
    options = getOptions(argv);

    if (typeof options.article === 'string') {
        options.article = options.article.trim();
    }

    // create a new chrome browser instance, with local user data directory
    //
    const userDataDir = path.join(process.cwd(), "chrome-user-data");
    const browser = await chromium.launchPersistentContext(userDataDir, {
        headless: options.headless,
        channel: 'chrome', 
        args: [
            '--no-first-run',
            '--no-default-browser-check',
        ],
    });

    browser.setDefaultTimeout(0);
    browser.setDefaultNavigationTimeout(0);

    console.log('browser launched');

    // get the first page, or create a new one if none exists
    //
    const pages = browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();

    if (options.article?.length > 0) {
        const content = await getArticle(page, options.article);
        console.log(`${content.slice(0, 300)}...\n`);

        if (!options.headless) {
            // wait for browser to be closed
            //
            console.log('Article fetched, please close the browser to exit.');
            await browser.waitForEvent('close');
        }
    } else {
        await scrapeNHK(page, SITE_BASE);
    }

    await browser.close();
    console.log('Browser closed');
}

const startTime = Date.now();

run(process.argv).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});

process.on('exit', (code) => {
    const duration = (Date.now() - startTime) / 1000;
    console.log(`Process exiting with code ${code}, total duration: ${duration.toFixed(2)} seconds`);
});

