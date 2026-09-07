import {
    SlashCommandBuilder,
    PermissionFlagsBits,
} from 'discord.js';

import { updateGuildConfig } from '../../services/config/guildConfig.js';

export default {
    data: new SlashCommandBuilder()
        .setName('setprefix')
        .setDescription('Change the server prefix')
        .addStringOption(option =>
            option
                .setName('prefix')
                .setDescription('New prefix, for example ? or $')
                .setRequired(true)
                .setMaxLength(5)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    category: 'core',

    async execute(interaction, config, client) {
        const prefix = interaction.options.getString('prefix')?.trim();

        if (!prefix) {
            return interaction.reply({
                content: '❌ You must provide a prefix.',
                ephemeral: true,
            });
        }

        await updateGuildConfig(
            client,
            interaction.guildId,
            { prefix }
        );

        await interaction.reply({
            content: `✅ Prefix changed to \`${prefix}\``,
            ephemeral: true,
        });
    },

    async prefixExecute(interaction, guildConfig, client) {
        const prefix = interaction.options.getString('prefix')?.trim();

        if (!prefix) {
            return interaction.reply({
                content: '❌ You must provide a prefix.',
            });
        }

        await updateGuildConfig(
            client,
            interaction.guildId,
            { prefix }
        );

        await interaction.reply({
            content: `✅ Prefix changed to \`${prefix}\``,
        });
    },
};
