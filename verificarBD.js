const Database = require('better-sqlite3');
const path = require('path');

// Conectar a la base de datos
const dbPath = path.join(__dirname, 'backend', 'database', 'feraben.db');
const db = new Database(dbPath);

console.log('🔍 VERIFICANDO ESTRUCTURA DE LA BASE DE DATOS...\n');

try {
  // Verificar si existe la tabla liquidaciones_comision
  const tableExists = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='liquidaciones_comision'
  `).get();

  if (tableExists) {
    console.log('✅ Tabla liquidaciones_comision existe');
    
    // Obtener estructura de la tabla
    const tableInfo = db.prepare(`PRAGMA table_info(liquidaciones_comision)`).all();
    
    console.log('\n📋 ESTRUCTURA ACTUAL:');
    tableInfo.forEach(column => {
      console.log(`   ${column.name} (${column.type}) ${column.notnull ? 'NOT NULL' : ''} ${column.pk ? 'PRIMARY KEY' : ''}`);
    });

    // Verificar columnas específicas que necesitamos
    const requiredColumns = [
      'periodo_desde', 'periodo_hasta', 'adelantos_otorgados', 
      'dinero_en_mano', 'otros_descuentos', 'otros_bonos', 
      'total_neto', 'metodo_pago', 'referencia_pago', 
      'observaciones_liquidacion', 'fecha_entrega'
    ];

    console.log('\n🎯 VERIFICACIÓN DE COLUMNAS REQUERIDAS:');
    const existingColumns = tableInfo.map(col => col.name);
    
    requiredColumns.forEach(col => {
      const exists = existingColumns.includes(col);
      console.log(`   ${exists ? '✅' : '❌'} ${col}`);
    });

  } else {
    console.log('❌ Tabla liquidaciones_comision NO existe');
  }

  // Verificar otras tablas importantes
  const otherTables = [
    'adelantos_vendedor', 'dinero_en_mano_vendedor', 
    'liquidacion_comision_detalles', 'liquidacion_adelantos_aplicados',
    'liquidacion_dinero_aplicado'
  ];

  console.log('\n🔍 VERIFICANDO OTRAS TABLAS:');
  otherTables.forEach(tableName => {
    const exists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='${tableName}'
    `).get();
    console.log(`   ${exists ? '✅' : '❌'} ${tableName}`);
  });

} catch (error) {
  console.error('❌ Error verificando base de datos:', error);
} finally {
  db.close();
}

console.log('\n🏁 Verificación completada');