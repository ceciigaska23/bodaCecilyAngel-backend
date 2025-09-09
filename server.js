// Importa las librerías necesarias
const express = require('express');
const cors = require('cors');
const axios = require('axios');

// Crea una instancia de la aplicación Express
const app = express();
const port = process.env.PORT || 3000;

// Middleware para habilitar CORS
app.use(cors());

// Define la ruta del proxy. Tu frontend llamará a esta ruta.
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

// Inicia el servidor
app.listen(port, () => {
  console.log(`Servidor proxy en ejecución en http://localhost:${port}`);
});