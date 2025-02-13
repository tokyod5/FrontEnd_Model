import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import '@mantine/core/styles.css';

import { MantineProvider } from '@mantine/core';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={{
      fontFamily:"'Slabo 13px', serif"
    }}>
      <App />
    </MantineProvider>
  </StrictMode >,
)
