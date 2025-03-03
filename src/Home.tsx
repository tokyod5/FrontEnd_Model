import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Container, Stack, Text, Image, Group } from '@mantine/core';
import { ArrowRightIcon } from '@radix-ui/react-icons';
import logo from './assets/logo_1.png';
import './App.css';

function Home() {
  const navigate = useNavigate();

  return (
    <Container fluid h="100vh" style={{ backgroundColor: '#FFFFFF' }}>
      <Stack h="100%" align="center" justify="center" gap={30}>
        <Stack align="center" justify="center" gap={5}>
          {/* Adjusted Logo Alignment */}
          <Image w={200} src={logo} alt="Model Sync Logo" style={{ marginLeft: '-50px' }} />
          
          <Text className="font-sans !text-xl !text-gray-600 !font-semibold">
            Convert your models easily
          </Text>
        </Stack>
        
        <Button 
          size="xl" 
          radius={20} 
          onClick={() => navigate('/upload')}
          style={{ backgroundColor: '#000000', color: '#FFFFFF', padding: '15px 40px' }}
        >
          <Group>
            <Text size="xl">Get Started</Text>
            <ArrowRightIcon className="w-6 h-6" />
          </Group>
        </Button>
      </Stack>
    </Container>
  );
}

export default Home;