// src/commands/utility/web-config.js
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('web-config')
        .setDescription('Retrieve the private link to the creator administrative portal.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Strictly limits to Administrators

    async execute(interaction) {
        const ALLOWED_GUILD_ID = "YOUR_FRIENDS_SERVER_ID"; // Replace with your friend's target Discord Server ID
        
        // Security gate check
        if (interaction.guildId !== ALLOWED_GUILD_ID) {
            return interaction.reply({ 
                content: "❌ Security Limit: This command is restricted to the main server installation.", 
                ephemeral: true 
            });
        }

        const dashboardUrl = `http://localhost:3000`; // Update with your Render URL (e.g., https://rip-helper.onrender.com) once deployed

        const embed = new EmbedBuilder()
            .setTitle('🔐 Creator Administration Access')
            .setDescription('Click below to securely authenticate with your Discord developer credentials.')
            .setColor('#a855f7')
            .addFields(
                { name: 'Private Gateway', value: 'Any unauthorized accounts attempt to access this web configuration portal will be automatically blocked.' }
            )
            .setFooter({ text: 'rip_helper Gateway Controller' })
            .setTimestamp();

        // Ephemeral ensures only the Administrator running the command can see this private response
        await interaction.reply({
            embeds: [embed],
            components: [
                {
                    type: 1, // Action Row
                    components: [
                        {
                            type: 2, // Button
                            style: 5, // Link type
                            label: 'Access Creator Dashboard',
                            url: dashboardUrl
                        }
                    ]
                }
            ],
            ephemeral: true 
        });
    },
};