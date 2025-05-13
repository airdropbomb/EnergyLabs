import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { promises as fs } from 'fs';
import inquirer from 'inquirer';
import cfonts from 'cfonts';
import chalk from 'chalk';
import ProxyChain from 'proxy-chain';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';

puppeteer.use(StealthPlugin());
const browsers = [];
const activeSpinners = [];

function centerText(text, color = 'yellowBright') {
  const terminalWidth = process.stdout.columns || 80;
  const textLength = text.length;
  const padding = Math.max(0, Math.floor((terminalWidth - textLength) / 2));
  return ' '.repeat(padding) + chalk[color](text);
}

function shorten(str, frontLen = 6, backLen = 4) {
  if (!str || str.length <= frontLen + backLen) return str;
  return `${str.slice(0, frontLen)}....${str.slice(-backLen)}`;
}

const spinnerFrames = ['⣾', '⣷', '⣯', '⣟', '⡿', '⢿', '⣻', '⣽'];
function createSpinner(text) {
  let frameIndex = 0;
  let interval;
  const spinner = {
    start: () => {
      process.stdout.write(`${chalk.yellowBright(spinnerFrames[frameIndex])} ${chalk.blueBright(text)}`);
      interval = setInterval(() => {
        frameIndex = (frameIndex + 1) % spinnerFrames.length;
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write(`${chalk.yellowBright(spinnerFrames[frameIndex])} ${chalk.blueBright(text)}`);
      }, 100);
      activeSpinners.push(spinner);
    },
    succeed: (message) => {
      clearInterval(interval);
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      process.stdout.write(`${chalk.greenBright('✔')} ${chalk.greenBright(message)}\n`);
      activeSpinners.splice(activeSpinners.indexOf(spinner), 1);
    },
    fail: (message) => {
      clearInterval(interval);
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      process.stdout.write(`${chalk.redBright('✖')} ${chalk.redBright(message)}\n`);
      activeSpinners.splice(activeSpinners.indexOf(spinner), 1);
    },
    stop: () => {
      clearInterval(interval);
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      activeSpinners.splice(activeSpinners.indexOf(spinner), 1);
    },
    updateText: (newText) => {
      text = newText;
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      process.stdout.write(`${chalk.yellowBright(spinnerFrames[frameIndex])} ${chalk.blueBright(text)}`);
    }
  };
  return spinner;
}

cfonts.say('NT EXHAUST', {
  font: 'block',
  align: 'center',
  colors: ['cyan', 'magenta'],
  background: 'transparent',
  letterSpacing: 1,
  lineHeight: 1,
  space: true,
  maxLength: '0'
});
console.log(centerText('=== Telegram Channel 🚀 : NT EXHAUST (@ntexhaust) ==='));
console.log(centerText('✪  ENERGY LABS AUTO DAILY BOT  ✪'));
console.log();

async function getLocalIP(proxy) {
  try {
    const config = proxy ? {
      httpsAgent: proxy.startsWith('socks') ? new SocksProxyAgent(proxy) : new HttpsProxyAgent(proxy)
    } : {};
    const response = await axios.get('https://api.ipify.org?format=json', { ...config, timeout: 10000 });
    return response.data.ip;
  } catch {
    return 'Error getting IP';
  }
}

async function validateProxy(proxy, localIP) {
  const spinner = createSpinner(` Validating Proxy: ${proxy}`);
  spinner.start();
  try {
    const config = {
      httpsAgent: proxy.startsWith('socks') ? new SocksProxyAgent(proxy) : new HttpsProxyAgent(proxy),
      timeout: 10000
    };
    const response = await axios.get('https://api.ipify.org?format=json', config);
    const ip = response.data.ip;
    if (ip && ip !== localIP) {
      spinner.succeed(` Proxy Valid: ${proxy}`);
      return { valid: true, ip };
    } else {
      spinner.fail(` Proxy Invalid: ${proxy}`);
      return { valid: false, ip: null };
    }
  } catch (error) {
    spinner.fail(` Proxy Invalid: ${proxy} (${error.message})`);
    return { valid: false, ip: null };
  }
}

