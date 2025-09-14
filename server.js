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
app.use(express.json());

// === CÓDIGO CORREGIDO ===
// Reemplaza esta URL con la que copiaste de tu despliegue de Apps Script
const externalApiUrl = `https://script.google.com/macros/s/AKfycbzcoHhPfKtSo1UNHZK4QhfhYBGjKsOOeEbBUmsIw2I8PElge-BGrDWWPBWLMQ3oPaiv/exec`;
// === FIN DEL CÓDIGO CORREGIDO ===


// Define la ruta del proxy para la BÚSQUEDA de invitados
app.get('/api/search', async (req, res) => {
  const { name } = req.query;
  
  const externalApiUrlv = `${externalApiUrl}?action=search&name=${encodeURIComponent(name)}`;
  
  try {
    const response = await axios.get(externalApiUrlv);
    res.json(response.data);
  } catch (error) {
    console.error('Error al hacer la solicitud a la API externa:', error.message);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
});

// NUEVA RUTA: Define el proxy para el ENVÍO del formulario
app.post('/api/submit', async (req, res) => {
  try {
    const response = await axios.post(externalApiUrl, req.body, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error al enviar el formulario a la API externa:', error.message);
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
});

// Inicia el servidor
app.listen(port, () => {
  console.log(`Servidor escuchando en el puerto ${port}`);
});