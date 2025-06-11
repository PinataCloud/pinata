import { PinataSDK } from "pinata";

const pinata = new PinataSDK({
	pinataJwt: process.env.PINATA_JWT!,
	pinataGateway: "",
});

async function main() {
	try {
		const uuid = crypto.randomUUID();
		const { id } = await pinata.upload.private.file(
			new File([uuid], `${uuid}.txt`, { type: "text/plain" }),
		);
		const updateFile = await pinata.files.private.update({
			id,
			name: `${uuid}-updated.txt`,
			keyvalues: {
				whimsey: "true",
			},
		});
		console.log(updateFile);
	} catch (error) {
		console.log(error);
	}
}

main();
