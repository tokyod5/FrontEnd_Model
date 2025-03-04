interface UploadResponse {
    success: boolean;
    download_url?: string;
    error?: string;
  }
  
  export const uploadFileToAPI = async (file: File): Promise<UploadResponse> => {
      if (!(file instanceof File)) {
          return { success: false, error: "Invalid file type." };
      }
  
      const formData = new FormData();
      formData.append("file", file);
  
      try {
          const response = await fetch("http://13.201.67.109/convert", {
              method: "POST",
              body: formData,
          });
  
          const data: UploadResponse = await response.json();
  
          // ✅ Check if the API explicitly returned an error
          if (!data.success) {
              return { success: false, error: data.error || "Unknown server error" };
          }
  
          return data;
      } catch (error) {
          return { success: false, error: (error as Error).message };
      }
  };
  