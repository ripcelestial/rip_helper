import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('web-config')
        .setDescription('Manage or view the web dashboard configuration link.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const bot = interaction.client;
            
            // Derive hostname and ports seamlessly from environment configurations
            const host = process.env.WEB_HOST || 'localhost';
            const port = bot.config?.api?.port || process.env.PORT || 3000;
            const dashboardUrl = `http://${host}:${port}/dashboard`;

            await interaction.editReply({
                content: `🌐 **TitanBot Web Dashboard**\n\nYou can configure server settings, view stats, and manage modules directly from the web panel.\n\n🔗 **Dashboard Link:** ${dashboardUrl}\n*Note: Ensure your account is logged in via Discord on the dashboard.*`
            });
        } catch (error) {
            if (interaction.client.logger) {
                interaction.client.logger.error(`Error running web-config command: ${error.message}`);
            } else {
                console.error(`Error running web-config command: ${error.message}`);
            }
            
            await interaction.editReply({
                content: '❌ Something went wrong while generating the configuration link.'
            });
        }
    },
};