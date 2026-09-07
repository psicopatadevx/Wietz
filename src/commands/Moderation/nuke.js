const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("nuke")
    .setDescription("Recreate the current channel.")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageChannels
    ),

  async execute(interaction) {
    if (
      !interaction.memberPermissions.has(
        PermissionFlagsBits.ManageChannels
      )
    ) {
      return interaction.reply({
        content: "❌ You need Manage Channels permission.",
        ephemeral: true,
      });
    }

    const channel = interaction.channel;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("nuke_confirm")
        .setLabel("Confirm")
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId("nuke_cancel")
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary)
    );

    const message = await interaction.reply({
      content:
        `⚠️ **Recreate ${channel}?**\n` +
        `All messages in this channel will be removed.`,
      components: [row],
      fetchReply: true,
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 10000,
    });

    collector.on("collect", async (button) => {
      if (button.user.id !== interaction.user.id) {
        return button.reply({
          content: "❌ Only the command user can confirm this.",
          ephemeral: true,
        });
      }

      if (button.customId === "nuke_cancel") {
        collector.stop("cancelled");

        return button.update({
          content: "✅ Nuke cancelled.",
          components: [],
        });
      }

      if (button.customId === "nuke_confirm") {
        collector.stop("confirmed");

        await button.update({
          content: "💥 Recreating channel...",
          components: [],
        });

        try {
          const newChannel = await channel.clone({
            reason: `Nuke requested by ${interaction.user.tag}`,
          });

          await channel.delete(
            `Nuke requested by ${interaction.user.tag}`
          );

          await newChannel.send(
            `💥 **Channel recreated.**\nRequested by ${interaction.user}.`
          );
        } catch (error) {
          console.error("Nuke error:", error);
        }
      }
    });

    collector.on("end", async (_, reason) => {
      if (reason === "time") {
        try {
          await interaction.editReply({
            content: "⌛ Confirmation expired.",
            components: [],
          });
        } catch {}
      }
    });
  },
};
