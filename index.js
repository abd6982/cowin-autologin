const path = require('path');
const puppeteer = require('puppeteer');

const conversationThreadId = '123';
const beneficiaryNumber = 1;
const phoneNumber = '9999999999';

let browser = null;
let page = null;
let messagePage = null;

const setup = async () => {
  // Support for pkg
  // https://github.com/vercel/pkg/issues/204#issuecomment-536323464
  const executablePath =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  (process.pkg
    ? path.join(
        path.dirname(process.execPath),
        'puppeteer',
        ...puppeteer
          .executablePath()
          .split(path.sep)
          .slice(6), // node_modules/puppeteer/.local-chromium
      )
    : puppeteer.executablePath());
  // launch browser
  browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized'],
    userDataDir: './userDataDir', // need to persist data
    executablePath,
  });
  browser.on('disconnected', () => process.exit(0));
  page = await browser.newPage();
  await page.goto('https://selfregistration.cowin.gov.in/');

  // create new tab for web messages
  messagePage = await browser.newPage();
  // this is needed to show console logs in browser
  messagePage.on('console', consoleObj => console.log(consoleObj.text()));
  await messagePage.goto('https://messages.google.com/web/');
  await messagePage.waitForSelector('body > mw-app > mw-bootstrap > div > main > mw-main-container > div > mw-main-nav');
  await messagePage.waitForTimeout(1000);

  // go to the COWIN OTP thread. this will vary for each user
  await messagePage.waitForSelector(`[href="/web/conversations/${conversationThreadId}"]`);
  await messagePage.evaluate((conversationThreadId) => {
    document.querySelectorAll(`[href="/web/conversations/${conversationThreadId}"]`)[0].click();
  }, conversationThreadId);
  await page.bringToFront();
};

const login = async (logout=false) => {
  if (logout) {
    await page.waitForSelector('body > app-root > ion-app > app-header > ion-header > ion-grid > ion-row.topband.md.hydrated > ion-col > ion-row > ion-col:nth-child(2) > div > ul > li');
    await page.click('body > app-root > ion-app > app-header > ion-header > ion-grid > ion-row.topband.md.hydrated > ion-col > ion-row > ion-col:nth-child(2) > div > ul > li');
  }
  await page.waitForSelector('[formcontrolname="mobile_number"]'); // wait for phone number input
  await page.waitForTimeout(1000);
  await page.type('[formcontrolname="mobile_number"]', phoneNumber); // enter the phone number
  // wait for the button
  await page.waitForXPath('//*[@id="main-content"]/app-login/ion-content/div/ion-grid/ion-row/ion-col/ion-grid/ion-row/ion-col[1]/ion-grid/form/ion-row/ion-col[2]/div/ion-button');
  await page.waitForTimeout(1000);
  const currTime = new Date();
  // click on the button
  await page.evaluate(() => {
    document.querySelector("#main-content > app-login > ion-content > div > ion-grid > ion-row > ion-col > ion-grid > ion-row > ion-col:nth-child(1) > ion-grid > form > ion-row > ion-col.col-padding.md.hydrated > div > ion-button").shadowRoot.querySelector("button").click();
  });

  // wait until otp generation request goes through
  await page.waitForRequest('https://cdn-api.co-vin.in/api/v2/auth/generateMobileOTP');

  await messagePage.bringToFront();
  // wait for messages to load
  await messagePage.waitForXPath('/html/body/mw-app/mw-bootstrap/div/main/mw-main-container/div/mw-conversation-container/div/div[1]/div/mws-messages-list/mws-bottom-anchored/div/div/div');
  await messagePage.waitForTimeout(1000);
  let otp = '';
  let tries = 0;
  while (true) {
    try {
      // get all messages
      const messages = await messagePage.evaluate(() => {
        const containerList = document.getElementsByClassName('content');
        let messagesList = null;
        if (containerList.length == 2) { // This happens when phone is using mobile data
          messagesList = Array.from(containerList[1].children);
        } else {
          messagesList = Array.from(containerList[0].children);
        }

        const messages = [];

        messagesList.forEach(elem => {
          try {
            messages.push(elem.firstElementChild.firstElementChild.nextElementSibling.firstElementChild.firstElementChild.firstElementChild.getAttribute('aria-label'));
          } catch (err) {
            console.log(err, elem);
          }
        });
        return messages;
      });
      // extract otp from the most recent message, if it was received within the last minute
      if (messages.length > 0) {
        let lastMessage = messages[messages.length - 1];
        let msgTime = new Date(lastMessage.substring(114, 138).replace(' at', ''));
        if ((currTime - msgTime)/1000 < 60) {
          otp = lastMessage.substring(53,59);
          break;
        }
      }
    } catch (err) {
      console.log('Error reading OTP: ', err);
    }
    tries += 1;
    if (tries >= 10) break;
    await messagePage.waitForTimeout(2000);
  }
  if (!otp) {
    await page.goto('https://selfregistration.cowin.gov.in/');
    await page.waitForTimeout(1000);
    login();
    return;
  }

  // go back to COWIN page
  await page.bringToFront();

  // wait for OTP input element
  await page.waitForSelector('[data-placeholder="Enter OTP"]');
  await page.waitForTimeout(1000);

  // type in the OTP
  await page.type('[data-placeholder="Enter OTP"]', otp);

  // submit the OTP
  await page.click('#main-content > app-login > ion-content > div > ion-grid > ion-row > ion-col > ion-grid > ion-row > ion-col > ion-grid > form > ion-row > ion-col:nth-child(3) > div > ion-button');

  // wait until beneficiary response comes from server
  await page.waitForResponse('https://cdn-api.co-vin.in/api/v2/appointment/beneficiaries');
  await page.waitForTimeout(1000);

  // select the desired beneficiary
  await page.evaluate((beneficiaryNumber) => {
    document.getElementsByClassName('m-lablename')[beneficiaryNumber-1].click();
  }, beneficiaryNumber);
  await page.waitForTimeout(1000);

  // switch to Search by District
  await page.evaluate(() => document.getElementById('status').click());

  // open the state selector dropdown
  await page.waitForSelector('[formcontrolname="state_id"]');
  await page.click('[formcontrolname="state_id"]');

  // select Delhi as the state
  await page.waitForSelector('[role="listbox"]');
  await page.evaluate(() => {
    document.querySelectorAll('[role="listbox"]')[0].children[9].click();
  });
  // await browser.close();
};

setup().then(login).then(() => setInterval(() => login(true), 600000)).catch(err => process.exit(1));
