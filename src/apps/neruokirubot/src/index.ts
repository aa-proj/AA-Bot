import {
  Client,
  TextChannel,
  IntentsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, Message, Interaction, CacheType
} from "discord.js";
import {Connection, ConnectionOptions, createConnection} from "typeorm";
import {User} from "./entity/User";
import {Sleep} from "./entity/Sleep";
import {getHoursFromMills, getTimeFromMills, giveAAPoint} from "./util";
import {OGPManager} from "./ogp";
import {AppBase} from "../../appBase";


// TypeORMのオプション
const options: ConnectionOptions = {
  type: "sqlite",
  database: "./assets/neruokirubot/db/db.sqlite3",
  entities: [User, Sleep],
  synchronize: false
};


// いろんな定数 TODO コンフィグ化
// const neru = "<:ne:803311475502350398>";
const neruEmojiID = "803311475502350398";
// const okiru = "<:ki:803311475325796434>";
const okiruEmojiID = "803311475325796434";

const neruRole = "885403771084079134";
const okiruRole = "885403912713158686";

const noChannel = "803321643803213834";
const generalChannel = "606109479003750442";

const guildID = "606109479003750440";

export class NeruOkiruBot extends AppBase {
  OGP: OGPManager
  // TypeORMのコネクション 使う前にnullチェックが必要
  connection: Connection | null = null;

  constructor(client: Client) {
    super(client);
    this.appName = "NeruOkiruBot"

    // コネクションする
    this.connectDB();
    this.OGP = new OGPManager();
    this.OGP.init();
  }

  override async onBotReady(arg: Client<true>) {
    this.log("OnBotReady")
  }

  override async onMessageCreate(msg: Message) {
    if (msg.author.bot) return;
    if (!msg.content.startsWith(process.env.COMMAND_PREFIX || "/no")) return;
    // 引数をパース
    const args = msg.content.replace(/　+/g, " ").slice(4).split(/ +/) //.trim().split(/ /);
    switch (args[0]) {
      case "init":
        await this.initBotMessage();
        if (msg.deletable) await msg.delete()
        break;
      case "test":
        // console.log(1000 * 60 * 60 * Number(args[1] || 6))
        const uuid = await this.OGP.generateOGP({
          date: new Date(),
          icon: msg.author.avatarURL() || "https://cdn.discordapp.com/avatars/803309031560708167/f160e91772bc096338fd55962a207a52.webp",
          name: msg.author.username,
          time: getHoursFromMills(1000 * 60 * 60 * Number(args[1] || 6)),
          sum: 1234, //getHoursFromMills(sum || 0),
          average: 123, // getHoursFromMills(sum ? sum / (sleeps?.length || 1) : 0),
          point: 123,
          start: new Date().getTime() - (1000 * 60 * 60 * Number(args[1] || 6)),
          end: new Date().getTime()
        })
        await msg.reply(`https://sleep.ahoaho.jp/image/${uuid}.png`)
    }
  }

