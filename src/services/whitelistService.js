import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'whitelist.json');

const DEFAULT_CONFIG = {
    users: [],
    roles: [],
};

function loadData() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            return {};
        }

        return JSON.parse(
            fs.readFileSync(DATA_FILE, 'utf8')
        );
    } catch (error) {
        console.error('[WHITELIST] Failed to load:', error);
        return {};
    }
}

function saveData(data) {
    fs.mkdirSync(DATA_DIR, { recursive: true });

    fs.writeFileSync(
        DATA_FILE,
        JSON.stringify(data, null, 2)
    );
}

export function getWhitelist(guildId) {
    const data = loadData();

    return {
        ...DEFAULT_CONFIG,
        ...(data[guildId] || {}),
        users: [...(data[guildId]?.users || [])],
        roles: [...(data[guildId]?.roles || [])],
    };
}

function saveGuild(guildId, config) {
    const data = loadData();

    data[guildId] = {
        users: [...new Set(config.users)],
        roles: [...new Set(config.roles)],
    };

    saveData(data);

    return data[guildId];
}

export function addUser(guildId, userId) {
    const config = getWhitelist(guildId);

    if (!config.users.includes(userId)) {
        config.users.push(userId);
    }

    return saveGuild(guildId, config);
}

export function removeUser(guildId, userId) {
    const config = getWhitelist(guildId);

    config.users = config.users.filter(
        id => id !== userId
    );

    return saveGuild(guildId, config);
}

export function addRole(guildId, roleId) {
    const config = getWhitelist(guildId);

    if (!config.roles.includes(roleId)) {
        config.roles.push(roleId);
    }

    return saveGuild(guildId, config);
}

export function removeRole(guildId, roleId) {
    const config = getWhitelist(guildId);

    config.roles = config.roles.filter(
        id => id !== roleId
    );

    return saveGuild(guildId, config);
}

export function clearWhitelist(guildId) {
    return saveGuild(guildId, {
        users: [],
        roles: [],
    });
}

export function isWhitelisted(member) {
    if (!member) return false;

    const config = getWhitelist(member.guild.id);

    if (config.users.includes(member.id)) {
        return true;
    }

    return member.roles.cache.some(role =>
        config.roles.includes(role.id)
    );
}
