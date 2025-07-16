const XLSX = require('xlsx');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

function crearRespaldo() {
  console.log('💾 CREANDO RESPALDO COMPLETO DEL CRM...\n');
  
  const db = new Database(path.join(__dirname, 'database', 'feraben.db'));
  
  try {
    // Crear carpeta de respaldos
    const backupDir = path.join(__dirname, 'respaldos');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }
    
    const fecha = new Date().toISOString().split('T')[0];
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // 1. EXPORTAR CLIENTES
    console.log('🏢 Exportando clientes...');
    const clientes = db.prepare(`
      SELECT 
        c.rut,
        c.razon_social,
        c.nombre_fantasia,
        c.email,
        c.direccion,
        c.ciudad,
        c.departamento,
        u.nombre as vendedor_asignado,
        COALESCE(SUM(m.importe), 0) as saldo_actual,
        c.created_at as fecha_creacion
      FROM clientes c
      LEFT JOIN usuarios u ON c.vendedor_id = u.id
      LEFT JOIN movimientos m ON c.id = m.cliente_id
      WHERE c.activo = 1
      GROUP BY c.id
      ORDER BY c.razon_social
    `).all();
    
    // 2. EXPORTAR MOVIMIENTOS
    console.log('💰 Exportando movimientos...');
    const movimientos = db.prepare(`
      SELECT 
        m.fecha,
        c.razon_social as cliente,
        u.nombre as vendedor,
        m.tipo_movimiento,
        m.documento,
        m.importe,
        m.comentario,
        m.created_at as fecha_registro
      FROM movimientos m
      JOIN clientes c ON m.cliente_id = c.id
      JOIN usuarios u ON m.vendedor_id = u.id
      ORDER BY m.fecha DESC, m.id DESC
    `).all();
    
    // 3. EXPORTAR RESUMEN POR VENDEDOR
    console.log('👥 Exportando resumen por vendedor...');
    const resumenVendedores = db.prepare(`
      SELECT 
        u.nombre as vendedor,
        COUNT(DISTINCT c.id) as total_clientes,
        COUNT(DISTINCT CASE WHEN saldos.saldo > 0 THEN c.id END) as clientes_con_deuda,
        COALESCE(SUM(CASE WHEN saldos.saldo > 0 THEN saldos.saldo ELSE 0 END), 0) as total_deuda,
        COALESCE(SUM(CASE WHEN m.tipo_movimiento = 'Venta' THEN m.importe ELSE 0 END), 0) as total_ventas,
        COALESCE(SUM(CASE WHEN m.tipo_movimiento = 'Pago' THEN ABS(m.importe) ELSE 0 END), 0) as total_cobros
      FROM usuarios u
      LEFT JOIN clientes c ON u.id = c.vendedor_id AND c.activo = 1
      LEFT JOIN movimientos m ON c.id = m.cliente_id
      LEFT JOIN (
        SELECT cliente_id, SUM(importe) as saldo
        FROM movimientos
        GROUP BY cliente_id
      ) saldos ON c.id = saldos.cliente_id
      WHERE u.rol IN ('admin', 'vendedor')
      GROUP BY u.id, u.nombre
      ORDER BY u.nombre
    `).all();
    
    // 4. CREAR ARCHIVO EXCEL
    console.log('📊 Creando archivo Excel...');
    
    const workbook = XLSX.utils.book_new();
    
    // Hoja de clientes
    const wsClientes = XLSX.utils.json_to_sheet(clientes);
    XLSX.utils.book_append_sheet(workbook, wsClientes, 'Clientes');
    
    // Hoja de movimientos
    const wsMovimientos = XLSX.utils.json_to_sheet(movimientos);
    XLSX.utils.book_append_sheet(workbook, wsMovimientos, 'Movimientos');
    
    // Hoja de resumen
    const wsResumen = XLSX.utils.json_to_sheet(resumenVendedores);
    XLSX.utils.book_append_sheet(workbook, wsResumen, 'Resumen Vendedores');
    
    // Hoja de estadísticas generales
    const estadisticas = [
      { concepto: 'Total Clientes', valor: clientes.length },
      { concepto: 'Total Movimientos', valor: movimientos.length },
      { concepto: 'Saldo Total Sistema', valor: movimientos.reduce((sum, m) => sum + m.importe, 0) },
      { concepto: 'Fecha Respaldo', valor: new Date().toLocaleString('es-UY') },
      { concepto: 'Versión CRM', valor: '1.0' }
    ];
    
    const wsEstadisticas = XLSX.utils.json_to_sheet(estadisticas);
    XLSX.utils.book_append_sheet(workbook, wsEstadisticas, 'Estadísticas');
    
    // Guardar archivo
    const nombreArchivo = `Feraben_CRM_Respaldo_${fecha}_${timestamp}.xlsx`;
    const rutaCompleta = path.join(backupDir, nombreArchivo);
    
    XLSX.writeFile(workbook, rutaCompleta);
    
    // 5. COPIAR BASE DE DATOS SQLite
    console.log('🗄️  Copiando base de datos...');
    const dbOriginal = path.join(__dirname, 'database', 'feraben.db');
    const dbRespaldo = path.join(backupDir, `feraben_backup_${fecha}_${timestamp}.db`);
    fs.copyFileSync(dbOriginal, dbRespaldo);
    
    // 6. CREAR ARCHIVO DE INFORMACIÓN
    const infoRespaldo = `
RESPALDO FERABEN CRM
===================

Fecha de creación: ${new Date().toLocaleString('es-UY')}
Versión del sistema: 1.0

CONTENIDO DEL RESPALDO:
- ${nombreArchivo}: Archivo Excel con todos los datos
- feraben_backup_${fecha}_${timestamp}.db: Base de datos SQLite completa

ESTADÍSTICAS:
- Clientes: ${clientes.length}
- Movimientos: ${movimientos.length}
- Vendedores activos: ${resumenVendedores.length}

INSTRUCCIONES DE RESTAURACIÓN:
1. Para importar Excel: Usar función de importación del CRM
2. Para restaurar DB: Reemplazar feraben.db con el archivo de respaldo

¡Datos seguros y respaldados!
`;
    
    fs.writeFileSync(path.join(backupDir, `INFO_${fecha}_${timestamp}.txt`), infoRespaldo);
    
    console.log('\n✅ ¡RESPALDO COMPLETADO EXITOSAMENTE!\n');
    console.log(`📁 Ubicación: ${backupDir}`);
    console.log(`📊 Excel: ${nombreArchivo}`);
    console.log(`🗄️  Base datos: feraben_backup_${fecha}_${timestamp}.db`);
    console.log(`📋 Info: INFO_${fecha}_${timestamp}.txt`);
    
    console.log('\n📊 ESTADÍSTICAS DEL RESPALDO:');
    console.log(`🏢 Clientes respaldados: ${clientes.length}`);
    console.log(`💰 Movimientos respaldados: ${movimientos.length}`);
    console.log(`👥 Vendedores: ${resumenVendedores.length}`);
    
    const saldoTotal = movimientos.reduce((sum, m) => sum + m.importe, 0);
    console.log(`💵 Saldo total: ${new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU' }).format(saldoTotal)}`);
    
  } catch (error) {
    console.error('❌ Error creando respaldo:', error);
  } finally {
    db.close();
  }
}

// Ejecutar respaldo
crearRespaldo();