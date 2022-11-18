import { Client, GatewayIntentBits, REST, Routes } from "discord.js"
import puppeteer from "puppeteer"
import { v4 as uuidv4 } from 'uuid';
import express, { Express } from "express";

export type OGPType = {
  name: string,
  icon: string,
  time: string | number
  date: Date,
  sum: string | number,
  average: string | number
  point: number,
  start: number,
  end: number
}

export class OGPManager {
  // @ts-ignore
  app: Express

  public init() {
    this.app = express()
    this.app.use("/internal", express.static('./assets/neruokirubot/static'));
    this.app.use("/image", express.static('./assets/neruokirubot/img'));
    this.app.listen(3000, () => console.log("express ok"))
  }

  async generateOGP(data: OGPType) {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 580, height: 160 });
    await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36");
    await page.goto("http://localhost:3000/internal/index.html?data=" + JSON.stringify(data), { waitUntil: 'load' });
    // await page.waitForTimeout(2600);
    const uuid = uuidv4()
    await page.screenshot({ path: `./assets/neruokirubot/img/${uuid}.png` ,omitBackground: true});
    await browser.close();
    return uuid
  }
}
