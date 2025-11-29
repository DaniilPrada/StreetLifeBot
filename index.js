// StreetLife Discord Bot
// English-only comments only

require("dotenv").config();
const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    PermissionsBitField
} = require("discord.js");

// DB helpers for protection
const {
    initDb,
    getProtectedCategoryIds,
    getProtectedChannelIds,
    addProtectedCategory,
    removeProtectedCategory,
    addProtectedChannel,
    removeProtectedChannel
} = require("./db");

// ----------------------------------------------------
// CLIENT
// ----------------------------------------------------

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Init DB
initDb();

// ----------------------------------------------------
// ENV SHORTCUTS
// ----------------------------------------------------

const LOG_RESULTS_CHANNEL_ID = process.env.LOG_RESULTS_CHANNEL_ID?.trim() || null;

const CHECKER_ROLE_IDS = (process.env.CHECKER_ROLE_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

// ----------------------------------------------------
// RUSSIAN LUX SERVER LAYOUT
// ----------------------------------------------------

const SERVER_LAYOUT = [
    {
        name: "📜┃ИНФОРМАЦИЯ СЕРВЕРА",
        children: [
            { name: "┃📢・новости-сервера", type: "text" },
            { name: "┃📘・правила-сервера", type: "text" },
            { name: "┃🧾・faq-и-гайды", type: "text" },
            { name: "┃🎫・как-попасть-на-сервер", type: "text" },
            { name: "┃🔗・полезные-ссылки", type: "text" }
        ]
    },
    {
        name: "💬┃ОБЩЕНИЕ",
        children: [
            { name: "┃💬・общий-чат", type: "text" },
            { name: "┃📸・скриншоты-и-медиа", type: "text" },
            { name: "┃📊・опросы-игроков", type: "text" },
            { name: "┃😂・мемы-и-угар", type: "text" },
            { name: "┃🤝・знакомства", type: "text" }
        ]
    },
    {
        name: "🎮┃STREETLIFE RP",
        children: [
            { name: "┃🚓・инфо-о-проекте", type: "text" },
            { name: "┃📂・структуры-и-фракции", type: "text" },
            { name: "┃📝・заявки-на-фракции", type: "text" },
            { name: "┃📋・правила-rp", type: "text" },
            { name: "┃📌・важные-объявления", type: "text" }
        ]
    },
    {
        name: "🏛┃ГОС.ОРГАНИЗАЦИИ",
        children: [
            { name: "┃🚔・полиция", type: "text" },
            { name: "┃🚑・медики", type: "text" },
            { name: "┃⚖️・правительство", type: "text" },
            { name: "┃🚒・спасательные-службы", type: "text" }
        ]
    },
    {
        name: "⚙️┃RP-ИГРА",
        children: [
            { name: "┃📂・rp-ситуации", type: "text" },
            { name: "┃📜・истории-персонажей", type: "text" },
            { name: "┃🧠・советы-по-rp", type: "text" },
            { name: "┃❓・вопросы-по-rp", type: "text" }
        ]
    },
    {
        name: "🎧┃ГОЛОСОВЫЕ-КАНАЛЫ",
        children: [
            { name: "🎤・общий-голосовой", type: "voice" },
            { name: "🎮・игровой-1", type: "voice" },
            { name: "🎮・игровой-2", type: "voice" },
            { name: "🎮・игровой-3", type: "voice" },
            { name: "🕺・общение-оффтоп", type: "voice" }
        ]
    },
    {
        name: "🎵┃МУЗЫКА",
        children: [
            { name: "┃🎵・музыка-бот", type: "text" },
            { name: "🎶・music-1", type: "voice" },
            { name: "🎶・music-2", type: "voice" }
        ]
    },
    {
        name: "🛠┃ТЕХ.ПОДДЕРЖКА",
        children: [
            { name: "┃🆘・тех-поддержка", type: "text" },
            { name: "┃📨・жалобы-и-апелляции", type: "text" },
            { name: "┃💡・предложения-по-серверу", type: "text" }
        ]
    },
    {
        name: "🛡┃ПЕРСОНАЛ",
        children: [
            { name: "┃🛡️・админ-чат", type: "text" },
            { name: "┃📕・отчеты-персонала", type: "text" },
            { name: "┃⚠️・важно-для-персонала", type: "text" }
        ]
    },
    {
        name: "📋┃ЛОГИ",
        children: [
            { name: "┃📘・логи-проверки", type: "text" },
            { name: "┃🧪・allowlist-логи", type: "text" },
            { name: "┃🔍・mod-logs", type: "text" }
        ]
    }
];

// ----------------------------------------------------
// EMBEDS (rules, access, candidate, log info)
// ----------------------------------------------------

const rulesEmbed = new EmbedBuilder()
    .setColor(0xD4AF37)
    .setTitle("📌 Правила проверки")
    .setDescription(
        "Добро пожаловать на этап проверки перед получением доступа на сервер **StreetLife RP — RU**.\n" +
        "Чтобы пройти проверку спокойно, уверенно и успешно — пожалуйста, внимательно ознакомьтесь с правилами.\n\n" +
        "Мы ценим игроков, которые проявляют уважение, зрелость и желание играть качественно.\n"
    )
    .addFields(
        {
            name: "👤 1. Поведение и отношение",
            value:
                "• Относитесь к администрации уважительно.\n" +
                "• Не перебивайте и не спорьте во время проверки.\n" +
                "• Общайтесь спокойным, ровным тоном.\n" +
                "• Соблюдайте культуру речи и элементарную вежливость.\n"
        },
        {
            name: "🎤 2. Требования к голосовой связи",
            value:
                "• Микрофон должен быть **чистым и разборчивым**.\n" +
                "• Без шумов, музыки, посторонних разговоров.\n" +
                "• Отвечайте спокойно и последовательно.\n"
        },
        {
            name: "📚 3. Проверка RP-подготовки",
            value:
                "**От Вас требуется:**\n" +
                "• Понимать, что такое RP как игра от лица персонажа.\n" +
                "• Разделять IC и OOC.\n" +
                "• Уметь объяснять свои действия логично.\n" +
                "• Мыслить от имени персонажа.\n" +
                "• Понимать важность атмосферы и взаимодействий.\n"
        },
        {
            name: "🧠 4. Адекватность, мышление и реакция",
            value:
                "• Вас могут попросить разыграть RP-ситуацию.\n" +
                "• Главное — спокойствие и логика.\n" +
                "• Это не экзамен — оценивается Ваш подход.\n"
        },
        {
            name: "🚫 5. Строго запрещено",
            value:
                "• Оскорбления игроков или администрации.\n" +
                "• Оскорбления национальности или религии.\n" +
                "• Упоминания или оскорбления родных.\n" +
                "• Токсичность, провокации, конфликты.\n" +
                "• Крики, агрессия, истерики.\n" +
                "• Детский или непонятный голос.\n" +
                "• Неуважение к проверяющему.\n" +
                "• Споры с администратором.\n" +
                "• Использование программ изменения голоса.\n"
        },
        {
            name: "🛡️ 6. Решение администрации",
            value:
                "• При успешном прохождении выдаётся роль **Allowlist**.\n" +
                "• При отказе можно пройти повторно позже.\n" +
                "• Решение администрации окончательное.\n"
        }
    )
    .setFooter({
        text: "StreetLife RP — RU • Проверка игроков",
        iconURL:
            "https://cdn.discordapp.com/icons/1439666122881241291/a_c4aff7503fcd4f99868cfc37b7eb23bb.gif?size=512"
    })
    .setTimestamp();

const accessEmbed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("🧪 Получить доступ к проверке")
    .setDescription(
        "Добро пожаловать на **StreetLife RP — RU**.\n\n" +
        "Чтобы пройти проверку и попасть на сервер, нажми на кнопку ниже.\n" +
        "Тебе будет выдана роль **AwaitingAllowlist**, и администрация увидит, что ты готов к проверке."
    )
    .setFooter({ text: "StreetLife RP — RU • Система доступа" });

const accessButton = new ButtonBuilder()
    .setCustomId("get_access")
    .setLabel("Получить доступ к проверке")
    .setStyle(ButtonStyle.Success)
    .setEmoji("🧪");

const candidateRulesEmbed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("📌 Обсуждение кандидата — Правила и информация")
    .setDescription(
        "**Закрытый служебный канал администрации StreetLife RP — RU**\n\n" +
        "Этот канал используется для внутреннего обсуждения кандидатов после проверки. " +
        "Здесь оценивается их зрелость, поведение и готовность к RP. " +
        "Вся информация, находящаяся здесь, является **конфиденциальной**."
    )
    .addFields(
        {
            name: "🔒 1. Конфиденциальность",
            value:
                "• Информация из канала предназначена только для сотрудников.\n" +
                "• Запрещено обсуждать канал вне него.\n" +
                "• Нельзя делать скриншоты, записи или копировать сообщения.\n" +
                "• Информация не передается кандидатам или игрокам.\n"
        },
        {
            name: "🛡️ 2. Доступ и участие",
            value:
                "• Доступ имеют только сотрудники, участвующие в проверке.\n" +
                "• Не приглашать посторонних пользователей.\n" +
                "• Обмен информацией — только при необходимости и внутри персонала.\n"
        },
        {
            name: "🧩 3. Назначение канала",
            value:
                "• Анализ ответов кандидата.\n" +
                "• Оценка поведения, зрелости и RP-подготовки.\n" +
                "• Обсуждение итогов проверки и формирование вывода.\n" +
                "• Поддержание профессионального стандарта сервера.\n"
        },
        {
            name: "📜 4. Формат общения",
            value:
                "• Писать только по делу и кратко.\n" +
                "• Рабочий, спокойный и уважительный тон.\n" +
                "• Избегать спама, эмоций и оффтопа.\n"
        },
        {
            name: "🎯 5. Объективность",
            value:
                "• Оценка должна быть аргументированной.\n" +
                "• Не использовать личные эмоции или симпатии.\n" +
                "• Оценивается только зрелость, поведение и RP-навыки.\n"
        },
        {
            name: "🚫 6. Запрещённые темы",
            value:
                "• Личные данные кандидата.\n" +
                "• Нац./религиозные темы, политика.\n" +
                "• Конфликты с других серверов.\n" +
                "• Обсуждение сотрудников вне темы проверки.\n"
        },
        {
            name: "⚖️ 7. Итоговое решение",
            value:
                "• Решение принимают сотрудники, проводившие проверку.\n" +
                "• Старший администратор формирует финальный вывод.\n" +
                "• Кандидату сообщается только итоговое решение.\n"
        }
    )
    .setFooter({ text: "StreetLife RP — RU • Внутренний канал персонала" })
    .setTimestamp();

const logInfoEmbed = new EmbedBuilder()
    .setColor(0x1abc9c)
    .setTitle("📘 Лог результатов — информация")
    .setDescription(
        "**Служебный канал логов проверки игроков на сервере StreetLife RP — RU.**\n\n" +
        "Здесь бот автоматически фиксирует результаты проверок кандидатов: кто прошёл, кто не прошёл, " +
        "кто проводил проверку и по какой причине был отказ.\n\n" +
        "Канал предназначен для **внутреннего использования персоналом** и помогает сохранять прозрачность и историю решений."
    )
    .addFields(
        {
            name: "📥 Что отправляет бот",
            value:
                "• Сообщения об успешном прохождении проверки (✅).\n" +
                "• Сообщения о непрохождении проверки (❌) с указанием причины.\n" +
                "• Информацию о том, какой сотрудник проводил проверку.\n"
        },
        {
            name: "🔒 Конфиденциальность",
            value:
                "• Канал виден только персоналу.\n" +
                "• Запрещено выносить содержимое канала за его пределы.\n"
        }
    )
    .setFooter({ text: "StreetLife RP — RU • Лог результатов проверки игроков" })
    .setTimestamp();

// ----------------------------------------------------
// WELCOME SYSTEM
// ----------------------------------------------------

async function sendWelcome(member, reason = "auto") {
    const channelId = process.env.WELCOME_CHANNEL_ID?.trim();
    console.log(`sendWelcome called for ${member.user.tag}, reason: ${reason}`);
    console.log("WELCOME_CHANNEL_ID used in code:", channelId);

    if (!channelId) {
        console.log("No WELCOME_CHANNEL_ID in .env");
        return;
    }

    const channel = member.guild.channels.cache.get(channelId);
    if (!channel) {
        console.log("Welcome channel not found in cache:", channelId);
        return;
    }

    try {
        const embed = new EmbedBuilder()
            .setColor(0xD4AF37)
            .setTitle(`👑 Добро пожаловать, ${member.user.username}!`)
            .setDescription(
                "👑 Добро пожаловать на легендарный сервер **StreetLife RP — RU**!\n\n" +
                "Ты только что присоединился к одному из самых качественных и уникальных RP-проектов.\n\n" +
                "✨ Здесь тебя ждёт:\n" +
                "• Авторитетное и дружелюбное сообщество\n" +
                "• Реалистичная атмосфера города и продуманные фракции\n" +
                "• Высококачественные системы RP\n" +
                "• Профессиональная администрация\n\n" +
                "📜 Обязательно ознакомься с правилами.\n\n" +
                "Добро пожаловать в **StreetLife RP — RU**. Твоя новая история начинается прямо сейчас. ✨"
            )
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setFooter({
                text: "StreetLife RP — RU • Элитный RP опыт",
                iconURL: member.guild.iconURL({ dynamic: true }) || undefined
            })
            .setTimestamp();

        await channel.send({
            content: `👋 <@${member.id}> добро пожаловать на сервер!`,
            embeds: [embed]
        });

        console.log("Welcome message sent to channel:", channelId);
    } catch (err) {
        console.error("Failed to send welcome message:", err);
    }
}

// ----------------------------------------------------
// HELPERS
// ----------------------------------------------------

function hasCheckerRole(member) {
    if (!CHECKER_ROLE_IDS.length) return true;
    return CHECKER_ROLE_IDS.some((id) => member.roles.cache.has(id));
}

async function sendResultLog(guild, embedOrContent) {
    if (!LOG_RESULTS_CHANNEL_ID) return;
    try {
        const logChannel = guild.channels.cache.get(LOG_RESULTS_CHANNEL_ID);
        if (!logChannel) return;
        if (typeof embedOrContent === "string") {
            await logChannel.send({ content: embedOrContent });
        } else {
            await logChannel.send(embedOrContent);
        }
    } catch (err) {
        console.error("Failed to send log message:", err);
    }
}

// Build polite DM for fail result
function buildFailDM(reasonText) {
    return (
        "Здравствуйте!\n\n" +
        "Благодарим Вас за участие в проверке на сервере **StreetLife RP — RU**.\n\n" +
        "К сожалению, на данный момент Вы не прошли проверку.\n\n" +
        "Причина отказа:\n" +
        (reasonText || "не указана") +
        "\n\n" +
        "Просим не воспринимать это как критику Вашей личности.\n\n" +
        "Рекомендуем подготовиться и попробовать снова позже.\n\n" +
        "С уважением,\nАдминистрация StreetLife RP — RU"
    );
}

// ----------------------------------------------------
// SERVER LAYOUT HELPERS
// ----------------------------------------------------

async function findOrCreateCategory(guild, name) {
    let category = guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildCategory && c.name === name
    );

    if (!category) {
        category = await guild.channels.create({
            name,
            type: ChannelType.GuildCategory
        });
        console.log(`Created category: ${name}`);
    } else {
        console.log(`Category exists: ${name}`);
    }

    return category;
}

