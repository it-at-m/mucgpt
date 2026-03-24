import { getConfig, handleApiRequest, postFormDataConfig } from "./fetch-utils";

const DATA_SERVICE_BASE = "/api/data";

/**
 * Uploads a file and returns a unique UUID for retrieval.
 * @param file The file to upload
 * @returns UUID string for the uploaded file
 */
export async function uploadFileApi(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);

    return handleApiRequest(async () => {
        const response = await fetch(`${DATA_SERVICE_BASE}/`, postFormDataConfig(formData));
        return response;
    }, "Failed to upload file");
}

/**
 * Retrieves the content of a file using its UUID.
 * Returns the content as a string.
 * @param fileId The UUID of the file to retrieve
 * @returns File content as string
 */
export async function getFileApi(fileId: string): Promise<string> {
    return handleApiRequest(() => fetch(`${DATA_SERVICE_BASE}/${fileId}`, getConfig()), "Failed to get file");
}
