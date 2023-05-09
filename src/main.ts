import {Client, IntentsBitField, Interaction, REST, Routes} from "discord.js";
import {NeruOkiruBot} from "./apps/neruokirubot/src";
import {AppBase, CommandType} from "./apps/appBase";
import {FuroHaittakaBot} from "./apps/furohaittakabot/src/main";
import {VCName} from "./apps/vcname/main";
import express from "express";
import cors from "cors"

export const GUILD_ID = "606109479003750440"


/**
 * main.ts
 * AA-Botのコア
 * アプリを読み込んで、一つのBotで複数のアプリを動かせるようにまとめている部分
 */


if (!process.env.DISCORD_TOKEN) throw new Error("DISCORD_TOKEN NOT PROVIDED")

const client = new Client(
  {
    intents:
      [IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.GuildMessageReactions,
        IntentsBitField.Flags.GuildVoiceStates
      ]
  });


const rest = new REST({version: '9'}).setToken(process.env.DISCORD_TOKEN);

const apps: AppBase[] = []
apps.push(new NeruOkiruBot(client))
apps.push(new FuroHaittakaBot(client))
apps.push(new VCName(client))

const apiApp = express()
apiApp.use(cors())
apps.forEach(app => {
  if(app.apiRouter) {
    apiApp.use(app.apiRoot, app.apiRouter)
    console.log(`registered api endpoint ${app.apiRoot} to ${app.appName}`)
  }
})

apiApp.listen(4000, () => {
  console.log("api server listen on 4000.")
})

client.on("ready", async (args) => {

  try {
    console.log('Started refreshing application (/) commands.');

    const commands = apps.reduce<CommandType[]>((p, n) => {return [...p, ...n.commands]}, [])

    await rest.put(
      Routes.applicationGuildCommands(args.user.id, GUILD_ID),
      {body: commands.map(r => {
          r.name = (process.env.CMD_PREFIX || "")  + r.name;
          return r
        })},
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }

  for (const app of apps) {
    await app.onBotReady(args)
  }
});

client.on("messageCreate", async (msg) => {
  for (const app of apps) {
    await app.onMessageCreate(msg)
  }
});


client.on("interactionCreate", async (interaction) => {
  // デバッグ用の環境変数が設定されていた時にcommandを前処理
  if (process.env.CMD_PREFIX && interaction.isChatInputCommand()) {
    interaction.commandName = interaction.commandName.replace(process.env.CMD_PREFIX, "")
  }

  for (const app of apps) {
    await app.onInteractionCreate(interaction)
  }
})

client.on("voiceStateUpdate", async (oldState, newState) => {
  for (const app of apps) {
    await app.onVoiceStateUpdate(oldState, newState)
  }
})

client.login(process.env.DISCORD_TOKEN)




