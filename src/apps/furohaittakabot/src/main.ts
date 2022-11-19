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


// const bathReaction = "<:nyuyoku:885703314417807420>";
const bathReactionId = "885703314417807420"
const dailyBotChannel = "803321643803213834";
const generalChannel = "606109479003750442";
const guildID = "606109479003750440";


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

    this.connectDB()
  }

  override onBotReady(arg: Client<true>) {
    this.log("Discord Bot Ready");
  }

  override async onMessageCreate(msg: Message) {
    if (msg.author.bot) return;
    if (!msg.content.startsWith("/bath")) return;
    // 引数をパース
    const args = msg.content.replace(/　+/g, " ").slice(5).trim().split(/ + /);
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
    const furoRepository = this.connection?.getRepository(Furo);
    const user = await userRepository?.findOne({discordId: messageUserId});
    const furoUser = await furoRepository?.findOne({where: {user: user}, order: {time: "DESC"}});
    const furoTime = furoUser?.time

    if (!user) {
      // Userが未登録だった時
      const newUser = userRepository?.create({
        discordId: messageUserId,
      });
      await userRepository?.save(<User>newUser);
    }
    {
      switch (command) {
        case "Furo":
          const furoTransaction = furoRepository?.create({
            time: new Date(),
            user: user,
          });
          furoRepository?.save(<Furo>furoTransaction);
          if (!furoTime) {
            await general.send(
              this.getNameFromID(messageUserId) +
              "は初めてお風呂に入りました"
            );
          } else {
            const aap = this.calcAAPoint((new Date().getTime()) - (new Date(furoTime).getTime()))
            if (aap !== 0) {
              await giveAAPoint(messageUserId, aap)
            }
            await general.send(
              this.getNameFromID(messageUserId) +
              "は" +
              getTimeFromMills((new Date().getTime()) - (new Date(furoTime).getTime()))
              + "ぶりにお風呂に入りました\n"
              + `${aap}ああP付与されました`
            );
          }
          await interaction.reply({content: "OK", ephemeral: true});
          break;
      }
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

  async getNameFromID(id: string) {
    let g = this.client.guilds.cache.get(guildID);
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
      return 12
    } else {
      return 0
    }
  }

}

