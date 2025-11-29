// index.js
// Discord moderation bot with warns, mutes, bans and escalation ladder
// Messages to Discord are in Russian

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
} = require("discord.js");

if (!process.env.TOKEN) {
  console.error("❌ Missing TOKEN in .env file");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel, Partials.GuildMember, Partials.Message],
});

const PREFIX = process.env.PREFIX || "!";
const DATA_FILE = path.join(__dirname, "punishments.json");

// -----------------------------------------------------
// Data load / save
// -----------------------------------------------------
let data = { guilds: {} };

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf8");
      data = JSON.parse(raw);
    }
  } catch (err) {
    console.error("Failed to load data file:", err);
    data = { guilds: {} };
  }
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to save data file:", err);
  }
}

loadData();

// Ensure structures exist
function getUserData(guildId, userId) {
  if (!data.guilds[guildId]) {
    data.guilds[guildId] = { users: {} };
  }
  if (!data.guilds[guildId].users[userId]) {
    data.guilds[guildId].users[userId] = {
      warns: [],   // { timestamp, reason, moderatorId, moderatorTag }
      bans: [],    // { timestamp, durationMs, reason, moderatorId, moderatorTag }
      banLevel: 0, // 0 -> 1 day, 1 -> 3 days, etc.
    };
  }
  return data.guilds[guildId].users[userId];
}

// -----------------------------------------------------
// Helpers
// -----------------------------------------------------

// Parse duration like "10m", "2h", "1d", "30s"
function parseDuration(str) {
  if (!str) return null;
  const match = str.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  let ms = 0;
  if (unit === "s") ms = value * 1000;
  if (unit === "m") ms = value * 60 * 1000;
  if (unit === "h") ms = value * 60 * 60 * 1000;
  if (unit === "d") ms = value * 24 * 60 * 60 * 1000;
  return ms;
}

// Format ms to short string
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

// Get or create "Muted" role and configure permissions
async function getOrCreateMutedRole(guild) {
  let mutedRole = guild.roles.cache.find((r) => r.name === "Muted");
  if (!mutedRole) {
    mutedRole = await guild.roles.create({
      name: "Muted",
      color: 0x555555,
      reason: "Auto-created muted role for moderation bot",
    });

    // Deny sending messages / speaking in all channels
    for (const [, channel] of guild.channels.cache) {
      try {
        await channel.permissionOverwrites.edit(mutedRole, {
          SendMessages: false,
          AddReactions: false,
          Speak: false,
          Connect: false,
        });
      } catch (err) {
        console.warn(
          `Failed to set permissions for channel ${channel.id}:`,
          err.message
        );
      }
    }
  }
  return mutedRole;
}

// Check moderator permissions
function isModerator(member) {
  if (!member) return false;
  return (
    member.permissions.has(PermissionsBitField.Flags.KickMembers) ||
    member.permissions.has(PermissionsBitField.Flags.BanMembers) ||
    member.permissions.has(PermissionsBitField.Flags.ModerateMembers) ||
    member.permissions.has(PermissionsBitField.Flags.Administrator)
  );
}

// Remove expired warns (cooldown 4 days)
const WARN_LIFETIME_MS = 4 * 24 * 60 * 60 * 1000;

function cleanupWarns(userData) {
  const now = Date.now();
  userData.warns = userData.warns.filter(
    (w) => now - w.timestamp <= WARN_LIFETIME_MS
  );
}

// -----------------------------------------------------
// Auto escalation on warn
// -----------------------------------------------------

