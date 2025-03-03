// api.d.ts
declare module "./api" {
  export const uploadFileToAPI: (file: File) => Promise<{
    success: boolean;
    error?: string;
    download_url?: string;
  }>;
}