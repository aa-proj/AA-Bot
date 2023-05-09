import {AppBase} from "../appBase";
import {CacheType, Client, GuildMember, Interaction, VoiceState} from "discord.js";
import {GUILD_ID} from "../../main";
import {Connection, ConnectionOptions, createConnection} from "typeorm";
import {NickNameLog} from "./entity/nickname";
import {sendMoneyById} from "../../lib/aabank";

// TypeORMのオプション
const options: ConnectionOptions = {
  type: "sqlite",
  database: "./assets/nickname/db/db.sqlite3",
  entities: [NickNameLog],
  synchronize: false
};


export class NickName extends AppBase {

  // TypeORMのコネクション 使う前にnullチェックが必要
  connection: Connection | null = null;



  constructor(props: Client) {
    super(props);
    this.appName = "NickName"
    this.commands = [
      {
        name: 'rename',
        description: 'AAPを使って他人のニックネームを編集します。',
        options: [
          {
            name: "targetuser",
            required: true,
            description: "対象ユーザ",
            type: 6
          },
          {
            name: "name",
            required: true,
            description: "ニックネーム",
          }
        ]
      }
    ]

    this.connectDB()
  }

  private async intervalTask(){
    const nicknameRepo = this.connection?.getRepository(NickNameLog)
    if (!nicknameRepo) return

    const beforeExpire = await nicknameRepo?.find({where: {isExpired: false}})

  }

  override async onInteractionCreate(interaction: Interaction<CacheType>) {
    if(!interaction.inGuild()) return

    if (interaction.isCommand()) {
      const nicknameRepo = this.connection?.getRepository(NickNameLog)
      if (!nicknameRepo) return

      if (interaction.commandName === "namae") {
        const targetUser = interaction.options.getMember("targetuser") as GuildMember
        const name = interaction.options.get("name")?.value as string

        if (!targetUser || !name) {
          await interaction.reply({content: "エラーが発生しました。", ephemeral: true})
          return
        }
        const guild = await this.client.guilds.fetch(GUILD_ID);

        if(!targetUser){
          await interaction.reply({content: "エラーが発生しました。", ephemeral: true})
          return
        }

        const member = await guild.members.fetch(targetUser.id);
        if (!member) return

        const log = await nicknameRepo?.findOne({where: {userId: member.id, isExpired: false}})
        if(log){
          await interaction.reply({content: "既にニックネームを変更しています。"})
          return
        }

        const newLog = nicknameRepo?.create({
          userId: member.id,
          payUserId: interaction.user.id,
          nickname: name,
          beforeNickname: member.nickname,
          createAt: new Date().getTime(),
          isExpired: false
        })
        await nicknameRepo?.save(newLog)
        await member.setNickname(name)
        await sendMoneyById(interaction.user.id, member.user.id,200, "ニックネーム変更")
        await interaction.reply({content: `${interaction.user.username}は200ああPを払って${member.user.username}のニックネームを${targetUser.nickname}に変更しました。`})
      }
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
