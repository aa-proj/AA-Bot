import {
  Client,
  TextChannel,
  IntentsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, Message, Interaction, CacheType
} from "discord.js";
import {Connection, ConnectionOptions, createConnection} from "typeorm";
import {User} from "./entity/User";
import {Sleep} from "./entity/Sleep";
import {getHoursFromMills, getTimeFromMills} from "./util";
import {OGPManager} from "./ogp";
import {AppBase} from "../../appBase";
import express from "express";
import {GUILD_ID} from "../../../main";
import {giveAAPoint} from "../../../lib/aabank";


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

export class NeruOkiruBot extends AppBase {
  OGP: OGPManager
  // TypeORMのコネクション 使う前にnullチェックが必要
  connection: Connection | null = null;

  // コンストラクタ
  // アプリがAA-Botに登録されるときに１度だけ呼び出される
  // ここでデータベースに繋いだり、最初に準備する処理を入れる
  constructor(client: Client) {
    super(client);
    this.appName = "NeruOkiruBot"

    this.OGP = new OGPManager();


    /** ここから HTTP APIの定義 */
    this.apiRoot = "/sleep"
    this.apiRouter = express.Router()

    // 死活監視
    this.apiRouter.get("/", (req, res) => {
      res.send("neruokiru ok")
    })

    // 寝るデータをとる
    this.apiRouter.get("/user/:id", async (req, res) => {
      const data = await this.getUserNeruData(req.params.id)
      res.json(data)
    })

    // 起きる
    this.apiRouter.post("/user/:id/okiru", async (req, res) => {
      try {
        await this.doOkiru(req.params.id)
        res.json({success: true})
      } catch {
        res.status(500).json({success: false})
      }
    })

    // 寝る
    this.apiRouter.post("/user/:id/neru", async (req, res) => {
      try {
        await this.doNeru(req.params.id)
        res.json({success: true})
      } catch {
        res.status(500).json({success: false})
      }
    })

    // コネクションする
    this.connectDB();
    /** ここまで */
  }

  // Botが準備完了になったとき
  override async onBotReady(arg: Client<true>) {
    this.log("OnBotReady")
  }

