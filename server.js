// ===== SERVER.JS CORREGIDO =====
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const QRCode = require('qrcode');

const app = express();
const port = process.env.PORT || 3000;

// ===== CONFIGURACIÓN DE CORS MEJORADA =====
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://localhost:5000",
    "http://127.0.0.1:5500",
    "https://boda-cecily-angel-backend.vercel.app",
    "https://ceciigaska23.github.io", // ⚠️  AÑADE ESTA LÍNEA
  ],
  methods: ["GET", "POST", "OPTIONS", "PUT", "DELETE"],
  allowedHeaders: [
    "Content-Type",
    "Accept",
    "Authorization",
    "X-Requested-With",
  ],
  credentials: true,
};

// Esta línea es suficiente para manejar CORS y peticiones OPTIONS
app.use(cors(corsOptions));

// Middleware para parsear JSON
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ===== URL DE GOOGLE APPS SCRIPT - ACTUALÍZALA =====
const GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxnQrrFZjH_Jnvao6AlyBcmAL9HxYZpHg1HVTvh3rTNjNwxKvz3FvdkrxT2F5JAfYFC/exec";

// ===== RUTAS DE LA API =====
// Ruta de validación de código QR (nueva y corregida)
// ===== RUTA DE VALIDACIÓN DE CÓDIGO QR =====
app.post('/api/validate-code', async (req, res) => {
  const { code } = req.body;
  console.log(`🔍 Validando código: ${code}`);

  if (!code) {
    return res.status(400).json({
      isValid: false,
      message: 'No se proporcionó un código.'
    });
  }

  try {
    // Construir URL para Google Apps Script
    const validateUrl = `${GOOGLE_SCRIPT_URL}?action=validate&code=${encodeURIComponent(code)}`;

    const response = await axios.get(validateUrl, {
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Wedding-App/1.0'
      },
      validateStatus: status => status >= 200 && status < 500
    });

    let jsonData;
    if (typeof response.data === 'string') {
      try {
        jsonData = JSON.parse(response.data);
      } catch (err) {
        console.error('❌ Error parseando respuesta de Google Script:', err);
        return res.status(500).json({
          isValid: false,
          message: 'Respuesta inválida del servidor de validación.'
        });
      }
    } else {
      jsonData = response.data;
    }

    console.log('📨 Respuesta de Google Script (validate):', jsonData);

    // Mapear la respuesta de Apps Script al formato del frontend
    if (jsonData.success) {
      res.json({
        isValid: true,
        message: jsonData.message || 'Código válido',
        guestName: jsonData.guestName || null
      });
    } else {
      res.json({
        isValid: false,
        message: jsonData.message || 'Código inválido o ya utilizado'
      });
    }

  } catch (error) {
    console.error('❌ Error en /api/validate-code:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      data: error.response?.data
    });

    if (error.code === 'ETIMEDOUT') {
      return res.status(504).json({
        isValid: false,
        message: 'Timeout - el servidor de validación tardó demasiado en responder'
      });
    }

    res.status(500).json({
      isValid: false,
      message: 'Error interno al validar el código'
    });
  }
});

// ===== RUTA DE SALUD PARA VERIFICAR QUE FUNCIONA =====
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    message: "Servidor de boda funcionando correctamente",
  });
});

