export type RecordingStatus = "UPLOADING" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
export type Stage = "validating" | "chunking" | "transcribing" | "summarizing" | null;
export type TranscriptStatus = "PENDING" | "DONE" | "PARTIAL" | "FAILED";
export type SummaryStatus = "PENDING" | "DONE" | "FAILED";
export type ChunkStatus = "PENDING" | "DONE" | "FAILED";

export interface TimedSegment {
  idx: number;
  start_sec: number;
  end_sec: number;
  text: string | null;
  status: ChunkStatus | string;
}

export interface SummaryContent {
  title: string;
  tldr: string;
  key_points: string[];
  action_items: string[];
}

export interface ProgressInfo {
  chunks_done: number;
  chunks_total: number;
}

export interface RecordingListItem {
  id: string;
  filename: string;
  status: RecordingStatus;
  stage: Stage;
  duration_sec: number | null;
  title: string | null;
  language_code: string;
  created_at: string;
}

export interface RecordingDetail {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  language_code: string;
  status: RecordingStatus;
  stage: Stage;
  progress: ProgressInfo;
  duration_sec: number | null;
  title: string | null;
  transcript_text: string | null;
  segments: TimedSegment[];
  summary_json: SummaryContent | null;
  summary_status: SummaryStatus;
  transcript_status: TranscriptStatus;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiError {
  code: string;
  message: string;
}
