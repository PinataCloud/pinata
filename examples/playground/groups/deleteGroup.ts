import { PinataSDK } from "pinata";

const pinata = new PinataSDK({
	pinataJwt: process.env.PINATA_JWT!,
	pinataGateway: "",
});

async function main() {
	try {
		const group = await pinata.groups.private.delete({
			groupId: "019515af-16b8-72de-96f6-91b3d73947a4",
		});
		console.log(group);
	} catch (error) {
		console.log(error);
	}
}

main();
