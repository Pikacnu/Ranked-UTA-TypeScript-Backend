import { Glob } from 'bun';
import type { CommandData } from './type';

export async function loadCommands() {
	const commands: CommandData[] = [];

	const files = Array.from(
		new Glob('*.ts').scanSync({ cwd: './src/commands' }),
	);

	for (const file of files) {
		try {
			const mod = await import(`./${file}`);
			console.log(`Loading command from ${file}`);
			if (!mod || !mod.command) {
				console.warn(`⚠ No command found in ${file}`);
				continue;
			}
			const command = mod.command as CommandData;
			if (!command.commandBuilder || !command.execute) {
				console.warn(`⚠ Invalid command structure in ${file}`);
				continue;
			}
			commands.push(command);
			try {
			} catch (error) {
				console.warn(`⚠ Invalid command structure in ${file}:`, error);
				continue;
			}
		} catch (error) {
			console.error(`✗ Failed to load command from ${file}:`, error);
		}
	}

	return commands;
}
