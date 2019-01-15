const Discord = require("discord.js");
const config = require("./config.json");
const snoo = require("snoowrap");
const sql = require("sqlite");
//requirements

const bot = new Discord.Client();
//const red = new snoowrap({userAgent: "Echo new reddit posts to Discord.", clientId: config.rid, clientSecret: config.rs, username: config.ru, password: config.rp});
sql.open("./score.sqlite");
bot.login(config.token);

bot.on("ready", () =>
{
    sql.all("SELECT * FROM pending_messages").then(result => //pull up all pending messages and send them when needed
    {
        result.forEach( function(row)
        {
            bot.setTimeout(function()
            {
                if (!bot.guilds.get(row.guild)) return;
                if (bot.guilds.get(row.guild).channels.get(row.channel).memberPermissions(bot.guilds.get(row.guild).me).has("SEND_MESSAGES"))
                    bot.guilds.get(row.guild).channels.get(row.channel).send(row.message, {disableEveryone: true, reply: bot.guilds.get(row.guild).member(row.user)});
                sql.run(`DELETE FROM pending_messages WHERE time = "${row.time}"`)
            }, Math.max(0, (parseInt(row.time) - new Date().getTime())));
        });
    }).catch(() =>
    {
        sql.run("CREATE TABLE IF NOT EXISTS pending_messages (guild TEXT, channel TEXT, user TEXT, time INT, message TEXT)");
    });
    bot.guilds.forEach( function(guild) //make sure there's a settings and a disabled for each guild
    {
        sql.get(`SELECT * FROM disabled_cmd WHERE guild = "${guild.id}"`).then(row =>
        {
            if (!row)
            {
                sql.run(`INSERT INTO disabled_cmd (guild, like, ping, setconfig, getconfig, nick, reminders, roll, conversion, help, incorrectCommands) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [guild.id, "false", "false", "false", "false", "false", "false", "false", "false", "false", "false"]);
            }
        }).catch(() =>
        {
            sql.run("CREATE TABLE IF NOT EXISTS disabled_cmd (guild TEXT, like TEXT, ping TEXT, setconfig TEXT, getconfig TEXT, nick TEXT, reminders TEXT, roll TEXT, conversion TEXT, help TEXT, incorrectCommands TEXT)").then(() =>
            {
                sql.run(`INSERT INTO disabled_cmd (guild, like, ping, setconfig, getconfig, nick, reminders, roll, conversion, help, incorrectCommands) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [guild.id, "false", "false", "false", "false", "false", "false", "false", "false", "false", "false"]);
            });
        });
        sql.get(`SELECT * FROM g_config WHERE guild = "${guild.id}"`).then(row =>
        {
            if (!row)
            {
                sql.run(`INSERT INTO g_config (guild, prefix, modLog, modRole, adminRole, wChannel, wMessage) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [guild.id, ".", "mod-log", "Moderator", "Administrator", "welcome", "Everyone welcome <new> to the server"]);
            }
        }).catch(() =>
        {
            sql.run(`CREATE TABLE IF NOT EXISTS g_config (guild TEXT, prefix TEXT, modLog TEXT, modRole TEXT, adminRole TEXT, wChannel TEXT, wMessage TEXT)`).then(() =>
            {
                sql.run(`INSERT INTO g_config (guild, prefix, modLog, modRole, adminRole, wChannel, wMessage) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [guild.id, ".", "mod-log", "Moderator", "Administrator", "welcome", "Everyone welcome <new> to the server"]);
            });
        });
    });
    console.log("Ready.");
});
//setup

bot.on("error", console.error);

bot.on("guildCreate", (guild) =>
{
    sql.run(`INSERT INTO disabled_cmd (guild, like, ping, setconfig, getconfig, nick, reminders, roll, conversion, help, incorrectCommands) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [guild.id, "false", "false", "false", "false", "false", "false", "false", "false", "false", "false"]);
    sql.run(`INSERT INTO g_config (guild, prefix, modLog, modRole, adminRole, wChannel, wMessage) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [guild.id, ".", "mod-log", "Moderator", "Administratot", "welcome", "Everyone welcome <new> to the server"]);
});

bot.on("guildMemberAdd", (member) =>
{
    sql.get(`SELECT * FROM g_config WHERE guild = "${member.guild.id}"`).then(row =>
    {
        const channel = member.guild.channels.find(channel => {return row.wChannel == channel.name;});
	    var welcome = row.wMessage;
        if (!channel) return;
	    welcome = welcome.replace("<new>", "<@" + member.id + ">");
        if (channel.memberPermissions(member.guild.me).has(["SEND_MESSAGES", "VIEW_CHANNEL"])) return channel.send(welcome);
        return;
    });
});

bot.on("guildMemberRemove", (member) =>
{
    sql.get(`SELECT * FROM g_config WHERE guild = "${member.guild.id}"`).then(gconfig =>
    {
        const mLog = member.guild.channels.find(channel => {return gconfig.modLog == channel.name;});
        if (!mLog) return;
        if (mLog.memberPermissions(member.guild.me).has(["SEND_MESSAGES", "VIEW_CHANNEL"]))
            return mLog.send(member.displayName + " has left or been kicked!");
    });
    return;
});

bot.on("messageDelete", (message) =>
{
    sql.get(`SELECT * FROM g_config WHERE guild = "${message.guild.id}"`).then(gconfig =>
    {
        const mLog = message.guild.channels.find(channel => {return gconfig.modLog == channel.name;});
        if (!mLog) return;
        if (mLog.memberPermissions(message.guild.me).has(["SEND_MESSAGES", "VIEW_CHANNEL"]))
            return mLog.send("Message deleted:\n" + message.author.username + ": " + message.content, {disableEveryone: true});
    });
    return;
});

bot.on("messageUpdate", (oldMessage, newMessage) =>
{
    sql.get(`SELECT * FROM g_config WHERE guild = "${oldMessage.guild.id}"`).then(gconfig =>
    {
        const mLog = oldMessage.guild.channels.find(channel => {return gconfig.modLog == channel.name;});
        if (!mLog) return;
        if (mLog.memberPermissions(oldMessage.guild.me).has(["SEND_MESSAGES", "VIEW_CHANNEL"]))
            return mLog.send("Message Edited:\n" + oldMessage.author.username + ": " + oldMessage.content + "\n" + newMessage.author.username + ": " + newMessage.content, {disableEveryone: true});
    });
    return;
});

