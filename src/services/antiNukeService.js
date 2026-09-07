
import { AuditLogEvent } from 'discord.js';

const config = {
    enabled: true,
    threshold: 3,
    windowMs: 10_000,
    action: 'kick',
};

// Per-guild action tracking
const activity = new Map();

const dangerousActions = new Set([
    AuditLogEvent.ChannelDelete,
    AuditLogEvent.RoleDelete,
    AuditLogEvent.BanAdd,
    AuditLogEvent.Kick,
    AuditLogEvent.BotAdd,
    AuditLogEvent.WebhookDelete,
    AuditLogEvent.WebhookCreate,
    AuditLogEvent.PermissionOverwriteDelete,
    AuditLogEvent.PermissionOverwriteUpdate,
]);

function getGuildActivity(guildId) {
    if (!activity.has(guildId)) {
        activity.set(guildId, new Map());
    }

    return activity.get(guildId);
}

export async function handleAuditLogEntry({ entry, guild }) {
    if (!config.enabled) return;
    if (!entry?.executorId) return;

    const executorId = entry.executorId;
const member = await guild.members
    .fetch(executorId)
    .catch(() => null);

    
    // Never punish the server owner
    if (executorId === guild.ownerId) return;

    // Ignore bots
    if (entry.executor?.bot) return;

    if (!dangerousActions.has(entry.action)) return;

    const guildActivity = getGuildActivity(guild.id);

    if (!guildActivity.has(executorId)) {
        guildActivity.set(executorId, []);
    }

    const actions = guildActivity.get(executorId);
    const now = Date.now();

    // Remove old actions
    const recentActions = actions.filter(
        timestamp => now - timestamp < config.windowMs
    );

    recentActions.push(now);
    guildActivity.set(executorId, recentActions);

    if (recentActions.length < config.threshold) return;

    try {
        const member = await guild.members.fetch(executorId);

        if (!member) return;
        if (!member.kickable) return;

        await member.kick('Anti-Nuke: excessive destructive actions detected');

        console.log(
            `[ANTI-NUKE] Kicked ${member.user.tag} from ${guild.name} after ${recentActions.length} dangerous actions.`
        );

        guildActivity.delete(executorId);
    } catch (error) {
        console.error('[ANTI-NUKE] Failed to punish executor:', error);
    }
}

export function setAntiNukeEnabled(enabled) {
    config.enabled = Boolean(enabled);
}

export function getAntiNukeConfig() {
    return { ...config };
}