async function applyAutoPunishment(message, member, userData) {
  const guild = message.guild;
  if (!guild) return;

  cleanupWarns(userData);
  const activeWarns = userData.warns.length;

  // Thresholds:
  // 3 warns -> 6h mute
  // 4 warns -> 12h mute
  // 5 warns -> 24h mute
  // 6 warns -> auto ban (1d, 3d, 7d, 14d, 30d)
  if (activeWarns === 3) {
    const durationMs = 6 * 60 * 60 * 1000;
    await autoMute(
      message,
      member,
      durationMs,
      "Набрано 3 активных предупреждения"
    );
  } else if (activeWarns === 4) {
    const durationMs = 12 * 60 * 60 * 1000;
    await autoMute(
      message,
      member,
      durationMs,
      "Набрано 4 активных предупреждения"
    );
  } else if (activeWarns === 5) {
    const durationMs = 24 * 60 * 60 * 1000;
    await autoMute(
      message,
      member,
      durationMs,
      "Набрано 5 активных предупреждений"
    );
  } else if (activeWarns === 6) {
    // Escalating ban ladder
    const banSteps = [1, 3, 7, 14, 30]; // days
    const level = Math.min(userData.banLevel, banSteps.length - 1);
    const days = banSteps[level];
    const durationMs = days * 24 * 60 * 60 * 1000;

    userData.banLevel = Math.min(userData.banLevel + 1, banSteps.length - 1);
    saveData();

    await autoBan(
      message,
      member,
      durationMs,
      `Набрано 6 активных предупреждений (уровень бана ${level + 1}, ${days}d)`
    );
  }
}

async function autoMute(message, member, durationMs, reason) {
  const guild = message.guild;
  if (!guild) return;

  try {
    const mutedRole = await getOrCreateMutedRole(guild);
    await member.roles.add(mutedRole, reason);
    await message.channel.send(
      `🔇 | ${member.user.tag} автоматически получил мут на ${formatDuration(
        durationMs
      )}. Причина: ${reason}`
    );

    setTimeout(async () => {
      try {
        if (member.roles.cache.has(mutedRole.id)) {
          await member.roles.remove(mutedRole, "Auto unmute after duration");
        }
      } catch (err) {
        console.warn("Failed to auto-unmute:", err.message);
      }
    }, durationMs);
  } catch (err) {
    console.error("Auto mute error:", err);
    await message.channel.send(
      "❌ Не удалось выдать автоматический мут (проверьте права/роль)."
    );
  }
}

async function autoBan(message, member, durationMs, reason) {
  const guild = message.guild;
  if (!guild) return;

  try {
    const userId = member.id;
    const tag = member.user.tag;

    const userData = getUserData(guild.id, userId);
    userData.bans.push({
      timestamp: Date.now(),
      durationMs,
      reason,
      moderatorId: message.author.id,
      moderatorTag: message.author.tag,
    });
    saveData();

    await member.ban({ reason });

    await message.channel.send(
      `⛔ | ${tag} автоматически забанен на ${formatDuration(
        durationMs
      )}. Причина: ${reason}`
    );

    setTimeout(async () => {
      try {
        await guild.members.unban(userId, "Auto unban after duration");
      } catch (err) {
        console.warn(
          "Failed to auto-unban (maybe already unbanned):",
          err.message
        );
      }
    }, durationMs);
  } catch (err) {
    console.error("Auto ban error:", err);
    await message.channel.send(
      "❌ Не удалось выдать автоматический бан (проверьте права)."
    );
  }
}

