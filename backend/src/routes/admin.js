const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const router = express.Router();

// POST /api/admin/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validaciones
    if (!username || !password) {
      return res.status(400).json({
        errorCode: 'MISSING_CREDENTIALS',
        message: 'Usuario y contraseña son requeridos'
      });
    }

    // Buscar admin
    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(401).json({
        errorCode: 'INVALID_CREDENTIALS',
        message: 'Usuario o contraseña incorrectos'
      });
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, admin.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({
        errorCode: 'INVALID_CREDENTIALS',
        message: 'Usuario o contraseña incorrectos'
      });
    }

    // Generar JWT
    const token = jwt.sign(
      {
        adminId: admin._id,
        username: admin.username
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      token,
      admin: {
        id: admin._id,
        username: admin.username
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      errorCode: 'SERVER_ERROR',
      message: 'Error interno del servidor'
    });
  }
});

// POST /api/admin/register (solo para testing/setup inicial)
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        errorCode: 'MISSING_DATA',
        message: 'Usuario y contraseña son requeridos'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        errorCode: 'WEAK_PASSWORD',
        message: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    // Verificar si ya existe
    const existingAdmin = await Admin.findOne({ username });
    if (existingAdmin) {
      return res.status(400).json({
        errorCode: 'USER_EXISTS',
        message: 'El usuario ya existe'
      });
    }

    // Hash de contraseña
    const passwordHash = await bcrypt.hash(password, 10);

    // Crear admin
    const admin = new Admin({
      username,
      passwordHash
    });

    await admin.save();

    res.status(201).json({
      message: 'Administrador creado exitosamente',
      admin: {
        id: admin._id,
        username: admin.username
      }
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({
      errorCode: 'SERVER_ERROR',
      message: 'Error interno del servidor'
    });
  }
});

module.exports = router;
