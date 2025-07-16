const Database = require('better-sqlite3');
const path = require('path');

// Conectar a la base de datos
const dbPath = path.join(__dirname, 'database', 'feraben.db');
const db = new Database(dbPath);

console.log('🔧 Actualizando base de datos para liquidaciones avanzadas...');

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

  console.log('📊 Agregando campos para liquidaciones avanzadas...');

  // Agregar campos a la tabla liquidaciones_comision
  const nuevasColumnas = [
    { nombre: 'adelantos_otorgados', tipo: 'DECIMAL(10,2) DEFAULT 0', descripcion: 'Adelantos dados al vendedor' },
    { nombre: 'dinero_en_mano', tipo: 'DECIMAL(10,2) DEFAULT 0', descripcion: 'Dinero que tiene el vendedor (cobros)' },
    { nombre: 'otros_descuentos', tipo: 'DECIMAL(10,2) DEFAULT 0', descripcion: 'Otros descuentos aplicados' },
    { nombre: 'otros_bonos', tipo: 'DECIMAL(10,2) DEFAULT 0', descripcion: 'Bonos o incentivos adicionales' },
    { nombre: 'total_neto', tipo: 'DECIMAL(10,2) DEFAULT 0', descripcion: 'Total neto a pagar al vendedor' },
    { nombre: 'metodo_pago', tipo: "TEXT DEFAULT 'transferencia'", descripcion: 'Método de pago (transferencia, efectivo, etc)' },
    { nombre: 'referencia_pago', tipo: 'TEXT', descripcion: 'Referencia del pago (número transferencia, etc)' },
    { nombre: 'observaciones_liquidacion', tipo: 'TEXT', descripcion: 'Observaciones específicas de la liquidación' },
    { nombre: 'firmado_vendedor', tipo: 'BOOLEAN DEFAULT false', descripcion: 'Si el vendedor firmó el recibo' },
    { nombre: 'firmado_admin', tipo: 'BOOLEAN DEFAULT false', descripcion: 'Si el admin firmó el recibo' },
    { nombre: 'fecha_entrega', tipo: 'DATE', descripcion: 'Fecha de entrega del pago' }
  ];

  for (const columna of nuevasColumnas) {
    if (!columnExists('liquidaciones_comision', columna.nombre)) {
      db.exec(`ALTER TABLE liquidaciones_comision ADD COLUMN ${columna.nombre} ${columna.tipo}`);
      console.log(`   ✅ Agregada: ${columna.nombre} - ${columna.descripcion}`);
    } else {
      console.log(`   ℹ️  Ya existe: ${columna.nombre}`);
    }
  }

  // Crear tabla de adelantos para llevar registro histórico
  console.log('\n🏦 Creando tabla de adelantos...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS adelantos_vendedores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendedor_id INTEGER NOT NULL,
      fecha_adelanto DATE NOT NULL,
      monto DECIMAL(10,2) NOT NULL,
      motivo TEXT,
      metodo_entrega TEXT DEFAULT 'efectivo',
      referencia TEXT,
      liquidacion_aplicada_id INTEGER,
      estado TEXT DEFAULT 'pendiente' CHECK(estado IN ('pendiente', 'aplicado', 'cancelado')),
      observaciones TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vendedor_id) REFERENCES usuarios(id),
      FOREIGN KEY (liquidacion_aplicada_id) REFERENCES liquidaciones_comision(id),
      FOREIGN KEY (created_by) REFERENCES usuarios(id)
    );
  `);

  // Crear tabla de dinero en mano (cobros del vendedor)
  console.log('💰 Creando tabla de dinero en mano...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS dinero_vendedor (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendedor_id INTEGER NOT NULL,
      fecha_cobro DATE NOT NULL,
      cliente_id INTEGER NOT NULL,
      monto DECIMAL(10,2) NOT NULL,
      movimiento_id INTEGER,
      concepto TEXT,
      liquidacion_aplicada_id INTEGER,
      estado TEXT DEFAULT 'en_mano' CHECK(estado IN ('en_mano', 'entregado', 'aplicado')),
      observaciones TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vendedor_id) REFERENCES usuarios(id),
      FOREIGN KEY (cliente_id) REFERENCES clientes(id),
      FOREIGN KEY (movimiento_id) REFERENCES movimientos(id),
      FOREIGN KEY (liquidacion_aplicada_id) REFERENCES liquidaciones_comision(id)
    );
  `);

  // Crear índices para optimizar consultas
  console.log('\n🔗 Creando índices...');
  try {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_adelantos_vendedor ON adelantos_vendedores(vendedor_id, estado);
      CREATE INDEX IF NOT EXISTS idx_adelantos_liquidacion ON adelantos_vendedores(liquidacion_aplicada_id);
      CREATE INDEX IF NOT EXISTS idx_dinero_vendedor ON dinero_vendedor(vendedor_id, estado);
      CREATE INDEX IF NOT EXISTS idx_dinero_liquidacion ON dinero_vendedor(liquidacion_aplicada_id);
    `);
    console.log('✅ Índices creados correctamente');
  } catch (error) {
    console.log('ℹ️  Algunos índices ya existían');
  }

  // Insertar algunos datos de ejemplo para Mariela (vendedor ID 2)
  console.log('\n🧪 Insertando datos de ejemplo...');
  
  // Ejemplo de adelanto pendiente
  const adelantoExiste = db.prepare('SELECT id FROM adelantos_vendedores WHERE vendedor_id = 2').get();
  if (!adelantoExiste) {
    db.prepare(`
      INSERT INTO adelantos_vendedores 
      (vendedor_id, fecha_adelanto, monto, motivo, metodo_entrega, estado, created_by, observaciones)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      2, // Mariela
      '2025-07-10', 
      15000, 
      'Adelanto de comisión solicitado',
      'efectivo',
      'pendiente',
      1, // Fernando
      'Adelanto entregado el 10/07 en efectivo'
    );
    console.log('   💰 Adelanto de ejemplo creado para Mariela: $15,000');
  }

  // Ejemplo de dinero en mano
  const dineroExiste = db.prepare('SELECT id FROM dinero_vendedor WHERE vendedor_id = 2').get();
  if (!dineroExiste) {
    db.prepare(`
      INSERT INTO dinero_vendedor 
      (vendedor_id, fecha_cobro, cliente_id, monto, concepto, estado, observaciones)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      2, // Mariela
      '2025-07-12',
      134, // SUAN LTDA (cliente de ejemplo)
      8500,
      'Cobro en efectivo de factura',
      'en_mano',
      'Cliente pagó en efectivo, Mariela tiene el dinero'
    );
    console.log('   🏦 Dinero en mano de ejemplo creado para Mariela: $8,500');
  }

  // Verificar las nuevas estructuras
  console.log('\n📊 Verificando nuevas estructuras...');
  
  const columnasLiquidacion = db.prepare('PRAGMA table_info(liquidaciones_comision)').all();
  console.log(`   Liquidaciones: ${columnasLiquidacion.length} columnas`);
  
  const adelantos = db.prepare('SELECT COUNT(*) as count FROM adelantos_vendedores').get();
  console.log(`   Adelantos registrados: ${adelantos.count}`);
  
  const dineroEnMano = db.prepare('SELECT COUNT(*) as count FROM dinero_vendedor').get();
  console.log(`   Registros dinero en mano: ${dineroEnMano.count}`);

  // Mostrar resumen para Mariela
  console.log('\n👤 Resumen para Mariela:');
  const adelantosPendientes = db.prepare(`
    SELECT SUM(monto) as total 
    FROM adelantos_vendedores 
    WHERE vendedor_id = 2 AND estado = 'pendiente'
  `).get();
  
  const dineroTotal = db.prepare(`
    SELECT SUM(monto) as total 
    FROM dinero_vendedor 
    WHERE vendedor_id = 2 AND estado = 'en_mano'
  `).get();

  console.log(`   📤 Adelantos pendientes: $${(adelantosPendientes.total || 0).toLocaleString()}`);
  console.log(`   💰 Dinero en mano: $${(dineroTotal.total || 0).toLocaleString()}`);
  
  console.log('\n✅ ¡Base de datos actualizada para liquidaciones avanzadas!');
  console.log('\n🎯 Nuevas funcionalidades disponibles:');
  console.log('   📋 Liquidaciones con adelantos y dinero en mano');
  console.log('   📄 Campos para generar recibos completos');
  console.log('   🧾 Registro histórico de adelantos');
  console.log('   💳 Diferentes métodos de pago');
  console.log('   ✍️  Control de firmas digitales');
  console.log('   📊 Cálculo automático de neto a pagar');

} catch (error) {
  console.error('❌ Error actualizando base de datos:', error);
  console.log('\n🔧 Información de diagnóstico:');
  console.log('   - Archivo DB:', dbPath);
  console.log('   - Error:', error.message);
} finally {
  db.close();
}

console.log('\n🚀 Próximo paso: Actualizar APIs y crear formulario de liquidación avanzado');