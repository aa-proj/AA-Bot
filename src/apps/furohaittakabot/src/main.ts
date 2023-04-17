import {
  ActionRowBuilder,
  ButtonBuilder,
  Client,
  IntentsBitField,
  ButtonStyle,
  Message,
  TextChannel, Interaction, CacheType
} from "discord.js";
import {Connection, ConnectionOptions, createConnection} from "typeorm";
import {User} from "./eneity/User";
import {Furo} from "./eneity/furo";
import {getTimeFromMills, giveAAPoint} from "./util";
import {AppBase} from "../../appBase";
import express from "express";
import {GUILD_ID} from "../../../main";


// const bathReaction = "<:nyuyoku:885703314417807420>";
const bathReactionId = "885703314417807420"
const dailyBotChannel = "803321643803213834";
const generalChannel = "606109479003750442";


// TypeORMのオプション
const options: ConnectionOptions = {
  type: "sqlite",
  database: "./assets/furohaittakabot/db/db.sqlite3",
  entities: [User, Furo],
  synchronize: false,
};


export class FuroHaittakaBot extends AppBase {
  connection: Connection | null = null;

  constructor(client: Client) {
    super(client);
    this.appName = "FuroHaittakaBot"
    this.commands = [
      {
        name: 'huro',
        description: '風呂の状況を知ります',
        options: [
          {
            name: "user",
            required: false,
            description: "ユーザ",
            type: 6
          }
        ]
      },
      {
        name: 'furo',
        description: '風呂の状況を知ります',
        options: [
          {
            name: "user",
            required: false,
            description: "ユーザ",
            type: 6
          }
        ]
      },
    ]

    this.apiRoot = "/furo"
    this.apiRouter = express.Router()
    this.apiRouter.get("/", (req, res) => {
      res.send("ok")
    })

    this.apiRouter.get("/user/:id", async (req, res) => {
      const data = await this.getUserFuroData(req.params.id)
      res.json(data)
    })

    this.apiRouter.post("/user/:id/furo", async (req, res) => {
      const result = await this.doFuro(req.params.id)
      if (result.state === Furo_Result.SUCCESS) {
        res.json({success: true, firstTime: false, point: result.point})
      } else if (result.state === Furo_Result.SUCCESS_FIRST_TIME) {
        res.json({success: true, firstTime: true})
      } else {
        res.status(500).json({success: false})
      }
    })

    this.apiRouter.post('/admin/:id/furo/:time', async (req, res) => {
      console.log(req.params.id)
      await this.doFuroSilent(req.params.id, new Date(Number(req.params.time)))
      res.send("ok")
    })

    this.connectDB()
  }

  override onBotReady(arg: Client<true>) {
    this.log("Discord Bot Ready");
  }

  override async onMessageCreate(msg: Message) {
    if (msg.author.bot) return;
    let len = 5

    if (process.env.CMD_PREFIX) {
      if (!msg.content.startsWith(`/${process.env.CMD_PREFIX}bath`)) {
        return;
      }
      len = `/${process.env.CMD_PREFIX}bath`.length
    } else if (!msg.content.startsWith("/bath")) {
      return;
    }
    // 引数をパース
    const args = msg.content.replace(/　+/g, " ").slice(len).trim().split(/ + /);
    switch (args[0]) {
      case "init":
        await this.initBotMessage(msg);
        break;
      case "test":
        const userCount = await this.connection?.getRepository(User).count()
        await msg.reply(`test OK! userCount :${userCount}`)
    }
  }

  override async onInteractionCreate(interaction: Interaction<CacheType>) {
    if (!interaction.guildId) {
      return;
    }
    if (interaction.isButton()) {
      const messageUser = interaction.user;
      const messageUserId = interaction.user.id;
      const command = interaction.customId;
      if (messageUser.bot) return;

      switch (command) {
        case "Furo":
          await this.doFuro(messageUserId)
          await interaction.reply({content: "OK", ephemeral: true});
          break;
      }
    }
    if (interaction.isCommand()) {
      if (interaction.commandName === 'huro' || interaction.commandName === "furo") {
        const userRepository = this.connection?.getRepository(User);
        const furoRepository = this.connection?.getRepository(Furo);

        const userId = interaction.options.get("user")?.user?.id || interaction.user.id
        const user = await userRepository?.findOne({discordId: userId});
        const furoUser = await furoRepository?.findOne({where: {user: user}, order: {time: "DESC"}});
        const furoTime = furoUser?.time
        if (!furoTime) {
          await interaction.reply("生まれてから風呂入ってません")
          return
        }
        await interaction.reply(
            this.getNameFromID(userId) + "は" +
            getTimeFromMills((new Date().getTime()) - (new Date(furoTime).getTime()))
            + "風呂に入っていません\n ああPが貰えなくなるまで残り" + getTimeFromMills(((new Date(furoTime).getTime() + 35 * 60 * 60 * 1000) - new Date().getTime()))
        )
        return
      }
    }
  }

