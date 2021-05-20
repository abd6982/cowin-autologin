### CoWIN Autologin

I built this tool since I was tired of logging in again and again, and getting logged out just when I was about to book a slot.

This tool simply launches a puppeteer instance, logs into CoWIN, and keeps logging out and logging you back in every 10 minutes.

#### Pre-requisites

1. An Android device connected to the internet, with [Google Messages](https://play.google.com/store/apps/details?id=com.google.android.apps.messaging) installed.
2. Node.js v12 is installed

#### Setup

1. There are three global variables at the top of `index.js`. This is where we define 3 things -
  - `phoneNumber`: The number used to login
  - `beneficiaryNumber`: On the beneficiary page, determine which beneficiary you want to book for. This number is their position from top to bottom. For eg. If you are at the top in the beneficiaries, your number will be `1`.
  - `conversationThreadId`: This is the thread ID of CoWIN in Google Messages. First go to [Google Messages Web](https://messages.google.com/web/). Connect your phone. Then go to the CoWIN thread. Note the URL in the URL bar. It has a number appened to it, looking something like `https://messages.google.com/web/conversations/1234`. Here `1234` is the thread ID.
2. Once you have determined the above 3 variables, put them in the `index.js` file.
3. Run `npm install`

#### Running

1. Run `npm start` and puppeteer will start a chromium instance and auto login. Use it for booking.
2. If you are running it for the first time, then you'll have to again login to Messages Web. Make sure to check the `Remember this Computer` option.


#### Packaging

I used [pkg](https://github.com/vercel/pkg) to build an executable out of this. It makes it easy to share this as a program to others so they can directly run it on their computers.

1. Install pkg - `npm install -g pkg`
2. Run the command `pkg index.js --target node12-win-x64 --out-path dist --public`
3. Your executable will be built under `dist` dir. Copy `node_modules/puppeteer/.local-chromium` and paste as `dist/puppeteer`. Note that the `.local-chromium` has been renamed to `puppeteer` after moving to dist. More details on why this has to be done can be found [here](https://github.com/vercel/pkg/issues/204#issuecomment-536323464).
4. Now bundle the dist dir and send it to anyone. Just start up the application and its done.

#### TODO

1. Auto determine the conversation thread
2. Show a Dialog to ask for phone number and beneficiary on runtime.
3. Ask for beneficiary name instead of number.
