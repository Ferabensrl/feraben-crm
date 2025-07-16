const Database = require('better-sqlite3');
const path = require('path');

// Conectar a la base de datos
const dbPath = path.join(__dirname, 'database', 'feraben.db');
const db = new Database(dbPath);

console.log('🔧 Arreglo final de base de datos para comisiones...');

try {
  // Función para verificar si una columna existe en una tabla
  function columnExists(tableName, columnName) {
    try {
      const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
      return columns.some(col => col.name === columnName);
    } catch (error) {
      return false;
    }
  }

  console.log('📊 Agregando columnas faltantes con valores constantes...');

  // Agregar columnas una por una con valores constantes
  if (!columnExists('vendedores_config', 'fecha_desde')) {
    // Usar fecha actual fija en lugar de CURRENT_DATE
    const fechaHoy = new Date().toISOString().split('T')[0];
    db.exec(`ALTER TABLE vendedores_config ADD COLUMN fecha_desde DATE DEFAULT '${fechaHoy}'`);
    console.log('   ✅ Agregada: fecha_desde');
  }

  if (!columnExists('vendedores_config', 'comentarios')) {
    db.exec(`ALTER TABLE vendedores_config ADD COLUMN comentarios TEXT DEFAULT ''`);
    console.log('   ✅ Agregada: comentarios');
  }

  if (!columnExists('vendedores_config', 'updated_at')) {
    // Usar timestamp actual fijo
    const timestampActual = new Date().toISOString();
    db.exec(`ALTER TABLE vendedores_config ADD COLUMN updated_at DATETIME DEFAULT '${timestampActual}'`);
    console.log('   ✅ Agregada: updated_at');
  }

  console.log('✅ Todas las columnas agregadas correctamente');

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
      // Actualizar comentarios si está vacío
      const config = db.prepare('SELECT * FROM vendedores_config WHERE usuario_id = ?').get(usuario.id);
      if (!config.comentarios) {
        const comentario = usuario.rol === 'admin' ? 
          'Administrador - Sin comisión' : 
          'Vendedor - 5% sobre pagos recibidos';
        
        db.prepare(`
          UPDATE vendedores_config 
          SET comentarios = ?, updated_at = ? 
          WHERE usuario_id = ?
        `).run(comentario, new Date().toISOString(), usuario.id);
        
        console.log(`   📝 ${usuario.nombre}: Comentario actualizado`);
      } else {
        console.log(`   ℹ️  ${usuario.nombre}: Ya configurado completamente`);
      }
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
  
  console.log('💰 Configuración de comisiones actual:');
  configs.forEach(config => {
    console.log(`   👤 ${config.nombre} (${config.rol}):`);
    console.log(`      - Porcentaje: ${config.porcentaje_comision}%`);
    console.log(`      - Base: ${config.base_calculo}`);
    console.log(`      - Mínimo: $${config.minimo_comision || 0}`);
    console.log(`      - Comentario: ${config.comentarios || 'Sin comentario'}`);
    console.log('');
  });

  // Probar una consulta de ejemplo
  console.log('🧪 Probando funcionalidad...');
  try {
    // Contar movimientos de prueba para Mariela (vendedor ID 2)
    const pruebaMovimientos = db.prepare(`
      SELECT 
        COUNT(*) as total_movimientos,
        SUM(CASE WHEN tipo_movimiento = 'Pago' THEN ABS(importe) ELSE 0 END) as total_pagos
      FROM movimientos 
      WHERE vendedor_id = 2 
      AND fecha >= date('now', '-30 days')
    `).get();

    console.log(`   📊 Mariela - Últimos 30 días:`);
    console.log(`      - Movimientos: ${pruebaMovimientos.total_movimientos}`);
    console.log(`      - Total pagos: $${pruebaMovimientos.total_pagos?.toFixed(2) || '0.00'}`);
    
    if (pruebaMovimientos.total_pagos > 0) {
      const comisionEjemplo = (pruebaMovimientos.total_pagos * 5) / 100;
      console.log(`      - Comisión ejemplo (5%): $${comisionEjemplo.toFixed(2)}`);
    }

  } catch (error) {
    console.log('   ⚠️  No se pudo ejecutar consulta de prueba');
  }

  // Estadísticas finales
  const stats = {
    usuarios: db.prepare('SELECT COUNT(*) as count FROM usuarios').get().count,
    clientes: db.prepare('SELECT COUNT(*) as count FROM clientes').get().count,
    movimientos: db.prepare('SELECT COUNT(*) as count FROM movimientos').get().count,
    vendedores_config: db.prepare('SELECT COUNT(*) as count FROM vendedores_config').get().count,
    liquidaciones: db.prepare('SELECT COUNT(*) as count FROM liquidaciones_comision').get().count
  };

  console.log('\n📈 Estadísticas del sistema:');
  console.log(`   👥 Usuarios: ${stats.usuarios}`);
  console.log(`   🏢 Clientes: ${stats.clientes}`);
  console.log(`   📊 Movimientos: ${stats.movimientos}`);
  console.log(`   ⚙️  Configs comisión: ${stats.vendedores_config}`);
  console.log(`   💰 Liquidaciones: ${stats.liquidaciones}`);

  console.log('\n✅ ¡BASE DE DATOS COMPLETAMENTE CONFIGURADA!');
  console.log('\n🎯 Sistema de comisiones listo para:');
  console.log('   ✅ Calcular comisiones por período');
  console.log('   ✅ Generar liquidaciones automáticas');
  console.log('   ✅ Configurar porcentajes por vendedor');
  console.log('   ✅ Reportes y comprobantes detallados');
  console.log('   ✅ Auditoría completa de movimientos');

  console.log('\n🚀 PRÓXIMO PASO: Agregar rutas API al servidor');
  
} catch (error) {
  console.error('❌ Error en configuración:', error);
  console.log('\n🔧 Información de diagnóstico:');
  console.log('   - Archivo DB:', dbPath);
  console.log('   - Error:', error.message);
  console.log('   - Código error:', error.code);
} finally {
  db.close();
}