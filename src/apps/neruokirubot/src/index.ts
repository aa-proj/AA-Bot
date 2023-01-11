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
import express from "express";
import {Furo_Result} from "../../furohaittakabot/src/main";


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

    this.apiRoot = "/sleep"
    this.apiRouter = express.Router()
    this.apiRouter.get("/", (req, res) => {
      res.send("neruokiru ok")
    })

    this.apiRouter.get("/user/:id", async (req, res) => {
      const data = await this.getUserNeruData(req.params.id)
      res.json(data)
    })

    this.apiRouter.post("/user/:id/okiru", async (req, res) => {
      try {
        await this.doOkiru(req.params.id)
        res.json({success: true})
      } catch {
        res.status(500).json({success: false})
      }
    })


    this.apiRouter.post("/user/:id/neru", async (req, res) => {
      try {
        await this.doNeru(req.params.id)
        res.json({success: true})
      } catch {
        res.status(500).json({success: false})
      }
    })
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

    if (interaction.user.bot) return;

    const command = interaction.customId;

    switch (command) {
      case "Neru":
        await this.doNeru(interaction.user.id)
        await interaction.reply({content: "OK", ephemeral: true});
        break;
      case "Okiru":
        await this.doOkiru(interaction.user.id)
        await interaction.reply({content: "OK", ephemeral: true});
        break;
    }
  }

  async doNeru(userId: string) {
    const userRepository = this.connection?.getRepository(User);
    const user = await userRepository?.findOne({discordId: userId});
    const g = await this.client.guilds.fetch(guildID);
    const general: TextChannel = <TextChannel>await g?.channels.fetch(generalChannel);
    const discordUser = await g.members.fetch(userId)
    await discordUser.roles.remove(neruRole);
    await discordUser.roles.add(okiruRole);
    if (!user) {
      // Userが未登録だった時
      const newUser = userRepository?.create({
        discordId: userId
      });
      await userRepository?.save(<User>newUser);
    } else if (user.nowSleeping) {
      await this.doOkiru(userId)
    }

    await userRepository?.update(
      {discordId: userId},
      {
        nowSleeping: true,
        sleepTempTime: new Date().getTime()
      }
    );
    await discordUser.roles.remove(okiruRole);
    await discordUser.roles.add(neruRole);
    await general.send(
      this.getNameFromID(userId) + "はねました。ぽやしみ"
    );

  }

  async getUserNeruData(userId: string): Promise<Sleep[]> {
    const userRepository = this.connection?.getRepository(User);
    const sleepRepository = this.connection?.getRepository(Sleep);
    const user = await userRepository?.findOne({discordId: userId});
    const sleeps = (await sleepRepository?.find({where: {user}}))?.filter(n => (n?.wakeTime || 0) - (n?.sleepTime || 0) >= 10 * 60 * 1000);

    if (!user || !sleeps) {
      return []
    }

    return sleeps

  }

  async doOkiru(userId: string) {
    const userRepository = this.connection?.getRepository(User);
    const sleepRepository = this.connection?.getRepository(Sleep);
    const user = await userRepository?.findOne({discordId: userId});
    const g = await this.client.guilds.fetch(guildID);
    const general: TextChannel = <TextChannel>await g?.channels.fetch(generalChannel);
    const discordUser = await g.members.fetch(userId)
    await discordUser.roles.remove(neruRole);
    await discordUser.roles.add(okiruRole);

    if (!user) {
      // Userが未登録だった時
      const newUser = userRepository?.create({
        discordId: userId
      });
      await userRepository?.save(<User>newUser);
    } else if (user.nowSleeping) {
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
        await giveAAPoint(userId, aap);
      }

      const sleeps = (await sleepRepository?.find({where: {user}}))?.filter(n => (n?.wakeTime || 0) - (n?.sleepTime || 0) >= 10 * 60 * 1000);
      const sum = sleeps?.reduce((p, n) => {
        return ((n?.wakeTime || 0) - (n?.sleepTime || 0)) + p;
      }, 0);

      const uuid = await this.OGP.generateOGP({
        date: new Date(),
        icon: (discordUser.avatarURL() || "https://cdn.discordapp.com/avatars/803309031560708167/f160e91772bc096338fd55962a207a52.webp"),
        name: discordUser.nickname || discordUser.displayName,
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
        {discordId: userId},
        {nowSleeping: false}
      );
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
