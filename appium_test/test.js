const fs = require('fs');
const { platform } = require('os');
const { execPath, config } = require('process');
const { createWorker } = require('tesseract.js');
const { remote } = require('webdriverio');
const zlib = require('zlib');

const configuration = {
    showName: '睡美人-两个王国的传说',
    showPlatform: '2025-10-26 *周 *日 *15:00',
    showPrice: [ 238, ],

    clearAppDataBeforeStart: false,
    packageName: 'cn.damai',
    activityPauseTime: 200,
    webdriverioOptions: {
        waitForIdleTimeout: 50,
        waitForSelectorTimeout: 1000,
    },
}

/*
{
  "platformName": "Android",
  "appium:automationName": "UiAutomator2",
  "appium:deviceName": "Android"
}
*/

const capabilities = {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:deviceName': 'Android',
};

const wdOpts = {
    hostname: process.env.APPIUM_HOST || 'localhost',
    port: parseInt(process.env.APPIUM_PORT, 10) || 4723,
    logLevel: 'info',
    // logLevel: 'error',
    capabilities,
};

let stopProgram = false;

let ocrWorkerPromise;

async function getOcrWorker() {
    if (!ocrWorkerPromise) {
        ocrWorkerPromise = createWorker('chi_sim+eng');
    }
    return ocrWorkerPromise;
}

async function shutdownOcrWorker() {
    if (ocrWorkerPromise) {
        const worker = await ocrWorkerPromise;
        await worker.terminate();
        ocrWorkerPromise = null;
    }
}


async function ocrElement(driver, element) {
    const worker = await getOcrWorker();
    const elementId = await element.elementId;

    const screenshotBase64 = await driver.takeElementScreenshot(elementId);
    const imageBuffer = Buffer.from(screenshotBase64, 'base64');

    // save to file for debugging
    // fs.writeFileSync('element_screenshot.png', imageBuffer);

    const {
        data: { text },
    } = await worker.recognize(imageBuffer);

    const normalizedText = text.replace(/\s+/g, ' ').trim();
    return normalizedText;
}


function getPriceInfoFromText(text) {
    const priceMatch = text.match(/([\d\.]+) *元/);
    if (priceMatch) {
        const outOfStock = text.match(/(缺 *货)/);
        return {
            price: parseFloat(priceMatch[1]),
            outOfStock: !!outOfStock,
        };
    }
}

// 关闭可能弹出的权限提示对话框
//
async function closePermissionDialog(driver) {
    const permissionDialog = await driver.$('id=cn.damai:id/damai_theme_dialog_layout');
    if (!permissionDialog.error) {
        const cancelButton = await permissionDialog.$('id=cn.damai:id/damai_theme_dialog_cancel_btn');
        await cancelButton.click();
        console.log('permission dialog closed');
    }
}

async function listInstalledApps(driver) {
    const result = await driver.execute('mobile: shell', {
        command: 'cmd',
        args: ['package', 'list', 'packages',],
        timeout: 20000,
        includeStderr: true,
    });

    let output = result.stdout || '';
    if (result.code !== 0 || !output.trim()) {
        // Fallback for devices that do not support label output via cmd.
        const fallback = await driver.execute('mobile: shell', {
            command: 'pm',
            args: ['list', 'packages', '-f'],
            timeout: 20000,
            includeStderr: true,
        });
        output = fallback.stdout || '';
    }

    console.log('Installed applications:', output);

    const apps = output
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
            const packageMatch = line.match(/package:([^\s]+)/);
            const labelMatch = line.match(/label:(.+)$/);
            let id = packageMatch ? packageMatch[1] : line;
            if (id.includes('=')) {
                id = id.substring(id.lastIndexOf('=') + 1);
            }
            const name = labelMatch ? labelMatch[1].trim() : 'Unknown';
            return { id, name };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

    apps.forEach(({ name, id }) => {
        console.log(`${name} (${id})`);
    });
}


async function SplashMainActivityHandler(driver) {
    // wait awhile for splash screen to load
    //
    await driver.pause(2000);

    // click agree button on splash screen if present
    //
    const agreeButton = await driver.$('id=cn.damai:id/id_boot_action_agree');
    if (agreeButton.error === undefined) {
        await agreeButton.click();
        console.log('Clicked agree button on splash screen.');
    }
    else {
        console.log('Agree button not found on splash screen.');
    }

    // await driver.waitUntil(
    //     async () => (await driver.getCurrentActivity()) === '.homepage.MainActivity',
    //     { timeout: 15000, interval: 1000, timeoutMsg: 'Main activity did not appear' }
    // );
}


async function LauncherHandler(driver) {

    const waitFunc = async () => {
        const popupWindowCloseButton = await driver.$('id=cn.damai:id/homepage_popup_window_close_btn');
        if (popupWindowCloseButton.error === undefined) {
            await popupWindowCloseButton.click();
        }

        return (await driver.getCurrentActivity()) === '.homepage.MainActivity';
    };

    // wait until MainActivity appears
    //
    // await driver.waitUntil(
    //     async () => (await waitFunc()),
    //     { timeout: 15000, interval: 1000, timeoutMsg: 'Main activity did not appear' }
    // );
}


