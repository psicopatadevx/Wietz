import fs from 'node:fs';
import path from 'node:path';
import { PermissionFlagsBits } from 'discord.js';
import { isWhitelisted } from './whitelistService.js';
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'antilink.json');

const defaults = {
    enabled: false,
    punishment: 'delete',
};

function loadData() {
    try {
        if (!fs.existsSync(DATA_FILE)) return {};

        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (error) {
        console.error('[ANTI-LINK] Failed to load data:', error);
        return {};
    }
}

function saveData(data) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getGuildSettings(guildId) {
    const data = loadData();

    return {
        ...defaults,
        ...(data[guildId] || {}),
    };
}

export function setAntiLinkEnabled(guildId, enabled) {
    const data = loadData();

    data[guildId] ??= { ...defaults };
    data[guildId].enabled = Boolean(enabled);

    saveData(data);

    return data[guildId];
}

export function setAntiLinkPunishment(guildId, punishment) {
    const allowed = ['delete', 'warn', 'kick', 'ban'];
if (isWhitelisted(message.member)) {
    return false;
}
    if (!allowed.includes(punishment)) {
        throw new Error('Invalid anti-link punishment.');
    }

    const data = loadData();

    data[guildId] ??= { ...defaults };
    data[guildId].punishment = punishment;

    saveData(data);

    return data[guildId];
}

export function getAntiLinkConfig(guildId) {
    return getGuildSettings(guildId);
}

export function containsLink(content) {
    if (!content) return false;

    const linkRegex =
        /(?:https?:\/\/|www\.)[^\s<]+/i;

    return linkRegex.test(content);
}

export async function handleAntiLink(message) {
    if (!message?.guild) return false;
    if (!message.content) return false;
    if (message.author?.bot) return false;

    const settings = getGuildSettings(message.guild.id);

    if (!settings.enabled) return false;
    if (!containsLink(message.content)) return false;

    // Administrators are allowed to post links.
    if (
        message.member?.permissions.has(
            PermissionFlagsBits.Administrator
        )
    ) {
        return false;
    }

    const punishment = settings.punishment;

    try {
        if (message.deletable) {
            await message.delete().catch(() => {});
        }

        if (punishment === 'delete') {
            return true;
        }

        if (punishment === 'warn') {
            const warning = await message.channel.send(
                `⚠️ ${message.author}, links aren't allowed here.`
            );

            setTimeout(() => {
                warning.delete().catch(() => {});
            }, 5000);

            return true;
        }

        const member = message.member;

        if (!member) return true;

        if (punishment === 'kick') {
            if (member.kickable) {
                await member.kick(
                    'Anti-Link: posting a prohibited link'
                );
            }

            return true;
        }

        if (punishment === 'ban') {
            if (member.bannable) {
                await member.ban({
                    reason:
                        'Anti-Link: posting a prohibited link',
                });
            }

            return true;
        }

        return true;
    } catch (error) {
        console.error(
            '[ANTI-LINK] Punishment failed:',
            error
        );

        return true;
    }
}
