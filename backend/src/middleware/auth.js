const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        errorCode: 'NO_TOKEN',
        message: 'Token de autenticación no proporcionado'
      });
    }

    const token = authHeader.substring(7);
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    req.admin = {
      id: decoded.adminId,
      username: decoded.username
    };
    
    next();
  } catch (error) {
    return res.status(401).json({
      errorCode: 'INVALID_TOKEN',
      message: 'Token inválido o expirado'
    });
  }
};

module.exports = authMiddleware;
