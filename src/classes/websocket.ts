import type { MesssageQueueEntry } from '#/commands/type';
import {
	Action,
	SizeToQueueName,
	type GamePlayer,
	type Message as WSMessage,
} from '@/types';
import { type Message } from '#/commands/type';
import {
	Client,
	MessageFlags,
	SectionBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
	TextChannel,
	TextDisplayBuilder,
	ThumbnailBuilder,
	type GuildTextBasedChannel,
} from 'discord.js';

export class WebsocketClient {
	private static client: WebSocket | null = null;
	public static RequestQueue: MesssageQueueEntry[] = [];
	private static clientId: string = 'Discord-Client';
	private static connectUrl: string | null = null;
	private static reconnectTime = 5000; // 5 seconds
	private static discordClient: Client | null = null;

	public static initialize(url: string, client: Client): void {
		if (this.client) {
			console.warn('WebSocket client is already initialized.');
			return;
		}
		this.client = new WebSocket(url);
		this.discordClient = client;
		this.connectUrl = url;
		this.client.onopen = () => {
			console.log('WebSocket connection established.');
		};
		this.client.onmessage = async (event) => {
			try {
				const data = JSON.parse(event.data) as Message;
				if (!data || !data.action) {
					console.error('Invalid message format:', event.data);
					return;
				}
				if (data.action === Action.handshake) {
					this.sendMessage({
						action: Action.handshake,
						sessionId: data.sessionId,
						payload: {
							handshake: {
								isLobby: true,
								sessionId: this.clientId,
								serverIP: '',
								serverPort: 0,
							},
						},
					});
				}
				if (data.action === Action.heartbeat) {
					this.sendMessage({
						action: Action.heartbeat,
					});
				}

				if (data.action === Action.output_win) {
					if (!data.payload || !data.payload.data) {
						console.error('Output win data is missing:', data);
						return;
					}
					if (data.payload.data) {
						const {
							gameId,
							isTeam1Win,
							isNoTeamWin,
							team1,
							team2,
							team1DeltaScore,
							team2DeltaScore,
						} = data.payload.data as {
							gameId: string;
							isTeam1Win: boolean;
							isNoTeamWin?: boolean;
							team1: GamePlayer[];
							team2: GamePlayer[];
							team1DeltaScore: number;
							team2DeltaScore: number;
						};
						console.log(
							`Game ID: ${gameId}, Team 1 Win: ${isTeam1Win}, Team 1 Delta Score: ${team1DeltaScore}, Team 2 Delta Score: ${team2DeltaScore}`,
						);
						let components;
						if (team1.length === 1) {
							components = [
								new TextDisplayBuilder().setContent(
									`# ${team1[0].minecraftId} VS ${team2[0].minecraftId}\n**${
										!isNoTeamWin
											? isTeam1Win
												? team1[0].minecraftId
												: team2[0].minecraftId
											: 'No One'
									} WON (+${isTeam1Win ? team1DeltaScore : team2DeltaScore})**`,
								),
								new SeparatorBuilder()
									.setSpacing(SeparatorSpacingSize.Small)
									.setDivider(true),
							];
						} else {
							components = [
								new SectionBuilder()
									.setThumbnailAccessory(
										new ThumbnailBuilder().setURL(
											'https://focalsalt.github.io/data/img/team1.png',
										),
									)
									.addTextDisplayComponents(
										new TextDisplayBuilder().setContent('# Team1'),
										new TextDisplayBuilder().setContent(
											`Player: ${team1.map((p) => p.minecraftId).join(', ')}`,
										),
									),
								new SectionBuilder()
									.setThumbnailAccessory(
										new ThumbnailBuilder().setURL(
											'https://focalsalt.github.io/data/img/team2.png',
										),
									)
									.addTextDisplayComponents(
										new TextDisplayBuilder().setContent('# Team2'),
										new TextDisplayBuilder().setContent(
											`Player: ${team2.map((p) => p.minecraftId).join(', ')}`,
										),
									),
								new TextDisplayBuilder().setContent(
									`## ${SizeToQueueName[team1.length]} | ${
										isNoTeamWin ? 'No One' : isTeam1Win ? 'Team1' : 'Team2'
									} Won !!!\nTheir rank score increased by **${
										isNoTeamWin
											? team1DeltaScore
											: isTeam1Win
											? team1DeltaScore
											: team2DeltaScore
									}**`,
								),
							];
						}
						const channel = await this.discordClient?.channels.fetch(
							'1386939249160355951',
						);
						if (channel?.isTextBased()) {
							const textChannel = channel as
								| GuildTextBasedChannel
								| TextChannel;
							textChannel.send({
								components: components || [],
								flags: MessageFlags.IsComponentsV2,
							});
						}
					}
				}

				if (
					data.action !== Action.handshake &&
					data.action !== Action.heartbeat
				) {
					console.log(`
						Received message: ${data.action}`);
				}

				const request = this.RequestQueue.sort(
					(a, b) => a.timestamp - b.timestamp,
				).find((req) => req.action === data.action);

				request?.callback(data);
				this.RequestQueue = this.RequestQueue.filter(
					(req) =>
						req.action !== data.action && req.timestamp !== request?.timestamp,
				);
			} catch (error) {
				console.error('Error parsing WebSocket message:', error);
			}
		};
		this.client.onerror = (error) => {
			console.error('WebSocket error:', error);
			this.reconnect(); // Attempt to reconnect on error
		};
		this.client.onclose = () => {
			console.log('WebSocket connection closed.');
			this.client = null; // Reset client on close
			this.reconnect(); // Attempt to reconnect on error
		};
	}

	private static reconnect(): void {
		if (this.client && this.client.readyState === WebSocket.OPEN) {
			console.warn('WebSocket client is already connected.');
			return;
		}
		console.log('Reconnecting WebSocket client...');
		setTimeout(() => {
			this.initialize(this.connectUrl || '', this.discordClient as Client); // Replace with your WebSocket server URL
		}, this.reconnectTime);
	}

	public static sendMessage(
		message: Message,
		callback?: (message: Message) => void,
	): void {
		if (!this.client || this.client.readyState !== WebSocket.OPEN) {
			console.error('WebSocket client is not connected.');
			return;
		}
		try {
			this.client.send(
				message.sessionId
					? JSON.stringify({ ...message } as WSMessage)
					: JSON.stringify({
							...message,
							sessionId: this.clientId,
					  } as WSMessage),
			);
			if (
				!(
					message.action === Action.handshake ||
					message.action === Action.heartbeat
				)
			) {
				console.log('Message sent:', message);
			}
			if (callback) {
				this.RequestQueue.push({
					action: message.action,
					timestamp: Date.now(),
					callback,
				});
			}
		} catch (error) {
			console.error('Error sending WebSocket message:', error);
		}
	}
}
