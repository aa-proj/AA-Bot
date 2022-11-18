import {Client, IntentsBitField} from "discord.js";
import {NeruOkiruBot} from "./apps/neruokirubot/src";

const client = new Client(
  {
    intents:
      [IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.GuildMessageReactions
      ]
  });

const neruOkiruBot = new NeruOkiruBot(client)


client.on("ready", async (args) => {
  console.log("Discord Bot Ready");
  await neruOkiruBot.onBotReady(args)
});

client.on("messageCreate", async (msg) => {
  console.log("messageCreate")
  await neruOkiruBot.onMessageCreate(msg)
});


client.on("interactionCreate", async (interaction) => {
  console.log("interactionCreate")
  await neruOkiruBot.onInteractionCreate(interaction)
})

client.login(process.env.DISCORD_TOKEN)
