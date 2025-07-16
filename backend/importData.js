const XLSX = require('xlsx');
const Database = require('better-sqlite3');
const path = require('path');

// Inicializar base de datos
const dbPath = path.join(__dirname, 'database', 'feraben.db');
const db = new Database(dbPath);

// Función para importar todos los datos
async function importarDatos() {
  console.log('🚀 Iniciando importación de datos...');
  
  try {
    // 1. Crear usuarios/vendedores
    console.log('👥 Importando vendedores...');
    
    // Insertar Fernando (admin)
    const insertFernando = db.prepare(`
      INSERT OR REPLACE INTO usuarios (id, email, password, nombre, rol)
      VALUES (1, 'fernando@feraben.com', 'admin123', 'Fernando', 'admin')
    `);
    insertFernando.run();
    
    // Insertar Mariela (vendedora)
    const insertMariela = db.prepare(`
      INSERT OR REPLACE INTO usuarios (id, email, password, nombre, rol)
      VALUES (2, 'mariela@feraben.com', 'vendedor123', 'Mariela', 'vendedor')
    `);
    insertMariela.run();
    
    // Configurar comisiones
    const insertComisionFernando = db.prepare(`
      INSERT OR REPLACE INTO vendedores_config (usuario_id, porcentaje_comision)
      VALUES (1, 0)
    `);
    insertComisionFernando.run();
    
    const insertComisionMariela = db.prepare(`
      INSERT OR REPLACE INTO vendedores_config (usuario_id, porcentaje_comision)
      VALUES (2, 15)
    `);
    insertComisionMariela.run();
    
    console.log('✅ Vendedores importados');
    
    // 2. Importar clientes (necesitas colocar el archivo Excel en la carpeta backend)
    console.log('🏢 Importando clientes...');
    
    // Ejemplo de estructura de datos que ya analizamos
    const clientesEjemplo = [
      {
        rut: "010040660017",
        razon_social: "SITYA BRAZEIRO NELSON LUIS",
        vendedor_id: 1,
        ciudad: "ARTIGAS",
        departamento: "ARTIGAS",
        direccion: "LECUEDER, CNEL. CARLOS 357, 0"
      },
      {
        rut: "020288380015",
        razon_social: "ALAMI S.R.L.",
        nombre_fantasia: "Supermercado El Paseo",
        vendedor_id: 1,
        ciudad: "CANELONES",
        departamento: "CANELONES",
        direccion: "RODO, JOSE ENRIQUE 470, 0"
      }
    ];
    
    const insertCliente = db.prepare(`
      INSERT OR REPLACE INTO clientes 
      (rut, razon_social, nombre_fantasia, vendedor_id, ciudad, departamento, direccion, email)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    clientesEjemplo.forEach(cliente => {
      insertCliente.run(
        cliente.rut,
        cliente.razon_social,
        cliente.nombre_fantasia || null,
        cliente.vendedor_id,
        cliente.ciudad,
        cliente.departamento,
        cliente.direccion,
        cliente.email || null
      );
    });
    
    console.log('✅ Clientes de ejemplo importados');
    
    // 3. Importar movimientos de ejemplo
    console.log('💰 Importando movimientos...');
    
    const movimientosEjemplo = [
      {
        fecha: '2024-04-10',
        cliente_id: 1,
        vendedor_id: 1,
        tipo_movimiento: 'Venta',
        documento: 'A-1001',
        importe: 25000
      },
      {
        fecha: '2024-04-15',
        cliente_id: 1,
        vendedor_id: 1,
        tipo_movimiento: 'Pago',
        documento: 'TRANSF',
        importe: -10000
      },
      {
        fecha: '2024-04-20',
        cliente_id: 2,
        vendedor_id: 2,
        tipo_movimiento: 'Venta',
        documento: 'A-1002',
        importe: 44565
      }
    ];
    
    const insertMovimiento = db.prepare(`
      INSERT INTO movimientos 
      (fecha, cliente_id, vendedor_id, tipo_movimiento, documento, importe)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    movimientosEjemplo.forEach(mov => {
      insertMovimiento.run(
        mov.fecha,
        mov.cliente_id,
        mov.vendedor_id,
        mov.tipo_movimiento,
        mov.documento,
        mov.importe
      );
    });
    
    console.log('✅ Movimientos de ejemplo importados');
    
    // Mostrar resumen
    const totalClientes = db.prepare('SELECT COUNT(*) as count FROM clientes').get();
    const totalMovimientos = db.prepare('SELECT COUNT(*) as count FROM movimientos').get();
    const totalUsuarios = db.prepare('SELECT COUNT(*) as count FROM usuarios').get();
    
    console.log('\n📊 RESUMEN DE IMPORTACIÓN:');
    console.log(`👥 Usuarios: ${totalUsuarios.count}`);
    console.log(`🏢 Clientes: ${totalClientes.count}`);
    console.log(`💰 Movimientos: ${totalMovimientos.count}`);
    console.log('\n🎉 ¡Importación completada exitosamente!');
    
  } catch (error) {
    console.error('❌ Error en importación:', error);
  } finally {
    db.close();
  }
}

// Ejecutar importación
importarDatos();