// -----------------------------------------------------
// Bot events
// -----------------------------------------------------

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// Message commands
client.on("messageCreate", async (message) => {
  if (!message.guild) return;
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  const moderator = isModerator(message.member);

  // -------------------------------------------
  // !warn @user <reason>
  // -------------------------------------------
  if (command === "warn") {
    if (!moderator) {
      return message.reply("❌ У вас нет прав для этой команды.");
    }

    const target =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]);

    if (!target) {
      return message.reply(
        "❗ Использование: `!warn @User <причина>`"
      );
    }

    if (target.id === message.author.id) {
      return message.reply("❌ Нельзя выдать предупреждение самому себе.");
    }

    args.shift(); // remove mention/id from args
    const reason = args.join(" ") || "Причина не указана";

    const userData = getUserData(message.guild.id, target.id);
    userData.warns.push({
      timestamp: Date.now(),
      reason,
      moderatorId: message.author.id,
      moderatorTag: message.author.tag,
    });
    cleanupWarns(userData);
    saveData();

    await message.channel.send(
      `⚠️ | Пользователь ${target.user.tag} получил предупреждение. Причина: ${reason}\n` +
        `Активных предупреждений (за последние 4 дня): ${userData.warns.length}`
    );

    await applyAutoPunishment(message, target, userData);
    return;
  }

  // -------------------------------------------
  // !unwarn @user <number>
  // -------------------------------------------
  if (command === "unwarn") {
    if (!moderator) {
      return message.reply("❌ У вас нет прав для этой команды.");
    }

    const target =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]);

    if (!target) {
      return message.reply(
        "❗ Использование: `!unwarn @User <номер>`"
      );
    }

    args.shift(); // remove user
    const warnNumber = parseInt(args.shift(), 10);

    if (!warnNumber || warnNumber < 1) {
      return message.reply("❗ Укажите корректный номер предупреждения.");
    }

    const userData = getUserData(message.guild.id, target.id);
    cleanupWarns(userData);

    if (warnNumber > userData.warns.length) {
      return message.reply("❗ Предупреждения с таким номером не существует.");
    }

    const removed = userData.warns.splice(warnNumber - 1, 1)[0];
    saveData();

    await message.channel.send(
      `🗑️ | У пользователя ${target.user.tag} удалено предупреждение №${warnNumber}.`
    );
    return;
  }

  // -------------------------------------------
  // !clearwarns @user
  // -------------------------------------------
  if (command === "clearwarns") {
    if (!moderator) {
      return message.reply("❌ У вас нет прав для этой команды.");
    }

    const target =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]);

    if (!target) {
      return message.reply(
        "❗ Использование: `!clearwarns @User`"
      );
    }

    const userData = getUserData(message.guild.id, target.id);
    userData.warns = [];
    saveData();

    await message.channel.send(
      `🧹 | Все предупреждения пользователя ${target.user.tag} были очищены.`
    );
    return;
  }

  // -------------------------------------------
  // !warns @user  (check warns)
  // -------------------------------------------
  if (command === "warns") {
    if (!moderator) {
      return message.reply("❌ У вас нет прав для этой команды.");
    }

    const target =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]);

    if (!target) {
      return message.reply(
        "❗ Использование: `!warns @User`"
      );
    }

    const userData = getUserData(message.guild.id, target.id);
    cleanupWarns(userData);
    saveData();

    if (userData.warns.length === 0) {
      return message.channel.send(
        `ℹ️ | У пользователя ${target.user.tag} нет активных предупреждений (последние 4 дня).`
      );
    }

    const list = userData.warns
      .map((w, i) => {
        const date = new Date(w.timestamp).toLocaleString();
        const mod = w.moderatorTag || w.moderatorId || "Неизвестно";
        return `${i + 1}. ${w.reason} – ${date} (модератор: ${mod})`;
      })
      .join("\n");

    await message.channel.send(
      `⚠️ Активные предупреждения пользователя ${target.user.tag} (последние 4 дня):\n${list}`
    );
    return;
  }

  // -------------------------------------------
  // !mute @user <duration> <reason>
  // -------------------------------------------
  if (command === "mute") {
    if (!moderator) {
      return message.reply("❌ У вас нет прав для этой команды.");
    }

    const target =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]);
    if (!target) {
      return message.reply(
        "❗ Использование: `!mute @User <время> <причина>`"
      );
    }

    args.shift(); // remove mention/id
    const durationStr = args.shift();
    const durationMs = parseDuration(durationStr);

    if (!durationMs) {
      return message.reply(
        "❗ Некорректное время. Примеры: `10m`, `1h`, `1d`."
      );
    }

    const reason = args.join(" ") || "Причина не указана";

    try {
      const mutedRole = await getOrCreateMutedRole(message.guild);
      await target.roles.add(
        mutedRole,
        `Manual mute for ${formatDuration(durationMs)}: ${reason}`
      );

      await message.channel.send(
        `🔇 | Пользователь ${target.user.tag} получил мут на ${formatDuration(
          durationMs
        )}. Причина: ${reason}`
      );

      setTimeout(async () => {
        try {
          if (target.roles.cache.has(mutedRole.id)) {
            await target.roles.remove(
              mutedRole,
              "Auto unmute after manual mute duration"
            );
          }
        } catch (err) {
          console.warn("Failed to auto-unmute:", err.message);
        }
      }, durationMs);
    } catch (err) {
      console.error("Manual mute error:", err);
      await message.channel.send(
        "❌ Не удалось выдать мут (проверьте права/роль)."
      );
    }
    return;
  }

  // -------------------------------------------
  // !unmute @user
  // -------------------------------------------
  if (command === "unmute") {
    if (!moderator) {
      return message.reply("❌ У вас нет прав для этой команды.");
    }

    const target =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]);
    if (!target) {
      return message.reply(
        "❗ Использование: `!unmute @User`"
      );
    }

    try {
      const mutedRole = await getOrCreateMutedRole(message.guild);
      if (!target.roles.cache.has(mutedRole.id)) {
        return message.reply("❗ У пользователя сейчас нет мута.");
      }
      await target.roles.remove(mutedRole, "Manual unmute");
      await message.channel.send(
        `🔊 | Мут пользователя ${target.user.tag} был снят.`
      );
    } catch (err) {
      console.error("Unmute error:", err);
      await message.channel.send(
        "❌ Не удалось снять мут (проверьте права/роль)."
      );
    }
    return;
  }

  // -------------------------------------------
  // !kick @user <reason>
  // -------------------------------------------
  if (command === "kick") {
    if (!moderator) {
      return message.reply("❌ У вас нет прав для этой команды.");
    }

    const target =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]);
    if (!target) {
      return message.reply(
        "❗ Использование: `!kick @User <причина>`"
      );
    }

    args.shift();
    const reason = args.join(" ") || "Причина не указана";

    try {
      await target.kick(reason);
      await message.channel.send(
        `👢 | Пользователь ${target.user.tag} был кикнут. Причина: ${reason}`
      );
    } catch (err) {
      console.error("Kick error:", err);
      await message.channel.send(
        "❌ Не удалось кикнуть пользователя (проверьте права)."
      );
    }
    return;
  }

  // -------------------------------------------
  // !ban @user <duration> <reason>
  // or: !ban @user <reason>  (permanent)
