const Database = require('better-sqlite3');
const path = require('path');

class ComisionesService {
  constructor() {
    const dbPath = path.join(__dirname, 'database', 'feraben.db');
    this.db = new Database(dbPath);
  }

  // ===== MÉTODOS EXISTENTES =====

  // Obtener configuración de un vendedor
  getConfigVendedor(vendedorId) {
    return this.db.prepare(`
      SELECT vc.*, u.nombre, u.rol 
      FROM vendedores_config vc 
      JOIN usuarios u ON vc.usuario_id = u.id 
      WHERE vc.usuario_id = ? AND vc.activo = 1
    `).get(vendedorId);
  }

  // Obtener todas las configuraciones
  getAllConfigs() {
    return this.db.prepare(`
      SELECT vc.*, u.nombre, u.rol 
      FROM vendedores_config vc 
      JOIN usuarios u ON vc.usuario_id = u.id 
      WHERE vc.activo = 1
      ORDER BY u.nombre
    `).all();
  }

  // Actualizar configuración de vendedor
  updateConfigVendedor(vendedorId, config) {
    const stmt = this.db.prepare(`
      UPDATE vendedores_config 
      SET porcentaje_comision = ?, 
          base_calculo = ?, 
          minimo_comision = ?,
          comentarios = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE usuario_id = ?
    `);
    
    return stmt.run(
      config.porcentaje_comision,
      config.base_calculo,
      config.minimo_comision || 0,
      config.comentarios || '',
      vendedorId
    );
  }

  // Obtener movimientos para cálculo de comisión
  getMovimientosParaComision(vendedorId, fechaDesde, fechaHasta, baseCalculo) {
    let whereConditions = ['m.vendedor_id = ?', 'm.fecha BETWEEN ? AND ?'];
    let params = [vendedorId, fechaDesde, fechaHasta];

    // Filtrar por tipo según base de cálculo
    if (baseCalculo === 'venta') {
      whereConditions.push("m.tipo_movimiento = 'Venta'");
    } else if (baseCalculo === 'pago') {
      whereConditions.push("m.tipo_movimiento = 'Pago'");
    } else if (baseCalculo === 'cobro') {
      whereConditions.push("m.tipo_movimiento IN ('Pago', 'Nota de Crédito')");
    }

    const query = `
      SELECT m.*, c.razon_social as cliente_nombre
      FROM movimientos m
      JOIN clientes c ON m.cliente_id = c.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY m.fecha, m.id
    `;

    return this.db.prepare(query).all(...params);
  }

  // Calcular comisión para un período
  calcularComisionPeriodo(vendedorId, fechaDesde, fechaHasta) {
    console.log(`🔢 Calculando comisión para vendedor ${vendedorId} desde ${fechaDesde} hasta ${fechaHasta}`);

    // Obtener configuración del vendedor
    const config = this.getConfigVendedor(vendedorId);
    if (!config) {
      throw new Error('No se encontró configuración para el vendedor');
    }

    console.log(`⚙️ Configuración: ${config.porcentaje_comision}% sobre ${config.base_calculo}`);

    // Obtener movimientos
    const movimientos = this.getMovimientosParaComision(
      vendedorId, 
      fechaDesde, 
      fechaHasta, 
      config.base_calculo
    );

    console.log(`📊 Encontrados ${movimientos.length} movimientos`);

    // Calcular base comisionable
    let totalBase = 0;
    const detalles = [];
    const clientesUnicos = new Set();

    movimientos.forEach(mov => {
      let baseComisionable = 0;
      
      // Calcular base según tipo de movimiento
      if (config.base_calculo === 'venta' && mov.tipo_movimiento === 'Venta') {
        baseComisionable = Math.abs(mov.importe);
      } else if (config.base_calculo === 'pago' && mov.tipo_movimiento === 'Pago') {
        baseComisionable = Math.abs(mov.importe);
      } else if (config.base_calculo === 'cobro' && 
                 (mov.tipo_movimiento === 'Pago' || mov.tipo_movimiento === 'Nota de Crédito')) {
        baseComisionable = Math.abs(mov.importe);
      }

      if (baseComisionable > 0) {
        const comisionMovimiento = (baseComisionable * config.porcentaje_comision) / 100;
        totalBase += baseComisionable;
        clientesUnicos.add(mov.cliente_id);

        detalles.push({
          movimiento_id: mov.id,
          cliente_id: mov.cliente_id,
          cliente_nombre: mov.cliente_nombre,
          fecha_movimiento: mov.fecha,
          tipo_movimiento: mov.tipo_movimiento,
          importe_movimiento: mov.importe,
          base_comisionable: baseComisionable,
          porcentaje_aplicado: config.porcentaje_comision,
          comision_calculada: comisionMovimiento
        });
      }
    });

    const totalComision = (totalBase * config.porcentaje_comision) / 100;
    const comisionFinal = Math.max(totalComision, config.minimo_comision || 0);

    console.log(`💰 Base: $${totalBase.toFixed(2)} | Comisión: $${comisionFinal.toFixed(2)}`);

    return {
      vendedor_id: vendedorId,
      vendedor_nombre: config.nombre,
      periodo_desde: fechaDesde,
      periodo_hasta: fechaHasta,
      configuracion: config,
      total_base: totalBase,
      total_comision: comisionFinal,
      cantidad_movimientos: detalles.length,
      cantidad_clientes: clientesUnicos.size,
      detalles: detalles
    };
  }