// ===== RUTA PARA BÚSQUEDA DE INVITADOS =====
app.get("/api/search", async (req, res) => {
  console.log("🔍 Búsqueda de invitado recibida:", req.query);

  const { name } = req.query;

  // Validación de entrada
  if (!name || name.trim().length < 2) {
    return res.status(400).json({
      found: false,
      error: "Nombre debe tener al menos 2 caracteres",
    });
  }

  try {
    // Construir URL con parámetros
    const searchUrl = `${GOOGLE_SCRIPT_URL}?action=search&name=${encodeURIComponent(
      name.trim()
    )}`;
    console.log("📡 Enviando request a:", searchUrl);

    // Configuración de axios con timeout y headers
    const axiosConfig = {
      timeout: 15000, // 15 segundos
      headers: {
        "User-Agent": "Wedding-App/1.0",
        Accept: "application/json",
      },
      validateStatus: function (status) {
        return status >= 200 && status < 500; // No rechazar en 4xx
      },
    };

    const response = await axios.get(searchUrl, axiosConfig);

    console.log("📨 Respuesta de Google Script:", {
      status: response.status,
      headers: response.headers["content-type"],
      data: response.data,
    });

    // Verificar si la respuesta es JSON válido
    let jsonData;
    if (typeof response.data === "string") {
      try {
        jsonData = JSON.parse(response.data);
      } catch (parseError) {
        console.error("❌ Error parseando JSON:", parseError);
        return res.status(500).json({
          found: false,
          error: "Error en el formato de respuesta del servidor",
        });
      }
    } else {
      jsonData = response.data;
    }

    // Verificar estructura de respuesta
    if (!jsonData || typeof jsonData !== "object") {
      console.error("❌ Respuesta inválida de Google Script:", jsonData);
      return res.status(500).json({
        found: false,
        error: "Respuesta inválida del servidor",
      });
    }

    // Enviar respuesta al frontend
    res.json(jsonData);
  } catch (error) {
    console.error("❌ Error en búsqueda:", {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      status: error.response?.status,
    });

    // Manejar diferentes tipos de errores
    if (error.code === "ENOTFOUND") {
      return res.status(503).json({
        found: false,
        error: "No se puede conectar con Google Apps Script",
      });
    }

    if (error.code === "ETIMEDOUT") {
      return res.status(504).json({
        found: false,
        error: "Timeout - el servidor tardó demasiado en responder",
      });
    }

    if (error.response?.status === 404) {
      return res.status(404).json({
        found: false,
        error: "Script de Google no encontrado - verifica la URL",
      });
    }

    res.status(500).json({
      found: false,
      error: "Error interno del servidor",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// ===== RUTA PARA VALIDAR Y MOSTRAR QR =====
app.get('/validacion-qr/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const qrData = `https://boda-cecily-angel.vercel.app/validacion-qr/?code=${id}`;
        const qrImage = await QRCode.toBuffer(qrData, { type: 'png', width: 300 });

        res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': qrImage.length
        });
        res.end(qrImage);
    } catch (error) {
        console.error('Error generando QR:', error);
        res.status(500).json({ error: 'No se pudo generar el QR' });
    }
});

// ===== RUTA PARA ENVÍO DE FORMULARIO =====
app.post("/api/submit", async (req, res) => {
  console.log("📝 Confirmación recibida:", req.body);

  try {
    const { id, name, attendance, phone } = req.body;
    if (!id || !name || !attendance) {
      return res.status(400).json({
        success: false,
        error: "Faltan datos requeridos: id, name, attendance",
      });
    }

    console.log("📡 Enviando confirmación a Google Script...");
    const axiosConfig = {
      timeout: 20000,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Wedding-App/1.0",
        Accept: "application/json",
      },
      validateStatus: function (status) {
        return status >= 200 && status < 500;
      },
    };

    const response = await axios.post(GOOGLE_SCRIPT_URL, req.body, axiosConfig);

    console.log("📨 Respuesta de Google Script:", {
      status: response.status,
      data: response.data,
    });

    let jsonData;
    if (typeof response.data === "string") {
      try {
        jsonData = JSON.parse(response.data);
      } catch (parseError) {
        console.error("❌ Error parseando respuesta POST:", parseError);
        return res.status(500).json({
          success: false,
          error: "Error en el formato de respuesta del servidor",
        });
      }
    } else {
      jsonData = response.data;
    }

    if (jsonData.success) {
      const confirmationNumber = jsonData.confirmationNumber;

      // 1. URL de validación que irá dentro del QR
      const validationUrl = `https://boda-cecily-angel.vercel.app/validacion-qr?code=${confirmationNumber}`;

      // 2. URL del QR que llama a TU PROPIA RUTA
      // ❌ REMUEVE ESTA LÍNEA INCORRECTA
      // const qrUrl = `https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=${encodeURIComponent(validationUrl)}`;
      // ✅ USA ESTA LÍNEA CORRECTA
      const qrUrl = `https://boda-cecily-angel-backend.vercel.app/qr-code/${confirmationNumber}`;

      // 3. Texto para WhatsApp
      const whatsappText = encodeURIComponent(
        `🎉 ¡Hola ${name}!\n\n` +
          `¡Tu asistencia a nuestra boda ha sido confirmada!\n\n` +
          `📅 Fecha: 30 de Octubre 2026\n` +
          `🕕 Hora: 4:00 PM\n` +
          `📍 Lugar: Lienzo Charro "La Tapatía"\n\n` +
          `🎫 Código de confirmación: ${confirmationNumber}\n\n` +
          `📲 Presenta este QR el día de la boda:\n${validationUrl}\n\n` +
          `Si deseas notificar un cambio en tu asistencia, escribe aquí:\nhttps://wa.me/5215640042829\n\n` +
          `¡Nos vemos en la celebración!\n` +
          `💕 Ángel & Ceci`
      );

      // 4. Link de envío por WhatsApp
      const whatsappUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${whatsappText}`;

      // 5. Respuesta al frontend
      return res.json({
        success: true,
        message: "Confirmación guardada y QR generado",
        confirmationNumber: confirmationNumber,
        whatsappUrl: whatsappUrl,
        qrUrl: qrUrl,
      });
    } else {
      console.log("⚠️ Error en confirmación:", jsonData.message);
    }
    res.json(jsonData);
  } catch (error) {
    console.error("❌ Error enviando confirmación:", {
      message: error.message,
      code: error.code,
      response: error.response?.data,
      status: error.response?.status,
    });
    // Manejar errores específicos
    if (error.code === "ETIMEDOUT") {
      return res.status(504).json({
        success: false,
        error: "Timeout - la confirmación tardó demasiado en procesarse",
      });
    }
    if (error.response?.status >= 400) {
      return res.status(error.response.status).json({
        success: false,
        error: "Error del servidor de Google",
        details: error.response.data,
      });
    }
    res.status(500).json({
      success: false,
      error: "Error interno del servidor",
      details: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// AÑADE ESTA NUEVA RUTA PARA GENERAR EL QR
app.get('/qr-code/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const validationUrl = `https://boda-cecily-angel.vercel.app/validacion-qr/?code=${code}`;
        const qrImage = await QRCode.toBuffer(validationUrl, { type: 'png', width: 300 });

        res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': qrImage.length
        });
        res.end(qrImage);
    } catch (error) {
        console.error('Error generando QR:', error);
        res.status(500).json({ error: 'No se pudo generar el QR' });
    }
});

