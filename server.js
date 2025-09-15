// ===== SERVER.JS CORREGIDO PARA VERCEL =====
const express = require('express');
const cors = require('cors');
const axios = require('axios');

// Crear instancia de Express
const app = express();
const port = process.env.PORT || 3000;

// ===== CONFIGURACIÓN DE CORS MEJORADA =====
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:5500',
    'https://your-wedding-site.vercel.app', // Cambia por tu dominio real
    'https://your-custom-domain.com' // Si tienes dominio personalizado
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'X-Requested-With'],
  credentials: true
};

app.use(cors(corsOptions));

// Middleware para parsear JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ===== URL DE GOOGLE APPS SCRIPT - ACTUALÍZALA =====
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxUyHd97p-6h1uAE72Iq2zN-hEhSxdkRGsJ4WXIguHTCyKRBjZTnBadrjGP_Fd2vQVQ/exec';

// ===== RUTA DE SALUD PARA VERIFICAR QUE FUNCIONA =====
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Servidor de boda funcionando correctamente' 
  });
});

// ===== RUTA PARA BÚSQUEDA DE INVITADOS =====
app.get('/api/search', async (req, res) => {
  console.log('🔍 Búsqueda de invitado recibida:', req.query);
  
  const { name } = req.query;
  
  // Validación de entrada
  if (!name || name.trim().length < 2) {
    return res.status(400).json({
      found: false,
      error: 'Nombre debe tener al menos 2 caracteres'
    });
  }

  try {
    // Construir URL con parámetros
    const searchUrl = `${GOOGLE_SCRIPT_URL}?action=search&name=${encodeURIComponent(name.trim())}`;
    console.log('📡 Enviando request a:', searchUrl);

    // Configuración de axios con timeout y headers
    const axiosConfig = {
      timeout: 15000, // 15 segundos
      headers: {
        'User-Agent': 'Wedding-App/1.0',
        'Accept': 'application/json',
      },
      validateStatus: function (status) {
        return status >= 200 && status < 500; // No rechazar en 4xx
      }
    };

    const response = await axios.get(searchUrl, axiosConfig);
    
    console.log('📨 Respuesta de Google Script:', {
      status: response.status,
      headers: response.headers['content-type'],
      data: response.data
    });

    // Verificar si la respuesta es JSON válido
    let jsonData;
    if (typeof response.data === 'string') {
      try {
        jsonData = JSON.parse(response.data);
      } catch (parseError) {
        console.error('❌ Error parseando JSON:', parseError);
        return res.status(500).json({
          found: false,
          error: 'Error en el formato de respuesta del servidor'
        });
      }
    } else {
      jsonData = response.data;
    }

    // Verificar estructura de respuesta
    if (!jsonData || typeof jsonData !== 'object') {
      console.error('❌ Respuesta inválida de Google Script:', jsonData);
      return res.status(500).json({
        found: false,
        error: 'Respuesta inválida del servidor'
      });
    }

    // Enviar respuesta al frontend
    res.json(jsonData);

  } catch (error) {
    console.error('❌ Error en búsqueda:', {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      status: error.response?.status
    });

    // Manejar diferentes tipos de errores
    if (error.code === 'ENOTFOUND') {
      return res.status(503).json({
        found: false,
        error: 'No se puede conectar con Google Apps Script'
      });
    }

    if (error.code === 'ETIMEDOUT') {
      return res.status(504).json({
        found: false,
        error: 'Timeout - el servidor tardó demasiado en responder'
      });
    }

    if (error.response?.status === 404) {
      return res.status(404).json({
        found: false,
        error: 'Script de Google no encontrado - verifica la URL'
      });
    }

    res.status(500).json({
      found: false,
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ===== NUEVA RUTA: VALIDACIÓN DE CÓDIGO QR =====
app.get('/api/validate-qr', async (req, res) => {
  const confirmationCode = req.query.code;

  if (!confirmationCode) {
    return res.status(400).send('Error: Código de confirmación no proporcionado.');
  }

  try {
    const scriptUrl = `${GOOGLE_SCRIPT_URL}?action=validate&code=${confirmationCode}`;
    const response = await axios.get(scriptUrl, { timeout: 15000 });
    const jsonData = response.data;

    if (jsonData.success) {
      const guestName = jsonData.guestName || 'Invitado';
      res.status(200).send(`
        <html>
          <head>
            <title>Asistencia Confirmada</title>
            <style>
              body { font-family: sans-serif; text-align: center; padding: 50px; }
              h1 { color: #4CAF50; }
              p { color: #333; }
            </style>
          </head>
          <body>
            <h1>✅ ¡Asistencia Confirmada!</h1>
            <p>¡Bienvenido, ${guestName}!</p>
          </body>
        </html>
      `);
    } else {
      res.status(400).send(`
        <html>
          <head>
            <title>Error</title>
            <style>
              body { font-family: sans-serif; text-align: center; padding: 50px; }
              h1 { color: #f44336; }
              p { color: #333; }
            </style>
          </head>
          <body>
            <h1>❌ Error</h1>
            <p>${jsonData.message || 'Código inválido o ya utilizado.'}</p>
          </body>
        </html>
      `);
    }
  } catch (error) {
    console.error('Error al validar el QR:', error.message);
    res.status(500).send('Error interno del servidor.');
  }
});

// ===== RUTA PARA ENVÍO DE FORMULARIO =====
app.post('/api/submit', async (req, res) => {
  console.log('📝 Confirmación recibida:', req.body);

  try {
    // Validación de datos requeridos
    const { id, name, attendance, phone  } = req.body;
    
    if (!id || !name || !attendance) {
      return res.status(400).json({
        success: false,
        error: 'Faltan datos requeridos: id, name, attendance'
      });
    }

    console.log('📡 Enviando confirmación a Google Script...');

    // Configuración de axios para POST
    const axiosConfig = {
      timeout: 20000, // 20 segundos para envíos
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Wedding-App/1.0',
        'Accept': 'application/json',
      },
      validateStatus: function (status) {
        return status >= 200 && status < 500;
      }
    };

    const response = await axios.post(GOOGLE_SCRIPT_URL, req.body, axiosConfig);

    console.log('📨 Respuesta de Google Script:', {
      status: response.status,
      data: response.data
    });

    // Parsear respuesta si es string
    let jsonData;
    if (typeof response.data === 'string') {
      try {
        jsonData = JSON.parse(response.data);
      } catch (parseError) {
        console.error('❌ Error parseando respuesta POST:', parseError);
        return res.status(500).json({
          success: false,
          error: 'Error en el formato de respuesta del servidor'
        });
      }
    } else {
      jsonData = response.data;
    }

    // Verificar que la respuesta indica éxito
    if (jsonData.success) {
      const confirmationNumber = jsonData.confirmationNumber;

      // Generar URL del QR
      const qrUrl = `https://tu-dominio.com/validacion-qr?code=${confirmationNumber}`;
      const whatsappText = `¡Hola ${name}!%0A%0A¡Tu asistencia a la boda ha sido confirmada! 🎉%0A%0ATe esperamos con mucho gusto. Aquí está el enlace a tu QR de confirmación: ${qrUrl}%0A%0A¡Nos vemos en la boda!`;
      const whatsappUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${whatsappText}`;

      return res.json({
        success: true,
        message: 'Confirmación guardada y QR generado',
        confirmationNumber: confirmationNumber,
        whatsappUrl: whatsappUrl // Envia la URL de WhatsApp al frontend
      });
      
      // console.log('✅ Confirmación guardada exitosamente');
    } else {
      console.log('⚠️ Error en confirmación:', jsonData.message);
    }

    res.json(jsonData);

  } catch (error) {
    console.error('❌ Error enviando confirmación:', {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      status: error.response?.status
    });

    // Manejar errores específicos
    if (error.code === 'ETIMEDOUT') {
      return res.status(504).json({
        success: false,
        error: 'Timeout - la confirmación tardó demasiado en procesarse'
      });
    }

    if (error.response?.status >= 400) {
      return res.status(error.response.status).json({
        success: false,
        error: 'Error del servidor de Google',
        details: error.response.data
      });
    }

    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ===== RUTA DE TESTING PARA GOOGLE SCRIPT =====
app.get('/api/test', async (req, res) => {
  try {
    console.log('🧪 Testing conexión con Google Script...');
    
    const testUrl = `${GOOGLE_SCRIPT_URL}?action=test`;
    const response = await axios.get(testUrl, { timeout: 10000 });
    
    res.json({
      success: true,
      message: 'Conexión con Google Script exitosa',
      data: response.data,
      status: response.status
    });
  } catch (error) {
    console.error('❌ Error en test:', error.message);
    res.status(500).json({
      success: false,
      error: 'No se pudo conectar con Google Script',
      details: error.message
    });
  }
});

// ===== MIDDLEWARE DE MANEJO DE ERRORES =====
app.use((error, req, res, next) => {
  console.error('❌ Error no manejado:', error);
  
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    details: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
  });
});

// ===== RUTA 404 - Corregida =====
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
    path: req.originalUrl
  });
});

// Añade esta ruta al inicio de tu archivo, después de los middlewares
app.get('/', (req, res) => {
  res.json({
    message: '¡Bienvenido a la API de la boda de Ángel & Ceci!',
    routes: {
      health: '/api/health',
      search: '/api/search?name=nombre',
      submit: 'POST /api/submit'
    }
  });
});

// ===== INICIAR SERVIDOR =====
app.listen(port, () => {
  console.log(`🚀 Servidor corriendo en puerto ${port}`);
  console.log(`📡 Google Script URL: ${GOOGLE_SCRIPT_URL}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// ===== MANEJO GRACEFUL DE SHUTDOWN =====
process.on('SIGTERM', () => {
  console.log('👋 Cerrando servidor gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('👋 Cerrando servidor gracefully...');
  process.exit(0);
});


module.exports = app;