  // 普通のテキストメッセージが来たとき
  override async onMessageCreate(msg: Message) {
    // Botの時はやらない
    if (msg.author.bot) return;

    // コマンド "/no" から始まってない時
    // CMD_PREFIX環境変数を持っている時は、/${CMD_PREFIX}no
    let len = 3
    if(process.env.CMD_PREFIX) {
      if (!msg.content.startsWith(`/${process.env.CMD_PREFIX}no`)) {
        return;
      }
      len = `/${process.env.CMD_PREFIX}no`.length
    }
    else if (!msg.content.startsWith("/no")) {
      return;
    }

    // 引数をパース
    // argsに /no 以降のコマンドを配列に入れる
    // /no init　なら argsには ["init"]が入る
    const args = msg.content.replace(/　+/g, " ").slice(len).split(/ +/) //.trim().split(/ /);

    // args[0] によって処理をかえる
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

  // ボタンとかコマンドとかのインタラクションが来たとき
  override async onInteractionCreate(interaction: Interaction<CacheType>) {

    // ボタンを押された時ではない
    // ああサーバからのアクションではない
    // 時は処理しない
    if (!interaction.isButton() || !interaction.guildId) {
      return;
    }

    // Botがおした時は処理しない
    if (interaction.user.bot) return;

    // コマンドを取り出し コマンドは initBotMessageメソッドのsetCustomIdで定義
    const command = interaction.customId;

    // コマンドで分岐
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

  // 寝る処理メソッド
  async doNeru(userId: string) {
    // いろいろとってくる
    const userRepository = this.connection?.getRepository(User);

    // DBに入ってるuserをuserIdで取り出す(新規の時はなんも入らん)
    const user = await userRepository?.findOne({discordId: userId});

    const g = await this.client.guilds.fetch(GUILD_ID);
    const general: TextChannel = <TextChannel>await g?.channels.fetch(generalChannel);
    const discordUser = await g.members.fetch(userId)

    // Discordのロールを更新する ??? これおかしいかもしれん
    await discordUser.roles.remove(neruRole);
    await discordUser.roles.add(okiruRole);

    if (!user) {
      // Userが未登録だった時、ユーザを作る
      const newUser = userRepository?.create({
        discordId: userId
      });
      await userRepository?.save(<User>newUser);
    } else if (user.nowSleeping) {
      await this.doOkiru(userId)
    }

    // updateでDBに入ってる値を更新する
    await userRepository?.update(
      {discordId: userId},
      {
        nowSleeping: true,
        sleepTempTime: new Date().getTime()
      }
    );

    // Discordのロールを更新
    await discordUser.roles.remove(okiruRole);
    await discordUser.roles.add(neruRole);

    // generalにメッセージを送信
    await general.send(
      this.getNameFromID(userId) + "はねました。ぽやしみ"
    );

  }

  // 睡眠データをとるメソッド
  async getUserNeruData(userId: string): Promise<{sleeps: Sleep[], nowSleeping: boolean}> {
    const userRepository = this.connection?.getRepository(User);
    const sleepRepository = this.connection?.getRepository(Sleep);
    const user = await userRepository?.findOne({discordId: userId});
    const sleeps = (await sleepRepository?.find({where: {user}}))?.filter(n => (n?.wakeTime || 0) - (n?.sleepTime || 0) >= 10 * 60 * 1000);

    if (!user || !sleeps) {
      return {
        sleeps: [],
        nowSleeping: false
      }
    }

    return {
      sleeps,
      nowSleeping: user.nowSleeping
    }
  }

  // 起きる処理メソッド
  async doOkiru(userId: string) {
    const userRepository = this.connection?.getRepository(User);
    const sleepRepository = this.connection?.getRepository(Sleep);
    const user = await userRepository?.findOne({discordId: userId});
    const g = await this.client.guilds.fetch(GUILD_ID);
    const general: TextChannel = <TextChannel>await g?.channels.fetch(generalChannel);
    const discordUser = await g.members.fetch(userId)

    // discordのロールを更新 ???
    await discordUser.roles.remove(neruRole);
    await discordUser.roles.add(okiruRole);

    if (!user) {
      // Userが未登録だった時
      const newUser = userRepository?.create({
        discordId: userId
      });
      await userRepository?.save(<User>newUser);
    } else if (user.nowSleeping) {
      // ユーザが寝てる時
      const date = new Date().getTime();

      // 寝たっていうデータを作成して、DBに入れてる
      const sleep = sleepRepository?.create({
        sleepTime: user.sleepTempTime,
        wakeTime: date,
        user: user
      });
      sleepRepository?.save(<Sleep>sleep);


      // ポイントの計算
      const aap = this.calcAAPoint(date - (user.sleepTempTime || 0));

      if (aap !== 0) {
        // 送金
        await giveAAPoint(userId, aap);
      }

      // ユーザの睡眠ログをとってくる
      const sleeps = (await sleepRepository?.find({where: {user}}))?.filter(n => (n?.wakeTime || 0) - (n?.sleepTime || 0) >= 10 * 60 * 1000);
      // 寝てる時間をreduce(forのエモい版)で加算
      const sum = sleeps?.reduce((p, n) => {
        return ((n?.wakeTime || 0) - (n?.sleepTime || 0)) + p;
      }, 0);


      // 画像を生成
      const uuid = await this.OGP.generateOGP({
        date: new Date(),
        icon: (discordUser.displayAvatarURL() || "https://cdn.discordapp.com/avatars/803309031560708167/f160e91772bc096338fd55962a207a52.webp"),
        name: discordUser.nickname || discordUser.displayName,
        time: getHoursFromMills(date - (user.sleepTempTime || 0)),
        sum: getHoursFromMills(sum || 0),
        average: getHoursFromMills(sum ? sum / (sleeps?.length || 1) : 0),
        point: aap,
        start: (user.sleepTempTime || 0),
        end: date
      });

      // 画像をgeneralに送信
      await general.send(
        `https://sleep.ahoaho.jp/image/${uuid}.png`
      );

      // ユーザの寝てるステータスをDBに反映
      userRepository?.update(
        {discordId: userId},
        {nowSleeping: false}
      );
    }
  }

  // ボットのボタンを二つ用意するメソッド
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

  // IDから名前取るメソッド
  getNameFromID(id: string) {
    let g = this.client.guilds.cache.get(GUILD_ID);
    let nickName = g?.members.cache.get(id)?.nickname?.replace("@", "＠");
    if (!nickName) nickName = g?.members.cache.get(id)?.displayName;
    return nickName;
  }

  // ああポイント計算メソッド
  calcAAPoint(time: number): number {
    const hour = Math.ceil(time / (1000 * 60 * 60));
    if (0 <= hour && hour < 5) {
      return 0;
    } else if (5 <= hour && hour < 13) {
        if (8 == hour) {
          if (6 <= new Date().getHours() && new Date().getHours() <= 8) {
            return 24;
          } else {
            return 16;
          }
        }else {
          if (6 <= new Date().getHours() && new Date().getHours() <= 8){
            return 20;
          } else {
            return 12;}
        }
    } else if (13 <= hour && hour < 18) {
      return 8;
    } else {
      return 4;
    }
  }

  // データベースつなぐ
  async connectDB() {
    this.connection = await createConnection(options);
    await this.connection.query("PRAGMA foreign_keys=OFF");
    await this.connection.synchronize();
    await this.connection.query("PRAGMA foreign_keys=ON");
  }

}