async function MainActivityHandler(driver) {
    const popupWindowCloseButton = await driver.$('id=cn.damai:id/homepage_popup_window_close_btn');
    if (popupWindowCloseButton.error === undefined) {
        await popupWindowCloseButton.click();
    }

    const searchTextBox = await driver.$('id=cn.damai:id/homepage_header_search');

    // click the search box to enter search activity
    //
    await searchTextBox.click();

    /*
    const mineTab = await driver.$('id=cn.damai:id/pioneer_home_tab_container_5');
    await mineTab.click();

    const unloggedIn = await driver.$('id=cn.damai:id/pioneer_mine_center_header_unlogin');
    if (unloggedIn.error === undefined) {
        console.log('User is not logged in.');
        return;
    }

    const userNameElement = await driver.$('id=cn.damai:id/pioneer_mine_center_header_user_name');
    const userName = await userNameElement.getText();
    console.log('Logged in user:', userName);

    // continue to perform actions for logged-in user...
    // 
    console.log('User is logged in, continue with further actions.');

    stopProgram = true;
    */
}

// project detail page
//
async function ProjectDetailActivityHandler(driver) {
    const confirmButton = await driver.$('id=cn.damai:id/damai_theme_dialog_confirm_btn');
    
    // click confirm button if present
    //
    if (confirmButton.error === undefined) {
        await confirmButton.click();
    }

    // 提示对话框
    //
    const tipDialog = await driver.$('id=cn.damai:id/damai_theme_dialog_layout');
    if (!tipDialog.error) {
        // scroll down tip content if present
        //
        const tipContentElement = await tipDialog.$('id=cn.damai:id/damai_theme_dialog_tip_content');
        if (tipContentElement.error === undefined) {
            await driver.execute('mobile: scrollGesture', {
                elementId: tipContentElement.elementId,
                direction: 'down',
                percent: 0.2,
            });
        }

        // const cancelButton = tipDialog.$('id=cn.damai:id/damai_theme_dialog_cancel_btn');
        // await cancelButton.click();

        stopProgram = true;
        return;
    }

    // click purchase button
    //
    const purchaseButton = await driver.$('id=cn.damai:id/trade_project_detail_purchase_status_bar_container_fl'); 
    if (purchaseButton.error === undefined) {
        const text = await ocrElement(driver, purchaseButton);
        console.log('Purchase button text:', text);

        if (text.includes('缺')) {
            stopProgram = true;
            return;
        }

        if (text.match(/选 *座/) || text.match(/立 *即 *购 *票/)) {
            await purchaseButton.click();
            return;
        }

        if (text.match(/预 *约 */)) {
            console.log('Purchase is a reservation, stopping program.');
            return;
        }

        stopProgram = true;

        // await purchaseButton.click();

        // // wait until "选座购票" page appears
        // await driver.waitUntil(
        //     async () => (await driver.getCurrentActivity()) === '.commonbusiness.seatbiz.sku.qilin.ui.NcovSkuActivity',
        //     { timeout: 15000, interval: 1000, timeoutMsg: 'NcovSkuActivity did not appear' }
        // );
    }
}


// "选座购票"页面
//
async function NcovSkuActivityHandler(driver) {

    let platforms = [];

    // 获得所有"场次"信息
    //
    const platformItems = await driver
        .$('id=cn.damai:id/project_detail_perform_flowlayout')
        .$$('id=cn.damai:id/ll_perform_item');
    console.log(`Found ${platformItems.length} date items.`);
    
    for (let index = 0; index < platformItems.length; index += 1) {
        const text = await ocrElement(driver, platformItems[index]);
        console.log(`Date item ${index}: ${text}`);

        const platform = {
            date: text,
            ticketItems: [],
            matched: false,
        };
        
        if (text.match(new RegExp(configuration.showPlatform))) {
            platform.matched = true;
        }

        platforms.push(platform);
    }

    // 依次选择每个"场次"，然后得到"票档"内容，匹配到用户配置
    //
    for (let index = 0; index < platformItems.length; index += 1) {
        if (!platforms[index].matched) {
            continue;
        }

        await platformItems[index].click();

        const projectDetailPanel = await driver.$('id=cn.damai:id/project_detail_perform_price_flowlayout');

        const getTicketItems = async function() {
            // 关闭有可能出现的弹窗
            await closePermissionDialog(driver);
            return await projectDetailPanel.$$('id=cn.damai:id/ll_perform_item');
        };

        // 等待"票档"列表加载完成
        //
        await driver.waitUntil(
            async () => { return (await getTicketItems()).length > 0; },
            { timeout: 10000, interval: 100, timeoutMsg: 'Ticket items did not load' }
        );
          
        const ticketItems = await getTicketItems();
        console.log(`For date item ${index}, found ${ticketItems.length} ticket items.`);

        for (let tIndex = 0; tIndex < ticketItems.length; tIndex += 1) {
            const text = await ocrElement(driver, ticketItems[tIndex]);
            console.log(`  Ticket item ${tIndex}: ${text}`);

            const priceInfo = getPriceInfoFromText(text);
            if (!priceInfo) {
                console.log('   No price found in text, skipping.');
            } else {
                const ticket = {
                    text, ...priceInfo,
                };

                if (configuration.showPrice.includes(priceInfo.price)) {
                    ticket.matched = true;
                }

                console.log('Ticket info:', ticket);

                platforms[index].ticketItems.push(ticket);

                if (ticket.matched && !ticket.outOfStock) {
                    console.log('buy ticket');

                    // click the ticket and buy button
                    //
                    await ticketItems[tIndex].click();

                    const buyButton = await driver.$('id=cn.damai:id/btn_buy_view');
                    await buyButton.click();

                    // await driver.pause(5000);

                    return;
                }
            }
        }
    }

    console.log('Platforms and ticket items:', 
        JSON.stringify(platforms, null, 2));

    stopProgram = true;
}

