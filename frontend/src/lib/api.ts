import { RecordingListItem, RecordingDetail, ApiError } from "@/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
const CLIENT_ID_KEY = "audio_notes_client_id";

export class ApiClientError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string = "UNKNOWN_ERROR", status: number = 0) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Returns or creates persistent client UUID in browser localStorage.
 */
export function getClientId(): string {
  if (typeof window === "undefined") {
    return "server-render-temp-id";
  }

  let clientId = localStorage.getItem(CLIENT_ID_KEY);
  if (!clientId) {
    clientId = crypto.randomUUID ? crypto.randomUUID() : `cid_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(CLIENT_ID_KEY, clientId);
  }
  return clientId;
}

/**
 * Standard fetch wrapper attaching X-Client-Id and parsing unified error responses.
 */
async function fetchWithAuth(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const clientId = getClientId();
  const url = `${API_BASE_URL}${endpoint}`;

  const headers = new Headers(options.headers || {});
  headers.set("X-Client-Id", clientId);
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errData: { error?: ApiError } | null = null;
      try {
        errData = await response.json();
      } catch {
        // Non-JSON response
      }

      const code = errData?.error?.code || `HTTP_${response.status}`;
      const message = errData?.error?.message || `Server responded with status ${response.status}`;
      throw new ApiClientError(message, code, response.status);
    }

    return response;
  } catch (err: any) {
    if (err instanceof ApiClientError) {
      throw err;
    }
    throw new ApiClientError(
      err.message || "Unable to reach server. Please check your internet connection.",
      "NETWORK_ERROR",
      0
    );
  }
}

export async function fetchRecordings(): Promise<RecordingListItem[]> {
  const res = await fetchWithAuth("/recordings");
  return res.json();
}

export async function fetchRecordingDetail(id: string): Promise<RecordingDetail> {
  const res = await fetchWithAuth(`/recordings/${id}`);
  return res.json();
}

export async function retryRecording(id: string): Promise<{ status: string; recording_id: string; message: string }> {
  const res = await fetchWithAuth(`/recordings/${id}/retry`, {
    method: "POST",
  });
  return res.json();
}

export async function deleteRecording(id: string): Promise<{ message: string }> {
  const res = await fetchWithAuth(`/recordings/${id}`, {
    method: "DELETE",
  });
  return res.json();
}

export interface UploadProgressEvent {
  loaded: number;
  total: number;
  percent: number;
}

export interface UploadOptions {
  file: File;
  languageCode: string;
  onProgress?: (progress: UploadProgressEvent) => void;
  onStageChange?: (stage: "init" | "uploading" | "completing") => void;
  signal?: AbortSignal;
}

/**
 * Direct S3 Presigned Upload flow with real XHR progress tracking.
 */
export async function uploadAudioFile({
  file,
  languageCode,
  onProgress,
  onStageChange,
  signal
}: UploadOptions): Promise<string> {
  // Step 1: Init upload session
  onStageChange?.("init");
  const initRes = await fetchWithAuth("/uploads/init", {
    method: "POST",
    body: JSON.stringify({
      filename: file.name,
      content_type: file.type || "audio/wav",
      size_bytes: file.size,
      language_code: languageCode,
    }),
    signal
  });

  const initData = await initRes.json();
  const { recording_id, upload_url } = initData;

  // Step 2: Direct PUT to Presigned S3 URL via XMLHttpRequest for true progress
  onStageChange?.("uploading");
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", upload_url, true);
    xhr.setRequestHeader("Content-Type", file.type || "audio/wav");

    if (signal) {
      signal.addEventListener("abort", () => {
        xhr.abort();
        reject(new ApiClientError("Upload cancelled by user.", "UPLOAD_CANCELLED", 0));
      });
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percent: Math.min(percent, 99) // reserve 100% for completion
        });
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (onProgress) {
          onProgress({ loaded: file.size, total: file.size, percent: 100 });
        }
        resolve();
      } else {
        reject(
          new ApiClientError(
            `Storage bucket upload failed (${xhr.status}). Please check network or CORS settings.`,
            "S3_UPLOAD_FAILED",
            xhr.status
          )
        );
      }
    };

    xhr.onerror = () => {
      reject(
        new ApiClientError(
          "Network failure while sending file to storage bucket. S3 bucket may be unreachable.",
          "S3_NETWORK_ERROR",
          0
        )
      );
    };

    xhr.onabort = () => {
      reject(new ApiClientError("Upload was aborted.", "UPLOAD_ABORTED", 0));
    };

    xhr.send(file);
  });

  // Step 3: Complete upload signal to backend
  onStageChange?.("completing");
  await fetchWithAuth(`/uploads/${recording_id}/complete`, {
    method: "POST",
    signal
  });

  return recording_id;
}
