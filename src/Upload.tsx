import  { useState, ChangeEvent } from 'react';
import { Button, Container, Stack, Group, Text, Title, Loader, Notification, Image } from '@mantine/core';
import { IconUpload, IconCheck, IconX } from '@tabler/icons-react';
import { uploadFileToAPI } from './api';
import logo from './assets/logo_1.png';
import './App.css';

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
        if (result.success && result.download_url) {
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
    <Container fluid h="100vh" style={{ backgroundColor: '#FFFFFF', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <Stack align="center" justify="center" gap={30} style={{ width: '100%', maxWidth: '600px', textAlign: 'center' }}>
        <Image w={300} src={logo} alt="Model Sync Logo" />
        
        <Title order={2} style={{ fontSize: '22px', fontWeight: 'bold', color: '#000000' }}>Upload Your 3D Model</Title>
        <Text size="md" color="#545454">Select a file to convert</Text>

        <div
          style={{
            border: '2px dashed #545454',
            padding: '12px',
            borderRadius: '8px',
            cursor: 'pointer',
            width: '65%',
            backgroundColor: '#FAFAFA',
            textAlign: 'center'
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
            <Group align="center" gap="sm" justify="center">
              {file ? <IconCheck size={28} color="green" /> : <IconUpload size={28} color="#888" />}
              <Text size="md" color="#333">{file ? file.name : 'Click or drag file here'}</Text>
            </Group>
          </label>
        </div>

        {error && (
          <Notification color="red" mt="sm" withCloseButton={false}>
            <IconX size={16} /> {error}
          </Notification>
        )}

        <Button 
          size="md" 
          onClick={handleUpload} 
          disabled={!file || uploading} 
          style={{ 
            backgroundColor: file ? '#000000' : '#B0B0B0',
            color: '#FFFFFF', 
            padding: '12px 30px', 
            fontSize: '16px', 
            borderRadius: '6px', 
            cursor: file ? 'pointer' : 'not-allowed' 
          }}
        >
          {uploading ? <Loader size="sm" /> : 'Convert File'}
        </Button>

        {downloadUrl && (
          <div style={{ marginTop: 15 }}>
            <a href={downloadUrl} download>
              <Button color="green" size="md" style={{ padding: '12px 30px', fontSize: '16px' }}>Download Converted File</Button>
            </a>
          </div>
        )}
      </Stack>
    </Container>
  );
}

export default Upload;