// -------------------------------------------
  if (command === "ban") {
    if (!moderator) {
      return message.reply("❌ У вас нет прав для этой команды.");
    }

    const targetUser =
      message.mentions.users.first() ||
      (args[0] && await client.users.fetch(args[0]).catch(() => null));

    if (!targetUser) {
      return message.reply(
        "❗ Использование: `!ban @User <время> <причина>` или `!ban @User <причина>` для пермбана."
      );
    }

    args.shift();
    const durationStr = args[0];
    let durationMs = parseDuration(durationStr);
    let reason;

    if (durationMs) {
      args.shift();
      reason = args.join(" ") || "Причина не указана";
    } else {
      durationMs = null;
      reason = args.join(" ") || "Причина не указана";
    }

    try {
      const guildMember = await message.guild.members
        .fetch(targetUser.id)
        .catch(() => null);

      const userData = getUserData(message.guild.id, targetUser.id);
      userData.bans.push({
        timestamp: Date.now(),
        durationMs,
        reason,
        moderatorId: message.author.id,
        moderatorTag: message.author.tag,
      });
      userData.banLevel = Math.min(userData.banLevel + 1, 4);
      saveData();

      await message.guild.members.ban(targetUser.id, { reason });

      if (durationMs) {
        await message.channel.send(
          `⛔ | Пользователь ${targetUser.tag} забанен на ${formatDuration(
            durationMs
          )}. Причина: ${reason}`
        );

        setTimeout(async () => {
          try {
            await message.guild.members.unban(
              targetUser.id,
              "Auto unban after timed ban"
            );
          } catch (err) {
            console.warn(
              "Failed to auto-unban (maybe already unbanned):",
              err.message
            );
          }
        }, durationMs);
      } else {
        await message.channel.send(
          `⛔ | Пользователь ${targetUser.tag} получил перманентный бан. Причина: ${reason}`
        );
      }
    } catch (err) {
      console.error("Ban error:", err);
      await message.channel.send(
        "❌ Не удалось забанить пользователя (проверьте права)."
      );
    }
    return;
  }

  // -------------------------------------------
  // !unban <UserID> <reason>