async function findOrCreateChannelInCategory(guild, category, def) {
    const existing = guild.channels.cache.find(
        (c) => c.name === def.name && c.parentId === category.id
    );

    if (existing) {
        console.log(`Channel exists: ${def.name} in ${category.name}`);
        return existing;
    }

    const type =
        def.type === "voice" ? ChannelType.GuildVoice : ChannelType.GuildText;

    const ch = await guild.channels.create({
        name: def.name,
        type,
        parent: category.id
    });

    console.log(`Created channel: ${def.name} in ${category.name}`);
    return ch;
}

// Build layout + cleanup inside categories
async function buildLuxLayout(guild) {
    const protectedCategories = await getProtectedCategoryIds(guild.id);
    const protectedChannels = await getProtectedChannelIds(guild.id);

    for (const categoryDef of SERVER_LAYOUT) {
        const category = await findOrCreateCategory(guild, categoryDef.name);
        const isCategoryProtected = protectedCategories.includes(category.id);

        const requiredNames = new Set(categoryDef.children.map((c) => c.name));

        // Cleanup inside category
        for (const ch of guild.channels.cache
            .filter((c) => c.parentId === category.id)
            .values()) {
            if (requiredNames.has(ch.name)) continue;
            if (protectedChannels.includes(ch.id)) continue;
            if (isCategoryProtected) continue;

            console.log(`Deleting extra channel: ${ch.name} (${ch.id}) in ${category.name}`);
            await ch.delete("StreetLifeBot cleanup: not in layout");
        }

        // Ensure required channels
        for (const chDef of categoryDef.children) {
            await findOrCreateChannelInCategory(guild, category, chDef);
        }
    }
}