async function askForProxy() {
  const { useProxy } = await inquirer.prompt([
    { type: 'confirm', name: 'useProxy', message: 'Want To Use Proxy? (y/n)', default: false }
  ]);
  if (!useProxy) {
    console.log(chalk.yellowBright('🚨 No Proxy Selected. Continuing Without Proxy.'));
    console.log();
    return { proxyList: [], proxyIPs: {} };
  }

  let proxyList = [];
  const proxyIPs = {};
  try {
    const proxyData = await fs.readFile('proxy.txt', 'utf8');
    proxyList = proxyData.split('\n').map(line => line.trim()).filter(Boolean);
    console.log(chalk.yellowBright(` 🛈 Loaded ${proxyList.length} Proxies..`));
    const localIP = await getLocalIP();
    const validProxies = [];
    for (const proxy of proxyList) {
      const result = await validateProxy(proxy, localIP);
      if (result.valid) {
        validProxies.push(proxy);
        proxyIPs[proxy] = result.ip;
      }
    }
    proxyList = validProxies;
    console.log(chalk.yellowBright(` 🛈 Found ${proxyList.length} Valid Proxies.`));
    console.log();
  } catch {
    console.log(chalk.yellowBright(' 🚨 proxy.txt Not Found/invalid proxy. Continuing Without Proxy.'));
    console.log();
  }
  return { proxyList, proxyIPs };
}

function generateUserAgent() {
  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/134.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/133.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/132.0.0.0 Safari/537.36'
  ];
  return agents[Math.floor(Math.random() * agents.length)];
}

