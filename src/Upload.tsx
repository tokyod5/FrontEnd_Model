import React, { useState, ChangeEvent } from 'react';
import { Button, Container, Group, Text, Title, Loader, Notification } from '@mantine/core';
import { IconUpload, IconCheck, IconX } from '@tabler/icons-react';
import { uploadFileToAPI } from './api';

function Upload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];

    if (selectedFile) {
      const fileName = selectedFile.name.toLowerCase();
      if (fileName.endsWith('.skp')) {
        setFile(selectedFile);
        setError(null);
      } else {
        setFile(null);
        setError('Only .skp files are allowed');
      }

      // Reset input to allow re-uploading the same file
      event.target.value = '';
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setDownloadUrl(null);

    try {
        const result = await uploadFileToAPI(file);

        setUploading(false);
        if (result.success && result.download_url) {  // ✅ Only success if download_url exists
            setDownloadUrl(result.download_url);
        } else {
            setError(result.error || "File conversion failed on the server.");
        }
    } catch (err) {
        setUploading(false);
        setError("An unexpected error occurred. Please check your connection.");
    }
};


  return (
    <Container size="sm" className="upload-container" style={{ textAlign: 'center', paddingTop: 50 }}>
      <Title order={2}>Upload Your 3D Model</Title>
      <Text>Select a file to convert</Text>

      <div
        style={{
          border: '2px dashed #545454',
          padding: '20px',
          borderRadius: '10px',
          marginTop: '20px',
          cursor: 'pointer',
        }}
      >
        <input
          type="file"
          accept=".skp"
          onChange={handleFileChange}
          style={{ display: 'none' }}
          id="file-upload"
        />
        <label htmlFor="file-upload">
          <Group align="center" gap="md">
            {file ? <IconCheck size={32} color="green" /> : <IconUpload size={32} />}
            <Text size="lg">{file ? file.name : 'Click or drag file here'}</Text>
          </Group>
        </label>
      </div>

      {error && (
        <Notification color="red" mt="sm" withCloseButton={false}>
          <IconX size={16} /> {error}
        </Notification>
      )}

      <Button size="md" mt="lg" onClick={handleUpload} disabled={!file || uploading}>
        {uploading ? <Loader size="sm" /> : 'Convert File'}
      </Button>

      {downloadUrl && (
        <div style={{ marginTop: 20 }}>
          <a href={downloadUrl} download>
            <Button color="green">Download Converted File</Button>
          </a>
        </div>
      )}
    </Container>
  );
}

export default Upload;
