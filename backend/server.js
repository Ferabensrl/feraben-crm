const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');
const ComisionesService = require('./comisionesService');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Inicializar base de datos SQLite
const dbPath = path.join(__dirname, 'database', 'feraben.db');
const db = new Database(dbPath);

// Crear tablas si no existen
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nombre TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'vendedor',
    activo BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rut TEXT UNIQUE NOT NULL,
    razon_social TEXT NOT NULL,
    nombre_fantasia TEXT,
    email TEXT,
    direccion TEXT,
    ciudad TEXT,
    departamento TEXT,
    vendedor_id INTEGER,
    activo BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vendedor_id) REFERENCES usuarios(id)
  );

  CREATE TABLE IF NOT EXISTS movimientos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha DATE NOT NULL,
    cliente_id INTEGER NOT NULL,
    vendedor_id INTEGER NOT NULL,
    tipo_movimiento TEXT NOT NULL,
    documento TEXT,
    importe DECIMAL(10,2) NOT NULL,
    comentario TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),
    FOREIGN KEY (vendedor_id) REFERENCES usuarios(id)
  );

  CREATE TABLE IF NOT EXISTS vendedores_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER UNIQUE NOT NULL,
    porcentaje_comision DECIMAL(5,2) DEFAULT 0,
    base_calculo TEXT DEFAULT 'pago',
    activo BOOLEAN DEFAULT true,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
  );

  CREATE TABLE IF NOT EXISTS liquidaciones_comision (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendedor_id INTEGER NOT NULL,
    fecha_desde DATE NOT NULL,
    fecha_hasta DATE NOT NULL,
    total_base DECIMAL(10,2) NOT NULL,
    porcentaje DECIMAL(5,2) NOT NULL,
    total_comision DECIMAL(10,2) NOT NULL,
    estado TEXT DEFAULT 'pendiente',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vendedor_id) REFERENCES usuarios(id)
  );

  CREATE TABLE IF NOT EXISTS empresa_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clave TEXT UNIQUE NOT NULL,
    valor TEXT NOT NULL,
    descripcion TEXT,
    modificable BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Insertar configuración inicial de empresa si no existe
db.exec(`
  INSERT OR IGNORE INTO empresa_config (clave, valor, descripcion, modificable) VALUES
  ('razon_social', 'Feraben SRL', 'Razón social de la empresa', true),
  ('rut', '020522780010', 'RUT de la empresa', true),
  ('telefono', '097998999', 'Teléfono principal', true),
  ('email', 'ferabensrl@gmail.com', 'Email de contacto', true),
  ('web', 'mareuy.com', 'Sitio web', true),
  ('direccion', 'Montevideo, Uruguay', 'Dirección física', true),
  ('version_sistema', '1.0.0', 'Versión del sistema', false),
  ('fecha_instalacion', '${new Date().toISOString()}', 'Fecha de instalación', false);
`);

console.log('🚀 Servidor Feraben CRM iniciando...');
console.log(`📊 Base de datos SQLite: ${dbPath}`);

// ===============================================
// RUTAS BÁSICAS
// ===============================================

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Servidor Feraben CRM funcionando' });
});

// ===============================================
// RUTAS DE CLIENTES
// ===============================================

