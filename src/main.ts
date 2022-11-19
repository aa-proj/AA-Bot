import {Client, IntentsBitField} from "discord.js";
import {NeruOkiruBot} from "./apps/neruokirubot/src";
import {AppBase} from "./apps/appBase";
import {FuroHaittakaBot} from "./apps/furohaittakabot/src/main";

const client = new Client(
  {
    intents:
      [IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.GuildMessageReactions
      ]
  });

const apps: AppBase[] = []
apps.push(new NeruOkiruBot(client))
apps.push(new FuroHaittakaBot(client))


client.on("ready", async (args) => {
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
  for (const app of apps) {
    await app.onInteractionCreate(interaction)
  }
})

client.login(process.env.DISCORD_TOKEN)
