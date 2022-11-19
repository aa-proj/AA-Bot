import {CacheType, Client, Interaction, Message} from "discord.js";

export class AppBase {
  appName: string = "unnamed"
  client: Client

  constructor(client: Client) {
    this.client = client
  }

  onBotReady(arg: Client<true>) {
    return
  }

  onMessageCreate(msg: Message) {
    return
  }

  onInteractionCreate(interaction: Interaction<CacheType>) {
    return
  }


  log(...args: any[]) {
    console.log(`[INFO][${this.appName}] ${args.map(arg => arg.toString()).join(" ")}`)
  }

  error(...args: any[]) {
    console.log(`[EROR][${this.appName}] ${args.map(arg => arg.toString()).join(" ")}`)
  }
}
