import {Client, IntentsBitField, REST, Routes} from "discord.js";
import {NeruOkiruBot} from "./apps/neruokirubot/src";
import {AppBase} from "./apps/appBase";
import {FuroHaittakaBot} from "./apps/furohaittakabot/src/main";
import {VCName} from "./apps/vcname/main";

export const SERVER_ID = "606109479003750440"

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


const commands = [
  {
    name: 'vc',
    description: 'VCのなまえをかえます',
    options: [
      {
        name: "name",
        required: true,
        description: "誰もいなくなるまで設定するVCの名前を指定します。",
        type: 3
      }
    ]
  }
];

client.on("ready", async (args) => {

  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationGuildCommands(args.user.id, SERVER_ID),
      {body: commands},
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