async function SearchActivityHandler(driver) {
    const searchText = configuration.showName;

    await closePermissionDialog(driver);

    // 获得演出列表
    //
    const showItems = await driver.$$('id=cn.damai:id/ll_search_item');
    if (showItems.length > 0) {
        // 精确匹配到演出，点击进入演出详情页
        //
        if (showItems.length === 1) {
            const showPoster = await showItems[0].$('id=cn.damai:id/poster');
            await showPoster.click();
            return;
        }

        for (let i = 0; i < showItems.length; i += 1) {
            const item = showItems[i];
            const titleElement = await item.$('id=cn.damai:id/tv_project_name');
            const titleText = await titleElement.getText();
            console.log(`Show ${i}: ${titleText}`);

            if (titleText.match(new RegExp(searchText))) {
                const showPoster = await item.$('id=cn.damai:id/poster');
                await showPoster.click();
                return;
            }
        }

        // 未能精确匹配到演出，停止程序
        //
        stopProgram = true;
        return;
    }

    const searchTextBox = await driver.$('id=cn.damai:id/header_search_v2_input');
    await searchTextBox.setValue(searchText);
    
    await driver.waitUntil(
        async () => {
            closePermissionDialog(driver);
            const resultItems = await driver.$$('id=cn.damai:id/tv_word');
            return resultItems.length > 0;
        },
        { timeout: 10000, interval: 500, timeoutMsg: 'Search results did not appear' }
    );

    // get all search result items
    const resultItems = await driver.$$('id=cn.damai:id/tv_word');
    if (resultItems.length === 0) {
        console.log('No search result items found.');
        stopProgram = true;
        return;
    }

    console.log(`Found ${resultItems.length} search result items.`);

    for (let i = 0; i < resultItems.length; i += 1) {
        const item = resultItems[i];
        const text = await item.getText();
        console.log(`Search result item ${i}: ${text}`);
    }

    // click the first search item
    //
    const firstItem = resultItems[0];
    await firstItem.click();

    // sleep awhile to allow detail page to load
    //
    await driver.pause(100);

    // stopProgram = true;
}


async function OrderActivityHandler(driver) {
    stopProgram = true;

    const buyButton = await driver
        .$('id=cn.damai:id/bottom_layout')
        .$('.//android.widget.TextView[@text="立即提交"]');
    await buyButton.click();

    stopProgram = true;
}


const activityHandlers = {
    '.launcher.Launcher': LauncherHandler,
    '.launcher.splash.SplashMainActivity': SplashMainActivityHandler,
    '.homepage.MainActivity': MainActivityHandler,
    '.trade.newtradeorder.ui.projectdetail.ui.activity.ProjectDetailActivity': ProjectDetailActivityHandler,
    '.commonbusiness.seatbiz.sku.qilin.ui.NcovSkuActivity': NcovSkuActivityHandler,
    'com.alibaba.pictures.bricks.search.v2.SearchActivity': SearchActivityHandler,
    '.ultron.view.activity.DmOrderActivity': OrderActivityHandler,
};



async function runTest() {
    const driver = await remote(wdOpts);
    try {
        // await listInstalledApps(driver);

        if (configuration.webdriverioOptions) {
            await driver.updateSettings(configuration.webdriverioOptions);
        }

        if (configuration.clearAppDataBeforeStart) {
            await driver.execute("mobile: shell", {
                "command": "pm",
                "args": ["clear", configuration.packageName],
                timeout: 20000,
                includeStderr: true,            
            });
        }

        const package = await driver.getCurrentPackage();
        console.log('Current package:', package);

        if (package !== configuration.packageName) {
            await driver.activateApp(configuration.packageName);
        }

        let name = await driver.getCurrentActivity();
        console.log('Current activity:', name);

        while (activityHandlers[name]) {
            await activityHandlers[name](driver);

            if (stopProgram) {
                break;
            }

            // sleep awhile to allow UI to stabilize
            await driver.pause(configuration.activityPauseTime || 100);

            name = await driver.getCurrentActivity();
        }

        if (!stopProgram) {
            console.log('No handler for activity: ', name);
        }

    } finally {
        // await driver.pause(1000);
        await driver.deleteSession();
        await shutdownOcrWorker();
    }
}

runTest().catch(console.error);
