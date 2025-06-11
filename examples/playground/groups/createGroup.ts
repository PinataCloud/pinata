import { PinataSDK } from "pinata";

const pinata = new PinataSDK({
	pinataJwt: process.env.PINATA_JWT!,
	pinataGateway: "",
});

async function main() {
	try {
		const group = await pinata.groups.public.create({
			name: "refactor-test",
		});
		console.log(group);
	} catch (error) {
		console.log(error);
	}
}

main();
