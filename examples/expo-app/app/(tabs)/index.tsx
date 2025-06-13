import { Image } from "expo-image";
import { View, Text, Button, StyleSheet } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useState } from "react";
import ParallaxScrollView from "@/components/ParallaxScrollView";
import { useUpload } from "pinata/expo";
import { Link } from "expo-router";

const SERVER_URL = "http://localhost:8787";

export default function HomeScreen() {
	const {
		upload, // Method to upload a file using a presigned URL
		progress, // Progress state as integer
		loading, // Boolean uploading state
		uploadResponse, // CID for the uploaded file
		error, // Error state
		pause, // Pause upload method
		resume, // Resume upload method
		cancel, // Cancel current upload method
	} = useUpload();
	const [fileUri, setFileUri] = useState<string | null>(null);
	const [fileName, setFileName] = useState<string | null>(null);

	const pickImage = async () => {
		const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

		if (status !== "granted") {
			alert("Sorry, we need camera roll permissions to make this work!");
			return;
		}

		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ImagePicker.MediaTypeOptions.All,
			allowsEditing: false,
			quality: 1,
		});

		if (!result.canceled && result.assets && result.assets.length > 0) {
			setFileUri(result.assets[0].uri);
			setFileName(result.assets[0].uri.split("/").pop() || "image");
		}
	};

	// Pick document from device
	const pickDocument = async () => {
		try {
			const result = await DocumentPicker.getDocumentAsync();

			if (result.canceled === false) {
				setFileUri(result.assets[0].uri);
				setFileName(result.assets[0].name);
			}
		} catch (err) {
			console.error("Error picking document", err);
		}
	};

	// Start the upload process
	const startUpload = async () => {
		if (!fileUri) {
			alert("Please select a file first");
			return;
		}
		try {
			const urlRes = await fetch(`${SERVER_URL}/presigned_url`);
			if (!urlRes.ok) {
				console.log(urlRes.status);
			}
			const urlData = await urlRes.json();
			await upload(
				fileUri,
				"public", // or 'private' if you want a private upload
				urlData.url,
				{
					name: fileName || "Upload from Expo",
					keyvalues: {
						app: "Pinata Expo Demo",
						timestamp: Date.now().toString(),
					},
				},
			);
		} catch (err) {
			console.error("Failed to start upload:", err);
			alert("Failed to start upload");
		}
	};

	// Progress bar component
	const ProgressBar = ({ value }: { value: number }) => {
		return (
			<View style={styles.progressBarContainer}>
				<View style={[styles.progressBar, { width: `${value}%` }]} />
			</View>
		);
	};

	return (
		<ParallaxScrollView
			headerBackgroundColor={{ light: "#A1CEDC", dark: "#1D3D47" }}
			headerImage={
				<Image
					source={require("@/assets/images/partial-react-logo.png")}
					style={styles.reactLogo}
				/>
			}
		>
			<View style={styles.container}>
				<Text style={styles.title}>Pinata IPFS Upload</Text>

				<View style={styles.buttonContainer}>
					<Button title="Pick Image" onPress={pickImage} />
					<Button title="Pick Document" onPress={pickDocument} />
				</View>

				{fileUri && (
					<View style={styles.fileInfoContainer}>
						<Text style={styles.fileInfo}>Selected: {fileName}</Text>
						<Button
							title="Upload to IPFS"
							onPress={startUpload}
							disabled={loading}
							color="#FF6AC1" // Pinata pink
						/>
					</View>
				)}

				{loading && (
					<View style={styles.uploadStatusContainer}>
						<Text style={styles.uploadStatusText}>
							Uploading... {Math.round(progress)}%
						</Text>
						<ProgressBar value={progress} />

						<View style={styles.uploadControlsContainer}>
							{progress < 100 && (
								<>
									<Button title="Pause" onPress={pause} color="#FFA15C" />
									<Button title="Resume" onPress={resume} color="#5CB8FF" />
									<Button title="Cancel" onPress={cancel} color="#FF5C5C" />
								</>
							)}
						</View>
					</View>
				)}

				{error && (
					<View style={styles.errorContainer}>
						<Text style={styles.errorTitle}>Upload Error</Text>
						<Text style={styles.errorText}>{error.message}</Text>
					</View>
				)}

				{uploadResponse && (
					<View style={styles.successContainer}>
						<Text style={styles.successTitle}>Upload Complete!</Text>
						<Text style={styles.successText}>File CID: {uploadResponse}</Text>
						<Link href={`https://gateway.pinata.cloud/ipfs/${uploadResponse}`}>
							View File
						</Link>
					</View>
				)}
			</View>
		</ParallaxScrollView>
	);
}

const styles = StyleSheet.create({
	titleContainer: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	stepContainer: {
		gap: 8,
		marginBottom: 8,
	},
	reactLogo: {
		height: 178,
		width: 290,
		bottom: 0,
		left: 0,
		position: "absolute",
	},
	container: {
		flex: 1,
		padding: 20,
		backgroundColor: "#f5f5f5",
	},
	title: {
		fontSize: 24,
		fontWeight: "bold",
		marginBottom: 20,
		textAlign: "center",
	},
	buttonContainer: {
		flexDirection: "row",
		justifyContent: "space-around",
		marginBottom: 20,
	},
	fileInfoContainer: {
		backgroundColor: "#fff",
		padding: 15,
		borderRadius: 8,
		marginBottom: 20,
		elevation: 2,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.2,
		shadowRadius: 2,
	},
	fileInfo: {
		marginBottom: 10,
	},
	uploadStatusContainer: {
		backgroundColor: "#fff",
		padding: 15,
		borderRadius: 8,
		marginBottom: 20,
		elevation: 2,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.2,
		shadowRadius: 2,
	},
	uploadStatusText: {
		marginBottom: 10,
		fontWeight: "bold",
	},
	progressBarContainer: {
		height: 10,
		backgroundColor: "#e0e0e0",
		borderRadius: 5,
		overflow: "hidden",
		marginBottom: 15,
	},
	progressBar: {
		height: "100%",
		backgroundColor: "#FF6AC1", // Pinata pink
	},
	uploadControlsContainer: {
		flexDirection: "row",
		justifyContent: "space-around",
	},
	errorContainer: {
		backgroundColor: "#FFEBEE",
		padding: 15,
		borderRadius: 8,
		marginBottom: 20,
		borderLeftWidth: 4,
		borderLeftColor: "#FF5C5C",
	},
	errorTitle: {
		fontWeight: "bold",
		color: "#D32F2F",
		marginBottom: 5,
	},
	errorText: {
		color: "#D32F2F",
	},
	successContainer: {
		backgroundColor: "#E8F5E9",
		padding: 15,
		borderRadius: 8,
		marginBottom: 20,
		borderLeftWidth: 4,
		borderLeftColor: "#4CAF50",
	},
	successTitle: {
		fontWeight: "bold",
		color: "#2E7D32",
		marginBottom: 10,
	},
	successText: {
		color: "#2E7D32",
		marginBottom: 5,
	},
	pinningContainer: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 5,
	},
	pinningText: {
		color: "#FF6AC1",
		marginRight: 10,
	},
});