// -------------------------------------------
  if (command === "unban") {
    if (!moderator) {
      return message.reply("❌ У вас нет прав для этой команды.");
    }

    const userId = args.shift();
    if (!userId) {
      return message.reply(
        "❗ Использование: `!unban <UserID> <причина>`"
      );
    }

    const reason = args.join(" ") || "Причина не указана";

    try {
      await message.guild.members.unban(userId, reason);
      await message.channel.send(
        `🔓 | Пользователь с ID **${userId}** был разбанен. Причина: ${reason}`
      );
    } catch (err) {
      console.error("Unban error:", err);
      await message.channel.send(
        "❌ Не удалось разбанить пользователя (возможно, он не в бане или нет прав)."
      );
    }
    return;
  }

  // -------------------------------------------
  // !bans @UserID/mention  (show ban history)
// -------------------------------------------
  if (command === "bans") {
    if (!moderator) {
      return message.reply("❌ У вас нет прав для этой команды.");
    }

    const mention =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]);
    const id = mention ? mention.id : args[0];

    if (!id) {
      return message.reply(
        "❗ Использование: `!bans @User` или `!bans <UserID>`"
      );
    }

    const userData = getUserData(message.guild.id, id);

    if (!userData.bans || userData.bans.length === 0) {
      return message.channel.send(
        `ℹ️ | Для этого пользователя нет записей о банах.`
      );
    }

    const list = userData.bans
      .map((b, i) => {
        const date = new Date(b.timestamp).toLocaleString();
        const duration =
          b.durationMs == null ? "перманент" : formatDuration(b.durationMs);
        const mod = b.moderatorTag || b.moderatorId || "Неизвестно";
        return `${i + 1}. ${date} – ${duration} – ${b.reason} (модератор: ${mod})`;
      })
      .join("\n");

    await message.channel.send(
      `⛔ История банов для пользователя ID ${id}:\n${list}`
    );
    return;
  }

  // -------------------------------------------
  // !clearbans @UserID/mention  (clear ban history)
// -------------------------------------------
  if (command === "clearbans") {
    if (!moderator) {
      return message.reply("❌ У вас нет прав для этой команды.");
    }

    const mention =
      message.mentions.members.first() ||
      message.guild.members.cache.get(args[0]);
    const id = mention ? mention.id : args[0];

    if (!id) {
      return message.reply(
        "❗ Использование: `!clearbans @User` или `!clearbans <UserID>`"
      );
    }

    const userData = getUserData(message.guild.id, id);
    userData.bans = [];
    saveData();

    await message.channel.send(
      `🧹 | История банов пользователя ID ${id} была очищена.`
    );
    return;
  }

  // -------------------------------------------
  // !help
  // -------------------------------------------
  if (command === "help") {
    const helpText =
      "📋 Команды модерации:\n" +
      "`!warn @User <причина>` – выдать предупреждение (с авто-мутами/банами)\n" +
      "`!unwarn @User <номер>` – удалить предупреждение по номеру\n" +
      "`!clearwarns @User` – очистить все предупреждения пользователя\n" +
      "`!warns @User` – показать активные предупреждения (последние 4 дня)\n" +
      "`!mute @User <время> <причина>` – мут на время (пример: 10m, 1h, 1d)\n" +
      "`!unmute @User` – снять мут\n" +
      "`!kick @User <причина>` – кикнуть пользователя\n" +
      "`!ban @User <время> <причина>` – бан на время\n" +
      "`!ban @User <причина>` – перманентный бан\n" +
      "`!unban <UserID> <причина>` – разбан по ID\n" +
      "`!bans @User` / `!bans <UserID>` – показать историю банов\n" +
      "`!clearbans @User` / `!clearbans <UserID>` – очистить историю банов\n\n" +
      "⏱ Формат времени: `s` = секунды, `m` = минуты, `h` = часы, `d` = дни.\n" +
      "⚠️ Предупреждения считаются только за последние 4 дня (кулдаун 4 дня).";

    await message.channel.send(helpText);
    return;
  }
});

// -----------------------------------------------------
// Login
// -----------------------------------------------------
client.login(process.env.TOKEN);
