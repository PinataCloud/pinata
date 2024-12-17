"use client";

import { useState } from "react";
import { pinata } from "@/utils/config";

export default function Home() {
	const [file, setFile] = useState<File>();
	const [url, setUrl] = useState("");
	const [uploading, setUploading] = useState(false);

	// Client side upload
	//
	const uploadFile = async () => {
		try {
			if (!file) {
				alert("No file selected");
				return;
			}
			setUploading(true);
			const signedUrlReq = await fetch("/api/url", {
				method: "GET",
			});
			const signedUrlRes = await signedUrlReq.json();
			const upload = await pinata.upload.file(file).url(signedUrlRes.url);
			const urlReuest = await fetch("/api/sign", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ cid: upload.cid }),
			});
			const url = await urlReuest.json();
			setUrl(url);
			setUploading(false);
		} catch (e) {
			console.log(e);
			setUploading(false);
			alert("Trouble uploading file");
		}
	};

	// Server side Upload

	// const uploadFile = async () => {
	// 	try {
	//    if (!file) {
	//      alert("No file selected");
	//      return;
	//    }
	// 		setUploading(true);
	// 		const data = new FormData();
	// 		data.set("file", file);
	// 		const uploadRequest = await fetch("/api/files", {
	// 			method: "POST",
	// 			body: data,
	// 		});
	// 		const signedUrl = await uploadRequest.json();
	// 		console.log(signedUrl);
	// 		setUrl(signedUrl);
	// 		setUploading(false);
	// 	} catch (e) {
	// 		console.log(e);
	// 		setUploading(false);
	// 		alert("Trouble uploading file");
	// 	}
	// };

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setFile(e.target?.files?.[0]);
	};

	return (
		<main className="w-full min-h-screen m-auto flex flex-col justify-center items-center">
			<input type="file" id="file" onChange={handleChange} />
			<button disabled={uploading} onClick={uploadFile}>
				{uploading ? "Uploading..." : "Upload"}
			</button>
			{url && <img src={url} alt="Image from Pinata" />}
		</main>
	);
}
