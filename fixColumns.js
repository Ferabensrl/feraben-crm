const Database = require('better-sqlite3');
const path = require('path');

// Conectar a la base de datos
const dbPath = path.join(__dirname, 'backend', 'database', 'feraben.db');
const db = new Database(dbPath);

console.log('🔧 CORRIGIENDO COLUMNAS ESPECÍFICAS...\n');

try {
  // Agregar las columnas periodo_desde y periodo_hasta que faltan
  console.log('➕ Agregando periodo_desde...');
  try {
    db.prepare('ALTER TABLE liquidaciones_comision ADD COLUMN periodo_desde DATE').run();
    console.log('✅ periodo_desde agregada');
  } catch (error) {
    if (error.message.includes('duplicate column')) {
      console.log('✅ periodo_desde ya existe');
    } else {
      console.log('❌ Error:', error.message);
    }
  }

  console.log('➕ Agregando periodo_hasta...');
  try {
    db.prepare('ALTER TABLE liquidaciones_comision ADD COLUMN periodo_hasta DATE').run();
    console.log('✅ periodo_hasta agregada');
  } catch (error) {
    if (error.message.includes('duplicate column')) {
      console.log('✅ periodo_hasta ya existe');
    } else {
      console.log('❌ Error:', error.message);
    }
  }

  // Crear las tablas auxiliares que faltan
  console.log('\n🏗️ Creando tablas auxiliares...');

  const tablesSQL = [
    {
      name: 'adelantos_vendedor',
      sql: `CREATE TABLE IF NOT EXISTS adelantos_vendedor (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vendedor_id INTEGER NOT NULL,
        fecha_adelanto DATE NOT NULL,
        monto DECIMAL(10,2) NOT NULL,
        concepto TEXT,
        estado TEXT DEFAULT 'pendiente',
        liquidacion_aplicada_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vendedor_id) REFERENCES usuarios(id),
        FOREIGN KEY (liquidacion_aplicada_id) REFERENCES liquidaciones_comision(id)
      )`
    },
    {
      name: 'dinero_en_mano_vendedor',
      sql: `CREATE TABLE IF NOT EXISTS dinero_en_mano_vendedor (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vendedor_id INTEGER NOT NULL,
        fecha_cobro DATE NOT NULL,
        monto DECIMAL(10,2) NOT NULL,
        cliente_nombre TEXT,
        concepto TEXT,
        estado TEXT DEFAULT 'pendiente',
        liquidacion_aplicada_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (vendedor_id) REFERENCES usuarios(id),
        FOREIGN KEY (liquidacion_aplicada_id) REFERENCES liquidaciones_comision(id)
      )`
    },
    {
      name: 'liquidacion_comision_detalles',
      sql: `CREATE TABLE IF NOT EXISTS liquidacion_comision_detalles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        liquidacion_id INTEGER NOT NULL,
        movimiento_id INTEGER NOT NULL,
        fecha_movimiento DATE NOT NULL,
        cliente_nombre TEXT NOT NULL,
        tipo_movimiento TEXT NOT NULL,
        base_comisionable DECIMAL(10,2) NOT NULL,
        comision_calculada DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (liquidacion_id) REFERENCES liquidaciones_comision(id),
        FOREIGN KEY (movimiento_id) REFERENCES movimientos(id)
      )`
    },
    {
      name: 'liquidacion_adelantos_aplicados',
      sql: `CREATE TABLE IF NOT EXISTS liquidacion_adelantos_aplicados (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        liquidacion_id INTEGER NOT NULL,
        adelanto_id INTEGER NOT NULL,
        monto_aplicado DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (liquidacion_id) REFERENCES liquidaciones_comision(id),
        FOREIGN KEY (adelanto_id) REFERENCES adelantos_vendedor(id)
      )`
    },
    {
      name: 'liquidacion_dinero_aplicado',
      sql: `CREATE TABLE IF NOT EXISTS liquidacion_dinero_aplicado (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        liquidacion_id INTEGER NOT NULL,
        dinero_id INTEGER NOT NULL,
        monto_aplicado DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (liquidacion_id) REFERENCES liquidaciones_comision(id),
        FOREIGN KEY (dinero_id) REFERENCES dinero_en_mano_vendedor(id)
      )`
    }
  ];

  tablesSQL.forEach(table => {
    try {
      db.prepare(table.sql).run();
      console.log(`✅ Tabla ${table.name} creada/verificada`);
    } catch (error) {
      console.log(`❌ Error creando ${table.name}:`, error.message);
    }
  });

  // Verificación final
  console.log('\n🔍 VERIFICACIÓN FINAL:');
  const finalInfo = db.prepare(`PRAGMA table_info(liquidaciones_comision)`).all();
  const finalColumns = finalInfo.map(col => col.name);
  
  const checkColumns = ['periodo_desde', 'periodo_hasta'];
  checkColumns.forEach(col => {
    console.log(`   ${finalColumns.includes(col) ? '✅' : '❌'} ${col}`);
  });

  console.log('\n🚀 ¡CORRECCIÓN COMPLETADA!');
  console.log('👉 Ahora reinicia el servidor y prueba de nuevo');

} catch (error) {
  console.error('❌ Error:', error);
} finally {
  db.close();
}