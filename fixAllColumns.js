const Database = require('better-sqlite3');
const path = require('path');

// Conectar a la base de datos
const dbPath = path.join(__dirname, 'backend', 'database', 'feraben.db');
const db = new Database(dbPath);

console.log('🔧 AGREGANDO TODAS LAS COLUMNAS FALTANTES...\n');

try {
  // Verificar columnas actuales
  const tableInfo = db.prepare(`PRAGMA table_info(liquidaciones_comision)`).all();
  const existingColumns = tableInfo.map(col => col.name);
  
  console.log('📋 Columnas existentes:', existingColumns.length);

  // TODAS las columnas que deben existir
  const requiredColumns = [
    { name: 'periodo_desde', type: 'DATE', defaultValue: 'NULL' },
    { name: 'periodo_hasta', type: 'DATE', defaultValue: 'NULL' },
    { name: 'base_calculo', type: 'TEXT', defaultValue: "'pago'" },
    { name: 'observaciones', type: 'TEXT', defaultValue: 'NULL' },
    { name: 'cantidad_movimientos', type: 'INTEGER', defaultValue: '0' },
    { name: 'cantidad_clientes', type: 'INTEGER', defaultValue: '0' },
    { name: 'fecha_pago', type: 'DATE', defaultValue: 'NULL' },
    { name: 'usuario_creador', type: 'INTEGER', defaultValue: 'NULL' },
    { name: 'numero_recibo', type: 'TEXT', defaultValue: 'NULL' },
    { name: 'archivo_pdf', type: 'TEXT', defaultValue: 'NULL' }
  ];

  console.log('\n🔧 AGREGANDO COLUMNAS FALTANTES:');
  
  let columnasAgregadas = 0;
  
  requiredColumns.forEach(col => {
    if (!existingColumns.includes(col.name)) {
      try {
        const alterSQL = `ALTER TABLE liquidaciones_comision ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.defaultValue}`;
        console.log(`   ➕ Agregando: ${col.name} (${col.type})`);
        db.prepare(alterSQL).run();
        console.log(`   ✅ ${col.name} agregada exitosamente`);
        columnasAgregadas++;
      } catch (error) {
        if (error.message.includes('duplicate column')) {
          console.log(`   ✅ ${col.name} ya existe`);
        } else {
          console.log(`   ❌ Error agregando ${col.name}:`, error.message);
        }
      }
    } else {
      console.log(`   ✅ ${col.name} ya existe`);
    }
  });

  // Verificación final completa
  console.log('\n🔍 VERIFICACIÓN FINAL COMPLETA:');
  const finalInfo = db.prepare(`PRAGMA table_info(liquidaciones_comision)`).all();
  console.log(`📋 Total columnas: ${finalInfo.length}`);
  
  console.log('\n📝 ESTRUCTURA COMPLETA:');
  finalInfo.forEach(col => {
    const required = requiredColumns.find(req => req.name === col.name);
    const status = required ? '🆕' : '📋';
    console.log(`   ${status} ${col.name} (${col.type})`);
  });

  console.log(`\n✅ ¡CORRECCIÓN COMPLETADA!`);
  console.log(`📊 Columnas agregadas: ${columnasAgregadas}`);
  console.log(`📊 Total columnas: ${finalInfo.length}`);
  console.log('\n🚀 Reinicia el servidor y prueba de nuevo');

} catch (error) {
  console.error('❌ Error:', error);
} finally {
  db.close();
}