// ===== RUTA DE TESTING PARA GOOGLE SCRIPT =====
app.get("/api/test", async (req, res) => {
  try {
    console.log("🧪 Testing conexión con Google Script...");

    const testUrl = `${GOOGLE_SCRIPT_URL}?action=test`;
    const response = await axios.get(testUrl, { timeout: 10000 });

    res.json({
      success: true,
      message: "Conexión con Google Script exitosa",
      data: response.data,
      status: response.status,
    });
  } catch (error) {
    console.error("❌ Error en test:", error.message);
    res.status(500).json({
      success: false,
      error: "No se pudo conectar con Google Script",
      details: error.message,
    });
  }
});

// ===== MIDDLEWARE DE MANEJO DE ERRORES =====
app.use((error, req, res, next) => {
  console.error("❌ Error no manejado:", error);

  res.status(500).json({
    success: false,
    error: "Error interno del servidor",
    details:
      process.env.NODE_ENV === "development" ? error.message : "Error interno",
  });
});

// Añade esta ruta al inicio de tu archivo, después de los middlewares
app.get("/", (req, res) => {
  res.json({
    message: "¡Bienvenido a la API de la boda de Ángel & Ceci!",
    status: "Backend funcionando correctamente",
    routes: {
      health: "/api/health",
      search: "/api/search?name=nombre",
      submit: "POST /api/submit",
      validateQR: "/api/validate-qr?code=codigo",
    },
  });
});

// ===== INICIAR SERVIDOR =====
app.listen(port, () => {
  console.log(`🚀 Servidor corriendo en puerto ${port}`);
  console.log(`📡 Google Script URL: ${GOOGLE_SCRIPT_URL}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
});

// ===== MANEJO GRACEFUL DE SHUTDOWN =====
process.on("SIGTERM", () => {
  console.log("👋 Cerrando servidor gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("👋 Cerrando servidor gracefully...");
  process.exit(0);
});

module.exports = app;