// Ruta para obtener todos los clientes
app.get('/api/clientes', (req, res) => {
  try {
    const clientes = db.prepare(`
      SELECT c.*, u.nombre as vendedor_nombre 
      FROM clientes c 
      LEFT JOIN usuarios u ON c.vendedor_id = u.id 
      WHERE c.activo = 1
      ORDER BY c.razon_social
    `).all();
    
    res.json(clientes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ruta para obtener clientes por vendedor
app.get('/api/clientes/vendedor/:vendedorId', (req, res) => {
  try {
    const { vendedorId } = req.params;
    const clientes = db.prepare(`
      SELECT c.*, u.nombre as vendedor_nombre 
      FROM clientes c 
      LEFT JOIN usuarios u ON c.vendedor_id = u.id 
      WHERE c.vendedor_id = ? AND c.activo = 1
      ORDER BY c.razon_social
    `).all(vendedorId);
    
    res.json(clientes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ruta para obtener estado de cuenta de un cliente
app.get('/api/clientes/:clienteId/estado-cuenta', (req, res) => {
  try {
    const { clienteId } = req.params;
    const movimientos = db.prepare(`
      SELECT m.*, c.razon_social as cliente_nombre
      FROM movimientos m
      JOIN clientes c ON m.cliente_id = c.id
      WHERE m.cliente_id = ?
      ORDER BY m.fecha, m.id
    `).all(clienteId);
    
    // Calcular saldo acumulado
    let saldo = 0;
    const estadoCuenta = movimientos.map(mov => {
      saldo += mov.importe;
      return {
        ...mov,
        saldo_acumulado: saldo
      };
    });
    
    res.json(estadoCuenta);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===============================================
// RUTAS DE MOVIMIENTOS
// ===============================================

// Ruta para obtener movimientos
app.get('/api/movimientos', (req, res) => {
  try {
    const movimientos = db.prepare(`
      SELECT m.*, c.razon_social as cliente_nombre, u.nombre as vendedor_nombre
      FROM movimientos m
      JOIN clientes c ON m.cliente_id = c.id
      JOIN usuarios u ON m.vendedor_id = u.id
      ORDER BY m.fecha DESC, m.id DESC
    `).all();
    
    res.json(movimientos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ruta para crear un nuevo movimiento
app.post('/api/movimientos', (req, res) => {
  try {
    const { fecha, cliente_id, vendedor_id, tipo_movimiento, documento, importe, comentario } = req.body;
    
    // Ajustar importe según tipo de movimiento
    let importeFinal = parseFloat(importe);
    if (tipo_movimiento === 'Pago' || tipo_movimiento === 'Nota de Crédito') {
      importeFinal = Math.abs(importeFinal) * -1; // Hacer negativo
    } else {
      importeFinal = Math.abs(importeFinal); // Hacer positivo
    }
    
    const stmt = db.prepare(`
      INSERT INTO movimientos (fecha, cliente_id, vendedor_id, tipo_movimiento, documento, importe, comentario)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(fecha, cliente_id, vendedor_id, tipo_movimiento, documento, importeFinal, comentario);
    
    res.json({ 
      id: result.lastInsertRowid,
      message: 'Movimiento creado exitosamente'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===============================================
// RUTAS DE CONFIGURACIÓN
// ===============================================

// Ruta para obtener configuración de empresa
app.get('/api/empresa-config', (req, res) => {
  try {
    const config = db.prepare(`
      SELECT clave, valor FROM empresa_config 
      WHERE modificable = 1 OR clave IN ('razon_social', 'rut', 'telefono', 'email')
      ORDER BY clave
    `).all();
    
    const configObj = {};
    config.forEach(item => {
      configObj[item.clave] = item.valor;
    });
    
    res.json(configObj);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ⭐ RUTA CRÍTICA PARA EXPORTACIÓN ⭐
app.post('/api/clientes/:clienteId/exportar-estado-cuenta', (req, res) => {
  try {
    const { clienteId } = req.params;
    const { formato, filtro, fechaDesde, fechaHasta } = req.body;
    
    console.log(`🎯 EXPORTACIÓN SOLICITADA - Cliente: ${clienteId}, Formato: ${formato}, Filtro: ${filtro}`);
    
    // Obtener datos del cliente
    const cliente = db.prepare(`
      SELECT c.*, u.nombre as vendedor_nombre 
      FROM clientes c 
      LEFT JOIN usuarios u ON c.vendedor_id = u.id 
      WHERE c.id = ?
    `).get(clienteId);
    
    if (!cliente) {
      console.log('❌ Cliente no encontrado');
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    console.log(`✅ Cliente encontrado: ${cliente.razon_social}`);
    
    // Configuración de empresa (con valores por defecto)
    const empresa = {
      razon_social: 'Feraben SRL',
      rut: '020522780010',
      telefono: '097998999',
      email: 'ferabensrl@gmail.com',
      web: 'mareuy.com',
      direccion: 'Montevideo, Uruguay'
    };
    
    // Obtener movimientos según filtro
    let whereClause = 'WHERE m.cliente_id = ?';
    let params = [clienteId];
    
    if (filtro === 'fechas' && fechaDesde && fechaHasta) {
      whereClause += ' AND m.fecha BETWEEN ? AND ?';
      params.push(fechaDesde, fechaHasta);
      console.log(`📅 Filtro por fechas: ${fechaDesde} a ${fechaHasta}`);
    }
    
    let movimientos = db.prepare(`
      SELECT m.*, c.razon_social as cliente_nombre, u.nombre as vendedor_nombre
      FROM movimientos m
      JOIN clientes c ON m.cliente_id = c.id
      JOIN usuarios u ON m.vendedor_id = u.id
      ${whereClause}
      ORDER BY m.fecha, m.id
    `).all(...params);
    
    console.log(`📊 Movimientos obtenidos: ${movimientos.length}`);
    
    // Filtrar desde último saldo 0 si se solicita
    if (filtro === 'ultimo_saldo_cero') {
      let saldoAcumulado = 0;
      let indiceUltimoCero = -1;
      
      // Encontrar último punto donde saldo era 0
      movimientos.forEach((mov, index) => {
        saldoAcumulado += mov.importe;
        if (saldoAcumulado === 0) {
          indiceUltimoCero = index;
        }
      });
      
      // Tomar movimientos desde después del último saldo 0
      if (indiceUltimoCero >= 0) {
        movimientos = movimientos.slice(indiceUltimoCero + 1);
        console.log(`🎯 Filtro último saldo 0: ${movimientos.length} movimientos desde posición ${indiceUltimoCero}`);
      }
    }
    
    // Calcular saldo acumulado
    let saldoAcumulado = 0;
    const movimientosConSaldo = movimientos.map(mov => {
      saldoAcumulado += mov.importe;
      return {
        ...mov,
        saldo_acumulado: saldoAcumulado
      };
    });
    
    const datosExportacion = {
      cliente,
      empresa,
      movimientos: movimientosConSaldo,
      saldoFinal: saldoAcumulado,
      fechaGeneracion: new Date().toISOString(),
      filtroAplicado: filtro,
      rangoFechas: filtro === 'fechas' ? { desde: fechaDesde, hasta: fechaHasta } : null
    };
    
    console.log(`✅ Datos preparados para exportación: Saldo final ${saldoAcumulado}`);
    
    res.json({
      success: true,
      datos: datosExportacion,
      message: `Estado de cuenta generado (${movimientosConSaldo.length} movimientos)`
    });
    
  } catch (error) {
    console.error('❌ Error en exportación:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===============================================
// RUTAS PARA SISTEMA DE COMISIONES
// ===============================================

// ===== CONFIGURACIÓN DE VENDEDORES =====

// Obtener configuración de todos los vendedores (solo admin)
app.get('/api/comisiones/config', (req, res) => {
  try {
    const comisionesService = new ComisionesService();
    const configs = comisionesService.getAllConfigs();
    comisionesService.close();
    
    res.json(configs);
  } catch (error) {
    console.error('Error obteniendo configuraciones:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener configuración de un vendedor específico
app.get('/api/comisiones/config/:vendedorId', (req, res) => {
  try {
    const { vendedorId } = req.params;
    const comisionesService = new ComisionesService();
    const config = comisionesService.getConfigVendedor(parseInt(vendedorId));
    comisionesService.close();
    
    if (!config) {
      return res.status(404).json({ error: 'Configuración no encontrada' });
    }
    
    res.json(config);
  } catch (error) {
    console.error('Error obteniendo configuración:', error);
    res.status(500).json({ error: error.message });
  }
});

// Actualizar configuración de vendedor (solo admin)
app.put('/api/comisiones/config/:vendedorId', (req, res) => {
  try {
    const { vendedorId } = req.params;
    const { porcentaje_comision, base_calculo, minimo_comision, comentarios } = req.body;
    
    // Validaciones
    if (porcentaje_comision < 0 || porcentaje_comision > 100) {
      return res.status(400).json({ error: 'El porcentaje debe estar entre 0 y 100' });
    }
    
    if (!['venta', 'pago', 'cobro'].includes(base_calculo)) {
      return res.status(400).json({ error: 'Base de cálculo inválida' });
    }

    const comisionesService = new ComisionesService();
    const result = comisionesService.updateConfigVendedor(parseInt(vendedorId), {
      porcentaje_comision: parseFloat(porcentaje_comision),
      base_calculo,
      minimo_comision: parseFloat(minimo_comision) || 0,
      comentarios: comentarios || ''
    });
    comisionesService.close();
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Vendedor no encontrado' });
    }
    
    res.json({ 
      success: true, 
      message: 'Configuración actualizada correctamente',
      changes: result.changes
    });
  } catch (error) {
    console.error('Error actualizando configuración:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== CÁLCULO DE COMISIONES =====

// Calcular comisión para un período (preview)
app.post('/api/comisiones/calcular', (req, res) => {
  try {
    const { vendedor_id, fecha_desde, fecha_hasta } = req.body;
    
    // Validaciones
    if (!vendedor_id || !fecha_desde || !fecha_hasta) {
      return res.status(400).json({ 
        error: 'Faltan parámetros: vendedor_id, fecha_desde, fecha_hasta' 
      });
    }

    const fechaDesde = new Date(fecha_desde);
    const fechaHasta = new Date(fecha_hasta);
    
    if (fechaDesde > fechaHasta) {
      return res.status(400).json({ error: 'La fecha desde no puede ser mayor a fecha hasta' });
    }

    const comisionesService = new ComisionesService();
    const calculo = comisionesService.calcularComisionPeriodo(
      parseInt(vendedor_id),
      fecha_desde,
      fecha_hasta
    );
    comisionesService.close();
    
    res.json({
      success: true,
      calculo: calculo,
      message: `Comisión calculada: $${calculo.total_comision.toFixed(2)}`
    });
  } catch (error) {
    console.error('Error calculando comisión:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generar liquidación de comisión
app.post('/api/comisiones/liquidar', (req, res) => {
  try {
    const { vendedor_id, fecha_desde, fecha_hasta } = req.body;
    
    // Validaciones similares al cálculo
    if (!vendedor_id || !fecha_desde || !fecha_hasta) {
      return res.status(400).json({ 
        error: 'Faltan parámetros: vendedor_id, fecha_desde, fecha_hasta' 
      });
    }

    const comisionesService = new ComisionesService();
    
    // Primero calcular
    const calculo = comisionesService.calcularComisionPeriodo(
      parseInt(vendedor_id),
      fecha_desde,
      fecha_hasta
    );
    
    // Luego guardar liquidación
    const liquidacionId = comisionesService.guardarLiquidacion(calculo);
    comisionesService.close();
    
    res.json({
      success: true,
      liquidacion_id: liquidacionId,
      calculo: calculo,
      message: `Liquidación #${liquidacionId} generada exitosamente`
    });
  } catch (error) {
    console.error('Error generando liquidación:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== CONSULTA DE LIQUIDACIONES =====

// Obtener liquidaciones de un vendedor
app.get('/api/comisiones/liquidaciones/vendedor/:vendedorId', (req, res) => {
  try {
    const { vendedorId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    
    const comisionesService = new ComisionesService();
    const liquidaciones = comisionesService.getLiquidacionesVendedor(
      parseInt(vendedorId), 
      limit
    );
    comisionesService.close();
    
    res.json(liquidaciones);
  } catch (error) {
    console.error('Error obteniendo liquidaciones del vendedor:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener todas las liquidaciones (solo admin)
app.get('/api/comisiones/liquidaciones', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    
    const comisionesService = new ComisionesService();
    const liquidaciones = comisionesService.getAllLiquidaciones(limit);
    comisionesService.close();
    
    res.json(liquidaciones);
  } catch (error) {
    console.error('Error obteniendo todas las liquidaciones:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener detalle de una liquidación específica
app.get('/api/comisiones/liquidaciones/:liquidacionId', (req, res) => {
  try {
    const { liquidacionId } = req.params;
    
    const comisionesService = new ComisionesService();
    const detalle = comisionesService.getDetalleLiquidacion(parseInt(liquidacionId));
    comisionesService.close();
    
    if (!detalle) {
      return res.status(404).json({ error: 'Liquidación no encontrada' });
    }
    
    res.json(detalle);
  } catch (error) {
    console.error('Error obteniendo detalle de liquidación:', error);
    res.status(500).json({ error: error.message });
  }
});

// Marcar liquidación como pagada (solo admin)
app.put('/api/comisiones/liquidaciones/:liquidacionId/pagar', (req, res) => {
  try {
    const { liquidacionId } = req.params;
    const { fecha_pago, observaciones } = req.body;
    
    if (!fecha_pago) {
      return res.status(400).json({ error: 'La fecha de pago es obligatoria' });
    }

    const comisionesService = new ComisionesService();
    const result = comisionesService.marcarComoPagada(
      parseInt(liquidacionId),
      fecha_pago,
      observaciones || ''
    );
    comisionesService.close();
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Liquidación no encontrada' });
    }
    
    res.json({
      success: true,
      message: 'Liquidación marcada como pagada',
      changes: result.changes
    });
  } catch (error) {
    console.error('Error marcando liquidación como pagada:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== ESTADÍSTICAS Y REPORTES =====

// Estadísticas de un vendedor por año
app.get('/api/comisiones/estadisticas/vendedor/:vendedorId/:año', (req, res) => {
  try {
    const { vendedorId, año } = req.params;
    
    const comisionesService = new ComisionesService();
    const estadisticas = comisionesService.getEstadisticasVendedor(
      parseInt(vendedorId),
      parseInt(año)
    );
    comisionesService.close();
    
    res.json(estadisticas);
  } catch (error) {
    console.error('Error obteniendo estadísticas del vendedor:', error);
    res.status(500).json({ error: error.message });
  }
});

// Resumen general para dashboard (solo admin)
app.get('/api/comisiones/resumen', (req, res) => {
  try {
    const comisionesService = new ComisionesService();
    const resumen = comisionesService.getResumenComisiones();
    comisionesService.close();
    
    res.json(resumen);
  } catch (error) {
    console.error('Error obteniendo resumen de comisiones:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== UTILIDADES =====

// Obtener períodos sugeridos para liquidación
app.get('/api/comisiones/periodos-sugeridos', (req, res) => {
  try {
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    
    const primerDiaMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const ultimoDiaMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
    
    const inicioAño = new Date(hoy.getFullYear(), 0, 1);
    
    const periodos = [
      {
        nombre: 'Mes actual',
        desde: primerDiaMes.toISOString().split('T')[0],
        hasta: ultimoDiaMes.toISOString().split('T')[0],
        descripcion: `${primerDiaMes.toLocaleDateString('es-UY')} al ${ultimoDiaMes.toLocaleDateString('es-UY')}`
      },
      {
        nombre: 'Mes anterior',
        desde: primerDiaMesAnterior.toISOString().split('T')[0],
        hasta: ultimoDiaMesAnterior.toISOString().split('T')[0],
        descripcion: `${primerDiaMesAnterior.toLocaleDateString('es-UY')} al ${ultimoDiaMesAnterior.toLocaleDateString('es-UY')}`
      },
      {
        nombre: 'Últimos 30 días',
        desde: new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        hasta: hoy.toISOString().split('T')[0],
        descripcion: 'Últimos 30 días'
      },
      {
        nombre: 'Año actual',
        desde: inicioAño.toISOString().split('T')[0],
        hasta: hoy.toISOString().split('T')[0],
        descripcion: `Desde ${inicioAño.toLocaleDateString('es-UY')}`
      }
    ];
    
    res.json(periodos);
  } catch (error) {
    console.error('Error generando períodos sugeridos:', error);
    res.status(500).json({ error: error.message });
  }
});
// ===============================================
// RUTAS PARA LIQUIDACIONES AVANZADAS
// ===============================================
// Agregar estas rutas al server.js después de las rutas de comisiones existentes

// ===== GESTIÓN DE ADELANTOS =====

// Obtener adelantos pendientes de un vendedor
app.get('/api/comisiones/adelantos/:vendedorId', (req, res) => {
  try {
    const { vendedorId } = req.params;
    
    const comisionesService = new ComisionesService();
    const adelantos = comisionesService.getAdelantosPendientes(parseInt(vendedorId));
    comisionesService.close();
    
    res.json(adelantos);
  } catch (error) {
    console.error('Error obteniendo adelantos:', error);
    res.status(500).json({ error: error.message });
  }
});

// Registrar nuevo adelanto
app.post('/api/comisiones/adelantos', (req, res) => {
  try {
    const { vendedor_id, fecha, monto, motivo, metodo, referencia, observaciones, created_by } = req.body;
    
    // Validaciones
    if (!vendedor_id || !fecha || !monto || monto <= 0) {
      return res.status(400).json({ error: 'Vendedor, fecha y monto son obligatorios' });
    }

    const comisionesService = new ComisionesService();
    const result = comisionesService.registrarAdelanto(
      parseInt(vendedor_id),
      { fecha, monto: parseFloat(monto), motivo, metodo, referencia, observaciones },
      parseInt(created_by) || 1
    );
    comisionesService.close();
    
    res.json({ 
      success: true, 
      adelanto_id: result.lastInsertRowid,
      message: 'Adelanto registrado exitosamente'
    });
  } catch (error) {
    console.error('Error registrando adelanto:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== GESTIÓN DE DINERO EN MANO =====

// Obtener dinero en mano de un vendedor
app.get('/api/comisiones/dinero-mano/:vendedorId', (req, res) => {
  try {
    const { vendedorId } = req.params;
    
    const comisionesService = new ComisionesService();
    const dinero = comisionesService.getDineroEnMano(parseInt(vendedorId));
    comisionesService.close();
    
    res.json(dinero);
  } catch (error) {
    console.error('Error obteniendo dinero en mano:', error);
    res.status(500).json({ error: error.message });
  }
});

// Registrar dinero en mano
app.post('/api/comisiones/dinero-mano', (req, res) => {
  try {
    const { vendedor_id, fecha, cliente_id, monto, movimiento_id, concepto, observaciones } = req.body;
    
    // Validaciones
    if (!vendedor_id || !fecha || !cliente_id || !monto || monto <= 0) {
      return res.status(400).json({ error: 'Vendedor, fecha, cliente y monto son obligatorios' });
    }

    const comisionesService = new ComisionesService();
    const result = comisionesService.registrarDineroEnMano(
      parseInt(vendedor_id),
      { 
        fecha, 
        cliente_id: parseInt(cliente_id), 
        monto: parseFloat(monto), 
        movimiento_id: movimiento_id ? parseInt(movimiento_id) : null,
        concepto, 
        observaciones 
      }
    );
    comisionesService.close();
    
    res.json({ 
      success: true, 
      dinero_id: result.lastInsertRowid,
      message: 'Dinero en mano registrado exitosamente'
    });
  } catch (error) {
    console.error('Error registrando dinero en mano:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== RESUMEN DE AJUSTES =====

// Obtener resumen de ajustes para un vendedor
app.get('/api/comisiones/ajustes/:vendedorId', (req, res) => {
  try {
    const { vendedorId } = req.params;
    
    const comisionesService = new ComisionesService();
    const resumen = comisionesService.getResumenAjustes(parseInt(vendedorId));
    comisionesService.close();
    
    res.json(resumen);
  } catch (error) {
    console.error('Error obteniendo resumen de ajustes:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== LIQUIDACIONES AVANZADAS =====

// Generar liquidación avanzada con ajustes
app.post('/api/comisiones/liquidar-avanzada', (req, res) => {
  try {
    const { 
      vendedor_id, 
      fecha_desde, 
      fecha_hasta, 
      adelantos_otorgados,
      dinero_en_mano,
      otros_descuentos,
      otros_bonos,
      metodo_pago,
      referencia_pago,
      observaciones_liquidacion,
      fecha_entrega
    } = req.body;
    
    // Validaciones básicas
    if (!vendedor_id || !fecha_desde || !fecha_hasta) {
      return res.status(400).json({ 
        error: 'Faltan parámetros: vendedor_id, fecha_desde, fecha_hasta' 
      });
    }

    const comisionesService = new ComisionesService();
    
    // Primero calcular la comisión
    const calculo = comisionesService.calcularComisionPeriodo(
      parseInt(vendedor_id),
      fecha_desde,
      fecha_hasta
    );
    
    // Luego guardar liquidación avanzada
    const datosLiquidacion = {
      adelantos_otorgados: parseFloat(adelantos_otorgados) || 0,
      dinero_en_mano: parseFloat(dinero_en_mano) || 0,
      otros_descuentos: parseFloat(otros_descuentos) || 0,
      otros_bonos: parseFloat(otros_bonos) || 0,
      metodo_pago: metodo_pago || 'transferencia',
      referencia_pago: referencia_pago || '',
      observaciones_liquidacion: observaciones_liquidacion || '',
      fecha_entrega: fecha_entrega || null
    };

    const liquidacionId = comisionesService.guardarLiquidacionAvanzada(calculo, datosLiquidacion);
    comisionesService.close();
    
    res.json({
      success: true,
      liquidacion_id: liquidacionId,
      calculo: calculo,
      datos_liquidacion: datosLiquidacion,
      message: `Liquidación avanzada #${liquidacionId} generada exitosamente`
    });
  } catch (error) {
    console.error('Error generando liquidación avanzada:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener liquidación completa con todos los detalles
app.get('/api/comisiones/liquidaciones/:liquidacionId/completa', (req, res) => {
  try {
    const { liquidacionId } = req.params;
    
    const comisionesService = new ComisionesService();
    const liquidacion = comisionesService.getLiquidacionCompleta(parseInt(liquidacionId));
    comisionesService.close();
    
    if (!liquidacion) {
      return res.status(404).json({ error: 'Liquidación no encontrada' });
    }
    
    res.json(liquidacion);
  } catch (error) {
    console.error('Error obteniendo liquidación completa:', error);
    res.status(500).json({ error: error.message });
  }
});

// Marcar liquidación como firmada por vendedor
app.put('/api/comisiones/liquidaciones/:liquidacionId/firmar-vendedor', (req, res) => {
  try {
    const { liquidacionId } = req.params;
    
    const comisionesService = new ComisionesService();
    const result = comisionesService.marcarFirmadoVendedor(parseInt(liquidacionId));
    comisionesService.close();
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Liquidación no encontrada' });
    }
    
    res.json({
      success: true,
      message: 'Liquidación marcada como firmada por vendedor',
      changes: result.changes
    });
  } catch (error) {
    console.error('Error marcando firma de vendedor:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== EXPORTACIÓN DE RECIBOS PDF =====

// Generar PDF de liquidación
app.post('/api/comisiones/liquidaciones/:liquidacionId/exportar-pdf', (req, res) => {
  try {
    const { liquidacionId } = req.params;
    
    const comisionesService = new ComisionesService();
    const liquidacion = comisionesService.getLiquidacionCompleta(parseInt(liquidacionId));
    comisionesService.close();
    
    if (!liquidacion) {
      return res.status(404).json({ error: 'Liquidación no encontrada' });
    }

    // Configuración de empresa (con valores por defecto)
    const empresa = {
      razon_social: 'Feraben SRL',
      rut: '020522780010',
      telefono: '097998999',
      email: 'ferabensrl@gmail.com',
      web: 'mareuy.com',
      direccion: 'Montevideo, Uruguay'
    };

    // Preparar datos para el PDF
    const datosPDF = {
      liquidacion: liquidacion,
      empresa: empresa,
      fecha_generacion: new Date().toISOString(),
      numero_recibo: `REC-LIQ-${liquidacion.id.toString().padStart(6, '0')}`
    };
    
    res.json({
      success: true,
      datos: datosPDF,
      message: `Datos preparados para PDF de liquidación #${liquidacion.id}`
    });
    
  } catch (error) {
    console.error('❌ Error preparando PDF de liquidación:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== UTILIDADES PARA LIQUIDACIONES =====

// Obtener clientes de un vendedor (para el formulario de dinero en mano)
app.get('/api/comisiones/vendedor/:vendedorId/clientes', (req, res) => {
  try {
    const { vendedorId } = req.params;
    
    const clientes = db.prepare(`
      SELECT id, rut, razon_social, nombre_fantasia
      FROM clientes 
      WHERE vendedor_id = ? AND activo = 1
      ORDER BY razon_social
    `).all(parseInt(vendedorId));
    
    res.json(clientes);
  } catch (error) {
    console.error('Error obteniendo clientes del vendedor:', error);
    res.status(500).json({ error: error.message });
  }
});

console.log('🎯 RUTAS DE LIQUIDACIONES AVANZADAS CARGADAS:');
console.log('   GET  /api/comisiones/adelantos/:vendedorId - Ver adelantos');
console.log('   POST /api/comisiones/adelantos - Registrar adelanto');
console.log('   GET  /api/comisiones/dinero-mano/:vendedorId - Ver dinero en mano');
console.log('   POST /api/comisiones/dinero-mano - Registrar dinero en mano');
console.log('   GET  /api/comisiones/ajustes/:vendedorId - Resumen ajustes');
console.log('   POST /api/comisiones/liquidar-avanzada - Liquidación con ajustes');
console.log('   GET  /api/comisiones/liquidaciones/:id/completa - Liquidación detallada');
console.log('   POST /api/comisiones/liquidaciones/:id/exportar-pdf - Generar PDF');
console.log('   PUT  /api/comisiones/liquidaciones/:id/firmar-vendedor - Firmar recibo');

// ===============================================
// INICIAR SERVIDOR
// ===============================================

app.listen(PORT, () => {
  console.log(`🚀 Servidor Feraben CRM funcionando en puerto ${PORT}`);
  console.log(`📊 Base de datos SQLite: ${dbPath}`);
  console.log(`\n🎯 RUTAS PRINCIPALES DISPONIBLES:`);
  console.log(`   📈 Dashboard: GET /api/health`);
  console.log(`   👥 Clientes: GET /api/clientes`);
  console.log(`   💰 Movimientos: GET /api/movimientos`);
  console.log(`   📄 Exportación: POST /api/clientes/:id/exportar-estado-cuenta`);
  console.log(`\n💼 RUTAS DE COMISIONES:`);
  console.log(`   ⚙️  Configuración: GET/PUT /api/comisiones/config`);
  console.log(`   🧮 Calcular: POST /api/comisiones/calcular`);
  console.log(`   📋 Liquidar: POST /api/comisiones/liquidar`);
  console.log(`   📊 Liquidaciones: GET /api/comisiones/liquidaciones`);
  console.log(`   📈 Resumen: GET /api/comisiones/resumen`);
  console.log(`   📅 Períodos: GET /api/comisiones/periodos-sugeridos`);
  console.log(`\n✅ Sistema completo operativo con módulo de comisiones!`);
  // ===== EXPORTACIÓN EXCEL DE LIQUIDACIÓN =====
app.post('/api/comisiones/liquidaciones/:id/exportar-excel', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📊 Exportando Excel para liquidación ${id}`);
    
    // Obtener datos básicos - SIN consultas complicadas
    const liquidacion = db.prepare(`
      SELECT lc.*, u.nombre as vendedor_nombre
      FROM liquidaciones_comision lc
      JOIN usuarios u ON lc.vendedor_id = u.id
      WHERE lc.id = ?
    `).get(id);

    if (!liquidacion) {
      return res.status(404).json({ error: 'Liquidación no encontrada' });
    }

    // Crear Excel simple
    const XLSX = require('xlsx');
    const wb = XLSX.utils.book_new();
    
    // Datos del recibo sencillo
    const reciboData = [
      ['FERABEN SRL'],
      ['RECIBO DE LIQUIDACIÓN DE COMISIÓN'],
      [''],
      ['Recibo N°:', `LIQ-${String(id).padStart(4, '0')}`],
      ['Fecha:', new Date().toLocaleDateString('es-UY')],
      [''],
      ['VENDEDOR:', liquidacion.vendedor_nombre],
      [''],
      ['PERÍODO:'],
      ['Desde:', liquidacion.fecha_desde || 'No especificada'],
      ['Hasta:', liquidacion.fecha_hasta || 'No especificada'],
      [''],
      ['CÁLCULO:'],
      ['Base Comisionable:', `$ ${(liquidacion.total_base || 0).toLocaleString('es-UY')}`],
      ['Porcentaje:', `${liquidacion.porcentaje || 0}%`],
      ['Comisión Bruta:', `$ ${(liquidacion.total_comision || 0).toLocaleString('es-UY')}`],
      [''],
      ['DESCUENTOS:'],
      ['Adelantos:', `$ ${(liquidacion.adelantos_otorgados || 0).toLocaleString('es-UY')}`],
      ['Dinero en Mano:', `$ ${(liquidacion.dinero_en_mano || 0).toLocaleString('es-UY')}`],
      ['Otros Descuentos:', `$ ${(liquidacion.otros_descuentos || 0).toLocaleString('es-UY')}`],
      ['Bonos:', `$ ${(liquidacion.otros_bonos || 0).toLocaleString('es-UY')}`],
      [''],
      ['TOTAL NETO:', `$ ${(liquidacion.total_neto || 0).toLocaleString('es-UY')}`],
      [''],
      ['Estado:', liquidacion.estado || 'calculada'],
      [''],
      ['_____________________     _____________________'],
      ['Firma Vendedor           Firma Administración'],
      [''],
      ['Generado por Feraben CRM']
    ];
    
    const wsRecibo = XLSX.utils.aoa_to_sheet(reciboData);
    wsRecibo['!cols'] = [{ width: 25 }, { width: 30 }];
    XLSX.utils.book_append_sheet(wb, wsRecibo, 'Recibo');
    
    // Generar archivo
    const fileName = `Recibo_${liquidacion.vendedor_nombre.replace(/\s+/g, '_')}_${id}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.send(buffer);
    
    console.log(`✅ Excel generado: ${fileName}`);
    
  } catch (error) {
    console.error('❌ Error Excel:', error);
    res.status(500).json({ error: error.message });
  }
});

console.log('📊 RUTA EXCEL AGREGADA: POST /api/comisiones/liquidaciones/:id/exportar-excel');
});
// AGREGAR AL FINAL DEL server.js (antes de module.exports)

// ===== EXPORTACIÓN EXCEL SIMPLE DE LIQUIDACIÓN =====
app.post('/api/comisiones/liquidaciones/:id/exportar-excel', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📊 Exportando Excel para liquidación ${id}`);
    
    // Obtener datos básicos de la liquidación
    const liquidacion = db.prepare(`
      SELECT lc.*, u.nombre as vendedor_nombre
      FROM liquidaciones_comision lc
      JOIN usuarios u ON lc.vendedor_id = u.id
      WHERE lc.id = ?
    `).get(id);

    if (!liquidacion) {
      return res.status(404).json({ error: 'Liquidación no encontrada' });
    }

    console.log(`✅ Liquidación encontrada: ${liquidacion.vendedor_nombre}`);

    // Crear Excel simple con RECIBO SENCILLO
    const XLSX = require('xlsx');
    const wb = XLSX.utils.book_new();
    
    // RECIBO SENCILLO - Solo lo necesario
    const reciboData = [
      ['FERABEN SRL'],
      ['RECIBO DE LIQUIDACIÓN DE COMISIÓN'],
      [''],
      ['Recibo N°:', `LIQ-${String(id).padStart(4, '0')}`],
      ['Fecha:', new Date().toLocaleDateString('es-UY')],
      [''],
      ['VENDEDOR:', liquidacion.vendedor_nombre],
      [''],
      ['PERÍODO DE LIQUIDACIÓN:'],
      ['Desde:', liquidacion.fecha_desde || 'No especificada'],
      ['Hasta:', liquidacion.fecha_hasta || 'No especificada'],
      [''],
      ['CÁLCULO DE COMISIÓN:'],
      ['Base Comisionable:', `$ ${(liquidacion.total_base || 0).toLocaleString('es-UY')}`],
      ['Porcentaje Aplicado:', `${liquidacion.porcentaje || 0}%`],
      ['Total Comisión Bruta:', `$ ${(liquidacion.total_comision || 0).toLocaleString('es-UY')}`],
      [''],
      ['DESCUENTOS Y AJUSTES:'],
      ['Adelantos Otorgados:', `$ ${(liquidacion.adelantos_otorgados || 0).toLocaleString('es-UY')}`],
      ['Dinero en Mano:', `$ ${(liquidacion.dinero_en_mano || 0).toLocaleString('es-UY')}`],
      ['Otros Descuentos:', `$ ${(liquidacion.otros_descuentos || 0).toLocaleString('es-UY')}`],
      ['Bonos/Incentivos:', `$ ${(liquidacion.otros_bonos || 0).toLocaleString('es-UY')}`],
      [''],
      ['TOTAL NETO A PAGAR:', `$ ${(liquidacion.total_neto || 0).toLocaleString('es-UY')}`],
      [''],
      ['Estado:', liquidacion.estado || 'calculada'],
      ['Método de Pago:', liquidacion.metodo_pago || 'No especificado'],
      [''],
      ['Observaciones:', liquidacion.observaciones_liquidacion || 'Ninguna'],
      [''],
      [''],
      ['_____________________     _____________________'],
      ['Firma Vendedor           Firma Administración'],
      [''],
      ['Generado automáticamente por Feraben CRM']
    ];
    
    const wsRecibo = XLSX.utils.aoa_to_sheet(reciboData);
    
    // Ajustar ancho de columnas para que se vea bien
    wsRecibo['!cols'] = [
      { width: 25 },  // Columna A
      { width: 30 }   // Columna B
    ];
    
    XLSX.utils.book_append_sheet(wb, wsRecibo, 'Recibo Liquidación');
    
    // Nombre del archivo
    const fileName = `Recibo_Liquidacion_${liquidacion.vendedor_nombre.replace(/\s+/g, '_')}_${id}.xlsx`;
    
    // Configurar headers para descarga
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    // Generar y enviar archivo
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.send(buffer);
    
    console.log(`📁 Archivo Excel generado: ${fileName}`);
    
  } catch (error) {
    console.error('❌ Error exportando Excel:', error);
    res.status(500).json({ error: 'Error generando archivo Excel: ' + error.message });
  }
});

module.exports = app;