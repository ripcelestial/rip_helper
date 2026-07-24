import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { getGuildConfig } from '../../services/guildConfig.js';

function resolveRoleId(roleValue) {
    if (!roleValue) return null;
    if (typeof roleValue === 'string') return roleValue;
    if (typeof roleValue === 'object' && roleValue.id) return roleValue.id;
    return null;
}

export default {
    data: new SlashCommandBuilder()
        .setName('web-config')
        .setDescription('Get your link to the web dashboard.')
        .setDMPermission(false),
    // Note: no setDefaultMemberPermissions here on purpose — staff members
    // who only have the configured mod/admin role (not Manage Server)
    // still need to be able to see and run this command.

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const config = await getGuildConfig(interaction.client, interaction.guild.id);
            const modRoleId = resolveRoleId(config.modRole);
            const adminRoleId = resolveRoleId(config.adminRole);

            const memberRoles = interaction.member.roles.cache;
            const hasStaffRole =
                (modRoleId && memberRoles.has(modRoleId)) ||
                (adminRoleId && memberRoles.has(adminRoleId));
            const hasManageGuild = interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);

            // Fallback: if no mod/admin role has been set up yet, only let
            // Manage Server holders through so no one gets locked out.
            const noStaffRolesConfigured = !modRoleId && !adminRoleId;
            const isAllowed = hasStaffRole || hasManageGuild || (noStaffRolesConfigured && hasManageGuild);

            if (!isAllowed) {
                await interaction.editReply({
                    content: '❌ You need the staff/mod/admin role (or Manage Server permission) to view the dashboard link.'
                });
                return;
            }

            const baseUrl = process.env.DASHBOARD_URL || 'https://rip-helper.onrender.com';
            const dashboardUrl = `${baseUrl}/manage.html`;

            await interaction.editReply({
                content: `🌐 **TitanBot Web Dashboard**\n\nYou can configure server settings, view stats, and manage modules directly from the web panel.\n\n🔗 **Dashboard Link:** ${dashboardUrl}\n*Note: Log in with your Discord account on the dashboard first.*`
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
