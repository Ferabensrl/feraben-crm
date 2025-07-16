const Database = require('better-sqlite3');
const path = require('path');

// Conectar a la base de datos
const dbPath = path.join(__dirname, 'backend', 'database', 'feraben.db');
const db = new Database(dbPath);

console.log('🔧 AGREGANDO COLUMNA base_calculo...\n');

try {
  // Verificar columnas actuales
  const tableInfo = db.prepare(`PRAGMA table_info(liquidaciones_comision)`).all();
  const existingColumns = tableInfo.map(col => col.name);
  
  console.log('📋 Columnas actuales:', existingColumns);

  // Agregar la columna base_calculo si no existe
  if (!existingColumns.includes('base_calculo')) {
    console.log('➕ Agregando base_calculo...');
    db.prepare('ALTER TABLE liquidaciones_comision ADD COLUMN base_calculo TEXT DEFAULT \'pago\'').run();
    console.log('✅ base_calculo agregada exitosamente');
  } else {
    console.log('✅ base_calculo ya existe');
  }

  // Verificar otras columnas que podrían faltar
  const additionalColumns = [
    { name: 'cantidad_movimientos', type: 'INTEGER', defaultValue: '0' },
    { name: 'cantidad_clientes', type: 'INTEGER', defaultValue: '0' }
  ];

  console.log('\n🔍 Verificando columnas adicionales...');
  additionalColumns.forEach(col => {
    if (!existingColumns.includes(col.name)) {
      try {
        console.log(`➕ Agregando ${col.name}...`);
        db.prepare(`ALTER TABLE liquidaciones_comision ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.defaultValue}`).run();
        console.log(`✅ ${col.name} agregada`);
      } catch (error) {
        console.log(`❌ Error agregando ${col.name}:`, error.message);
      }
    } else {
      console.log(`✅ ${col.name} ya existe`);
    }
  });

  // Verificación final
  console.log('\n🔍 VERIFICACIÓN FINAL:');
  const finalInfo = db.prepare(`PRAGMA table_info(liquidaciones_comision)`).all();
  console.log('📋 Todas las columnas:');
  finalInfo.forEach(col => {
    console.log(`   • ${col.name} (${col.type})`);
  });

  console.log('\n🚀 ¡CORRECCIÓN COMPLETADA!');
  console.log('👉 Reinicia el servidor y prueba de nuevo');

} catch (error) {
  console.error('❌ Error:', error);
} finally {
  db.close();
}