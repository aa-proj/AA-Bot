import {CacheType, Client, Interaction, Message} from "discord.js";

export class AppBase {
  appName: string | undefined
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
}
