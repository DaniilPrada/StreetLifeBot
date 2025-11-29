// db.js
// Simple SQLite wrapper for protected categories/channels

const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Path to DB file (same folder as index.js)
const dbPath = path.join(__dirname, "data.db");
const db = new sqlite3.Database(dbPath);

// Initialize tables
function initDb() {
    db.serialize(() => {
        db.run(
            `CREATE TABLE IF NOT EXISTS protected_categories (
                guild_id TEXT NOT NULL,
                category_id TEXT NOT NULL,
                PRIMARY KEY (guild_id, category_id)
            )`
        );

        db.run(
            `CREATE TABLE IF NOT EXISTS protected_channels (
                guild_id TEXT NOT NULL,
                channel_id TEXT NOT NULL,
                PRIMARY KEY (guild_id, channel_id)
            )`
        );
    });
}

// Helpers: Promisified queries

function getProtectedCategoryIds(guildId) {
    return new Promise((resolve, reject) => {
        db.all(
            "SELECT category_id FROM protected_categories WHERE guild_id = ?",
            [guildId],
            (err, rows) => {
                if (err) return reject(err);
                resolve(rows.map((r) => r.category_id));
            }
        );
    });
}

function getProtectedChannelIds(guildId) {
    return new Promise((resolve, reject) => {
        db.all(
            "SELECT channel_id FROM protected_channels WHERE guild_id = ?",
            [guildId],
            (err, rows) => {
                if (err) return reject(err);
                resolve(rows.map((r) => r.channel_id));
            }
        );
    });
}

function addProtectedCategory(guildId, categoryId) {
    return new Promise((resolve, reject) => {
        db.run(
            "INSERT OR IGNORE INTO protected_categories (guild_id, category_id) VALUES (?, ?)",
            [guildId, categoryId],
            (err) => {
                if (err) return reject(err);
                resolve();
            }
        );
    });
}

function removeProtectedCategory(guildId, categoryId) {
    return new Promise((resolve, reject) => {
        db.run(
            "DELETE FROM protected_categories WHERE guild_id = ? AND category_id = ?",
            [guildId, categoryId],
            (err) => {
                if (err) return reject(err);
                resolve();
            }
        );
    });
}

function addProtectedChannel(guildId, channelId) {
    return new Promise((resolve, reject) => {
        db.run(
            "INSERT OR IGNORE INTO protected_channels (guild_id, channel_id) VALUES (?, ?)",
            [guildId, channelId],
            (err) => {
                if (err) return reject(err);
                resolve();
            }
        );
    });
}

function removeProtectedChannel(guildId, channelId) {
    return new Promise((resolve, reject) => {
        db.run(
            "DELETE FROM protected_channels WHERE guild_id = ? AND channel_id = ?",
            [guildId, channelId],
            (err) => {
                if (err) return reject(err);
                resolve();
            }
        );
    });
}

module.exports = {
    initDb,
    getProtectedCategoryIds,
    getProtectedChannelIds,
    addProtectedCategory,
    removeProtectedCategory,
    addProtectedChannel,
    removeProtectedChannel
};
