import { PinataSDK } from "pinata";

const pinata = new PinataSDK({
	pinataJwt: process.env.PINATA_JWT,
	pinataGateway: "",
});

async function main() {
	try {
		const readKey = await pinata.keys.create({
			keyName: "read-only",
			permissions: {
				resources: ["org:files:read"],
			},
		});

		pinata.setNewJwt(readKey.JWT);

		const files = await pinata.files.public.list();
		console.log(files);

		const groups = await pinata.groups.public.list();
		console.log(groups);
	} catch (error) {
		console.log(error);
	}
}

main();