  // ===== NUEVOS MÉTODOS PARA LIQUIDACIONES AVANZADAS =====

  // Obtener adelantos pendientes de un vendedor
  getAdelantosPendientes(vendedorId) {
    return this.db.prepare(`
      SELECT * FROM adelantos_vendedor 
      WHERE vendedor_id = ? AND estado = 'pendiente'
      ORDER BY fecha_adelanto DESC
    `).all(vendedorId);
  }

  // Obtener dinero en mano de un vendedor
  getDineroEnMano(vendedorId) {
    return this.db.prepare(`
      SELECT * FROM dinero_en_mano_vendedor
      WHERE dv.vendedor_id = ? AND dv.estado = 'pendiente'
      ORDER BY dv.fecha_cobro DESC
    `).all(vendedorId);
  }

  // Calcular resumen de ajustes para un vendedor
  getResumenAjustes(vendedorId) {
    const adelantos = this.db.prepare(`
      SELECT COALESCE(SUM(monto), 0) as total
      FROM adelantos_vendedor 
      WHERE vendedor_id = ? AND estado = 'pendiente'
    `).get(vendedorId);

    const dineroEnMano = this.db.prepare(`
      SELECT COALESCE(SUM(monto), 0) as total
      FROM dinero_en_mano_vendedor 
      WHERE vendedor_id = ? AND estado = 'pendiente'
    `).get(vendedorId);

    return {
      adelantos_pendientes: adelantos.total,
      dinero_en_mano: dineroEnMano.total,
      ajuste_total: adelantos.total + dineroEnMano.total
    };
  }

