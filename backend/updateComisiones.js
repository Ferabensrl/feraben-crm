const Database = require('better-sqlite3');
const path = require('path');

// Conectar a la base de datos
const dbPath = path.join(__dirname, 'database', 'feraben.db');
const db = new Database(dbPath);

console.log('🔧 Actualizando base de datos para sistema de comisiones...');

try {
  // Crear tabla de configuración de vendedores
  db.exec(`
    CREATE TABLE IF NOT EXISTS vendedores_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER UNIQUE NOT NULL,
      porcentaje_comision DECIMAL(5,2) DEFAULT 5.00,
      base_calculo TEXT DEFAULT 'pago' CHECK(base_calculo IN ('venta', 'pago', 'cobro')),
      minimo_comision DECIMAL(10,2) DEFAULT 0,
      activo BOOLEAN DEFAULT true,
      fecha_desde DATE DEFAULT CURRENT_DATE,
      comentarios TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );
  `);

  // Crear tabla de liquidaciones de comisión
  db.exec(`
    CREATE TABLE IF NOT EXISTS liquidaciones_comision (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendedor_id INTEGER NOT NULL,
      periodo_desde DATE NOT NULL,
      periodo_hasta DATE NOT NULL,
      base_calculo TEXT NOT NULL,
      porcentaje DECIMAL(5,2) NOT NULL,
      total_base DECIMAL(10,2) NOT NULL,
      total_comision DECIMAL(10,2) NOT NULL,
      cantidad_movimientos INTEGER DEFAULT 0,
      cantidad_clientes INTEGER DEFAULT 0,
      estado TEXT DEFAULT 'calculada' CHECK(estado IN ('calculada', 'pagada', 'anulada')),
      fecha_pago DATE NULL,
      observaciones TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vendedor_id) REFERENCES usuarios(id)
    );
  `);

  // Crear tabla de detalle de comisiones (para auditoría)
  db.exec(`
    CREATE TABLE IF NOT EXISTS detalle_comisiones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      liquidacion_id INTEGER NOT NULL,
      movimiento_id INTEGER NOT NULL,
      cliente_id INTEGER NOT NULL,
      fecha_movimiento DATE NOT NULL,
      tipo_movimiento TEXT NOT NULL,
      importe_movimiento DECIMAL(10,2) NOT NULL,
      base_comisionable DECIMAL(10,2) NOT NULL,
      porcentaje_aplicado DECIMAL(5,2) NOT NULL,
      comision_calculada DECIMAL(10,2) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (liquidacion_id) REFERENCES liquidaciones_comision(id),
      FOREIGN KEY (movimiento_id) REFERENCES movimientos(id),
      FOREIGN KEY (cliente_id) REFERENCES clientes(id)
    );
  `);

  // Insertar configuración inicial para vendedores existentes
  console.log('📊 Configurando vendedores...');
  
  // Fernando (ID: 1) - Admin, no necesita comisión pero lo configuramos
  db.prepare(`
    INSERT OR IGNORE INTO vendedores_config 
    (usuario_id, porcentaje_comision, base_calculo, minimo_comision, comentarios)
    VALUES (?, ?, ?, ?, ?)
  `).run(1, 0.00, 'pago', 0, 'Administrador - Sin comisión');

  // Mariela (ID: 2) - Vendedora, configuración inicial 5%
  db.prepare(`
    INSERT OR IGNORE INTO vendedores_config 
    (usuario_id, porcentaje_comision, base_calculo, minimo_comision, comentarios)
    VALUES (?, ?, ?, ?, ?)
  `).run(2, 5.00, 'pago', 0, 'Vendedora - 5% sobre pagos recibidos');

  // Verificar usuarios existentes
  const usuarios = db.prepare('SELECT id, nombre, rol FROM usuarios ORDER BY id').all();
  console.log('👥 Usuarios encontrados:');
  usuarios.forEach(user => {
    console.log(`   ${user.id}: ${user.nombre} (${user.rol})`);
  });

  // Verificar configuración de comisiones
  const configs = db.prepare(`
    SELECT vc.*, u.nombre, u.rol 
    FROM vendedores_config vc 
    JOIN usuarios u ON vc.usuario_id = u.id
    ORDER BY vc.usuario_id
  `).all();
  
  console.log('\n💰 Configuración de comisiones:');
  configs.forEach(config => {
    console.log(`   ${config.nombre}: ${config.porcentaje_comision}% sobre ${config.base_calculo}`);
  });

  // Crear índices para optimizar consultas
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_liquidaciones_vendedor_periodo ON liquidaciones_comision(vendedor_id, periodo_desde, periodo_hasta);
    CREATE INDEX IF NOT EXISTS idx_detalle_liquidacion ON detalle_comisiones(liquidacion_id);
    CREATE INDEX IF NOT EXISTS idx_detalle_movimiento ON detalle_comisiones(movimiento_id);
    CREATE INDEX IF NOT EXISTS idx_vendedores_config_usuario ON vendedores_config(usuario_id);
  `);

  // Estadísticas de la base de datos
  const stats = {
    usuarios: db.prepare('SELECT COUNT(*) as count FROM usuarios').get().count,
    clientes: db.prepare('SELECT COUNT(*) as count FROM clientes').get().count,
    movimientos: db.prepare('SELECT COUNT(*) as count FROM movimientos').get().count,
    vendedores_config: db.prepare('SELECT COUNT(*) as count FROM vendedores_config').get().count
  };

  console.log('\n📈 Estadísticas actuales:');
  console.log(`   Usuarios: ${stats.usuarios}`);
  console.log(`   Clientes: ${stats.clientes}`);
  console.log(`   Movimientos: ${stats.movimientos}`);
  console.log(`   Configs comisión: ${stats.vendedores_config}`);

  console.log('\n✅ ¡Base de datos actualizada para sistema de comisiones!');
  console.log('\n🎯 Próximo paso: Implementar la lógica de cálculo de comisiones');
  
} catch (error) {
  console.error('❌ Error actualizando base de datos:', error);
} finally {
  db.close();
}

console.log('\n🚀 Actualización completada. Ahora puedes continuar con el desarrollo del módulo de comisiones.');