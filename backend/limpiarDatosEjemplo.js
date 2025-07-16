const Database = require('better-sqlite3');
const path = require('path');

// Conectar a la base de datos
const dbPath = path.join(__dirname, 'database', 'feraben.db');
const db = new Database(dbPath);

console.log('🧹 Limpiando datos de ejemplo...');

try {
  // Verificar datos actuales
  console.log('\n📊 Datos actuales de Mariela (vendedor ID 2):');
  
  const adelantos = db.prepare('SELECT COUNT(*) as count, SUM(monto) as total FROM adelantos_vendedores WHERE vendedor_id = 2').get();
  const dinero = db.prepare('SELECT COUNT(*) as count, SUM(monto) as total FROM dinero_vendedor WHERE vendedor_id = 2').get();
  
  console.log(`   Adelantos: ${adelantos.count} registros, total: $${(adelantos.total || 0).toLocaleString()}`);
  console.log(`   Dinero en mano: ${dinero.count} registros, total: $${(dinero.total || 0).toLocaleString()}`);

  // Borrar datos de ejemplo
  console.log('\n🗑️ Eliminando datos de ejemplo...');
  
  const resultAdelantos = db.prepare('DELETE FROM adelantos_vendedores WHERE vendedor_id = 2').run();
  const resultDinero = db.prepare('DELETE FROM dinero_vendedor WHERE vendedor_id = 2').run();
  
  console.log(`   ✅ Adelantos eliminados: ${resultAdelantos.changes} registros`);
  console.log(`   ✅ Dinero en mano eliminado: ${resultDinero.changes} registros`);

  // Verificar limpieza
  console.log('\n✨ Verificación post-limpieza:');
  
  const adelantosFinal = db.prepare('SELECT COUNT(*) as count FROM adelantos_vendedores WHERE vendedor_id = 2').get();
  const dineroFinal = db.prepare('SELECT COUNT(*) as count FROM dinero_vendedor WHERE vendedor_id = 2').get();
  
  console.log(`   Adelantos restantes: ${adelantosFinal.count}`);
  console.log(`   Dinero en mano restante: ${dineroFinal.count}`);

  if (adelantosFinal.count === 0 && dineroFinal.count === 0) {
    console.log('\n🎉 ¡Datos limpiados exitosamente!');
    console.log('📋 Ahora la liquidación mostrará:');
    console.log('   - Adelantos: $0');
    console.log('   - Dinero en mano: $0');
    console.log('   - Total neto = Comisión bruta');
  } else {
    console.log('\n⚠️ Algunos datos no se eliminaron correctamente');
  }

  console.log('\n📝 Para agregar adelantos reales, puedes usar:');
  console.log('   - La API POST /api/comisiones/adelantos');
  console.log('   - La API POST /api/comisiones/dinero-mano');
  console.log('   - O crear un formulario en la interfaz');

} catch (error) {
  console.error('❌ Error limpiando datos:', error);
} finally {
  db.close();
}

console.log('\n🚀 Reinicia la aplicación React para ver los cambios');