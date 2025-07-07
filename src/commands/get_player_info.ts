import {
	ContainerBuilder,
	MessageFlags,
	SectionBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
	SlashCommandBuilder,
	TextDisplayBuilder,
	ThumbnailBuilder,
} from 'discord.js';
import { getRankByElo, ICommand } from './type';
import { WebsocketClient } from '#/classes/websocket';
import { Action } from '@/types';

export const command = new ICommand({
	commandBuilder: new SlashCommandBuilder()
		.setName('get_info')
		.setDescription('Get player info')
		.addStringOption((option) =>
			option
				.setName('playerid')
				.setDescription('The player ID to get the info for'),
		),
	execute: async (interaction) => {
		const playerID = interaction.options.getString('playerid');
		if (!playerID || playerID.trim() === '') {
			await interaction.reply({
				content: 'Please provide a valid player ID.',
				ephemeral: true,
			});
			return;
		}

		WebsocketClient.sendMessage(
			{
				action: Action.get_player_data,
				payload: {
					player: {
						minecraftId: playerID,
					},
				},
			},
			(message) => {
				if (message.status === 0) {
					interaction.reply({
						content: `Error: ${message.payload?.message || 'Unknown error'}`,
					});
					return;
				}
				const components = [
					new SectionBuilder()
						.setThumbnailAccessory(
							new ThumbnailBuilder().setURL(
								`https://mc-heads.net/avatar/${message.payload?.player?.uuid}/100`,
							),
						)
						.addTextDisplayComponents(
							new TextDisplayBuilder().setContent('# Ranked UTA Player Info'),
							new TextDisplayBuilder().setContent(
								`Minecraft ID: **${message.payload?.player?.minecraftId}**`,
							),
							new TextDisplayBuilder().setContent(
								`-# ${message.payload?.player?.uuid}`,
							),
						),
					new SeparatorBuilder()
						.setSpacing(SeparatorSpacingSize.Small)
						.setDivider(false),
					new TextDisplayBuilder().setContent(
						`Elo: **${
							getRankByElo(message.payload?.player?.score || 0)?.name
						}** | Rank: ${
							message.payload?.player?.score
								? message.payload.player.score
								: 'Unranked'
						} | Played: ${message.payload?.player?.gameCount || 0} games`,
					),
					new TextDisplayBuilder().setContent(
						'-# __*Data is transfering from Nebulirion Asteroid belt*__',
					),
				];
				interaction.reply({
					components: components,
					flags: MessageFlags.IsComponentsV2,
				});
			},
		);
	},
});
