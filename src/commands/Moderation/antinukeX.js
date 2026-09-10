// src/antinuke.js
// PrefixByte — Defensive Anti-Nuke System
// discord.js v14
//
// Defensive actions only:
// - Detects rapid channel/role deletions
// - Detects rapid bans/kicks
// - Detects rapid webhook deletions
// - Checks Discord audit logs to identify the executor
// - Supports trusted-user whitelisting
// - Can remove dangerous roles from a suspected executor
//
// Required bot permissions:
// ViewAuditLog
// ModerateMembers
// ManageRoles
// ManageChannels (only if you later add lockdown/recovery)
//
// Required intent:
// Guilds
// GuildMembers (recommended)

const {
  AuditLogEvent,
  PermissionsBitField
} = require("discord.js");

const DEFAULT_CONFIG = {
  enabled: true,

  // Number of matching actions allowed during the window.
  thresholds: {
    channelDelete: 3,
    roleDelete: 3,
    ban: 5,
    kick: 5,
    webhookDelete: 3
  },

  // Detection window in milliseconds.
  windowMs: 10_000,

  // How long the executor should be timed out.
  timeoutMs: 10 * 60 * 1000,

  // Remove dangerous roles from the executor.
  stripDangerousRoles: true,

  // Role IDs that should never be removed.
  protectedRoleIds: [],

  // User IDs that are trusted and won't trigger punishment.
  trustedUsers: [],

  // Bot/user IDs that should never be punished.
  ignoredUsers: [],

  // Log detections to a channel.
  logChannelId: null
};

const ACTIONS = {
  channelDelete: AuditLogEvent.ChannelDelete,
  roleDelete: AuditLogEvent.RoleDelete,
  ban: AuditLogEvent.MemberBanAdd,
  kick: AuditLogEvent.MemberKick,
  webhookDelete: AuditLogEvent.WebhookDelete
};

