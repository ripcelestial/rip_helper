import { SlashCommandBuilder, EmbedBuilder, version as djsVersion } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Displays information and uptime performance about TitanBot.'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: false });

        const client = interaction.client;
        const uptimeSeconds = Math.floor(process.uptime());
        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = uptimeSeconds % 60;
        
        const uptimeString = `${hours}h ${minutes}m ${seconds}s`;
        const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

        const statsEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('📊 TitanBot System Information')
            .addFields(
                { name: '🤖 Bot Version', value: '`2.0.0`', inline: true },
                { name: '🟢 Discord.js', value: `\`v${djsVersion}\``, inline: true },
                { name: '📦 Node.js', value: `\`${process.version}\``, inline: true },
                { name: '⏳ System Uptime', value: `\`${uptimeString}\``, inline: true },
                { name: '💾 Memory Footprint', value: `\`${memoryUsage} MB\``, inline: true },
                { name: '🛡️ Connected Guilds', value: `\`${client.guilds.cache.size}\``, inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [statsEmbed] });
    },
};