async function login(page, account) {
  const spinner = createSpinner(' Processing Login');
  spinner.start();
  try {
    await page.goto('https://defi-energylabs.com/', { waitUntil: 'networkidle2', timeout: 60000 });
    await page.click('button[onclick="showForm(\'login\')"]');
    await page.waitForSelector('#login-form', { visible: true, timeout: 10000 });
    await page.type('#login-username', account.username || account.email);
    await page.type('#login-password', account.password);
    await Promise.all([
      page.click('button[name="login"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
    ]);
    if (page.url() === 'https://defi-energylabs.com/dashboard') {
      spinner.succeed(' Login Successful');
      return true;
    } else {
      await page.waitForSelector('.alert.alert-danger', { timeout: 5000 });
      const error = await page.$eval('.alert.alert-danger p', el => el.textContent);
      spinner.fail(` Login Failed: ${error}`);
      return false;
    }
  } catch (error) {
    spinner.fail(` Login Failed: ${error.message}`);
    return false;
  }
}

async function getDashboardInfo(page, account) {
  const spinner = createSpinner(' Getting Dashboard Info');
  spinner.start();
  try {
    await page.goto('https://defi-energylabs.com/dashboard', { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('.balance-cards', { timeout: 10000 });
    const info = await page.evaluate(() => {
      const energyPoint = document.querySelector('.balance-cards .balance-card:nth-child(3) .balance-amount')?.textContent || 'N/A';
      const energyBalance = document.querySelector('.balance-cards .balance-card:nth-child(1) .balance-amount')?.textContent || 'N/A';
      const wEnergyBalance = document.querySelector('.balance-cards .balance-card:nth-child(2) .balance-amount')?.textContent || 'N/A';
      return { energyPoint, energyBalance, wEnergyBalance };
    });
    if (info.energyPoint === 'N/A' && info.energyBalance === 'N/A' && info.wEnergyBalance === 'N/A') {
      spinner.fail(' Dashboard Info Unavailable');
    } else {
      spinner.succeed(' Dashboard Info Received');
      console.log(chalk.bold.magentaBright(`    ➥ Username: ${account.username}`));
      console.log(chalk.bold.magentaBright(`    ➥ Energy Points: ${info.energyPoint}`));
      console.log(chalk.bold.magentaBright(`    ➥ Energy Balance: ${info.energyBalance}`));
      console.log(chalk.bold.magentaBright(`    ➥ WEnergy Balance: ${info.wEnergyBalance}`));
    }
  } catch (error) {
    spinner.fail(` Failed Getting Dashboard Info: ${error.message}`);
    console.log(chalk.yellowBright(' Dashboard Info Unavailable.'));
  }
}

async function claimFaucet(page) {
  const spinner = createSpinner(' Processing Faucet Claim');
  spinner.start();
  try {
    await page.goto('https://defi-energylabs.com/faucet', { waitUntil: 'networkidle2', timeout: 60000 });
    const isClaimed = await page.$('.claim-btn[disabled]');
    if (isClaimed) {
      spinner.succeed(chalk.bold.yellowBright(' Faucet Already Claimed Today'));
      return false;
    }
    await page.click('.claim-btn');
    await page.waitForSelector('.alert.alert-success', { timeout: 10000 });
    spinner.succeed(' Faucet Claimed Successfully');
    return true;
  } catch (error) {
    spinner.fail(` Failed Claiming Faucet: ${error.message}`);
    return false;
  }
}

async function performSwap(page) {
  let currentSpinner = null;
  try {
    await page.goto('https://defi-energylabs.com/swap', { waitUntil: 'networkidle2', timeout: 60000 });
    for (let i = 0; i < 5; i++) {
      currentSpinner = createSpinner(` Processing Swap ${i + 1}/5`);
      currentSpinner.start();
      await new Promise(resolve => setTimeout(resolve, 100)); 
      const swapsToday = await page.$eval('.swap-limit', el => el.textContent.match(/(\d+)\/5/)?.[1] || '0');
      if (parseInt(swapsToday) >= 5) {
        currentSpinner.succeed(chalk.bold.yellowBright(' Daily Swap Limit Reached'));
        return;
      }

      let retries = 3;
      while (retries > 0) {
        try {
          await page.select('#from-token', 'ENRG');
          await page.select('#to-token', 'WENRG');
          await page.type('#amount', '0.1');
          await page.click('.swap-btn');
          await page.waitForSelector('.alert.alert-success', { timeout: 15000 });
          currentSpinner.succeed(` Swap ${i + 1}/5 Successful`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          break;
        } catch (error) {
          retries--;
          currentSpinner.stop();
          process.stdout.clearLine(0);
          process.stdout.cursorTo(0);
          console.log(chalk.yellowBright(` 🚨 Swap ${i + 1}/5 Failed (Attempt ${3 - retries}/3): ${error.message}`));
          if (retries > 0) {
            console.log(chalk.yellowBright(' ⟳ Retrying after page refresh...'));
            await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
            await new Promise(resolve => setTimeout(resolve, 2000));
            currentSpinner = createSpinner(` Processing Swap ${i + 1}/5`);
            currentSpinner.start();
            await new Promise(resolve => setTimeout(resolve, 100));
          } else {
            console.log(chalk.redBright(` ✖️ Swap ${i + 1}/5 Failed after 3 attempts`));
            throw error;
          }
        }
      }
    }
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    console.log(chalk.greenBright(`✔️ All Swaps Completed`));
  } catch (error) {
    if (currentSpinner) currentSpinner.stop();
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    console.log(chalk.redBright(` ✖️ Failed Performing Swap: ${error.message}`));
  } finally {
    if (currentSpinner) currentSpinner.stop();
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
  }
}

async function processAccount(account, proxyList, proxyIPs) {
  console.log(chalk.whiteBright(`🗣️ Account: ${account.username}`));
  let browser;
  let page;
  let anonymizedProxy = null;
  let useProxy = proxyList.length > 0;
  let accountIP = await getLocalIP();

  const browserArgs = ['--no-sandbox', '--disable-setuid-sandbox'];

  if (useProxy) {
    const proxy = proxyList[Math.floor(Math.random() * proxyList.length)];
    if (proxyIPs[proxy]) {
      const spinner = createSpinner(` Checking Proxy IP for Account`);
      spinner.start();
      accountIP = await getLocalIP(proxy); 
      if (accountIP && accountIP !== await getLocalIP()) {
        anonymizedProxy = await ProxyChain.anonymizeProxy(proxy);
        browserArgs.push(`--proxy-server=${anonymizedProxy}`);
        spinner.succeed(` Proxy IP: ${accountIP}`);
      } else {
        spinner.fail(`Proxy Invalid for This Account `);
        useProxy = false;
        console.log(chalk.yellowBright(' ⚠️ Continuing Without Proxy.'));
      }
    } else {
      useProxy = false;
      console.log(chalk.yellowBright(' ⚠️  Proxy Invalid. Continuing Without Proxy.'));
    }
  }

  console.log(chalk.whiteBright(`🎯 Using IP: ${accountIP}`));
  console.log(chalk.cyanBright('='.repeat(80)));
  console.log();

  try {
    browser = await puppeteer.launch({ headless: true, args: browserArgs, ignoreHTTPSErrors: true });
    browsers.push(browser);
    page = await browser.newPage();
    await page.setUserAgent(generateUserAgent());
    await page.setViewport({ width: 1280, height: 720 });

    if (await login(page, account)) {
      await claimFaucet(page);
      await performSwap(page);
      await getDashboardInfo(page, account);
    } else {
      console.log(chalk.redBright(` ✖️ Account ${shorten(account.username)} Failed Due To Login Error`));
    }
  } catch (error) {
    console.log(chalk.redBright(` ✖️ Error Processing Account ${shorten(account.username)}: ${error.message}`));
  } finally {
    if (page) await page.close().catch(() => {});
    if (browser) {
      browsers.splice(browsers.indexOf(browser), 1);
      await browser.close().catch(() => {});
    }
    if (anonymizedProxy) await ProxyChain.closeAnonymizedProxy(anonymizedProxy, true).catch(() => {});
  }
}

async function waitForNextCycle() {
  const waitTimeMs = 24 * 60 * 60 * 1000;
  const startTime = Date.now();
  const endTime = new Date(startTime + waitTimeMs);
  console.log(chalk.greenBright(`\nAll Accounts Processed Successfully. Waiting 24 Hours Until Next Cycle...`));

  return new Promise((resolve) => {
    let frameIndex = 0;
    const spinner = createSpinner(` Waiting for Next Cycle (calculating...)`);
    spinner.start();

    const interval = setInterval(() => {
      const elapsedMs = Date.now() - startTime;
      const remainingMs = waitTimeMs - elapsedMs;
      frameIndex = (frameIndex + 1) % spinnerFrames.length;

      if (remainingMs <= 0) {
        clearInterval(interval);
        spinner.succeed(' Starting Next Cycle');
        resolve();
      } else {
        const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
        const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        const remainingSeconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
        const timeText = `Waiting for Next Cycle ${remainingHours}h ${remainingMinutes}m ${remainingSeconds}s remaining`;
        spinner.updateText(timeText);
      }
    }, 1000);
  });
}

process.on('SIGINT', async () => {
  console.log(chalk.redBright('\n⛔ Bot Stopped ,  Cleaning Up Resources...'));
  try {
    for (const spinner of [...activeSpinners]) {
      spinner.stop();
    }
    activeSpinners.length = 0;
    for (const browser of [...browsers]) {
      await browser.close().catch(err => console.log(chalk.redBright(`✖ Error Closing: ${err.message}`)));
    }
    browsers.length = 0;
  } catch {
  }
  process.exit(0);
});

async function processAllAccounts(proxyList, proxyIPs) {
  let accountsData;
  try {
    accountsData = JSON.parse(await fs.readFile('accounts.json', 'utf8'));
  } catch (error) {
    console.log(chalk.redBright(' Failed Reading accounts.json: File Not Found or Invalid Format'));
    return false;
  }

  for (const [index, account] of accountsData.entries()) {
    console.log();
    console.log(chalk.cyanBright('='.repeat(80)));
    console.log(chalk.whiteBright(`Processing Account ${index + 1}/${accountsData.length}`));
    await processAccount(account, proxyList, proxyIPs);
    if (index < accountsData.length - 1) {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      console.log();
      console.log(chalk.grey(' Waiting 5 Seconds Before Next Account...'));
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  console.log();
  console.log(chalk.cyanBright('='.repeat(80)));
  return true;
}

async function main() {
  const { proxyList, proxyIPs } = await askForProxy();
  while (true) {
    const success = await processAllAccounts(proxyList, proxyIPs);
    if (!success) {
      console.log(chalk.redBright('✖️ Stopping Bot Due to Error Reading accounts.json'));
      break;
    }
    await waitForNextCycle();
  }
}

main().catch(err => console.error(chalk.red(` Error: ${err.message}`)));