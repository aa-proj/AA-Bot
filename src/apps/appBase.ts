import {CacheType, Client, Interaction, Message, VoiceState} from "discord.js";
import {Router} from "express";

export type CommandType = {
  name: string
  description: string
  options: Array<any>
}

export class AppBase {
  appName: string = "unnamed"
  apiRoot: string = "unnamed"
  apiRouter: Router | null = null
  commands: CommandType[] = []
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

  onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
    return
  }


  log(...args: any[]) {
    console.log(`[INFO][${this.appName}] ${args.map(arg => arg.toString()).join(" ")}`)
  }

  error(...args: any[]) {
    console.log(`[EROR][${this.appName}] ${args.map(arg => arg.toString()).join(" ")}`)
  }
}
