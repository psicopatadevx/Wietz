import {
    SlashCommandBuilder,
    PermissionFlagsBits,
} from 'discord.js';

import {
    getGuildConfig,
    updateGuildConfig,
} from '../../services/config/guildConfig.js';

export default {
    data: new SlashCommandBuilder()
        .setName('setprefix')
        .setDescription('Change the server prefix')
        .addStringOption(option =>
            option
                .setName('prefix')
                .setDescription('The new prefix')
                .setRequired(true)
                .setMaxLength(5),
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator,
        ),

    category: 'core',

    async execute(interaction, config, client) {
        const newPrefix = interaction.options
            .getString('prefix')
            .trim();

        if (!newPrefix) {
            return interaction.reply({
                content: '❌ Prefix cannot be empty.',
                ephemeral: true,
            });
        }

        await updateGuildConfig(
            client,
            interaction.guildId,
            { prefix: newPrefix },
        );

        await interaction.reply({
            content: `✅ Server prefix changed to \`${newPrefix}\``,
            ephemeral: true,
        });
    },

    async prefixExecute(interaction, guildConfig, client) {
        const newPrefix = interaction.options
            .getString('prefix')
            .trim();

        if (!newPrefix) {
            return interaction.reply({
                content: '❌ Prefix cannot be empty.',
            });
        }

        await updateGuildConfig(
            client,
            interaction.guildId,
            { prefix: newPrefix },
        );

        await interaction.reply({
            content: `✅ Server prefix changed to \`${newPrefix}\``,
        });
    },
};