  async getUserFuroData(userId: string): Promise<Furo[]> {
    const userRepository = this.connection?.getRepository(User);
    const furoRepository = this.connection?.getRepository(Furo);
    const user = await userRepository?.findOne({discordId: userId});
    if (!user) {
      return []
    }
    const furoData = await furoRepository?.find({where: {user: user}, order: {time: "DESC"}});
    return furoData || []
  }

  async doFuroSilent(userId: string, date: Date) {
    const userRepository = this.connection?.getRepository(User);
    const furoRepository = this.connection?.getRepository(Furo);
    let user = await userRepository?.findOne({discordId: userId});
    if (!user) {
      console.log("user inai")
      return
    }
    const furoTransaction = furoRepository?.create({
      time: date,
      user: user,
    });
    furoRepository?.save(<Furo>furoTransaction);
    console.log("save ok")
  }


  async doFuro(userId: string): Promise<{ state: Furo_Result, point?: number, time?: number }> {
    const userRepository = this.connection?.getRepository(User);
    const furoRepository = this.connection?.getRepository(Furo);
    const g = await this.client.guilds.fetch(GUILD_ID);
    const general: TextChannel = <TextChannel>await g.channels.fetch(generalChannel);
    let user = await userRepository?.findOne({discordId: userId});
    if (!user) {
      const newUser = userRepository?.create({
        discordId: userId,
      });
      await userRepository?.save(<User>newUser);
      user = await userRepository?.findOne({discordId: userId});
    }


    const furoUser = await furoRepository?.findOne({where: {user: user}, order: {time: "DESC"}});
    const furoTime = furoUser?.time

    const furoTransaction = furoRepository?.create({
      time: new Date(),
      user: user,
    });
    furoRepository?.save(<Furo>furoTransaction);

    if (!furoTime) {
      await general.send(
          this.getNameFromID(userId) +
          "は初めてお風呂に入りました"
      );
      return {state: Furo_Result.SUCCESS_FIRST_TIME}
    } else {
      const aap = this.calcAAPoint((new Date().getTime()) - (new Date(furoTime).getTime()))
      if (aap !== 0) {
        await giveAAPoint(userId, aap)
      }

      await general.send(
          this.getNameFromID(userId) +
          "は" +
          getTimeFromMills((new Date().getTime()) - (new Date(furoTime).getTime()))
          + "ぶりにお風呂に入りました\n"
          + `${aap}ああP付与されました`
      );

      return {state: Furo_Result.SUCCESS, point: aap, time: (new Date().getTime()) - (new Date(furoTime).getTime())}
    }
  }


  async connectDB() {
    this.connection = await createConnection(options);
    await this.connection.query("PRAGMA foreign_keys=OFF");
    await this.connection.synchronize();
    await this.connection.query("PRAGMA foreign_keys=ON");
    this.log("DB Connected!!")
  }

  async initBotMessage(msg: Message) {

    const channel: TextChannel = (await this.client.channels.fetch(dailyBotChannel)) as TextChannel;
    const action = new ActionRowBuilder()
        .addComponents([
              new ButtonBuilder()
                  .setCustomId("Furo")
                  .setLabel("風呂")
                  .setStyle(ButtonStyle.Success)
                  .setEmoji(bathReactionId)
            ]
        );
    // @ts-ignore
    await channel.send({content: "お風呂に入ったらリアクションしてください", components: [action]});
  }

  getNameFromID(id: string) {
    let g = this.client.guilds.cache.get(GUILD_ID);
    let nickName = g?.members.cache.get(id)?.nickname?.replace("@", "＠");
    if (!nickName) nickName = g?.members.cache.get(id)?.displayName;
    return nickName;
  }

  calcAAPoint(time: number): number {
    const hour = Math.ceil(time / (1000 * 60 * 60))
    if (0 <= hour && hour < 6) {
      return 0
    } else if (6 <= hour && hour < 18) {
      return 8
    } else if (18 <= hour && hour < 36) {
      if (24 == hour) {
        return 16
      } else {
        return 12
      }
    } else {
      return 0
    }

  }
}

export enum Furo_Result {
  SUCCESS,
  SUCCESS_FIRST_TIME,
  UNKNOWN_ERROR
}