// Delete categories/channels not in layout and not protected
async function cleanExtraStructure(guild) {
    const protectedCategories = await getProtectedCategoryIds(guild.id);
    const protectedChannels = await getProtectedChannelIds(guild.id);

    const layoutCategoryNames = new Set(SERVER_LAYOUT.map((c) => c.name));

    // Delete categories not in layout
    for (const cat of guild.channels.cache
        .filter((c) => c.type === ChannelType.GuildCategory)
        .values()) {
        if (layoutCategoryNames.has(cat.name)) continue;
        if (protectedCategories.includes(cat.id)) continue;

        console.log(`Deleting extra category: ${cat.name} (${cat.id})`);
        await cat.delete("StreetLifeBot cleanextraserver: category not in layout");
    }

    // Delete root channels not protected
    for (const ch of guild.channels.cache
        .filter(
            (c) =>
                (c.type === ChannelType.GuildText ||
                    c.type === ChannelType.GuildVoice) &&
                !c.parentId
        )
        .values()) {
        if (protectedChannels.includes(ch.id)) continue;

        console.log(`Deleting extra root channel: ${ch.name} (${ch.id})`);
        await ch.delete("StreetLifeBot cleanextraserver: root channel not protected");
    }
}

// Delete full category by name
async function deleteCategoryByName(guild, name) {
    const protectedCategories = await getProtectedCategoryIds(guild.id);
    const protectedChannels = await getProtectedChannelIds(guild.id);

    const category = guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildCategory && c.name === name
    );

    if (!category) return { ok: false, reason: "not_found" };
    if (protectedCategories.includes(category.id)) {
        return { ok: false, reason: "protected" };
    }

    for (const ch of guild.channels.cache
        .filter((c) => c.parentId === category.id)
        .values()) {
        if (protectedChannels.includes(ch.id)) continue;

        console.log(`Deleting channel in category delete: ${ch.name} (${ch.id})`);
        await ch.delete("StreetLifeBot deletecategory");
    }

    console.log(`Deleting category: ${category.name} (${category.id})`);
    await category.delete("StreetLifeBot deletecategory");

    return { ok: true };
}

