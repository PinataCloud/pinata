import * as tus from "tus-js-client";
import fs from "fs";

async function resumeUpload() {
	try {
		const filePath = "/path/to/file";
		const fileStream = fs.createReadStream(filePath);
		const fileStats = fs.statSync(filePath);

		const upload = new tus.Upload(fileStream, {
			endpoint: "https://uploads.pinata.cloud/v3/files",
			chunkSize: 35 * 1024 * 1024, // 50MiB chunk size
			retryDelays: [0, 3000, 5000, 10000, 20000],
			onUploadUrlAvailable: async function () {
				if (upload.url) {
					console.log("Upload URL is available! URL: ", upload.url);
				}
			},
			metadata: {
				filename: "folder.zip",
				filetype: "application/zip",
			},
			headers: { Authorization: `Bearer ${process.env.PINATA_JWT}` },
			uploadSize: fileStats.size,
			onError: function (error) {
				console.log("Failed because: " + error);
			},
			onProgress: function (bytesUploaded, bytesTotal) {
				const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
				console.log(percentage + "%");
			},
			onSuccess: function () {
				console.log("Upload completed!");
			},
		});

		upload.start();
	} catch (error) {
		console.log(error);
	}
}

resumeUpload();
