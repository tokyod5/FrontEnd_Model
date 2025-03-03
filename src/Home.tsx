import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Container, Stack, Text, Image, Group } from '@mantine/core';
import { ArrowRightIcon } from '@radix-ui/react-icons';
import logo from './assets/logo_1.png';
import './App.css';

function Home() {
  const navigate = useNavigate(); // Hook for navigation

  return (
    <Container fluid h="100vh">
      <Stack h="100%" align="center" justify="flex-start" gap={30}>
        <Stack align="center" justify="center" gap={50}>
          <Image mt={30} w={150} h={70} src={logo} alt="3D Model Converter" />
          <Text className="font-sans !mt-10 !text-4xl !text-[#545454] !font-bold !tracking-wide">
            3D MODEL CONVERTER
          </Text>
          <Text className="font-sans !mt-10 !text-xl !text-[#545454] !font-bold">
            Convert your models easily
          </Text>
        </Stack>
        <Button size="xl" className="" radius={20} onClick={() => navigate('/upload')}>
          <Group>
            <Text size="xl">Get Started</Text>
            <ArrowRightIcon className="w-12 h-12" />
          </Group>
        </Button>
      </Stack>
    </Container>
  );
}

export default Home;
