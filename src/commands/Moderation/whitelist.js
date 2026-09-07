import {
    SlashCommandBuilder,
    PermissionFlagsBits,
} from 'discord.js';

import {
    getWhitelist,
    addUser,
    removeUser,
    addRole,
    removeRole,
    clearWhitelist,
    isWhitelisted,
} from '../../services/whitelistService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('whitelist')
        .setDescription('Manage the server whitelist')
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        )

        .addSubcommand(sub =>
            sub
                .setName('add')
                .setDescription('Whitelist a user')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('User to whitelist')
                        .setRequired(true)
                )
        )

        .addSubcommand(sub =>
            sub
                .setName('remove')
                .setDescription('Remove a whitelisted user')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('User to remove')
                        .setRequired(true)
                )
        )

        .addSubcommand(sub =>
            sub
                .setName('addrole')
                .setDescription('Whitelist a role')
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('Role to whitelist')
                        .setRequired(true)
                )
        )

        .addSubcommand(sub =>
            sub
                .setName('removerole')
                .setDescription('Remove a whitelisted role')
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('Role to remove')
                        .setRequired(true)
                )
        )

        .addSubcommand(sub =>
            sub
                .setName('list')
                .setDescription('Show the whitelist')
        )

        .addSubcommand(sub =>
            sub
                .setName('check')
                .setDescription('Check whether a user is whitelisted')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('User to check')
                        .setRequired(true)
                )
        )

        .addSubcommand(sub =>
            sub
                .setName('clear')
                .setDescription('Clear the entire whitelist')
        ),

    category: 'moderation',

    async execute(interaction) {
        const subcommand =
            interaction.options.getSubcommand();

        const guildId = interaction.guildId;

        if (subcommand === 'add') {
            const user =
                interaction.options.getUser('user');

            addUser(guildId, user.id);

            return interaction.reply({
                content:
                    `✅ ${user} has been added to the whitelist.`,
                ephemeral: true,
            });
        }

        if (subcommand === 'remove') {
            const user =
                interaction.options.getUser('user');

            removeUser(guildId, user.id);

            return interaction.reply({
                content:
                    `✅ ${user} has been removed from the whitelist.`,
                ephemeral: true,
            });
        }

        if (subcommand === 'addrole') {
            const role =
                interaction.options.getRole('role');

            addRole(guildId, role.id);

            return interaction.reply({
                content:
                    `✅ ${role} has been added to the whitelist.`,
                ephemeral: true,
            });
        }

        if (subcommand === 'removerole') {
            const role =
                interaction.options.getRole('role');

            removeRole(guildId, role.id);

            return interaction.reply({
                content:
                    `✅ ${role} has been removed from the whitelist.`,
                ephemeral: true,
            });
        }

        if (subcommand === 'check') {
            const user =
                interaction.options.getUser('user');

            const member =
                await interaction.guild.members
                    .fetch(user.id)
                    .catch(() => null);

            const status =
                member && isWhitelisted(member);

            return interaction.reply({
                content:
                    `${status ? '✅' : '❌'} ${user} is **${
                        status ? 'whitelisted' : 'not whitelisted'
                    }**.`,
                ephemeral: true,
            });
        }

        if (subcommand === 'clear') {
            clearWhitelist(guildId);

            return interaction.reply({
                content:
                    '🗑️ The entire server whitelist has been cleared.',
                ephemeral: true,
            });
        }

        if (subcommand === 'list') {
            const whitelist =
                getWhitelist(guildId);

            const users = whitelist.users.length
                ? whitelist.users
                      .map(id => `<@${id}>`)
                      .join(', ')
                : 'None';

            const roles = whitelist.roles.length
                ? whitelist.roles
                      .map(id => `<@&${id}>`)
                      .join(', ')
                : 'None';

            return interaction.reply({
                content:
                    `🛡️ **Server Whitelist**\n\n` +
                    `**Users:**\n${users}\n\n` +
                    `**Roles:**\n${roles}`,
                ephemeral: true,
            });
        }
    },
};
