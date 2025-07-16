const Database = require('better-sqlite3');
const path = require('path');

// Conectar a la base de datos
const dbPath = path.join(__dirname, 'database', 'feraben.db');
const db = new Database(dbPath);

console.log('🔧 Analizando y arreglando base de datos para comisiones...');

try {
  // Función para verificar si una tabla existe
  function tableExists(tableName) {
    const result = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name=?
    `).get(tableName);
    return !!result;
  }

  // Función para verificar si una columna existe en una tabla
  function columnExists(tableName, columnName) {
    try {
      const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
      return columns.some(col => col.name === columnName);
    } catch (error) {
      return false;
    }
  }

  console.log('📊 Analizando estructura actual...');

  // Verificar estado de tablas
  const tablas = {
    vendedores_config: tableExists('vendedores_config'),
    liquidaciones_comision: tableExists('liquidaciones_comision'),
    detalle_comisiones: tableExists('detalle_comisiones')
  };

  console.log('📋 Estado de tablas:');
  Object.entries(tablas).forEach(([tabla, existe]) => {
    console.log(`   ${tabla}: ${existe ? '✅ Existe' : '❌ No existe'}`);
  });

  // Si vendedores_config existe, verificar estructura
  if (tablas.vendedores_config) {
    console.log('\n🔍 Analizando estructura de vendedores_config...');
    const columnas = db.prepare('PRAGMA table_info(vendedores_config)').all();
    
    console.log('📝 Columnas actuales:');
    columnas.forEach(col => {
      console.log(`   ${col.name}: ${col.type}`);
    });

    // Verificar columnas faltantes
    const columnasFaltantes = [];
    const columnasRequeridas = [
      'minimo_comision',
      'fecha_desde', 
      'comentarios',
      'updated_at'
    ];

    columnasRequeridas.forEach(col => {
      if (!columnExists('vendedores_config', col)) {
        columnasFaltantes.push(col);
      }
    });

    if (columnasFaltantes.length > 0) {
      console.log(`\n⚠️  Columnas faltantes: ${columnasFaltantes.join(', ')}`);
      console.log('🔧 Agregando columnas faltantes...');

      // Agregar columnas una por una
      if (!columnExists('vendedores_config', 'minimo_comision')) {
        db.exec('ALTER TABLE vendedores_config ADD COLUMN minimo_comision DECIMAL(10,2) DEFAULT 0');
        console.log('   ✅ Agregada: minimo_comision');
      }

      if (!columnExists('vendedores_config', 'fecha_desde')) {
        db.exec('ALTER TABLE vendedores_config ADD COLUMN fecha_desde DATE DEFAULT CURRENT_DATE');
        console.log('   ✅ Agregada: fecha_desde');
      }

      if (!columnExists('vendedores_config', 'comentarios')) {
        db.exec('ALTER TABLE vendedores_config ADD COLUMN comentarios TEXT');
        console.log('   ✅ Agregada: comentarios');
      }

      if (!columnExists('vendedores_config', 'updated_at')) {
        db.exec('ALTER TABLE vendedores_config ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP');
        console.log('   ✅ Agregada: updated_at');
      }
    } else {
      console.log('✅ Todas las columnas requeridas están presentes');
    }
  } else {
    // Crear tabla completa si no existe
    console.log('🆕 Creando tabla vendedores_config...');
    db.exec(`
      CREATE TABLE vendedores_config (
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
    console.log('✅ Tabla vendedores_config creada');
  }

  // Crear otras tablas si no existen
  if (!tablas.liquidaciones_comision) {
    console.log('🆕 Creando tabla liquidaciones_comision...');
    db.exec(`
      CREATE TABLE liquidaciones_comision (
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
    console.log('✅ Tabla liquidaciones_comision creada');
  }

  if (!tablas.detalle_comisiones) {
    console.log('🆕 Creando tabla detalle_comisiones...');
    db.exec(`
      CREATE TABLE detalle_comisiones (
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
    console.log('✅ Tabla detalle_comisiones creada');
  }

  // Verificar usuarios existentes
  console.log('\n👥 Verificando usuarios...');
  const usuarios = db.prepare('SELECT id, nombre, rol FROM usuarios ORDER BY id').all();
  console.log('Usuarios encontrados:');
  usuarios.forEach(user => {
    console.log(`   ${user.id}: ${user.nombre} (${user.rol})`);
  });

  // Configurar vendedores si no están configurados
  console.log('\n💰 Configurando comisiones de vendedores...');
  
  for (const usuario of usuarios) {
    const configExiste = db.prepare('SELECT id FROM vendedores_config WHERE usuario_id = ?').get(usuario.id);
    
    if (!configExiste) {
      const porcentaje = usuario.rol === 'admin' ? 0.00 : 5.00;
      const comentario = usuario.rol === 'admin' ? 
        'Administrador - Sin comisión' : 
        'Vendedor - 5% sobre pagos recibidos';

      db.prepare(`
        INSERT INTO vendedores_config 
        (usuario_id, porcentaje_comision, base_calculo, minimo_comision, comentarios)
        VALUES (?, ?, ?, ?, ?)
      `).run(usuario.id, porcentaje, 'pago', 0, comentario);
      
      console.log(`   ✅ ${usuario.nombre}: ${porcentaje}% configurado`);
    } else {
      console.log(`   ℹ️  ${usuario.nombre}: Ya configurado`);
    }
  }

  // Crear índices para optimizar consultas
  console.log('\n🔗 Creando índices...');
  try {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_liquidaciones_vendedor_periodo ON liquidaciones_comision(vendedor_id, periodo_desde, periodo_hasta);
      CREATE INDEX IF NOT EXISTS idx_detalle_liquidacion ON detalle_comisiones(liquidacion_id);
      CREATE INDEX IF NOT EXISTS idx_detalle_movimiento ON detalle_comisiones(movimiento_id);
      CREATE INDEX IF NOT EXISTS idx_vendedores_config_usuario ON vendedores_config(usuario_id);
    `);
    console.log('✅ Índices creados correctamente');
  } catch (error) {
    console.log('ℹ️  Algunos índices ya existían');
  }

  // Verificar configuración final
  console.log('\n📊 Verificación final...');
  const configs = db.prepare(`
    SELECT vc.*, u.nombre, u.rol 
    FROM vendedores_config vc 
    JOIN usuarios u ON vc.usuario_id = u.id
    ORDER BY vc.usuario_id
  `).all();
  
  console.log('Configuración de comisiones:');
  configs.forEach(config => {
    console.log(`   ${config.nombre}: ${config.porcentaje_comision}% sobre ${config.base_calculo} (min: $${config.minimo_comision})`);
  });

  // Estadísticas finales
  const stats = {
    usuarios: db.prepare('SELECT COUNT(*) as count FROM usuarios').get().count,
    clientes: db.prepare('SELECT COUNT(*) as count FROM clientes').get().count,
    movimientos: db.prepare('SELECT COUNT(*) as count FROM movimientos').get().count,
    vendedores_config: db.prepare('SELECT COUNT(*) as count FROM vendedores_config').get().count,
    liquidaciones: db.prepare('SELECT COUNT(*) as count FROM liquidaciones_comision').get().count
  };

  console.log('\n📈 Estadísticas actuales:');
  console.log(`   Usuarios: ${stats.usuarios}`);
  console.log(`   Clientes: ${stats.clientes}`);
  console.log(`   Movimientos: ${stats.movimientos}`);
  console.log(`   Configs comisión: ${stats.vendedores_config}`);
  console.log(`   Liquidaciones: ${stats.liquidaciones}`);

  console.log('\n✅ ¡Base de datos actualizada correctamente para sistema de comisiones!');
  console.log('\n🎯 Sistema listo para:');
  console.log('   - Calcular comisiones por período');
  console.log('   - Generar liquidaciones automáticas');
  console.log('   - Reportes y comprobantes');
  console.log('   - Configuración por vendedor');
  
} catch (error) {
  console.error('❌ Error actualizando base de datos:', error);
  console.log('\n🔧 Detalles del error para diagnóstico:');
  console.log('   - Archivo DB:', dbPath);
  console.log('   - Error específico:', error.message);
} finally {
  db.close();
}

console.log('\n🚀 ¡Listo! Ahora puedes continuar con las rutas API del sistema de comisiones.');