  override async onInteractionCreate(interaction: Interaction<CacheType>) {

    if (!interaction.isButton() || !interaction.guildId) {
      return;
    }
    const g = this.client.guilds.cache.get(interaction.guildId);
    const general: TextChannel = <TextChannel>await g?.channels.fetch(generalChannel);
    const messageUser = interaction.user;
    const messageUserId = interaction.user.id;
    const command = interaction.customId;
    if (messageUser.bot) return;

    const userRepository = this.connection?.getRepository(User);
    const sleepRepository = this.connection?.getRepository(Sleep);
    const user = await userRepository?.findOne({discordId: interaction.user.id});

    if (!user) {
      // Userが未登録だった時
      const newUser = userRepository?.create({
        discordId: messageUserId
      });
      await userRepository?.save(<User>newUser);
    } else {
      switch (command) {
        case "Neru":
          if (user.nowSleeping) {
            const date = new Date().getTime();
            const sleep = sleepRepository?.create({
              sleepTime: user.sleepTempTime,
              wakeTime: date,
              user: user
            });
            sleepRepository?.save(<Sleep>sleep);
            // ポイントの付与
            const aap = this.calcAAPoint(date - (user.sleepTempTime || 0));
            if (aap !== 0) {
              await giveAAPoint(messageUserId, aap);
            }

            const sleeps = (await sleepRepository?.find({where: {user}}))?.filter(n => (n?.wakeTime || 0) - (n?.sleepTime || 0) >= 10 * 60 * 1000);
            const sum = sleeps?.reduce((p, n) => {
              return ((n?.wakeTime || 0) - (n?.sleepTime || 0)) + p;
            }, 0);

            const uuid = await this.OGP.generateOGP({
              date: new Date(),
              icon: (interaction.user.avatarURL() || "https://cdn.discordapp.com/avatars/803309031560708167/f160e91772bc096338fd55962a207a52.webp"),
              name: interaction.user.username,
              time: getHoursFromMills(date - (user.sleepTempTime || 0)),
              sum: getHoursFromMills(sum || 0),
              average: getHoursFromMills(sum ? sum / (sleeps?.length || 1) : 0),
              point: aap,
              start: (user.sleepTempTime || 0),
              end: date
            });

            await general.send(
              `https://sleep.ahoaho.jp/image/${uuid}.png`
            );

            userRepository?.update(
              {discordId: messageUserId},
              {nowSleeping: false}
            );
          }
          await userRepository?.update(
            {discordId: messageUserId},
            {
              nowSleeping: true,
              sleepTempTime: new Date().getTime()
            }
          );
          g?.members.cache.get(messageUserId)?.roles.remove(okiruRole);
          g?.members.cache.get(messageUserId)?.roles.add(neruRole);
          await general.send(
            this.getNameFromID(messageUserId) + "はねました。ぽやしみ"
          );
          await interaction.reply({content: "OK", ephemeral: true});
          break;
        case "Okiru":
          g?.members.cache.get(messageUserId)?.roles.remove(neruRole);
          g?.members.cache.get(messageUserId)?.roles.add(okiruRole);
          if (user.nowSleeping) {
            const date = new Date().getTime();
            const sleep = sleepRepository?.create({
              sleepTime: user.sleepTempTime,
              wakeTime: date,
              user: user
            });
            sleepRepository?.save(<Sleep>sleep);
            // ポイントの付与
            const aap = this.calcAAPoint(date - (user.sleepTempTime || 0));
            if (aap !== 0) {
              await giveAAPoint(messageUserId, aap);
            }

            const sleeps = (await sleepRepository?.find({where: {user}}))?.filter(n => (n?.wakeTime || 0) - (n?.sleepTime || 0) >= 10 * 60 * 1000);
            const sum = sleeps?.reduce((p, n) => {
              return ((n?.wakeTime || 0) - (n?.sleepTime || 0)) + p;
            }, 0);

            const uuid = await this.OGP.generateOGP({
              date: new Date(),
              icon: (interaction.user.avatarURL() || "https://cdn.discordapp.com/avatars/803309031560708167/f160e91772bc096338fd55962a207a52.webp"),
              name: interaction.user.username,
              time: getHoursFromMills(date - (user.sleepTempTime || 0)),
              sum: getHoursFromMills(sum || 0),
              average: getHoursFromMills(sum ? sum / (sleeps?.length || 1) : 0),
              point: aap,
              start: (user.sleepTempTime || 0),
              end: date
            });

            await general.send(
              `https://sleep.ahoaho.jp/image/${uuid}.png`
            );

            userRepository?.update(
              {discordId: messageUserId},
              {nowSleeping: false}
            );
          }
          await interaction.reply({content: "OK", ephemeral: true});
          break;
      }
    }
    try {

    } catch (e) {
      console.error("interaction failed");
    }
  }

  async initBotMessage() {
    const channel: TextChannel = (await this.client.channels.fetch(noChannel)) as TextChannel;
    const action = new ActionRowBuilder()
      .addComponents([
          new ButtonBuilder()
            .setCustomId("Neru")
            .setLabel("寝る")
            .setStyle(ButtonStyle.Success)
            .setEmoji(neruEmojiID)
          ,
          new ButtonBuilder()
            .setCustomId("Okiru")
            .setLabel("起きる")
            .setStyle(ButtonStyle.Primary)
            .setEmoji(okiruEmojiID)
        ]
      );
    // @ts-ignore
    await channel.send({content: "このメッセージにリアクションしてね(⋈◍＞◡＜◍)。✧♡", components: [action]});
  }

  getNameFromID(id: string) {
    let g = this.client.guilds.cache.get(guildID);
    let nickName = g?.members.cache.get(id)?.nickname?.replace("@", "＠");
    if (!nickName) nickName = g?.members.cache.get(id)?.displayName;
    return nickName;
  }

  calcAAPoint(time: number): number {
    const hour = Math.ceil(time / (1000 * 60 * 60));
    if (0 <= hour && hour < 5) {
      return 0;
    } else if (5 <= hour && hour < 13) {
      return 12;
    } else if (13 <= hour && hour < 18) {
      return 8;
    } else {
      return 4;
    }
  }

  async connectDB() {
    this.connection = await createConnection(options);
    const userRepository = this.connection.getRepository(User);
    this.log(await userRepository.count());
    await this.connection.query("PRAGMA foreign_keys=OFF");
    await this.connection.synchronize();
    await this.connection.query("PRAGMA foreign_keys=ON");
  }

}
