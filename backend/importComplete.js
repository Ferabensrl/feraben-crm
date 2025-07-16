const XLSX = require('xlsx');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Inicializar base de datos
const dbPath = path.join(__dirname, 'database', 'feraben.db');
const db = new Database(dbPath);

// Arrays para reportes detallados
let clientesNoImportados = [];
let movimientosNoImportados = [];
let clientesImportadosConAdvertencias = [];

// Función para generar ID único cuando no hay RUT
function generarIdUnico(razonSocial, index) {
  if (!razonSocial) return `CLIENTE_${index}`;
  return razonSocial.substring(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, '') + `_${index}`;
}

// Función para limpiar y formatear fechas de Excel
function formatearFechaExcel(fechaExcel) {
  if (!fechaExcel) return null;
  
  if (typeof fechaExcel === 'string') {
    // Intentar parsear diferentes formatos
    const fecha = new Date(fechaExcel);
    return !isNaN(fecha.getTime()) ? fecha.toISOString().split('T')[0] : null;
  }
  
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
  
  return vendedoresMap[nombreVendedor] || 1;
}

// Función para importar clientes con máxima flexibilidad
function importarClientesCompletos() {
  console.log('🏢 IMPORTANDO TODOS LOS CLIENTES (incluso con datos incompletos)...');
  
  const clientesPath = path.join(__dirname, 'excel-data', 'HOJA Base de Datos Clientes.xlsx');
  const clientesWorkbook = XLSX.readFile(clientesPath);
  const clientesSheet = clientesWorkbook.Sheets[clientesWorkbook.SheetNames[0]];
  const clientesData = XLSX.utils.sheet_to_json(clientesSheet);
  
  console.log(`📊 Procesando ${clientesData.length} registros...`);
  
  const insertCliente = db.prepare(`
    INSERT INTO clientes 
    (rut, razon_social, nombre_fantasia, email, direccion, ciudad, departamento, vendedor_id, activo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  let clientesImportados = 0;
  const clienteMap = new Map();
  
  clientesData.forEach((cliente, index) => {
    try {
      let rut = limpiarTexto(cliente['RUT'] || cliente['Rut']);
      const razonSocial = limpiarTexto(cliente['Razón Social'] || cliente['Razon Social']);
      const nombreFantasia = limpiarTexto(cliente['Nombre Fantasia'] || cliente['Nombre de Fantasía']);
      const email = limpiarTexto(cliente['Email']);
      const direccion = limpiarTexto(cliente['Dirección'] || cliente['Direccion']);
      const ciudad = limpiarTexto(cliente['Ciudad']);
      const departamento = limpiarTexto(cliente['Departamento']);
      const vendedorNombre = limpiarTexto(cliente['Vendedor Asignado'] || cliente['Vendedor']);
      
      // Si no tiene razón social, intentar con nombre fantasía
      const nombreEfectivo = razonSocial || nombreFantasia;
      
      if (!nombreEfectivo) {
        clientesNoImportados.push({
          fila: index + 2, // +2 porque Excel empieza en 1 y hay header
          motivo: 'Sin razón social ni nombre fantasía',
          datos: cliente
        });
        return;
      }
      
      // Si no tiene RUT, generar uno único
      if (!rut) {
        rut = generarIdUnico(nombreEfectivo, index + 1);
        clientesImportadosConAdvertencias.push({
          fila: index + 2,
          cliente: nombreEfectivo,
          advertencia: `RUT generado automáticamente: ${rut}`,
          datos: cliente
        });
      }
      
      const vendedorId = obtenerVendedorId(vendedorNombre);
      
      const result = insertCliente.run(
        rut,
        nombreEfectivo,
        nombreFantasia,
        email,
        direccion,
        ciudad,
        departamento,
        vendedorId,
        1
      );
      
      // Mapear para movimientos (probar múltiples variantes)
      const variantes = [
        nombreEfectivo.toUpperCase(),
        nombreFantasia?.toUpperCase(),
        razonSocial?.toUpperCase()
      ].filter(Boolean);
      
      variantes.forEach(variante => {
        clienteMap.set(variante, result.lastInsertRowid);
      });
      
      clientesImportados++;
      
      if (clientesImportados % 10 === 0) {
        console.log(`   📈 Importados ${clientesImportados} clientes...`);
      }
      
    } catch (error) {
      clientesNoImportados.push({
        fila: index + 2,
        motivo: `Error: ${error.message}`,
        datos: cliente
      });
    }
  });
  
  console.log(`✅ ${clientesImportados} clientes importados`);
  console.log(`⚠️  ${clientesNoImportados.length} clientes no importados`);
  console.log(`🔧 ${clientesImportadosConAdvertencias.length} clientes con advertencias\n`);
  
  return clienteMap;
}

// Función para importar movimientos con búsqueda inteligente
function importarMovimientosCompletos(clienteMap) {
  console.log('💰 IMPORTANDO TODOS LOS MOVIMIENTOS...');
  
  const movimientosPath = path.join(__dirname, 'excel-data', 'HOJA MOVIMIENTOS.xlsx');
  const movimientosWorkbook = XLSX.readFile(movimientosPath);
  const movimientosSheet = movimientosWorkbook.Sheets[movimientosWorkbook.SheetNames[0]];
  const movimientosData = XLSX.utils.sheet_to_json(movimientosSheet);
  
  console.log(`📊 Procesando ${movimientosData.length} movimientos...`);
  
  const insertMovimiento = db.prepare(`
    INSERT INTO movimientos 
    (fecha, cliente_id, vendedor_id, tipo_movimiento, documento, importe, comentario)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  let movimientosImportados = 0;
  
  movimientosData.forEach((mov, index) => {
    try {
      const fecha = formatearFechaExcel(mov['Fecha']);
      const clienteNombre = limpiarTexto(mov['Cliente']);
      const vendedorNombre = limpiarTexto(mov['Vendedor']);
      const tipoMovimiento = limpiarTexto(mov['Tipo de Movimiento'] || mov['Tipo']);
      const documento = limpiarTexto(mov['Documento']);
      const importe = parseFloat(mov['Importe']) || 0;
      const comentario = limpiarTexto(mov['Comentario']);
      
      if (!clienteNombre || !tipoMovimiento) {
        movimientosNoImportados.push({
          fila: index + 2,
          motivo: 'Faltan datos obligatorios (Cliente o Tipo)',
          datos: mov
        });
        return;
      }
      
      // Búsqueda inteligente de cliente
      let clienteId = clienteMap.get(clienteNombre.toUpperCase());
      
      // Si no encuentra, buscar por coincidencia parcial
      if (!clienteId) {
        for (let [nombre, id] of clienteMap.entries()) {
          if (nombre.includes(clienteNombre.toUpperCase()) || 
              clienteNombre.toUpperCase().includes(nombre)) {
            clienteId = id;
            break;
          }
        }
      }
      
      if (!clienteId) {
        movimientosNoImportados.push({
          fila: index + 2,
          motivo: `Cliente "${clienteNombre}" no encontrado`,
          datos: mov
        });
        return;
      }
      
      if (!fecha) {
        movimientosNoImportados.push({
          fila: index + 2,
          motivo: 'Fecha inválida',
          datos: mov
        });
        return;
      }
      
      const vendedorId = obtenerVendedorId(vendedorNombre);
      
      // Ajustar importe según tipo
      let importeFinal = importe;
      if (tipoMovimiento === 'Pago' || tipoMovimiento === 'Devolución') {
        importeFinal = Math.abs(importe) * -1;
      } else {
        importeFinal = Math.abs(importe);
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
      movimientosNoImportados.push({
        fila: index + 2,
        motivo: `Error: ${error.message}`,
        datos: mov
      });
    }
  });
  
  console.log(`✅ ${movimientosImportados} movimientos importados`);
  console.log(`⚠️  ${movimientosNoImportados.length} movimientos no importados\n`);
}

// Función para generar reportes detallados
function generarReportes() {
  console.log('📄 GENERANDO REPORTES DETALLADOS...\n');
  
  const reportesDir = path.join(__dirname, 'reportes-importacion');
  if (!fs.existsSync(reportesDir)) {
    fs.mkdirSync(reportesDir);
  }
  
  // Reporte de clientes no importados
  if (clientesNoImportados.length > 0) {
    const reporteClientes = clientesNoImportados.map(item => 
      `Fila ${item.fila}: ${item.motivo}\nDatos: ${JSON.stringify(item.datos, null, 2)}\n---`
    ).join('\n');
    
    fs.writeFileSync(
      path.join(reportesDir, 'clientes-no-importados.txt'),
      `CLIENTES NO IMPORTADOS (${clientesNoImportados.length})\n\n${reporteClientes}`
    );
  }
  
  // Reporte de clientes con advertencias
  if (clientesImportadosConAdvertencias.length > 0) {
    const reporteAdvertencias = clientesImportadosConAdvertencias.map(item =>
      `Fila ${item.fila}: ${item.cliente}\nAdvertencia: ${item.advertencia}\n---`
    ).join('\n');
    
    fs.writeFileSync(
      path.join(reportesDir, 'clientes-con-advertencias.txt'),
      `CLIENTES CON ADVERTENCIAS (${clientesImportadosConAdvertencias.length})\n\n${reporteAdvertencias}`
    );
  }
  
  // Reporte de movimientos no importados
  if (movimientosNoImportados.length > 0) {
    const reporteMovimientos = movimientosNoImportados.map(item =>
      `Fila ${item.fila}: ${item.motivo}\nDatos: ${JSON.stringify(item.datos, null, 2)}\n---`
    ).join('\n');
    
    fs.writeFileSync(
      path.join(reportesDir, 'movimientos-no-importados.txt'),
      `MOVIMIENTOS NO IMPORTADOS (${movimientosNoImportados.length})\n\n${reporteMovimientos}`
    );
  }
  
  console.log(`📁 Reportes guardados en: ${reportesDir}`);
  console.log(`   - clientes-no-importados.txt (${clientesNoImportados.length})`);
  console.log(`   - clientes-con-advertencias.txt (${clientesImportadosConAdvertencias.length})`);
  console.log(`   - movimientos-no-importados.txt (${movimientosNoImportados.length})\n`);
}

// Función principal
async function importacionCompleta() {
  console.log('🚀 IMPORTACIÓN COMPLETA Y DETALLADA\n');
  
  try {
    // Limpiar datos existentes
    console.log('🧹 Limpiando datos existentes...');
    db.exec(`
      DELETE FROM liquidaciones_comision;
      DELETE FROM movimientos;
      DELETE FROM clientes;
      DELETE FROM vendedores_config;
      DELETE FROM usuarios;
    `);
    
    // Recrear vendedores
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
    
    // Importar clientes
    const clienteMap = importarClientesCompletos();
    
    // Importar movimientos
    importarMovimientosCompletos(clienteMap);
    
    // Generar reportes
    generarReportes();
    
    // Estadísticas finales
    const stats = {
      usuarios: db.prepare('SELECT COUNT(*) as count FROM usuarios').get(),
      clientes: db.prepare('SELECT COUNT(*) as count FROM clientes').get(),
      movimientos: db.prepare('SELECT COUNT(*) as count FROM movimientos').get(),
      ventas: db.prepare("SELECT COUNT(*) as count FROM movimientos WHERE tipo_movimiento = 'Venta'").get(),
      pagos: db.prepare("SELECT COUNT(*) as count FROM movimientos WHERE tipo_movimiento = 'Pago'").get(),
      devoluciones: db.prepare("SELECT COUNT(*) as count FROM movimientos WHERE tipo_movimiento = 'Devolución'").get(),
    };
    
    const saldoTotal = db.prepare(`
      SELECT COALESCE(SUM(importe), 0) as total
      FROM movimientos
    `).get();
    
    console.log('🎉 ¡IMPORTACIÓN COMPLETA FINALIZADA!\n');
    console.log('📊 ESTADÍSTICAS FINALES:');
    console.log(`👥 Usuarios: ${stats.usuarios.count}`);
    console.log(`🏢 Clientes: ${stats.clientes.count}`);
    console.log(`💰 Movimientos: ${stats.movimientos.count}`);
    console.log(`💵 Saldo total: ${new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU' }).format(saldoTotal.total)}`);
    
    console.log('\n📋 RESUMEN DE PROBLEMAS:');
    console.log(`❌ Clientes no importados: ${clientesNoImportados.length}`);
    console.log(`⚠️  Clientes con advertencias: ${clientesImportadosConAdvertencias.length}`);
    console.log(`❌ Movimientos no importados: ${movimientosNoImportados.length}`);
    
    console.log('\n🔍 REVISA LOS REPORTES para corregir los datos faltantes.');
    console.log('🚀 Reinicia React para ver todos los cambios.');
    
  } catch (error) {
    console.error('❌ ERROR CRÍTICO:', error);
  } finally {
    db.close();
  }
}

// Ejecutar
importacionCompleta();