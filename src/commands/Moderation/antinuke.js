import {
    SlashCommandBuilder,
    PermissionFlagsBits,
} from 'discord.js';

import {
    setAntiNukeEnabled,
    getAntiNukeConfig,
} from '../../services/antiNukeService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('antinuke')
        .setDescription('Configure the anti-nuke protection')
        .addStringOption(option =>
            option
                .setName('action')
                .setDescription('Choose an anti-nuke action')
                .setRequired(true)
                .addChoices(
                    { name: 'Enable', value: 'enable' },
                    { name: 'Disable', value: 'disable' },
                    { name: 'Status', value: 'status' },
                ),
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator,
        ),

    category: 'moderation',

    async execute(interaction) {
        const action = interaction.options.getString('action');

        if (action === 'enable') {
            setAntiNukeEnabled(true);

            await interaction.reply({
                content: '🛡️ Anti-nuke protection is now **enabled**.',
                ephemeral: true,
            });

            return;
        }

        if (action === 'disable') {
            setAntiNukeEnabled(false);

            await interaction.reply({
                content: '⚠️ Anti-nuke protection is now **disabled**.',
                ephemeral: true,
            });

            return;
        }

        const settings = getAntiNukeConfig();

        await interaction.reply({
            content:
                `🛡️ **Anti-Nuke Status**\n\n` +
                `Status: **${settings.enabled ? 'Enabled' : 'Disabled'}**\n` +
                `Threshold: **${settings.threshold} actions**\n` +
                `Window: **${settings.windowMs / 1000}s**\n` +
                `Action: **${settings.action}**`,
            ephemeral: true,
        });
    },
};