  // Guardar liquidación avanzada - CORREGIDO ⭐
  guardarLiquidacionAvanzada(calculoComision, datosLiquidacion) {
    const transaction = this.db.transaction(() => {
      // Calcular el total neto
      const totalBruto = calculoComision.total_comision;
      const adelantos = datosLiquidacion.adelantos_otorgados || 0;
      const dineroEnMano = datosLiquidacion.dinero_en_mano || 0;
      const otrosDescuentos = datosLiquidacion.otros_descuentos || 0;
      const otrosBonos = datosLiquidacion.otros_bonos || 0;
      
      const totalNeto = totalBruto - adelantos - dineroEnMano - otrosDescuentos + otrosBonos;

      // ⭐ CORREGIDO: Usar nombres de columnas que existen en tu BD
      const stmtLiquidacion = this.db.prepare(`
        INSERT INTO liquidaciones_comision (
          vendedor_id, fecha_desde, fecha_hasta, base_calculo, porcentaje,
          total_base, total_comision, cantidad_movimientos, cantidad_clientes,
          adelantos_otorgados, dinero_en_mano, otros_descuentos, otros_bonos,
          total_neto, metodo_pago, referencia_pago, observaciones_liquidacion,
          estado, observaciones, fecha_entrega
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const resultLiquidacion = stmtLiquidacion.run(
        calculoComision.vendedor_id,
        calculoComision.periodo_desde || datosLiquidacion.fechaDesde,  // ✅ CORREGIDO
        calculoComision.periodo_hasta || datosLiquidacion.fechaHasta,   // ✅ CORREGIDO
        calculoComision.configuracion.base_calculo,
        calculoComision.configuracion.porcentaje_comision,
        calculoComision.total_base,
        calculoComision.total_comision,
        calculoComision.cantidad_movimientos,
        calculoComision.cantidad_clientes,
        adelantos,
        dineroEnMano,
        otrosDescuentos,
        otrosBonos,
        totalNeto,
        datosLiquidacion.metodo_pago || 'transferencia',
        datosLiquidacion.referencia_pago || '',
        datosLiquidacion.observaciones_liquidacion || '',
        'calculada',
        `Liquidación generada automáticamente`,
        datosLiquidacion.fecha_entrega || null
      );

      const liquidacionId = resultLiquidacion.lastInsertRowid;

      // Insertar detalles de comisiones
      const stmtDetalle = this.db.prepare(`
        INSERT INTO liquidacion_comision_detalles (
          liquidacion_id, movimiento_id, fecha_movimiento, cliente_nombre,
          tipo_movimiento, base_comisionable, comision_calculada
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      calculoComision.detalles.forEach(detalle => {
        stmtDetalle.run(
          liquidacionId,
          detalle.movimiento_id,
          detalle.fecha_movimiento,
          detalle.cliente_nombre,
          detalle.tipo_movimiento,
          detalle.base_comisionable,
          detalle.comision_calculada
        );
      });

      // Marcar adelantos como aplicados si se especificaron
      if (adelantos > 0) {
        this.db.prepare(`
          UPDATE adelantos_vendedor 
          SET estado = 'aplicado', liquidacion_aplicada_id = ?
          WHERE vendedor_id = ? AND estado = 'pendiente'
        `).run(liquidacionId, calculoComision.vendedor_id);
      }

      // Marcar dinero en mano como aplicado si se especificó
      if (dineroEnMano > 0) {
        this.db.prepare(`
          UPDATE dinero_en_mano_vendedor 
          SET estado = 'aplicado', liquidacion_aplicada_id = ?
          WHERE vendedor_id = ? AND estado = 'pendiente'
        `).run(liquidacionId, calculoComision.vendedor_id);
      }

      return liquidacionId;
    });

    return transaction();
  }

  // Obtener liquidación completa con todos los detalles
  getLiquidacionCompleta(liquidacionId) {
    const liquidacion = this.db.prepare(`
      SELECT lc.*, u.nombre as vendedor_nombre, u.rol as vendedor_rol
      FROM liquidaciones_comision lc
      JOIN usuarios u ON lc.vendedor_id = u.id
      WHERE lc.id = ?
    `).get(liquidacionId);

    if (!liquidacion) return null;

    // Obtener detalles de comisiones
    const detalles = this.db.prepare(`
      SELECT * FROM liquidacion_comision_detalles
      WHERE liquidacion_id = ?
      ORDER BY fecha_movimiento
    `).all(liquidacionId);

    // Obtener adelantos aplicados
    const adelantosAplicados = this.db.prepare(`
      SELECT * FROM adelantos_vendedor
      WHERE liquidacion_aplicada_id = ?
      ORDER BY fecha_adelanto
    `).all(liquidacionId);

    // Obtener dinero en mano aplicado
    const dineroAplicado = this.db.prepare(`
      SELECT * FROM dinero_en_mano_vendedor
      WHERE dv.liquidacion_aplicada_id = ?
      ORDER BY dv.fecha_cobro
    `).all(liquidacionId);

    return {
      ...liquidacion,
      detalles: detalles,
      adelantos_aplicados: adelantosAplicados,
      dinero_aplicado: dineroAplicado
    };
  }

  // Registrar nuevo adelanto
  registrarAdelanto(vendedorId, adelanto, creadoPor) {
    return this.db.prepare(`
      INSERT INTO adelantos_vendedor 
      (vendedor_id, fecha_adelanto, monto, concepto)
      VALUES (?, ?, ?, ?)
    `).run(
      vendedorId,
      adelanto.fecha,
      adelanto.monto,
      adelanto.concepto || ''
    );
  }

  // Registrar dinero en mano
  registrarDineroEnMano(vendedorId, dinero) {
    return this.db.prepare(`
      INSERT INTO dinero_en_mano_vendedor 
      (vendedor_id, fecha_cobro, monto, cliente_nombre, concepto)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      vendedorId,
      dinero.fecha,
      dinero.monto,
      dinero.cliente_nombre || '',
      dinero.concepto || ''
    );
  }

  // ===== MÉTODOS EXISTENTES ACTUALIZADOS =====

  // Guardar liquidación simple (versión original con compatibilidad)
  guardarLiquidacion(calculoComision) {
    return this.guardarLiquidacionAvanzada(calculoComision, {});
  }

  // Obtener liquidaciones de un vendedor - CORREGIDO ⭐
  getLiquidacionesVendedor(vendedorId, limit = 10) {
    return this.db.prepare(`
      SELECT lc.*, u.nombre as vendedor_nombre
      FROM liquidaciones_comision lc
      JOIN usuarios u ON lc.vendedor_id = u.id
      WHERE lc.vendedor_id = ?
      ORDER BY lc.fecha_hasta DESC, lc.id DESC
      LIMIT ?
    `).all(vendedorId, limit);
  }

  // Obtener todas las liquidaciones (para admin) - CORREGIDO ⭐
  getAllLiquidaciones(limit = 20) {
    return this.db.prepare(`
      SELECT lc.*, u.nombre as vendedor_nombre
      FROM liquidaciones_comision lc
      JOIN usuarios u ON lc.vendedor_id = u.id
      ORDER BY lc.fecha_hasta DESC, lc.id DESC
      LIMIT ?
    `).all(limit);
  }

  // Obtener detalle de una liquidación (actualizado)
  getDetalleLiquidacion(liquidacionId) {
    return this.getLiquidacionCompleta(liquidacionId);
  }

  // Marcar liquidación como pagada
  marcarComoPagada(liquidacionId, fechaPago, observaciones) {
    return this.db.prepare(`
      UPDATE liquidaciones_comision 
      SET estado = 'pagada', 
          fecha_pago = ?, 
          observaciones = ?,
          firmado_admin = true
      WHERE id = ?
    `).run(fechaPago, observaciones, liquidacionId);
  }

  // Marcar como firmado por vendedor
  marcarFirmadoVendedor(liquidacionId) {
    return this.db.prepare(`
      UPDATE liquidaciones_comision 
      SET firmado_vendedor = true
      WHERE id = ?
    `).run(liquidacionId);
  }

  // Estadísticas de un vendedor por año - CORREGIDO ⭐
  getEstadisticasVendedor(vendedorId, año) {
    return this.db.prepare(`
      SELECT 
        COUNT(*) as total_liquidaciones,
        SUM(total_base) as total_base_anual,
        SUM(total_comision) as total_comision_anual,
        SUM(total_neto) as total_neto_anual,
        SUM(adelantos_otorgados) as total_adelantos,
        SUM(dinero_en_mano) as total_dinero_aplicado,
        AVG(total_comision) as promedio_comision,
        SUM(cantidad_movimientos) as total_movimientos,
        SUM(cantidad_clientes) as total_clientes_atendidos
      FROM liquidaciones_comision
      WHERE vendedor_id = ? 
      AND strftime('%Y', fecha_hasta) = ?
      AND estado != 'anulada'
    `).get(vendedorId, año.toString());
  }

  // Resumen para dashboard - CORREGIDO ⭐
  getResumenComisiones() {
    const resumen = this.db.prepare(`
      SELECT 
        COUNT(DISTINCT vendedor_id) as vendedores_activos,
        COUNT(*) as total_liquidaciones,
        SUM(total_comision) as total_comisiones_calculadas,
        SUM(total_neto) as total_neto_calculado,
        SUM(CASE WHEN estado = 'pagada' THEN total_neto ELSE 0 END) as total_neto_pagado,
        SUM(CASE WHEN estado = 'calculada' THEN total_neto ELSE 0 END) as total_neto_pendiente,
        SUM(adelantos_otorgados) as total_adelantos,
        SUM(dinero_en_mano) as total_dinero_aplicado
      FROM liquidaciones_comision
      WHERE strftime('%Y', fecha_hasta) = strftime('%Y', 'now')
    `).get();

    const porVendedor = this.db.prepare(`
      SELECT 
        u.nombre as vendedor,
        COUNT(*) as liquidaciones,
        SUM(lc.total_comision) as total_comision,
        SUM(lc.total_neto) as total_neto,
        SUM(CASE WHEN lc.estado = 'pagada' THEN lc.total_neto ELSE 0 END) as neto_pagado
      FROM liquidaciones_comision lc
      JOIN usuarios u ON lc.vendedor_id = u.id
      WHERE strftime('%Y', lc.fecha_hasta) = strftime('%Y', 'now')
      AND lc.estado != 'anulada'
      GROUP BY lc.vendedor_id, u.nombre
      ORDER BY total_neto DESC
    `).all();

    return {
      resumen: resumen,
      por_vendedor: porVendedor
    };
  }

  // Cerrar conexión
  close() {
    this.db.close();
  }
}

module.exports = ComisionesService;