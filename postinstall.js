(function () {
	const colors = {
		reset: "\x1b[0m",
		bright: "\x1b[1m",
		fg: {
			yellow: "\x1b[33m",
			cyan: "\x1b[36m",
			green: "\x1b[32m",
		},
		dim: "\x1b[2m",
	};

	const boxWidth = 70;
	const horizontalBorder = "+" + "=".repeat(boxWidth - 2) + "+";
	const emptyLine = "|" + " ".repeat(boxWidth - 2) + "|";

	function stripAnsi(str) {
		return str.replace(/\x1b\[[0-9;]*m/g, "");
	}

	function centeredText(text, width) {
		const visibleLength = stripAnsi(text).length;
		const padding = Math.max(0, width - visibleLength);
		const leftPad = Math.floor(padding / 2);
		const rightPad = padding - leftPad;
		return "|" + " ".repeat(leftPad) + text + " ".repeat(rightPad) + "|";
	}

	console.log("\n" + colors.fg.yellow + horizontalBorder + colors.reset);
	console.log(colors.fg.yellow + emptyLine + colors.reset);
	console.log(
		colors.fg.yellow +
			centeredText(
				colors.bright +
					colors.fg.yellow +
					"🚨 ATTENTION IPFS USERS! 🚨" +
					colors.reset,
				boxWidth - 2,
			) +
			colors.reset,
	);
	console.log(colors.fg.yellow + emptyLine + colors.reset);
	console.log(
		colors.fg.yellow +
			centeredText(
				colors.fg.cyan +
					"If you're looking to use IPFS please install pinata-web3 instead." +
					colors.reset,
				boxWidth - 2,
			) +
			colors.reset,
	);
	console.log(colors.fg.yellow + emptyLine + colors.reset);
	console.log(
		colors.fg.yellow +
			centeredText(
				colors.fg.green + "npm install pinata-web3" + colors.reset,
				boxWidth - 2,
			) +
			colors.reset,
	);
	console.log(colors.fg.yellow + emptyLine + colors.reset);
	console.log(
		colors.fg.yellow +
			centeredText(
				colors.dim +
					"For more information please see our documentation at" +
					colors.reset,
				boxWidth - 2,
			) +
			colors.reset,
	);
	console.log(
		colors.fg.yellow +
			centeredText(
				colors.dim + "https://docs.pinata.cloud/web3/sdk" + colors.reset,
				boxWidth - 2,
			) +
			colors.reset,
	);
	console.log(colors.fg.yellow + emptyLine + colors.reset);
	console.log(colors.fg.yellow + horizontalBorder + colors.reset);
	console.log("\n");
})();
