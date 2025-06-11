import { PinataSDK } from "pinata";

const pinata = new PinataSDK({
	pinataJwt: process.env.PINATA_JWT!,
	pinataGateway: "",
});

async function main() {
	try {
		let ids = [];
		const files = await pinata.files.private.list().limit(10);
		for (const file of files.files) {
			ids.push(file.id);
		}
		console.log(ids);

		const group = await pinata.groups.private.removeFiles({
			groupId: "019515af-16b8-72de-96f6-91b3d73947a4",
			files: ids,
		});
		console.log(group);
	} catch (error) {
		console.log(error);
	}
}

await main();
