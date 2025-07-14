import {
	TextDisplayBuilder,
	SeparatorBuilder,
	SeparatorSpacingSize,
	ContainerBuilder,
	WebhookClient,
	MessageFlags,
	type APIContainerComponent,
} from 'discord.js';
import type { Server } from './types';

export class Webhook {
	private static webhookURL: string;

	constructor(webhookUrl: string) {
		if (!webhookUrl) {
			throw new Error('Webhook URL is required');
		}
		Webhook.webhookURL = webhookUrl;
	}

	private static async send(data: {
		components: APIContainerComponent[];
		flags: MessageFlags;
	}) {
		await fetch(`${Webhook.webhookURL}?with_components=true`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(data),
		});
	}

	private static MessageInfoBuilder(server: Server, isOnline: boolean): string {
		if (server.clientId === 'Discord-Client') {
			return 'Discord Client';
		}
		if (isOnline) {
			return `
Server IP: ${server.ip}
Server Port: ${server.port}
Server UUID: ${server.uuid}
Server IsLobby: ${server.isLobby}`;
		} else {
			return `
Server IP: ${server.ip}
Server UUID: ${server.uuid}
Server IsLobby: ${server.isLobby}`;
		}
	}

	public static sendOnline(server: Server): void {
		Webhook.send({
			components: [
				new ContainerBuilder()
					.addTextDisplayComponents(
						new TextDisplayBuilder().setContent('🟢 Server Online'),
					)
					.addSeparatorComponents(
						new SeparatorBuilder()
							.setSpacing(SeparatorSpacingSize.Small)
							.setDivider(false),
					)
					.addTextDisplayComponents(
						new TextDisplayBuilder().setContent('Server Info :'),
					)
					.addTextDisplayComponents(
						new TextDisplayBuilder().setContent(
							Webhook.MessageInfoBuilder(server, true),
						),
					)
					.toJSON(),
			],
			flags: MessageFlags.IsComponentsV2,
		});
	}
	public static sendOffline(server: Server): void {
		Webhook.send({
			components: [
				new ContainerBuilder()
					.addTextDisplayComponents(
						new TextDisplayBuilder().setContent('🔴 Server Offline'),
					)
					.addSeparatorComponents(
						new SeparatorBuilder()
							.setSpacing(SeparatorSpacingSize.Small)
							.setDivider(false),
					)
					.addTextDisplayComponents(
						new TextDisplayBuilder().setContent('Server Info :'),
					)
					.addTextDisplayComponents(
						new TextDisplayBuilder().setContent(
							Webhook.MessageInfoBuilder(server, false),
						),
					)
					.toJSON(),
			],
			flags: MessageFlags.IsComponentsV2,
		});
	}

	public static async sendServerOffline() {
		await Webhook.send({
			components: [
				new ContainerBuilder()
					.addTextDisplayComponents(
						new TextDisplayBuilder().setContent('🔴 Server Offline'),
					)
					.addSeparatorComponents(
						new SeparatorBuilder()
							.setSpacing(SeparatorSpacingSize.Small)
							.setDivider(false),
					)
					.addTextDisplayComponents(
						new TextDisplayBuilder().setContent('Server Info :'),
					)
					.addTextDisplayComponents(
						new TextDisplayBuilder().setContent(
							'Main(Backend) Server Offline.',
						),
					)
					.toJSON(),
			],
			flags: MessageFlags.IsComponentsV2,
		});
	}
}
