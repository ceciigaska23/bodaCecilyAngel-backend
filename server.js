// Importa las librerías necesarias
const express = require('express');
const cors = require('cors');
const axios = require('axios');

// Crea una instancia de la aplicación Express
const app = express();
const port = process.env.PORT || 3000;

// Middleware para habilitar CORS
app.use(cors());

// NUEVA LÍNEA: Middleware para analizar cuerpos de solicitud JSON.
// Esto es crucial para recibir los datos del formulario que vienen del frontend.
app.use(express.json());

// Define la ruta del proxy para la BÚSQUEDA de invitados
app.get('/api/search', async (req, res) => {
  // Obtiene el parámetro 'name' de la solicitud de tu frontend
  const { name } = req.query;
  
  // URL de la API de Google Apps Script (¡aquí es donde va tu URL!)
  const externalApiUrl = `https://script.google.com/macros/s/AKfycbz1qWvbXP8eOGCQ3kJcF2dfKdfPjsKLzmn6rs7AHAceEMkNzlwLLyZCT3Z0W6dWhKWj/exec?action=search&name=${encodeURIComponent(name)}`;
  
  try {
    // Hace la solicitud a la API de Google Apps Script desde tu servidor proxy
    const response = await axios.get(externalApiUrl);
    
    // Envía los datos de vuelta al frontend
    res.json(response.data);
  } catch (error) {
    console.error('Error al hacer la solicitud a la API externa:', error.message);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
});

// NUEVA RUTA: Define el proxy para el ENVÍO del formulario
app.post('/api/submit', async (req, res) => {
  // URL de tu API de Google Apps Script
  const externalApiUrl = `https://script.google.com/macros/s/AKfycbz1qWvbXP8eOGCQ3kJcF2dfKdfPjsKLzmn6rs7AHAceEMkNzlwLLyZCT3Z0W6dWhKWj/exec`;

  try {
    // Los datos del formulario ya están en req.body
    // Hacemos una petición POST al Google Apps Script
    const response = await axios.post(externalApiUrl, req.body, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Reenvía la respuesta de Google Apps Script de vuelta al frontend
    res.json(response.data);
  } catch (error) {
    console.error('Error al enviar la confirmación a la API externa:', error.message);
    res.status(500).json({ error: 'Error al procesar la solicitud de envío' });
  }
});


// Inicia el servidor
app.listen(port, () => {
  console.log(`Servidor proxy en ejecución en http://localhost:${port}`);
});