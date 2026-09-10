require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits
} = require("discord.js");

const { createAntiNuke } = require("./antinuke");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// One Anti-Nuke system per server
const antiNuke = new Map();

// ─────────────────────────────────────────────
// SLASH COMMANDS
// ─────────────────────────────────────────────

const commands = [
  new SlashCommandBuilder()
    .setName("antinuke")
    .setDescription("Manage PrefixByte's defensive Anti-Nuke system")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild.toString()
    )
    .addSubcommand(sub =>
      sub
        .setName("enable")
        .setDescription("Enable Anti-Nuke protection")
    )
    .addSubcommand(sub =>
      sub
        .setName("disable")
        .setDescription("Disable Anti-Nuke protection")
    )
    .addSubcommand(sub =>
      sub
        .setName("status")
        .setDescription("Show Anti-Nuke status")
    )
    .addSubcommand(sub =>
      sub
        .setName("whitelist")
        .setDescription("Whitelist a user")
        .addUserOption(option =>
          option
            .setName("user")
            .setDescription("User to whitelist")
            .setRequired(true)
        )
    )
].map(command => command.toJSON());

// ─────────────────────────────────────────────
// REGISTER COMMANDS
// ─────────────────────────────────────────────

async function registerCommands() {
  const rest = new REST({ version: "10" })
    .setToken(process.env.DISCORD_TOKEN);

  try {
    console.log("Registering slash commands...");

    await rest.put(
      Routes.applicationCommands(client.user.id),
      {
        body: commands
      }
    );

    console.log("Slash commands registered successfully.");
  } catch (error) {
    console.error("Failed to register slash commands:", error);
  }
}

// ─────────────────────────────────────────────
// READY
// ─────────────────────────────────────────────

client.once(Events.ClientReady, async bot => {
  console.log(`PrefixByte online as ${bot.user.tag}`);
  console.log(`Servers: ${bot.guilds.cache.size}`);

  // Create Anti-Nuke system for every server
  for (const guild of bot.guilds.cache.values()) {
    antiNuke.set(
      guild.id,
      createAntiNuke(guild, {
        enabled: true,

        // Server owner is trusted by default.
        trustedUsers: [
          guild.ownerId
        ],

        // Optional log channel.
        // Put a channel ID here if you want detection logs.
        logChannelId: null,

        thresholds: {
          channelDelete: 3,
          roleDelete: 3,
          ban: 5,
          kick: 5,
          webhookDelete: 3
        },

        windowMs: 10_000
      })
    );
  }

  await registerCommands();
});

// ─────────────────────────────────────────────
// NEW SERVER
// ─────────────────────────────────────────────

client.on(Events.GuildCreate, guild => {
  if (antiNuke.has(guild.id)) return;

  antiNuke.set(
    guild.id,
    createAntiNuke(guild, {
      enabled: true,
      trustedUsers: [
        guild.ownerId
      ]
    })
  );

  console.log(`Added Anti-Nuke protection to ${guild.name}`);
});

// ─────────────────────────────────────────────
// SLASH COMMAND HANDLER
// ─────────────────────────────────────────────

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName !== "antinuke") {
    return;
  }

  const guild = interaction.guild;

  if (!guild) {
    return interaction.reply({
      content: "❌ This command can only be used inside a server.",
      ephemeral: true
    });
  }

  if (
    !interaction.memberPermissions.has(
      PermissionFlagsBits.ManageGuild
    )
  ) {
    return interaction.reply({
      content: "❌ You need **Manage Server** permission.",
      ephemeral: true
    });
  }

  let system = antiNuke.get(guild.id);

  if (!system) {
    system = createAntiNuke(guild, {
      enabled: true,
      trustedUsers: [
        guild.ownerId
      ]
    });

    antiNuke.set(guild.id, system);
  }

  const subcommand = interaction.options.getSubcommand();

  // ENABLE
  if (subcommand === "enable") {
    system.config.enabled = true;

    return interaction.reply({
      content: "🛡️ **Anti-Nuke enabled.**",
      ephemeral: true
    });
  }

  // DISABLE
  if (subcommand === "disable") {
    system.config.enabled = false;

    return interaction.reply({
      content: "⚠️ **Anti-Nuke disabled.**",
      ephemeral: true
    });
  }

  // STATUS
  if (subcommand === "status") {
    const status = system.config.enabled
      ? "🟢 Enabled"
      : "🔴 Disabled";

    return interaction.reply({
      content:
        `🛡️ **PrefixByte Anti-Nuke**\n\n` +
        `Status: ${status}\n` +
        `Channel deletion limit: ${system.config.thresholds.channelDelete}\n` +
        `Role deletion limit: ${system.config.thresholds.roleDelete}\n` +
        `Ban limit: ${system.config.thresholds.ban}\n` +
        `Kick limit: ${system.config.thresholds.kick}\n` +
        `Webhook deletion limit: ${system.config.thresholds.webhookDelete}\n` +
        `Detection window: ${system.config.windowMs / 1000}s`,
      ephemeral: true
    });
  }

  // WHITELIST
  if (subcommand === "whitelist") {
    const user = interaction.options.getUser("user");

    system.addTrustedUser(user.id);

    return interaction.reply({
      content:
        `✅ ${user} has been added to the Anti-Nuke whitelist.`,
      ephemeral: true
    });
  }
});

// ─────────────────────────────────────────────
// DEFENSIVE EVENT MONITORING
// ─────────────────────────────────────────────

// Channel deletion
client.on(Events.ChannelDelete, async channel => {
  if (!channel.guild) return;

  const system = antiNuke.get(channel.guild.id);

  if (system) {
    await system.handle("channelDelete");
  }
});

// Role deletion
client.on(Events.RoleDelete, async role => {
  const system = antiNuke.get(role.guild.id);

  if (system) {
    await system.handle("roleDelete");
  }
});

// Ban detection
client.on(Events.GuildBanAdd, async ban => {
  const system = antiNuke.get(ban.guild.id);

  if (system) {
    await system.handle("ban");
  }
});

// Kick detection
client.on(Events.GuildMemberRemove, async member => {
  const system = antiNuke.get(member.guild.id);

  if (system) {
    await system.handle("kick");
  }
});

// Webhook changes
client.on(Events.WebhooksUpdate, async channel => {
  const system = antiNuke.get(channel.guild.id);

  if (system) {
    await system.handle("webhookDelete");
  }
});

// ─────────────────────────────────────────────
// ERROR HANDLING
// ─────────────────────────────────────────────

client.on(Events.Error, error => {
  console.error("Discord client error:", error);
});

process.on("unhandledRejection", error => {
  console.error("Unhandled promise rejection:", error);
});

process.on("uncaughtException", error => {
  console.error("Uncaught exception:", error);
});

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────

if (!process.env.DISCORD_TOKEN) {
  console.error(
    "❌ DISCORD_TOKEN is missing from Railway environment variables."
  );

  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