// ----------------------------------------------------
// EVENTS
// ----------------------------------------------------

client.once("ready", () => {
    console.log(`Bot is online as ${client.user.tag}`);
    console.log("WELCOME_CHANNEL_ID:", process.env.WELCOME_CHANNEL_ID);
    console.log("RULES_CHECK_CHANNEL_ID:", process.env.RULES_CHECK_CHANNEL_ID);
    console.log("AWAITING_ALLOWLIST_ROLE_ID:", process.env.AWAITING_ALLOWLIST_ROLE_ID);
    console.log("ALLOWLIST_ROLE_ID:", process.env.ALLOWLIST_ROLE_ID);
    console.log("GET_ACCESS_CHANNEL_ID:", process.env.GET_ACCESS_CHANNEL_ID);
    console.log("LOG_RESULTS_CHANNEL_ID:", process.env.LOG_RESULTS_CHANNEL_ID);
    console.log("CHECKER_ROLE_IDS:", CHECKER_ROLE_IDS);
});

client.on("guildMemberAdd", async (member) => {
    console.log("New member joined:", member.user.tag);
    await sendWelcome(member, "auto-join");
});

// ----------------------------------------------------
// MESSAGE COMMANDS
// ----------------------------------------------------

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    const raw = message.content.trim();
    const content = raw.toLowerCase();
    const args = raw.split(/\s+/);
    const cmd = args[0].toLowerCase();

    // Simple ping
    if (cmd === "!ping") {
        return message.reply("🏓 Понг от StreetLife Bot!");
    }

    // !say <text>
    if (cmd === "!say") {
        const text = raw.slice("!say".length).trim();
        if (text.length > 0) {
            return message.channel.send(text);
        }
    }

    // !testwelcome
    if (cmd === "!testwelcome") {
        if (!message.member) {
            return message.reply("Эту команду нужно использовать на сервере, а не в личных сообщениях.");
        }
        await sendWelcome(message.member, "testwelcome");
        return message.reply("Тестовое приветствие отправлено в канал welcome.");
    }

    // !sendtestrules
    if (cmd === "!sendtestrules") {
        const rulesChannelId = process.env.RULES_CHECK_CHANNEL_ID?.trim();
        if (!rulesChannelId) {
            return message.reply("❗ RULES_CHECK_CHANNEL_ID не указан в .env");
        }

        let channel = message.guild.channels.cache.get(rulesChannelId);
        if (!channel) {
            try {
                channel = await message.guild.channels.fetch(rulesChannelId);
            } catch (err) {
                console.error("Failed to fetch rules channel:", err);
                return message.reply("❗ Не удалось найти канал для правил. Проверь ID в .env");
            }
        }

        if (!channel) {
            return message.reply("❗ Канал для правил не найден.");
        }

        await channel.send({ embeds: [rulesEmbed] });
        return message.reply("📌 Правила проверки отправлены в канал правил.");
    }

    // !sendaccesspanel
    if (cmd === "!sendaccesspanel") {
        const targetChannelId = process.env.GET_ACCESS_CHANNEL_ID?.trim();
        let channel = message.guild.channels.cache.get(targetChannelId) || message.channel;

        const row = new ActionRowBuilder().addComponents(accessButton);

        await channel.send({
            embeds: [accessEmbed],
            components: [row]
        });

        return message.reply("🧪 Панель доступа отправлена.");
    }

    // !sendcandidaterules
    if (cmd === "!sendcandidaterules") {
        return message.channel.send({ embeds: [candidateRulesEmbed] });
    }

    // !sendloginfo
    if (cmd === "!sendloginfo") {
        if (!message.member || !hasCheckerRole(message.member)) {
            return message.reply("❗ У вас нет прав использовать эту команду.");
        }
        return message.channel.send({ embeds: [logInfoEmbed] });
    }

    // ------------------------------------------------
    // PROTECTION COMMANDS
    // ------------------------------------------------

    // !protectchannel #channel
    if (cmd === "!protectchannel") {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply("❗ Эту команду может использовать только администратор.");
        }

        const ch = message.mentions.channels.first();
        if (!ch) {
            return message.reply("❗ Укажи канал через #упоминание.\nПример: `!protectchannel #общий-чат`");
        }

        try {
            await addProtectedChannel(message.guild.id, ch.id);
            return message.reply(`✅ Канал ${ch} добавлен в список защищённых.`);
        } catch (err) {
            console.error("protectchannel failed:", err);
            return message.reply("❗ Ошибка при добавлении защиты канала.");
        }
    }

    // !unprotectchannel #channel
    if (cmd === "!unprotectchannel") {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply("❗ Эту команду может использовать только администратор.");
        }

        const ch = message.mentions.channels.first();
        if (!ch) {
            return message.reply("❗ Укажи канал через #упоминание.\nПример: `!unprotectchannel #общий-чат`");
        }

        try {
            await removeProtectedChannel(message.guild.id, ch.id);
            return message.reply(`✅ Канал ${ch} удалён из списка защищённых.`);
        } catch (err) {
            console.error("unprotectchannel failed:", err);
            return message.reply("❗ Ошибка при удалении защиты канала.");
        }
    }

    // !protectcategory <name>
    if (cmd === "!protectcategory") {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply("❗ Эту команду может использовать только администратор.");
        }

        const targetName = raw.slice("!protectcategory".length).trim();
        if (!targetName) {
            return message.reply("❗ Укажи точное название категории.\nПример: `!protectcategory 💬┃ОБЩЕНИЕ`");
        }

        const category = message.guild.channels.cache.find(
            (c) => c.type === ChannelType.GuildCategory && c.name === targetName
        );

        if (!category) {
            return message.reply("❗ Категория с таким названием не найдена.");
        }

        try {
            await addProtectedCategory(message.guild.id, category.id);
            return message.reply(`✅ Категория \`${category.name}\` добавлена в список защищённых.`);
        } catch (err) {
            console.error("protectcategory failed:", err);
            return message.reply("❗ Ошибка при добавлении защиты категории.");
        }
    }

    // !unprotectcategory <name>
    if (cmd === "!unprotectcategory") {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply("❗ Эту команду может использовать только администратор.");
        }

        const targetName = raw.slice("!unprotectcategory".length).trim();
        if (!targetName) {
            return message.reply("❗ Укажи точное название категории.\nПример: `!unprotectcategory 💬┃ОБЩЕНИЕ`");
        }

        const category = message.guild.channels.cache.find(
            (c) => c.type === ChannelType.GuildCategory && c.name === targetName
        );

        if (!category) {
            return message.reply("❗ Категория с таким названием не найдена.");
        }

        try {
            await removeProtectedCategory(message.guild.id, category.id);
            return message.reply(`✅ Категория \`${category.name}\` убрана из списка защищённых.`);
        } catch (err) {
            console.error("unprotectcategory failed:", err);
            return message.reply("❗ Ошибка при удалении защиты категории.");
        }
    }

    // ------------------------------------------------
    // LUX SERVER SETUP
    // ------------------------------------------------

    if (cmd === "!setupserverlux") {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply("❗ Эту команду может использовать только администратор.");
        }

        await message.reply("⏳ Начинаю настраивать структуру сервера StreetLife (российский люкс)...");

        try {
            await buildLuxLayout(message.guild);
            await message.reply("✅ Структура категорий и каналов обновлена по роскошному макету.");
        } catch (err) {
            console.error("buildLuxLayout failed:", err);
            await message.reply("❗ Ошибка при настройке структуры. См. логи бота.");
        }

        return;
    }

    // CLEAN EXTRA: !cleanextraserver
    if (cmd === "!cleanextraserver") {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply("❗ Эту команду может использовать только администратор.");
        }

        await message.reply(
            "⚠️ Начинаю умную очистку: будут удалены категории и каналы, которых нет в макете и не защищены."
        );

        try {
            await cleanExtraStructure(message.guild);
            await message.reply("✅ Очистка завершена. Лишние категории/каналы удалены.");
        } catch (err) {
            console.error("cleanExtraStructure failed:", err);
            await message.reply("❗ Ошибка при очистке. См. логи бота.");
        }

        return;
    }

    // DELETE CATEGORY: !deletecategory <name>
    if (cmd === "!deletecategory") {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply("❗ Эту команду может использовать только администратор.");
        }

        const targetName = raw.slice("!deletecategory".length).trim();
        if (!targetName) {
            return message.reply("❗ Укажи точное название категории.\nПример: `!deletecategory 💬┃ОБЩЕНИЕ`");
        }

        const result = await deleteCategoryByName(message.guild, targetName);

        if (!result.ok && result.reason === "not_found") {
            return message.reply("❗ Категория с таким названием не найдена.");
        }
        if (!result.ok && result.reason === "protected") {
            return message.reply("❗ Эта категория защищена и не может быть удалена.");
        }

        return message.reply(`✅ Категория \`${targetName}\` и её каналы были удалены (кроме защищённых).`);
    }

    // DELETE CHANNEL: !deletechannel #mention
    if (cmd === "!deletechannel") {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply("❗ Эту команду может использовать только администратор.");
        }

        const targetChannel = message.mentions.channels.first();
        if (!targetChannel) {
            return message.reply("❗ Укажи канал через #упоминание. Пример: `!deletechannel #общий-чат`");
        }

        const protectedChannels = await getProtectedChannelIds(message.guild.id);
        if (protectedChannels.includes(targetChannel.id)) {
            return message.reply("❗ Этот канал защищён и не может быть удалён.");
        }

        try {
            const name = targetChannel.name;
            await targetChannel.delete("StreetLifeBot deletechannel");
            return message.reply(`✅ Канал \`${name}\` удалён.`);
        } catch (err) {
            console.error("deletechannel failed:", err);
            return message.reply("❗ Не удалось удалить канал. Проверь права бота.");
        }
    }

    // ------------------------------------------------
    // PASS / FAIL COMMANDS (Allowlist)
    // ------------------------------------------------

    if (content.startsWith("!прошел проверку")) {
        if (!message.member || !hasCheckerRole(message.member)) {
            return message.reply("❗ У вас нет прав использовать эту команду.");
        }

        const targetMember = message.mentions.members.first();
        if (!targetMember) {
            return message.reply("❗ Укажите пользователя через @mention.\nПример: `!прошел проверку @User`");
        }

        const allowId = process.env.ALLOWLIST_ROLE_ID?.trim();
        const awaitingId = process.env.AWAITING_ALLOWLIST_ROLE_ID?.trim();

        const allowRole = allowId ? message.guild.roles.cache.get(allowId) : null;
        const awaitingRole = awaitingId ? message.guild.roles.cache.get(awaitingId) : null;

        if (!allowRole) {
            return message.reply("❗ Роль Allowlist не найдена. Проверьте ALLOWLIST_ROLE_ID в .env");
        }

        if (awaitingRole && targetMember.roles.cache.has(awaitingId)) {
            await targetMember.roles.remove(awaitingRole).catch((err) => {
                console.error("Failed to remove AwaitingAllowlist:", err);
            });
        }

        try {
            await targetMember.roles.add(allowRole);
        } catch (err) {
            console.error("Failed to add Allowlist:", err);
            return message.reply("❗ Не удалось выдать роль Allowlist. Проверьте права бота.");
        }

        await message.channel.send(
            `🎉 <@${targetMember.id}> успешно прошёл проверку и получил доступ к серверу **StreetLife RP — RU**. Добро пожаловать!`
        );

        try {
            await targetMember.send(
                "Здравствуйте!\n\n" +
                "Поздравляем! Вы успешно прошли проверку на сервере **StreetLife RP — RU**.\n\n" +
                "Вам выдана роль **Allowlist**, и теперь у Вас есть доступ к серверу.\n\n" +
                "Добро пожаловать в наш проект!\n\n" +
                "С уважением,\nАдминистрация StreetLife RP — RU"
            );
        } catch (err) {
            console.error("Failed to send DM (pass):", err);
        }

        const passLogEmbed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle("✅ Проверка пройдена")
            .addFields(
                { name: "Кандидат", value: `<@${targetMember.id}>`, inline: true },
                { name: "Проверяющий", value: `<@${message.author.id}>`, inline: true }
            )
            .setTimestamp();

        await sendResultLog(message.guild, { embeds: [passLogEmbed] });

        return;
    }

    if (content.startsWith("!не прошел проверку")) {
        if (!message.member || !hasCheckerRole(message.member)) {
            return message.reply("❗ У вас нет прав использовать эту команду.");
        }

        const targetMember = message.mentions.members.first();
        if (!targetMember) {
            return message.reply(
                "❗ Укажите пользователя через @mention.\nПример: `!не прошел проверку @User причина...`"
            );
        }

        const mention = `<@${targetMember.id}>`;
        const altMention = `<@!${targetMember.id}>`;
        let reasonPart = raw;

        reasonPart = reasonPart.replace(/^!не прошел проверку\s*/i, "");
        reasonPart = reasonPart.replace(mention, "").replace(altMention, "").trim();

        if (reasonPart.endsWith(".")) {
            reasonPart = reasonPart.slice(0, -1).trim();
        }

        const reasonText = reasonPart || "не указана";

        const awaitingId = process.env.AWAITING_ALLOWLIST_ROLE_ID?.trim();
        const awaitingRole = awaitingId ? message.guild.roles.cache.get(awaitingId) : null;

        if (awaitingRole && targetMember.roles.cache.has(awaitingId)) {
            await targetMember.roles.remove(awaitingRole).catch((err) => {
                console.error("Failed to remove AwaitingAllowlist on fail:", err);
            });
        }

        await message.channel.send(
            `❌ <@${targetMember.id}> не прошёл проверку. Можно попробовать позже.\nПричина: ${reasonText}`
        );

        const dmText = buildFailDM(reasonText);
        try {
            await targetMember.send(dmText);
        } catch (err) {
            console.error("Failed to send DM (fail):", err);
        }

        const failLogEmbed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("❌ Проверка не пройдена")
            .addFields(
                { name: "Кандидат", value: `<@${targetMember.id}>`, inline: true },
                { name: "Проверяющий", value: `<@${message.author.id}>`, inline: true },
                { name: "Причина", value: reasonText, inline: false }
            )
            .setTimestamp();

        await sendResultLog(message.guild, { embeds: [failLogEmbed] });

        return;
    }
});

