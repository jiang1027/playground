const { remote } = require('webdriverio');

const capabilities = {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:deviceName': 'Android',
};

const wdOpts = {
    hostname: process.env.APPIUM_HOST || 'localhost',
    port: parseInt(process.env.APPIUM_PORT, 10) || 4723,
    // logLevel: 'info',
    logLevel: 'error',
    capabilities,
};

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


async function runTest() {
    const driver = await remote(wdOpts);
    try {
        // await listInstalledApps(driver);

        await driver.updateSettings({
            waitForIdleTimeout: 1000,
            waitForSelectorTimeout: 5000,
        });

        const package = await driver.getCurrentPackage();
        console.log('Current package:', package);

        const name = await driver.getCurrentActivity();
        console.log('Current activity:', name);

    } finally {
        await driver.pause(1000);
        await driver.deleteSession();
    }
}

runTest().catch(console.error);
