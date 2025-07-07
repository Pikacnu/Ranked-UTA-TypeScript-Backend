import { spawn, type Subprocess } from 'bun';

const createSubProcess = async (
	cmd: string[],
	prefix: string,
): Promise<Subprocess> => {
	let subProcess: Subprocess = spawn({
		cmd: cmd,
		cwd: import.meta.dir,
		stdout: 'pipe',
		stderr: 'pipe',
		env: {
			...process.env,
			NODE_ENV: 'development',
		},
	});
	const stdout = subProcess.stdout as Bun.BunReadableStream;
	const stderr = subProcess.stderr as Bun.BunReadableStream;
	const stdoutReader = stdout.getReader();
	const stderrReader = stderr.getReader();

	stdoutReader.read().then(function processOutput({ done, value }) {
		if (done) return;
		const output = new TextDecoder().decode(value);
		console.log(`${prefix} ${output.replace(/[\n\r]$/, '')}`);
		stdoutReader.read().then(processOutput);
	});

	stderrReader.read().then(function processError({ done, value }) {
		if (done) return;
		const errorOutput = new TextDecoder().decode(value);
		console.error(`${prefix} ERROR: ${errorOutput.replace(/[\n\r]$/, '')}`);
		stderrReader.read().then(processError);
	});

	subProcess.exited.then(async (code) => {
		if (code === 0) {
			console.log(`${prefix} Process exited successfully.`);
		} else {
			console.error(`${prefix} Process exited with code ${code}.`);
		}
		subProcess = await createSubProcess(cmd, prefix); // Restart the process
	});

	return subProcess;
};

const cmds = [
	['bun', './websocket/index.ts'],
	['bun', './src/index.ts'],
];

const prefixes = ['[MAIN]', '[DISCORD]'].map((prefix) => {
	return `\x1b[32m${prefix.padEnd(10)}|\x1b[0m`; // Green color for prefixes
});

const processes: Subprocess[] = [];

for (let i = 0; i < cmds.length; i++) {
	processes.push(await createSubProcess(cmds[i], prefixes[i]));
}

process.on('SIGINT', () => {
	console.log('Received SIGINT, terminating processes...');
	processes.forEach((proc) => {
		proc.kill();
	});
	process.exit(0);
});
