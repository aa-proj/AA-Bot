import {AppBase} from "../appBase";
import {CacheType, Client, GuildMember, Interaction, VoiceState} from "discord.js";


export class VCName extends AppBase {

  voiceChannelMap: Map<string, string>

  constructor(props: Client) {
    super(props);
    this.appName = "VCName"
    this.commands = [
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
    ]
    this.voiceChannelMap = new Map()
  }

  override async onInteractionCreate(interaction: Interaction<CacheType>) {
    if (!interaction.isCommand()) return
    if (interaction.commandName !== "vc") return
    if (!interaction.inGuild()) return

    const voiceChannel = (<GuildMember>interaction.member).voice.channel

    if (!voiceChannel) {
      await interaction.reply("ボイスチャンネルにいないようです")
      return
    }

    try {
      const name = interaction.options.get("name")?.value?.toString()
      if (!name) {
        await interaction.reply("チャンネル名が不正です")
        return
      }

      if (!this.voiceChannelMap.has(voiceChannel.id)) {
        this.voiceChannelMap.set(voiceChannel.id, voiceChannel.name)
      }

      await interaction.deferReply()
      await voiceChannel.setName(name)
      await interaction.reply({content: "OK", ephemeral: true})
    } catch (e) {
      await interaction.reply("エラーが発生しました(多分変えすぎ)")
      console.error(e)
    }
  }

  override async onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
    if ((newState.channel === null && oldState.channel !== null) || oldState.channel?.members.size === 0) {
      if (!this.voiceChannelMap.has(oldState.channel.id)) return
      try {
        const beforeName = this.voiceChannelMap.get(oldState.channel.id)
        if (!beforeName) return
        await oldState.channel.setName(beforeName)
      } catch (e) {
        this.error("VoiceChannel Name Update Error")
      }
      return
    }
    return
  }
}
