const XLSX = require('xlsx');
const Database = require('better-sqlite3');
const path = require('path');

// Inicializar base de datos
const dbPath = path.join(__dirname, 'database', 'feraben.db');
const db = new Database(dbPath);

// Función para limpiar y formatear fechas de Excel
function formatearFechaExcel(fechaExcel) {
  if (!fechaExcel) return null;
  
  // Si ya es string en formato correcto
  if (typeof fechaExcel === 'string') {
    return fechaExcel;
  }
  
  // Si es número de Excel (fecha serial)
  if (typeof fechaExcel === 'number') {
    const fecha = new Date((fechaExcel - 25569) * 86400 * 1000);
    return fecha.toISOString().split('T')[0];
  }
  
  return null;
}

// Función para limpiar texto
function limpiarTexto(texto) {
  if (!texto) return null;
  return String(texto).trim().replace(/\s+/g, ' ');
}

// Función para obtener ID de vendedor por nombre
function obtenerVendedorId(nombreVendedor) {
  const vendedoresMap = {
    'Fernando': 1,
    'Mariela': 2
  };
  
  return vendedoresMap[nombreVendedor] || 1; // Por defecto Fernando
}

// Función principal de importación
async function importarDatosReales() {
  console.log('🚀 INICIANDO IMPORTACIÓN MASIVA DE DATOS REALES...\n');
  
  try {
    // 1. LIMPIAR DATOS EXISTENTES
    console.log('🧹 Limpiando datos existentes...');
    db.exec(`
      DELETE FROM liquidaciones_comision;
      DELETE FROM movimientos;
      DELETE FROM clientes;
      DELETE FROM vendedores_config;
      DELETE FROM usuarios;
    `);
    console.log('✅ Datos limpiados\n');

    // 2. RECREAR VENDEDORES
    console.log('👥 Recreando vendedores...');
    
    const insertUsuario = db.prepare(`
      INSERT INTO usuarios (id, email, password, nombre, rol, activo)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    insertUsuario.run(1, 'fernando@feraben.com', 'admin123', 'Fernando', 'admin', 1);
    insertUsuario.run(2, 'mariela@feraben.com', 'vendedor123', 'Mariela', 'vendedor', 1);
    
    const insertConfig = db.prepare(`
      INSERT INTO vendedores_config (usuario_id, porcentaje_comision, base_calculo)
      VALUES (?, ?, ?)
    `);
    
    insertConfig.run(1, 0, 'pago');
    insertConfig.run(2, 15, 'pago');
    
    console.log('✅ Vendedores creados\n');

    // 3. IMPORTAR CLIENTES REALES
    console.log('🏢 Importando clientes reales...');
    
    const clientesPath = path.join(__dirname, 'excel-data', 'HOJA Base de Datos Clientes.xlsx');
    const clientesWorkbook = XLSX.readFile(clientesPath);
    const clientesSheet = clientesWorkbook.Sheets[clientesWorkbook.SheetNames[0]];
    const clientesData = XLSX.utils.sheet_to_json(clientesSheet);
    
    console.log(`📊 Encontrados ${clientesData.length} clientes en Excel`);
    
    const insertCliente = db.prepare(`
      INSERT INTO clientes 
      (rut, razon_social, nombre_fantasia, email, direccion, ciudad, departamento, vendedor_id, activo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    let clientesImportados = 0;
    const clienteMap = new Map(); // Para mapear nombres a IDs
    
    clientesData.forEach((cliente, index) => {
      try {
        const rut = limpiarTexto(cliente['RUT'] || cliente['Rut']);
        const razonSocial = limpiarTexto(cliente['Razón Social'] || cliente['Razon Social']);
        const nombreFantasia = limpiarTexto(cliente['Nombre Fantasia'] || cliente['Nombre de Fantasía']);
        const email = limpiarTexto(cliente['Email']);
        const direccion = limpiarTexto(cliente['Dirección'] || cliente['Direccion']);
        const ciudad = limpiarTexto(cliente['Ciudad']);
        const departamento = limpiarTexto(cliente['Departamento']);
        const vendedorNombre = limpiarTexto(cliente['Vendedor Asignado'] || cliente['Vendedor']);
        
        if (!rut || !razonSocial) {
          console.log(`⚠️  Cliente ${index + 1}: Faltan datos obligatorios (RUT o Razón Social)`);
          return;
        }
        
        const vendedorId = obtenerVendedorId(vendedorNombre);
        const clienteId = index + 1;
        
        const result = insertCliente.run(
          rut,
          razonSocial,
          nombreFantasia,
          email,
          direccion,
          ciudad,
          departamento,
          vendedorId,
          1
        );
        
        // Mapear razón social a ID para movimientos
        clienteMap.set(razonSocial.toUpperCase(), result.lastInsertRowid);
        
        clientesImportados++;
        
        if (clientesImportados % 10 === 0) {
          console.log(`   📈 Importados ${clientesImportados} clientes...`);
        }
        
      } catch (error) {
        console.error(`❌ Error importando cliente ${index + 1}:`, error.message);
      }
    });
    
    console.log(`✅ ${clientesImportados} clientes importados exitosamente\n`);

    // 4. IMPORTAR MOVIMIENTOS REALES
    console.log('💰 Importando movimientos reales...');
    
    const movimientosPath = path.join(__dirname, 'excel-data', 'HOJA MOVIMIENTOS.xlsx');
    const movimientosWorkbook = XLSX.readFile(movimientosPath);
    const movimientosSheet = movimientosWorkbook.Sheets[movimientosWorkbook.SheetNames[0]];
    const movimientosData = XLSX.utils.sheet_to_json(movimientosSheet);
    
    console.log(`📊 Encontrados ${movimientosData.length} movimientos en Excel`);
    
    const insertMovimiento = db.prepare(`
      INSERT INTO movimientos 
      (fecha, cliente_id, vendedor_id, tipo_movimiento, documento, importe, comentario)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    let movimientosImportados = 0;
    let movimientosErrores = 0;
    
    movimientosData.forEach((mov, index) => {
      try {
        const fecha = formatearFechaExcel(mov['Fecha']);
        const clienteNombre = limpiarTexto(mov['Cliente']);
        const vendedorNombre = limpiarTexto(mov['Vendedor']);
        const tipoMovimiento = limpiarTexto(mov['Tipo de Movimiento'] || mov['Tipo']);
        const documento = limpiarTexto(mov['Documento']);
        const importe = parseFloat(mov['Importe']) || 0;
        const comentario = limpiarTexto(mov['Comentario']);
        
        if (!fecha || !clienteNombre || !tipoMovimiento) {
          movimientosErrores++;
          return;
        }
        
        // Buscar cliente por nombre
        const clienteId = clienteMap.get(clienteNombre.toUpperCase());
        if (!clienteId) {
          console.log(`⚠️  Movimiento ${index + 1}: Cliente "${clienteNombre}" no encontrado`);
          movimientosErrores++;
          return;
        }
        
        const vendedorId = obtenerVendedorId(vendedorNombre);
        
        // Ajustar importe según tipo (mantener lógica original)
        let importeFinal = importe;
        if (tipoMovimiento === 'Pago' || tipoMovimiento === 'Devolución') {
          importeFinal = Math.abs(importe) * -1; // Negativos
        } else {
          importeFinal = Math.abs(importe); // Positivos
        }
        
        insertMovimiento.run(
          fecha,
          clienteId,
          vendedorId,
          tipoMovimiento,
          documento,
          importeFinal,
          comentario
        );
        
        movimientosImportados++;
        
        if (movimientosImportados % 100 === 0) {
          console.log(`   📈 Importados ${movimientosImportados} movimientos...`);
        }
        
      } catch (error) {
        console.error(`❌ Error importando movimiento ${index + 1}:`, error.message);
        movimientosErrores++;
      }
    });
    
    console.log(`✅ ${movimientosImportados} movimientos importados exitosamente`);
    console.log(`⚠️  ${movimientosErrores} movimientos con errores\n`);

    // 5. GENERAR ESTADÍSTICAS FINALES
    console.log('📊 GENERANDO ESTADÍSTICAS FINALES...\n');
    
    const stats = {
      usuarios: db.prepare('SELECT COUNT(*) as count FROM usuarios').get(),
      clientes: db.prepare('SELECT COUNT(*) as count FROM clientes').get(),
      movimientos: db.prepare('SELECT COUNT(*) as count FROM movimientos').get(),
      ventas: db.prepare("SELECT COUNT(*) as count FROM movimientos WHERE tipo_movimiento = 'Venta'").get(),
      pagos: db.prepare("SELECT COUNT(*) as count FROM movimientos WHERE tipo_movimiento = 'Pago'").get(),
      devoluciones: db.prepare("SELECT COUNT(*) as count FROM movimientos WHERE tipo_movimiento = 'Devolución'").get(),
    };
    
    // Calcular saldos por vendedor
    const saldosPorVendedor = db.prepare(`
      SELECT 
        u.nombre as vendedor,
        COUNT(DISTINCT c.id) as clientes,
        COALESCE(SUM(m.importe), 0) as total_saldo
      FROM usuarios u
      LEFT JOIN clientes c ON u.id = c.vendedor_id
      LEFT JOIN movimientos m ON c.id = m.cliente_id
      WHERE u.rol = 'vendedor' OR u.rol = 'admin'
      GROUP BY u.id, u.nombre
    `).all();
    
    console.log('🎉 ¡IMPORTACIÓN COMPLETADA EXITOSAMENTE!\n');
    console.log('📈 RESUMEN FINAL:');
    console.log(`👥 Usuarios: ${stats.usuarios.count}`);
    console.log(`🏢 Clientes: ${stats.clientes.count}`);
    console.log(`💰 Movimientos totales: ${stats.movimientos.count}`);
    console.log(`  └─ Ventas: ${stats.ventas.count}`);
    console.log(`  └─ Pagos: ${stats.pagos.count}`);
    console.log(`  └─ Devoluciones: ${stats.devoluciones.count}`);
    
    console.log('\n💼 CARTERA POR VENDEDOR:');
    saldosPorVendedor.forEach(vendedor => {
      const saldoFormateado = new Intl.NumberFormat('es-UY', {
        style: 'currency',
        currency: 'UYU',
        minimumFractionDigits: 0
      }).format(vendedor.total_saldo);
      
      console.log(`  ${vendedor.vendedor}: ${vendedor.clientes} clientes - Saldo total: ${saldoFormateado}`);
    });
    
    console.log('\n🚀 ¡TU CRM ESTÁ LISTO CON TODOS LOS DATOS REALES!');
    console.log('   Reinicia la aplicación React para ver todos los cambios.');
    
  } catch (error) {
    console.error('❌ ERROR CRÍTICO EN IMPORTACIÓN:', error);
  } finally {
    db.close();
  }
}

// Ejecutar importación
console.log('🎯 FERABEN CRM - IMPORTACIÓN MASIVA DE DATOS\n');
console.log('Este proceso importará TODOS tus datos reales desde Excel:\n');
console.log('📂 Archivos a procesar:');
console.log('  - HOJA Base de Datos Clientes.xlsx');
console.log('  - HOJA MOVIMIENTOS.xlsx');
console.log('  - Hoja Vendedores.xlsx\n');
console.log('⏱️  Iniciando en 3 segundos...\n');

setTimeout(() => {
  importarDatosReales();
}, 3000);