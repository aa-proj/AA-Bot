import {AppBase} from "../appBase";
import {CacheType, Client, GuildMember, Interaction, VoiceState} from "discord.js";
import {GUILD_ID} from "../../main";


export class NickName extends AppBase {

  voiceChannelMap: Map<string, string>

  constructor(props: Client) {
    super(props);
    this.appName = "NickName"
    this.commands = [
      {
        name: 'namae',
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
    this.voiceChannelMap = new Map()
  }

  override async onInteractionCreate(interaction: Interaction<CacheType>) {
    if(!interaction.inGuild()) return

    if (interaction.isCommand()) {
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
        await member.setNickname(name)
      }
    }
  }
}
