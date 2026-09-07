import {
    SlashCommandBuilder,
    PermissionFlagsBits,
} from 'discord.js';

import {
    setAntiLinkEnabled,
    setAntiLinkPunishment,
    getAntiLinkConfig,
} from '../../services/antiLinkService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('antilink')
        .setDescription('Configure anti-link protection')
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('enable')
                .setDescription('Enable anti-link protection')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Disable anti-link protection')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Show anti-link settings')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('punishment')
                .setDescription('Set the anti-link punishment')
                .addStringOption(option =>
                    option
                        .setName('type')
                        .setDescription('Punishment to use')
                        .setRequired(true)
                        .addChoices(
                            {
                                name: 'Delete',
                                value: 'delete',
                            },
                            {
                                name: 'Warn',
                                value: 'warn',
                            },
                            {
                                name: 'Kick',
                                value: 'kick',
                            },
                            {
                                name: 'Ban',
                                value: 'ban',
                            },
                        )
                )
        ),

    category: 'moderation',

    async execute(interaction) {
        const subcommand =
            interaction.options.getSubcommand();

        const guildId = interaction.guildId;

        if (subcommand === 'enable') {
            setAntiLinkEnabled(guildId, true);

            return interaction.reply({
                content:
                    '🛡️ Anti-Link protection is now **enabled**.',
                ephemeral: true,
            });
        }

        if (subcommand === 'disable') {
            setAntiLinkEnabled(guildId, false);

            return interaction.reply({
                content:
                    '⚠️ Anti-Link protection is now **disabled**.',
                ephemeral: true,
            });
        }

        if (subcommand === 'punishment') {
            const punishment =
                interaction.options.getString('type');

            setAntiLinkPunishment(
                guildId,
                punishment
            );

            return interaction.reply({
                content:
                    `✅ Anti-Link punishment set to **${punishment}**.`,
                ephemeral: true,
            });
        }

        const settings =
            getAntiLinkConfig(guildId);

        return interaction.reply({
            content:
                `🛡️ **Anti-Link Status**\n\n` +
                `Status: **${settings.enabled ? 'Enabled' : 'Disabled'}**\n` +
                `Punishment: **${settings.punishment}**`,
            ephemeral: true,
        });
    },
};