bot.on("guildBanAdd", (guild, user) =>
{
    sql.get(`SELECT * FROM g_config WHERE guild = "${guild.id}"`).then(gconfig =>
    {
        const mLog = guild.channels.find(channel => {return gconfig.modLog == channel.name;});
        if (!mLog) return;
        if (mLog.memberPermissions(guild.me).has(["SEND_MESSAGES", "VIEW_CHANNEL"]))
            return mLog.send(user.username + " has been banned!");
    });
    return;
});

bot.on("guildBanRemove", (guild, user) =>
{
    sql.get(`SELECT * FROM g_config WHERE guild = "${guild.id}"`).then(gconfig =>
    {
        const mLog = guild.channels.find(channel => {return gconfig.modLog == channel.name;});
        if (!mLog) return;
        if (mLog.memberPermissions(guild.me).has(["SEND_MESSAGES", "VIEW_CHANNEL"]))
            return mLog.send(user.username + " has been unbanned!");
    });
    return;
});

bot.on("message", async (message) =>
{
    if (!message.guild || message.author.bot) return;
    sql.get(`SELECT * FROM g_config WHERE guild = "${message.guild.id}"`).then(gconfig =>
    {
        sql.get(`SELECT * FROM disabled_cmd WHERE guild = ${message.guild.id}`).then(disabled =>
        {
            if (message.content.endsWith("--"))
            {
                if (disabled.like == "true") return;
                const like = message.content.slice(0, -2).trim();
                sql.get(`SELECT * FROM "${message.guild.id}" WHERE like = "${like.toLowerCase()}"`).then(row => {
                    if (!row) {
                        sql.run(`INSERT INTO "${message.guild.id}" (like, plus, minus) VALUES (?, ?, ?)`, [like.toLowerCase(), 0, -1]).then(() =>
                        {
                           if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES"))
                               message.channel.send("\"" + like + "\" Has -1 likes. [0, -1]", {disableEveryone: true});
                        });
                    }
                    else
                    {
                        sql.run(`UPDATE "${message.guild.id}" SET minus = ${row.minus - 1} WHERE like = "${like.toLowerCase()}"`).then(() =>
                        {
                            if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES")) message.channel.send("\"" + like + "\" Has " +
                                parseInt(row.plus + row.minus - 1) + " likes. [" + parseInt(row.plus) + ", " + parseInt(row.minus - 1) + "]", {disableEveryone: true});
                        });
                    }
                }).catch(() =>
                {
                    sql.run(`CREATE TABLE IF NOT EXISTS "${message.guild.id}" (like TEXT, plus INTEGER, minus INTEGER)`).then(() =>
                    {
                        sql.run(`INSERT INTO "${message.guild.id}" (like, plus, minus) VALUES (?, ?, ?)`, [like.toLowerCase(), 0, -1]).then(() =>
                        {
                            if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES"))
                                message.channel.send("\"" + like + "\" Has -1 likes. [0, -1]", {disableEveryone: true});
                        });
                    });
                });
            }
            else if (message.content.endsWith('\u2014')) //ios replaces -- with an em dash because it's dumb.
            {
                if (disabled.like == "true") return;
                const like = message.content.slice(0, -1).trim();
                sql.get(`SELECT * FROM "${message.guild.id}" WHERE like = "${like.toLowerCase()}"`).then(row =>
                {
                    if (!row)
                    {
                        sql.run(`INSERT INTO "${message.guild.id}" (like, plus, minus) VALUES (?, ?, ?)`, [like.toLowerCase(), 0, -1]).then(() =>
                        {
                            if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES"))
                                message.channel.send("\"" + like + "\" Has -1 likes. [0, -1]", {disableEveryone: true});
                        });
                    }
                    else
                    {
                        sql.run(`UPDATE "${message.guild.id}" SET minus = ${row.minus - 1} WHERE like = "${like.toLowerCase()}"`).then(() =>
                        {
                            if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES")) message.channel.send("\"" + like + "\" Has " +
                                parseInt(row.plus + row.minus - 1) + " likes. [" + parseInt(row.plus) + ", " + parseInt(row.minus - 1) + "]", {disableEveryone: true});
                        });
                    }
                }).catch(() => {
                    sql.run(`CREATE TABLE IF NOT EXISTS "${message.guild.id}" (like TEXT, plus INTEGER, minus INTEGER)`).then(() =>
                    {
                        sql.run(`INSERT INTO "${message.guild.id}" (like, plus, minus) VALUES (?, ?, ?)`, [like.toLowerCase(), 0, -1]).then(() =>
                        {
                            if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES")) 
                                message.channel.send("\"" + like + "\" Has -1 likes. [0, -1]", {disableEveryone: true});
                        });
                    });
                });
            }
            else if (message.content.endsWith("++"))
            {
                if (disabled.like == "true") return;
                const like = message.content.slice(0, -2).trim();
                sql.get(`SELECT * FROM "${message.guild.id}" WHERE like = "${like.toLowerCase()}"`).then(row =>
                {
                    if (!row)
                    {
                        sql.run(`INSERT INTO "${message.guild.id}" (like, plus, minus) VALUES (?, ?, ?)`, [like.toLowerCase(), 1, 0]).then(() =>
                        {
                            if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES"))
                                message.channel.send("\"" + like + "\" Has 1 likes. [1, 0]", {disableEveryone: true});
                        });
                    }
                    else {
                        sql.run(`UPDATE "${message.guild.id}" SET plus = ${row.plus + 1} WHERE like = "${like.toLowerCase()}"`).then(() =>
                        {
                            if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES")) message.channel.send("\"" + like + "\" Has " +
                                parseInt(row.plus + row.minus + 1) + " likes. [" + parseInt(row.plus + 1) + ", " + parseInt(row.minus) + "]", {disableEveryone: true});
                        });
                    }
                }).catch(() =>
                {
                    sql.run(`CREATE TABLE IF NOT EXISTS "${message.guild.id}" (like TEXT, plus INTEGER, minus INTEGER)`).then(() =>
                    {
                        sql.run(`INSERT INTO "${message.guild.id}" (like, plus, minus) VALUES (?, ?, ?)`, [like.toLowerCase(), 1, 0]).then(() =>
                        {
                            if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES")) 
                                message.channel.send("\"" + like + "\" Has 1 likes. [1, 0]", {disableEveryone: true});
                        });
                    });
                });
            }
            else if (message.content.startsWith(gconfig.prefix))
            {
                const args = message.content.split(/\s+/g);
                const cmd = args.shift().slice(gconfig.prefix.length).toLowerCase();
                if (cmd.startsWith(".")) if (gconfig.prefix == ".") return; //allows people to say "..." if delete incorrect in enabled since default prefix is "."
                switch (cmd)
                {
                    case "ping":
                    {
                        if (!message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES")) return;
                        if (disabled.ping != "true") return message.channel.send("Pong.");
                        else
                        {
                            if (disabled.incorrectCommands != "true") return;
                            else
                            {
                                if (message.deletable) message.delete();
                                return message.channel.send("Incorrect Command.");
                                return;
                            }
                        }
                        return;
                    }
                    case "roll":
                    {
                        if (disabled.roll != "true")
                        {
                            if (!message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES")) return;
                            if (args[0] == null) return message.channel.send("please insert die roll (example: 1d6 is a single six sided die.)");
                            const d = args[0].indexOf("d");
                            if (d == -1) return;
                            var amount = parseInt(args[0].slice(0, d - args[0].length));
                            const sides = parseInt(args[0].slice(d + 1));
                            if (isNaN(sides) || sides < 1 || sides > 100) return message.channel.send("Amount of sides needs to be between 1 and 100 inclusively.");
                            if (isNaN(amount)) amount = 1;
                            if (amount < 1 || amount > 100) return message.channel.send("You can not have less than one roll or more than 100.");
                            var msg = "";
                            var roll = 0;
                            var count = 0;
                            for (var i = 0; i < amount; i++)
                            {
                                roll = Math.floor(Math.random() * Math.floor(sides)) + 1;
                                msg = msg + roll + ", ";
                                count += roll;
                            }
                            msg = `Rolled ${amount} dice with ${sides} sides: \`${count}\`\n\`\`\`` + msg.slice(0, -2) + "\`\`\`";
                            return message.channel.send(msg);
                        }
                        else
                        {
                            if (disabled.incorrectCommands != "true") return;
                            else
                            {
                                if (message.deletable) message.delete();
                                return message.channel.send("Incorrect Command.");
                            }
                        }
                        return;
                    }
                    case "convert":
                    case "communist":
                    case "metric":
                    {
                        if (disabled.conversion != "true")
                        {
                            if (!message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES")) return;
                            const amount = parseInt(args[0]);
                            const conversion = args[1];
                            if (isNaN(amount)) return message.reply("Please input something to convert.");
                            if (conversion == "inches" || conversion == "inch" || args[0].endsWith("in"))
                            {
                                return message.reply(`${amount} inches is about ${Math.round(amount * 2.54 * 100)/100} centimetres.`);
                            }
                            else if (conversion == "feet" || conversion == "foot" || args[0].endsWith("ft"))
                            {
                                return message.reply(`${amount} feet is about ${Math.round(amount * 0.305 * 100)/100} metres.`);
                            }
                            else if (conversion == "yards" || conversion == "yard" || args[0].endsWith("yd"))
                            {
                                return message.reply(`${amount} yards is about ${Math.round(amount * 0.915 * 100)/100} metres.`);
                            }
                            else if (conversion == "miles" || conversion == "mile" || args[0].endsWith("mi"))
                            {
                                return message.reply(`${amount} miles is about ${Math.round(amount * 1.61 * 100)/100} kilometres.`);
                            }
                            else if (conversion == "ounces" || conversion == "ounce" || args[0].endsWith("oz"))
                            {
                                return message.reply(`${amount} ounces is about ${Math.round(amount * 28.35 * 100)/100} grams.`);
                            }
                            else if (conversion == "pounds" || conversion == "pound" || args[0].endsWith("lb"))
                            {
                                return message.reply(`${amount} pounds is about ${Math.round(amount * 0.454 * 100)/100} kilograms.`);
                            }
                            else if (conversion == "fahrenheit" || args[0].endsWith("f"))
                            {
                                return message.reply(`${amount} fahrenheit is about ${Math.round((amount - 32) * 5 / 9 * 100)/100} celsius.`);
                            }
                        }
                        else
                        {
                            if (disabled.incorrectCommands != "true") return;
                            else
                            {
                                if (message.deletable) message.delete();
                                return message.channel.send("Incorrect Command.");
                            }
                        }
                    }
                    case "freedom":
                    case "imperial":
                    {
                        if (disabled.conversion != "true")
                        {
                            if (!message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES")) return;
                            const amount = parseInt(args[0]);
                            const conversion = args[1];
                            if (isNaN(amount)) return message.reply("Please input something to convert.");
                            if (conversion == "millimeters" || conversion == "millimeter" || conversion == "millimetres" || conversion == "millimetre" || args[0].endsWith("mm"))
                            {
                                return message.reply(`${amount} millimetres is about ${Math.round(amount * 0.039 * 100)/100} inches.`);
                            }
                            if (conversion == "centimeters" || conversion == "centimeter" || conversion == "centimetres" || conversion == "centimetre" || args[0].endsWith("cm"))
                            {
                                return message.reply(`${amount} centimetres is about ${Math.round(amount * 0.394 * 100)/100} inches.`);
                            }
                            else if (conversion == "kilometers" || conversion == "kilometer" || conversion == "kilometres" || conversion == "kilometre" || args[0].endsWith("km"))
                            {
                                return message.reply(`${amount} kilometres is about ${Math.round(amount * 0.621 * 100)/100} miles.`);
                            }
                            else if (conversion == "meters" || conversion == "meter" || conversion == "metres" || conversion == "metre" || args[0].endsWith("m"))
                            {
                                return message.reply(`${amount} metres is about ${Math.round(amount * 3.28 * 100)/100} feet.`);
                            }
                            else if (conversion == "kilograms" || conversion == "kilogram" || args[0].endsWith("kg"))
                            {
                                return message.reply(`${amount} kilograms is about ${Math.round(amount * 2.204 * 100)/100} pounds.`);
                            }
                            else if (conversion == "grams" || conversion == "gram" || args[0].endsWith("g"))
                            {
                                return message.reply(`${amount} grams is about ${Math.round(amount * 0.035 * 100)/100} ounces.`);
                            }
                            else if (conversion == "celsius" || args[0].endsWith("c"))
                            {
                                return message.reply(`${amount} celsius is about ${Math.round(((amount * 9 / 5) + 32) * 100)/100} fahrenheit.`);
                            }
                            else
                            {
                                return message.reply(`Unfortunately I do not have a conversion for ${args.join(' ')}.`);
                            }
                            return;
                        }
                        else
                        {
                            if (disabled.incorrectCommands != "true") return;
                            else
                            {
                                if (message.deletable) message.delete();
                                return message.channel.send("Incorrect Command.");
                            }
                        }
                        return;
                    }
                    case "points":
                    case "likes":
                    {
                        if (!message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES")) return;
                        if (disabled.like != "true")
                        {
                            const like = args.join(' ').trim();
                            sql.get(`SELECT * FROM "${message.guild.id}" WHERE like = "${like}"`).then(row =>
                            {
                                if (!row)
                                {
                                    sql.run(`INSERT INTO "${message.guild.id}" (like, plus, minus) VALUES (?, ?, ?)`, [like, 0, 0]).then(() =>
                                    {
                                        message.channel.send("\"" + args.join(' ').trim() + "\" Has no likes yet.", {disableEveryone: true});
                                    });
                                }
                                else
                                {
                                    message.channel.send("\"" + args.join(' ').trim() + "\" Has " + parseInt(row.plus + row.minus) +
                                        " likes. [" + parseInt(row.plus) + ", " + parseInt(row.minus) + "]", {disableEveryone: true});
                                }
                            }).catch(() =>
                            {
                                sql.run(`CREATE TABLE IF NOT EXISTS "${message.guild.id}" (like TEXT, plus INTEGER, minus INTEGER)`).then(() =>
                                {
                                    sql.run(`INSERT INTO "${message.guild.id}" (like, plus, minus) VALUES (?, ?, ?)`, [like, 0, 0]).then(() =>
                                    {
                                        message.channel.send("\"" + args.join(' ').trim() + "\" Has no likes yet.", {disableEveryone: true});
                                    });
                                });
                            });
                        }
                        else
                        {
                            if (disabled.incorrectCommands != "true") return;
                            else
                            {
                                if (message.deletable) message.delete();
                                message.channel.send("Incorrect Command.");
                                return;
                            }
                        }
                        return;
                    }
                    case "setdisabled":
                    {
                        if (message.deletable) message.delete();
                        const mod = message.guild.roles.find(role => {return gconfig.modRole == role.name;});
                        const admin = message.guild.roles.find(role => {return gconfig.adminRole == role.name;});
                        if (!mod) {if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES"))
                            return message.reply(`${gconfig.modRole} role not found.`, {disableEveryone: true}); return;}
                        if (!admin) {if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES"))
                            return message.reply(`${gconfig.adminRole} role not found.`, {disableEveryone: true}); return;}
                        if (!message.member.roles.some(role => [mod.id, admin.id].includes(role.id)) && message.member.id != config.owner)
                            return message.reply("This is a mod command.");
                        const [prop, ...value] = args;
                        if (prop == null) {if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES"))
                            return message.reply("Please input config to change."); return;}
                        if (disabled[prop] == null) {if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES"))
                            return message.reply(`${prop} is not in the config.`, {disableEveryone: true}); return;}
                        sql.run(`UPDATE disabled_cmd SET ${prop} = "${value}" WHERE guild = "${message.guild.id}"`)
                        if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES"))
                            return message.channel.send(`Command ${prop} disabled has been changed to: \`${value}\``);
                        return;
                    }
                    case "disable":
                    {
                        if (message.deletable) message.delete();
                        const mod = message.guild.roles.find(role => {return gconfig.modRole == role.name;});
                        const admin = message.guild.roles.find(role => {return gconfig.adminRole == role.name;});
                        if (!mod) {if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES"))
                            return message.reply(`${gconfig.modRole} role not found.`, {disableEveryone: true}); return;}
                        if (!admin) {if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES"))
                            return message.reply(`${gconfig.adminRole} role not found.`, {disableEveryone: true}); return;}
                        if (!message.member.roles.some(role => [mod.id, admin.id].includes(role.id)) && message.member.id != config.owner)
                            return message.reply("This is a mod command.");
                        if (args[0] == null) {if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES"))
                            return message.reply("Please input config to change."); return;}
                        if (disabled[args[0]] == null) {if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES"))
                            return message.reply(`${args[0]} is not in the config.`, {disableEveryone: true}); return;}
                        sql.run(`UPDATE disabled_cmd SET ${args[0]} = "true" WHERE guild = "${message.guild.id}"`)
                        if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES"))
                            return message.channel.send(`Command ${args[0]} has been \`disabled\`.`);
                    }
                    case "enable":
                    {
                        if (message.deletable) message.delete();
                        const mod = message.guild.roles.find(role => {return gconfig.modRole == role.name;});
                        const admin = message.guild.roles.find(role => {return gconfig.adminRole == role.name;});
                        if (!mod) {if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES"))
                            return message.reply(`${gconfig.modRole} role not found.`, {disableEveryone: true}); return;}
                        if (!admin) {if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES"))
                            return message.reply(`${gconfig.adminRole} role not found.`, {disableEveryone: true}); return;}
                        if (!message.member.roles.some(role => [mod.id, admin.id].includes(role.id)) && message.member.id != config.owner)
                            return message.reply("This is a mod command.");
                        if (args[0] == null) {if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES"))
                            return message.reply("Please input config to change."); return;}
                        if (disabled[args[0]] == null) {if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES"))
                            return message.reply(`${args[0]} is not in the config.`, {disableEveryone: true}); return;}
                        sql.run(`UPDATE disabled_cmd SET ${args[0]} = "false" WHERE guild = "${message.guild.id}"`)
                        if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES"))
                            return message.channel.send(`Command ${args[0]} has been \`enabled\`.`);
                    }
                    case "getdisabled":
                    case "showdisabled":
                    {
                        if (!message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES")) return;
                        if (message.deletable) message.delete();
                        const mod = message.guild.roles.find(role => {return gconfig.modRole == role.name;});
                        const admin = message.guild.roles.find(role => {return gconfig.adminRole == role.name;});
                        if (!mod) return message.reply(`${gconfig.modRole} role not found.`, {disableEveryone: true});
                        if (!admin) return message.reply(`${gconfig.adminRole} role not found.`, {disableEveryone: true});
                        if (!message.member.roles.some(role => [mod.id, admin.id].includes(role.id)) && message.member.id != config.owner)
                            return message.reply("This is a mod command.");
                        let configProps = Object.keys(disabled).map(prop => { return `\n${prop} : ${disabled[prop]}`; });
                        return message.channel.send(`The following commands are disabled: \`\`\`${configProps.slice(1)}\`\`\``);
                    }
                    case "setconfig":
                    {
                        if (disabled.setconfig != "true")
                        {
                            if (message.member.id != config.owner)
                            {
                                if (message.deletable) message.delete();
                                const admin = message.guild.roles.find(role => {return gconfig.adminRole == role.name;});
                                if (!admin) {if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES"))
                                    return message.reply(`${gconfig.adminRole} role not found.`, {disableEveryone: true}); return;}
                                if (!message.member.roles.has(admin.id))
                                    {if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES")) return message.reply("This is an admin command."); return;}
                                const prop = args[0];
                                const value = args.slice(1).join(' ').trim();
                                if (prop == null) {if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES"))
                                    return message.reply("Please input config to change."); return;}
                                if (gconfig[prop] == null) {if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES"))
                                    return message.reply(`${prop} is not in the config.`, {disableEveryone: true}); return;}
                                sql.run(`UPDATE g_config SET ${prop} = "${value}" WHERE guild = "${message.guild.id}"`)
                                if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES"))
                                    return message.channel.send(`Setting ${prop} has been changed to:\n\`${value}\``);
                                return;
                            }
                            else
                            {
                                const prop = args[0];
                                const value = args.slice(1).join(' ').trim();
                                if (prop == null) {if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES"))
                                    return message.reply("Please input config to change."); return;}
                                if (gconfig[prop] == null) {if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES"))
                                    return message.reply(`${prop} is not in the config.`, {disableEveryone: true}); return;}
                                sql.run(`UPDATE g_config SET ${prop} = "${value}" WHERE guild = "${message.guild.id}"`)
                                if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES"))
                                    return message.channel.send(`Setting ${prop} has been changed to:\n\`${value}\``);
                                return;
                            }
                        }
                        else
                        {
                            if (disabled.incorrectCommands != "true") return;
                            else
                            {
                                if (message.deletable) message.delete();
                                if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES")) return message.channel.send("Incorrect Command.");
                                return;
                            }
                        }
                        return;
                    }
                    case "getconfig":
                    case "showconfig":
                    {
                        if (!message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES")) return;
                        if (disabled.getconfig != "true")
                        {
                            if (message.deletable) message.delete();
                            let configProps = Object.keys(gconfig).map(prop => { return `\n${prop} : ${gconfig[prop]}`; });
                            return message.channel.send(`The following are the server's current configuration: \`\`\`${configProps.slice(1)}\`\`\``);
                        }
                        else
                        {
                            if (disabled.incorrectCommands != "true") return;
                            else
                            {
                                if (message.deletable) message.delete();
                                return message.channel.send("Incorrect Command.");
                            }
                        }
                        return;
                    }
                    case "roast":
                    {
                        if (message.deletable) message.delete();
                        const mod = message.guild.roles.find(role => {return gconfig.modRole == role.name;});
                        const admin = message.guild.roles.find(role => {return gconfig.adminRole == role.name;});
                        if (!mod) return message.reply(`${gconfig.modRole} role not found.`, {disableEveryone: true});
                        if (!admin) return message.reply(`${gconfig.adminRole} role not found.`, {disableEveryone: true});
                        if (!message.member.roles.some(role => [mod.id, admin.id].includes(role.id)) && message.member.id != config.owner)
                            return message.reply("This is a mod command.");
                        const synonyms = ["roasted", "ruined", "wrecked", "rekt", "shitstomped", "fucked up"];
                        if (args.length < 2) {if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES")) return message.channel.send("Please tell me who roasted whom."); return;}
                        const first = message.guild.members.find(user => {return args[0].slice(2, -1).replace("!", "") == user.id;});
                        const second = message.guild.members.find(user => {return args[1].slice(2, -1).replace("!", "") == user.id;});
                        if (!first || !second) {if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES")) return message.channel.send("Please tell me who roasted whom."); return;}
                        if (first.id == second.id) {if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES")) return message.channel.send("I'm sorry but you can not roast yourself or no one."); return;}
                        var msg = first.displayName + " " + synonyms[Math.floor(Math.random() * synonyms.length)] + " " + second.displayName + ".";
                        sql.get(`SELECT * FROM roasted_list WHERE name = "${first.id}"`).then(row =>
                        {
                            if (!row) sql.run(`INSERT INTO roasted_list (guild, name, roast, roasted) VALUES (?, ?, ?, ?)`, [message.guild.id, first.id, 1, 0]);
                            else sql.run(`UPDATE roasted_list SET roast = ${row.roast + 1} WHERE name = "${first.id}"`);
                        }).catch(() =>
                        {
                            sql.run(`CREATE TABLE IF NOT EXISTS roasted_list (guild TEXT, name TEXT, roast INTEGER, roasted INTEGER)`).then(() =>
                            {
                                sql.run(`INSERT INTO roasted_list (guild, name, roast, roasted) VALUES (?, ?, ?, ?)`, [message.guild.id, first.id, 1, 0]);
                            });
                        });
                        sql.get(`SELECT * FROM roasted_list WHERE name = "${second.id}"`).then(row =>
                        {
                            if (!row)
                            {
                                sql.run(`INSERT INTO roasted_list (guild, name, roast, roasted) VALUES (?, ?, ?, ?)`, [message.guild.id, second.id, 0, 1]);
                            }
                            else
                            {
                                sql.run(`UPDATE roasted_list SET roasted = ${row.roasted + 1} WHERE name = "${second.id}"`);
                            }
                        }).catch(() =>
                        {
                            sql.run(`CREATE TABLE IF NOT EXISTS roasted_list (guild TEXT, name TEXT, roast INTEGER, roasted INTEGER)`).then(() =>
                            {
                                sql.run(`INSERT INTO roasted_list (guild, name, roast, roasted) VALUES (?, ?, ?, ?)`, [message.guild.id, second.id, 0, 1]);
                            });
                        });
                        if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES")) return message.channel.send(msg);
                        else return;
                    }
                    case "unroast":
                    {
                        if (message.deletable) message.delete();
                        const mod = message.guild.roles.find(role => {return gconfig.modRole == role.name;});
                        const admin = message.guild.roles.find(role => {return gconfig.adminRole == role.name;});
                        if (!mod) return message.reply(`${gconfig.modRole} role not found.`, {disableEveryone: true});
                        if (!admin) return message.reply(`${gconfig.adminRole} role not found.`, {disableEveryone: true});
                        if (!message.member.roles.some(role => [mod.id, admin.id].includes(role.id)) && message.member.id != config.owner)
                            return message.reply("This is a mod command.");
                        const synonyms = ["unroasted", "unruined", "unwrecked", "unrekt", "unshitstomped", "unfucked up"];
                        if (args.length < 2) {if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES")) return message.channel.send("Please tell me who roasted whom."); return;}
                        const first = message.guild.members.find(user => {return args[0].slice(2, -1).replace("!", "") == user.id;});
                        const second = message.guild.members.find(user => {return args[1].slice(2, -1).replace("!", "") == user.id;});
                        if (!first || !second) {if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES")) return message.channel.send("Please tell me who roasted whom."); return;}
                        if (first.id == second.id) {if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES")) return message.channel.send("I'm sorry but you can not roast yourself or no one."); return;}
                        var msg = first.displayName + " " + synonyms[Math.floor(Math.random() * synonyms.length)] + " " + second.displayName + ".";
                        sql.get(`SELECT * FROM roasted_list WHERE name = "${first.id}"`).then(row =>
                        {
                            if (!row) sql.run(`INSERT INTO roasted_list (guild, name, roast, roasted) VALUES (?, ?, ?, ?)`, [message.guild.id, first.id, -1, 0]);
                            else sql.run(`UPDATE roasted_list SET roast = ${row.roast - 1} WHERE name = "${first.id}"`);
                        }).catch(() =>
                        {
                            sql.run(`CREATE TABLE IF NOT EXISTS roasted_list (guild TEXT, name TEXT, roast INTEGER, roasted INTEGER)`).then(() =>
                            {
                                sql.run(`INSERT INTO roasted_list (guild, name, roast, roasted) VALUES (?, ?, ?, ?)`, [message.guild.id, first.id, -1, 0]);
                            });
                        });
                        sql.get(`SELECT * FROM roasted_list WHERE name = "${second.id}"`).then(row =>
                        {
                            if (!row)
                            {
                                sql.run(`INSERT INTO roasted_list (guild, name, roast, roasted) VALUES (?, ?, ?, ?)`, [message.guild.id, second.id, 0, -1]);
                            }
                            else
                            {
                                sql.run(`UPDATE roasted_list SET roasted = ${row.roasted - 1} WHERE name = "${second.id}"`);
                            }
                        }).catch(() =>
                        {
                            sql.run(`CREATE TABLE IF NOT EXISTS roasted_list (guild TEXT, name TEXT, roast INTEGER, roasted INTEGER)`).then(() =>
                            {
                                sql.run(`INSERT INTO roasted_list (guild, name, roast, roasted) VALUES (?, ?, ?, ?)`, [message.guild.id, second.id, 0, -1]);
                            });
                        });
                        if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES")) return message.channel.send(msg);
                        else return;
                    }
                    case "roasted":
                    {
                        if (!message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES")) return;
                        const roast = message.guild.members.find(user => {return args[0].slice(2, -1).replace("!", "") == user.id;});
                        if (!roast) return message.channel.send("Who would you like to see roasted stats on?");
                        const synonyms = ["roasted", "ruined", "wrecked", "rekt", "shitstomped", "fucked up"];
                        sql.get(`SELECT * FROM roasted_list WHERE name = "${roast.id}"`).then(row =>
                        {
                            if (!row)
                            {
                                sql.run(`INSERT INTO roasted_list (guild, name, roast, roasted) VALUES (?, ?, ?, ?)`, [message.guild.id, roast.id, 0, 0]).then(() =>
                                {
                                    return message.channel.send(roast.displayName + " has not " + synonyms[Math.floor(Math.random() * synonyms.length)] + " anyone and has also not been " + synonyms[Math.floor(Math.random() * synonyms.length)] + ".", {disableEveryone: true});
                                });
                            }
                            else
                            {
                                return message.channel.send(roast.displayName + " has " + synonyms[Math.floor(Math.random() * synonyms.length)] + " \`" + row.roast +
                                    "\` people and has been " + synonyms[Math.floor(Math.random() * synonyms.length)] + " \`" + row.roasted + "\` times.", {disableEveryone: true});
                            }
                        }).catch(() =>
                        {
                            sql.run(`CREATE TABLE IF NOT EXISTS roasted_list (guild TEXT, name TEXT, roast INTEGER, roasted INTEGER)`).then(() =>
                            {
                                sql.run(`INSERT INTO roasted_list (guild, name, roast, roasted) VALUES (?, ?, ?, ?)`, [message.guild.id, roast.id, 0, 0]).then(() =>
                                {
                                    return message.channel.send(roast.displayName + " has not " + synonyms[Math.floor(Math.random() * synonyms.length)] + " anyone and has also not been " + synonyms[Math.floor(Math.random() * synonyms.length)] + ".", {disableEveryone: true});
                                });
                            });
                        });
                        return;
                    }
                    case "nick":
                    { 
                        if (disabled.nick != "true")
                        {
                            if (message.deletable) message.delete();
                            const mod = message.guild.roles.find(role => {return gconfig.modRole == role.name;});
                            const admin = message.guild.roles.find(role => {return gconfig.adminRole == role.name;});
                            if (!mod) {if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES"))
                                return message.reply(`${gconfig.modRole} role not found.`, {disableEveryone: true}); return;}
                            if (!admin) {if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES"))
                                return message.reply(`${gconfig.adminRole} role not found.`, {disableEveryone: true}); return;}
                            if (!message.member.roles.some(role => [mod.id, admin.id].includes(role.id)) && message.member.id != config.owner) 
                                if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES")) return message.reply("This is a mod command.");
                            if (message.channel.memberPermissions(message.guild.me).has("CHANGE_NICKNAME"))
                            {
                                message.guild.member(bot.user).setNickname(args.join(' '));
                                if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES")) return message.channel.send("Nickname changed.");
                            }
                            else if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES")) return message.channel.send("No nick permissions.");
                            return;
                        }
                        else
                        {
                            if (disabled.incorrectCommands != "true") return;
                            else
                            {
                                if (message.deletable) message.delete();
                                if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES")) return message.channel.send("Incorrect Command.");
                                return;
                            }
                        }
                        return;
                    }
                    case "name":
                    {
                        if (message.member.id != config.owner) return;
                        if (message.deletable) message.delete();
                        if (message.channel.memberPermissions(message.guild.me).has("MANAGE_NICKNAMES") && message.guild.members.find(user => {return args[0].slice(2, -1).replace("!", "") == user.id;}).manageable)
                                return message.guild.members.find(user => {return args[0].slice(2, -1).replace("!", "") == user.id;}).setNickname(args.slice(1).join(' '));
                        return;
                    }
                    case "in":
                    case "remindme":
                    { 
                        if (!message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES")) return;
                        if (disabled.reminders != "true")
                        {
                            const delay = args[0];
                            if (delay == null || isNaN(delay.slice(0, -1))) return message.reply("Please specify a valid time and a message.");
                            var msg = args.slice(1).join(' ');
                            var time = 60000;
                            if (delay.startsWith('-')) return message.reply("Invalid time.");
                            if (delay.endsWith('s'))
                            {
                                time = parseInt(delay) * 1000;
                                if (time > 1814400000) return message.reply("Invalid time, max time allowed is 3 weeks (1,814,400 seconds).");
                                message.reply(`I will remind you in ${parseInt(delay)} seconds.`);
                            }
                            else if (delay.endsWith('m'))
                            {
                                time = parseInt(delay) * 1000 * 60;
                                if (time > 1814400000) return message.reply("Invalid time, max time allowed is 3 weeks (30,240 minutes).");
                                message.reply(`I will remind you in ${parseInt(delay)} minutes`);
                            }
                            else if (delay.endsWith('h'))
                            {
                                time = parseInt(delay) * 1000 * 60 * 60;
                                if (time > 1814400000) return message.reply("Invalid time, max time allowed is 3 weeks (504 hours).");
                                message.reply(`I will remind you in ${parseInt(delay)} hours`);
                            }
                            else if (delay.endsWith('d'))
                            {
                                time = parseInt(delay) * 1000 * 60 * 60 * 24;
                                if (time > 1814400000) return message.reply("Invalid time, max time allowed is 3 weeks (21 days).");
                                message.reply(`I will remind you in ${parseInt(delay)} days`);
                            }
                            else
                            {
                                if (args[1] == "seconds" || args[1] == "second")
                                {
                                    if (args[1] == "seconds") msg = msg.slice(8);
                                    else msg.slice(7);
                                    time = parseInt(delay) * 1000;
                                    if (time > 1814400000) return message.reply("Invalid time, max time allowed is 3 weeks (1,814,400 seconds).");
                                    message.reply(`I will remind you in ${parseInt(delay)} seconds.`);
                                }
                                else if (args[1] == "minutes" || args[1] == "minute")
                                {
                                    if (args[1] == "minutes") msg = msg.slice(8);
                                    else msg = msg.slice(7);
                                    time = parseInt(delay) * 1000 * 60;
                                    if (time > 1814400000) return message.reply("Invalid time, max time allowed is 3 weeks (30,240 minutes).");
                                    message.reply(`I will remind you in ${parseInt(delay)} minutes`);
                                }
                                else if (args[1] == "hours" || args[1] == "hour")
                                {
                                    if (args[1] == "hours") msg = msg.slice(6);
                                    else msg = msg.slice(5);
                                    time = parseInt(delay) * 1000 * 60 * 60;
                                    if (time > 1814400000) return message.reply("Invalid time, max time allowed is 3 weeks (504 hours).");
                                    message.reply(`I will remind you in ${parseInt(delay)} hours`);
                                }
                                else if (args[1] == "days" || args[1] == "day")
                                {
                                    if (args[1] == "days") msg = msg.slice(5);
                                    else msg = msg.slice(4);
                                    time = parseInt(delay) * 1000 * 60 * 60 * 24;
                                    if (time > 1814400000) return message.reply("Invalid time, max time allowed is 3 weeks (21 days).");
                                    message.reply(`I will remind you in ${parseInt(delay)} days`);
                                }
                                else
                                {
                                    time = parseInt(delay) * 1000 * 60;
                                    if (time > 1814400000) return message.reply("Invalid time, max time allowed is 3 weeks (30,240 minutes).");
                                    message.reply(`I will remind you in ${parseInt(delay)} minutes`);
                                }
                            }
                            var pending = new Date().getTime();
                            pending += time;
                            pending = pending.toString();
                            sql.run(`INSERT INTO pending_messages (guild, channel, user, time, message) VALUES (?, ?, ?, ?, ?)`,
                                [message.guild.id, message.channel.id, message.author.id, pending, msg]);
                            bot.setTimeout(() =>
                            {
                                if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES")) message.reply(msg, {disableEveryone: true});
                                sql.run(`DELETE FROM pending_messages WHERE time = "${pending}"`);
                            }, time);
                            return;
                        }
                        else
                        {
                            if (disabled.incorrectCommands != "true") return;
                            else
                            {
                                if (message.deletable) message.delete();
                                return message.channel.send("Incorrect Command.");
                            }
                        }
                        return;
                    }
                    case "logout":
                    {
                        if (message.member.id != config.owner) {if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES"))
                            return message.reply("This is a bot owner command.");} return;
                        if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES")) message.channel.send("Shutting down.");
                        return bot.destroy();
                    }
                    case "test":
                    {
                        if (message.member.id != config.owner) return;
                        
                    }
                    case "help":
                    {
                        if (disabled.help != "true")
                        {
                            if (!message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES")) return;
                            var help = args[0];
                            if (help == null)
                            {
                                const mod = message.guild.roles.find(role => {return gconfig.modRole == role.name;});
                                const admin = message.guild.roles.find(role => {return gconfig.adminRole == role.name;});
                                if (!mod) return message.reply(`${gconfig.modRole} role not found.`, {disableEveryone: true});
                                if (!admin) return message.reply(`${gconfig.adminRole} role not found.`, {disableEveryone: true});
                                var msg = "\`\`\`Available commands are:\nEveryone: ";
                                if (disabled.like != "true") msg = msg + "likes, points, ";
                                if (disabled.ping != "true") msg = msg + "ping, ";
                                if (disabled.reminders != "true") msg = msg + "in, remindme, ";
                                if (disabled.getconfig != "true") msg = msg + "getconfig, showconfig, ";
                                if (disabled.conversion != "true") msg = msg + "convert, communist, metric, freedom, imperial, ";
                                if (disabled.roll != "true") msg = msg + "roll, ";
                                msg = msg + "roasted, help.";
                                if (message.member.roles.some(role => [mod.id, admin.id].includes(role.id) || message.member.id == config.owner))
                                {
                                    msg = msg + "\nMod: ";
                                    if (disabled.nick != "true") msg = msg + "nick, ";
                                    msg = msg + "roast, unroast, setdisabled, getdisabled, showdisabled, disable, enable.";
                                }
                                if (message.member.roles.has(admin.id) || message.member.id == config.owner)
                                {
                                    msg = msg + "\nAdmin: ";
                                    if (disabled.setconfig != "true") msg = msg + "setconfig.";
                                }
                                if (message.member.id == config.owner)
                                {
                                    msg = msg + "\nOwner: logout.";

                                }
                                return message.channel.send(msg + "\`\`\`");
                            }
                            else
                            {
                                help = help.toLowerCase();
                                if(help == "likes" || help == "points")
                                {
                                    return message.channel.send("\`likes <phrase>\`, \`points <phrase>\`\nDisplays the amount of likes and dislikes of <phrase>, to give <phrase> a like or dislike append \"++\" or \"--\" to the end of the phrase. (Example: Penis++)");
                                }
                                else if(help == "ping")
                                {
                                    return message.channel.send("replies with \"Pong.\"");
                                }
                                else if(help == "in" || help == "remindme")
                                {
                                    return message.channel.send("\`in <number>[l] [size] <phrase>\`, \`remindme <number>[l] [size] <phrase>\`\nWill notify you with <phrase> after <number>[l] [size] is met. If both [l] and [size] are used, [l] is taken and [size] is used in <phrase>. [l] allowed: s, m, h, d. [size] allowed: seconds, minutes, hours, days. If no [l] or [size] is used, minutes are used. (Examples: .in 10 minutes remind me penis exists. .remindme 10s I have a very short memory.) Note, maximum time is 21 days.");
                                }
                                else if(help == "getconfig" || help == "showconfig")
                                {
                                    return message.channel.send("Shows the guild's configuration.");
                                }
                                else if(help == "convert")
                                {
                                    return message.channel.send("\`convert <amount>[SI] [unit]\`\nConverts <amount> from [SI] or [unit] to another unit. Accepts inches, feet, yards, miles, millimetres, centimetres, metres, kilometres, ounces, pounds, grams, kilograms, fahrenheit, and celsius.");
                                }
                                else if(help == "communist" || help == "metric")
                                {
                                    return message.channel.send("\`communist <amount>[SI] [unit]\`, \`metric <amount>[SI] [unit]\`\nConverts <amount> from freedom [unit](or [SI]) to communist units (imperial to metric). Accepts inches, feet, yards, miles, ounces, pounds, and fahrenheit.");
                                }
                                else if(help == "freedom" || help == "imperial")
                                {
                                    return message.channel.send("\`freedom <amount>[SI] [unit]\`, \`imperial <amount>[SI] [unit]\`\nConverts <amount> from communist [unit](or [SI]) to freedom units (metric to imperial). Accepts millimetres, centimetres, metres, kilometres, grams, kilograms, and celsius.");
                                }
                                else if(help == "roll")
                                {
                                    return message.channel.send("\`roll [amount]d<sides>\`\nRolls [amount] of dice with <sides> sides. If amount is left out it will roll 1 die. [amount] and <sides> must be between 1 and 100 inclusively. (Example: .roll 4d10)");
                                }
                                else if(help == "roasted")
                                {
                                    return message.channel.send("\`roasted <user>\`\nDisplays how many times <user> has roasted and been roasted.");
                                }
                                else if(help == "help")
                                {
                                    return message.channel.send("\`help [command]\`\nShows you all enabled commands that you can use. If [command] is entered it displays help for that command. (Example: .help help)");
                                }
                                else if(help == "nick")
                                {
                                    return message.channel.send("\`nick <name>\`\nNicknames the bot to <name>. (Example: .nick Buttlidor) Note, this is a MOD command.");
                                }
                                else if(help == "roast")
                                {
                                    return message.channel.send("\`roast <roaster> <roasted>\`\n<roaster> roasts <roasted>, adds a counter to their roast levels, don't overcook!");
                                }
                                else if(help == "unroast")
                                {
                                    return message.channel.send("\`roast <roaster> <roasted>\`\n<roaster> unroasts <roasted>, subtracts a counter to their roast levels, chilly!");
                                }
                                else if(help == "setdisabled")
                                {
                                    return message.channel.send("\`setdisabled <command> <true/false>\`\nDisables the use of <command> if <true> or enables if <false>, setting incorrectCommands to <true> enables the bot to delete all incorrectCommands. Note, this is a MOD command.");
                                }
                                else if(help == "getdisabled" || help == "showdisabled")
                                {
                                    return message.channel.send("Shows the guild's disabled commands list. Note, this is a MOD command.");
                                }
                                else if(help == "disable")
                                {
                                    return message.channel.send("\`disable <command>\`\nDisables the use of <command>. Note, this is a MOD command.");
                                }
                                else if(help == "enable")
                                {
                                    return message.channel.send("\`enable <command>\`\nEnables the use of <command>. Note, this is a MOD command.");
                                }
                                else if(help == "setconfig")
                                {
                                    return message.channel.send("\`setconfig <config> <value>\`\nSets <config> to <value>. Note, this is an ADMIN command.");
                                }
                                else if(help == "logout")
                                {
                                    return message.channel.send("This logs the bot off of discord. Note, you can't use this command so why are you looking at the help for it?");
                                }
                                else
                                {
                                    return message.channel.send(`No such command \`${help}\``);
                                }
                                return;
                            }
                        }
                        else
                        {
                            if (disabled.incorrectCommands != "true") return;
                            else
                            {
                                if (message.deletable) message.delete();
                                return message.channel.send("Incorrect Command.");
                            }
                        }
                        return;
                    }
                    default:
                    {
                        if (disabled.incorrectCommands != "true") return;
                        else
                        {
                            if (message.deletable) message.delete();
                            if (message.channel.memberPermissions(message.guild.me).has("SEND_MESSAGES")) message.channel.send("Incorrect Command.");
                            return;
                        }
                        return;
                    }
                }
            }
            else return;
        });
    });
});