// ----------------------------------------------------
// BUTTON INTERACTIONS
// ----------------------------------------------------

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === "get_access") {
        const roleId = process.env.AWAITING_ALLOWLIST_ROLE_ID?.trim();

        if (!roleId) {
            return interaction.reply({
                content: "❗ Роль AwaitingAllowlist не настроена. Сообщи администрации.",
                ephemeral: true
            });
        }

        const member = interaction.member;
        const role = interaction.guild.roles.cache.get(roleId);

        if (!role) {
            return interaction.reply({
                content: "❗ Роль AwaitingAllowlist не найдена на сервере. Сообщи владельцу.",
                ephemeral: true
            });
        }

        if (member.roles.cache.has(roleId)) {
            return interaction.reply({
                content: "✅ У тебя уже есть роль ожидания проверки.",
                ephemeral: true
            });
        }

        try {
            await member.roles.add(role);
            console.log(`Role AwaitingAllowlist given to ${member.user.tag}`);

            return interaction.reply({
                content: "✅ Тебе выдана роль **AwaitingAllowlist**. Ожидай администратора для проверки.",
                ephemeral: true
            });
        } catch (err) {
            console.error("Failed to add AwaitingAllowlist role:", err);
            return interaction.reply({
                content: "❗ Не удалось выдать роль. Сообщи администрации.",
                ephemeral: true
            });
        }
    }
});

// ----------------------------------------------------
// TOKEN & LOGIN
// ----------------------------------------------------

console.log("Token length:", process.env.TOKEN?.length);
client.login(process.env.TOKEN);