function createAntiNuke(guild, customConfig = {}) {
  const config = {
    ...DEFAULT_CONFIG,
    ...customConfig,
    thresholds: {
      ...DEFAULT_CONFIG.thresholds,
      ...(customConfig.thresholds || {})
    }
  };

  // action -> Map<executorId, timestamps[]>
  const activity = new Map();

  function getActionMap(action) {
    if (!activity.has(action)) {
      activity.set(action, new Map());
    }

    return activity.get(action);
  }

  function isIgnored(executorId) {
    return (
      executorId === guild.client.user.id ||
      config.ignoredUsers.includes(executorId) ||
      config.trustedUsers.includes(executorId)
    );
  }

  function recordAction(action, executorId) {
    const map = getActionMap(action);

    if (!map.has(executorId)) {
      map.set(executorId, []);
    }

    const now = Date.now();

    const timestamps = map
      .get(executorId)
      .filter((timestamp) => now - timestamp <= config.windowMs);

    timestamps.push(now);

    map.set(executorId, timestamps);

    return timestamps.length;
  }

  function thresholdReached(action, count) {
    const threshold = config.thresholds[action];

    if (!threshold) {
      return false;
    }

    return count >= threshold;
  }

  async function findExecutor(action) {
    try {
      const logs = await guild.fetchAuditLogs({
        type: ACTIONS[action],
        limit: 5
      });

      const entry = logs.entries.find((entry) => {
        const age = Date.now() - entry.createdTimestamp;

        return age >= 0 && age <= 5000 && entry.executor;
      });

      return entry?.executor || null;
    } catch (error) {
      console.error(
        `[AntiNuke] Failed to fetch audit logs for ${action}:`,
        error
      );

      return null;
    }
  }

  async function getMember(executorId) {
    try {
      return await guild.members.fetch(executorId);
    } catch {
      return null;
    }
  }

  async function stripDangerousRoles(member) {
    if (!member || !config.stripDangerousRoles) {
      return [];
    }

    if (!guild.members.me) {
      return [];
    }

    const removed = [];

    for (const role of member.roles.cache.values()) {
      if (role.id === guild.id) continue;

      if (config.protectedRoleIds.includes(role.id)) {
        continue;
      }

      // Bot cannot remove roles equal to or higher than its highest role.
      if (
        role.position >= guild.members.me.roles.highest.position
      ) {
        continue;
      }

      try {
        await member.roles.remove(
          role,
          "PrefixByte Anti-Nuke: suspicious destructive activity"
        );

        removed.push(role.id);
      } catch (error) {
        console.error(
          `[AntiNuke] Could not remove role ${role.name}:`,
          error.message
        );
      }
    }

    return removed;
  }

  async function timeoutExecutor(member) {
    if (!member) return false;

    if (!guild.members.me?.permissions.has(
      PermissionsBitField.Flags.ModerateMembers
    )) {
      console.warn(
        "[AntiNuke] Missing ModerateMembers permission."
      );

      return false;
    }

    if (!member.moderatable) {
      console.warn(
        `[AntiNuke] Cannot timeout ${member.user.tag}.`
      );

      return false;
    }

    try {
      await member.timeout(
        config.timeoutMs,
        "PrefixByte Anti-Nuke: suspicious destructive activity"
      );

      return true;
    } catch (error) {
      console.error(
        `[AntiNuke] Failed to timeout ${member.user.tag}:`,
        error.message
      );

      return false;
    }
  }

  async function sendLog(action, executor, count, result) {
    if (!config.logChannelId) return;

    try {
      const channel = await guild.channels.fetch(
        config.logChannelId
      );

      if (!channel || !channel.isTextBased()) {
        return;
      }

      const removedCount = result.removedRoles?.length || 0;

      await channel.send({
        embeds: [
          {
            title: "🚨 Anti-Nuke Detection",
            description:
              `Suspicious activity was detected and defensive action was taken.`,
            fields: [
              {
                name: "Action",
                value: action,
                inline: true
              },
              {
                name: "Executor",
                value: `${executor.tag} (${executor.id})`,
                inline: true
              },
              {
                name: "Detected Actions",
                value: String(count),
                inline: true
              },
              {
                name: "Timed Out",
                value: result.timedOut ? "Yes" : "No",
                inline: true
              },
              {
                name: "Roles Removed",
                value: String(removedCount),
                inline: true
              }
            ],
            timestamp: new Date().toISOString()
          }
        ]
      });
    } catch (error) {
      console.error(
        "[AntiNuke] Failed to send log:",
        error.message
      );
    }
  }

  async function respond(action, executorId, count) {
    if (isIgnored(executorId)) {
      return;
    }

    const executor = await getMember(executorId);

    if (!executor) {
      console.warn(
        `[AntiNuke] Could not fetch executor ${executorId}.`
      );

      return;
    }

    const result = {
      timedOut: false,
      removedRoles: []
    };

    // Defensive response only.
    result.timedOut = await timeoutExecutor(executor);

    result.removedRoles =
      await stripDangerousRoles(executor);

    await sendLog(
      action,
      executor.user,
      count,
      result
    );
  }

  async function handle(action) {
    if (!config.enabled) return;

    if (!ACTIONS[action]) {
      throw new Error(`Unknown Anti-Nuke action: ${action}`);
    }

    const executor = await findExecutor(action);

    if (!executor) {
      return;
    }

    if (isIgnored(executor.id)) {
      return;
    }

    const count = recordAction(
      action,
      executor.id
    );

    if (!thresholdReached(action, count)) {
      return;
    }

    await respond(
      action,
      executor.id,
      count
    );

    // Reset after triggering so the same burst doesn't
    // repeatedly punish the executor.
    const map = getActionMap(action);
    map.delete(executor.id);
  }

  function cleanup() {
    const now = Date.now();

    for (const map of activity.values()) {
      for (const [executorId, timestamps] of map) {
        const fresh = timestamps.filter(
          (timestamp) =>
            now - timestamp <= config.windowMs
        );

        if (fresh.length === 0) {
          map.delete(executorId);
        } else {
          map.set(executorId, fresh);
        }
      }
    }
  }

  const cleanupTimer = setInterval(
    cleanup,
    config.windowMs
  );

  // Prevent the interval from keeping Node alive unnecessarily.
  cleanupTimer.unref?.();

  return {
    config,

    async handle(action) {
      return handle(action);
    },

    stop() {
      clearInterval(cleanupTimer);
      activity.clear();
    },

    addTrustedUser(userId) {
      if (!config.trustedUsers.includes(userId)) {
        config.trustedUsers.push(userId);
      }
    },

    removeTrustedUser(userId) {
      config.trustedUsers =
        config.trustedUsers.filter(
          (id) => id !== userId
        );
    },

    isTrusted(userId) {
      return (
        config.trustedUsers.includes(userId) ||
        config.ignoredUsers.includes(userId)
      );
    }
  };
}

module.exports = {
  createAntiNuke,
  DEFAULT_CONFIG,
  ACTIONS
};
