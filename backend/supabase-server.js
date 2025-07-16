const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://cedspllucwvpoehlyccs.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlZHNwbGx1Y3d2cG9laGx5Y2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2MjkyMTQsImV4cCI6MjA2ODIwNTIxNH0.80z7k6ti2pxBKb8x6NILe--YNaLhJemtC32oqKW-Kz4';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('🚀 Servidor Feraben CRM iniciando con Supabase...');

// ===============================================
// UTILIDADES
// ===============================================

function calcularSaldoCliente(movimientos) {
  return movimientos.reduce((total, mov) => total + parseFloat(mov.importe), 0);
}

function formatearMoneda(amount) {
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: 'UYU',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatearFecha(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-UY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// ===============================================
// RUTAS BÁSICAS
// ===============================================

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Servidor Feraben CRM funcionando con Supabase' });
});

// ===============================================
// RUTAS DE CLIENTES
// ===============================================

app.get('/api/clientes', async (req, res) => {
  try {
    const { data: clientes, error } = await supabase
      .from('clientes')
      .select(`
        *,
        usuarios!vendedor_id (nombre)
      `)
      .eq('activo', true)
      .order('razon_social');
    
    if (error) throw error;
    
    // Obtener movimientos para calcular saldos
    const { data: todosMovimientos, error: movError } = await supabase
      .from('movimientos')
      .select('cliente_id, importe');
    
    if (movError) throw movError;
    
    // Calcular saldo para cada cliente
    const clientesConSaldo = clientes.map(cliente => {
      const movimientosCliente = todosMovimientos.filter(m => m.cliente_id === cliente.id);
      const saldo = calcularSaldoCliente(movimientosCliente);
      
      return {
        ...cliente,
        vendedor_nombre: cliente.usuarios?.nombre || 'Sin vendedor',
        saldo_actual: saldo
      };
    });
    
    res.json(clientesConSaldo);
  } catch (error) {
    console.error('Error obteniendo clientes:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/clientes/vendedor/:vendedorId', async (req, res) => {
  try {
    const { vendedorId } = req.params;
    
    const { data: clientes, error } = await supabase
      .from('clientes')
      .select(`
        *,
        usuarios!vendedor_id (nombre)
      `)
      .eq('vendedor_id', vendedorId)
      .eq('activo', true)
      .order('razon_social');
    
    if (error) throw error;
    
    // Obtener movimientos para calcular saldos
    const { data: todosMovimientos, error: movError } = await supabase
      .from('movimientos')
      .select('cliente_id, importe')
      .in('cliente_id', clientes.map(c => c.id));
    
    if (movError) throw movError;
    
    const clientesConSaldo = clientes.map(cliente => {
      const movimientosCliente = todosMovimientos.filter(m => m.cliente_id === cliente.id);
      const saldo = calcularSaldoCliente(movimientosCliente);
      
      return {
        ...cliente,
        vendedor_nombre: cliente.usuarios?.nombre || 'Sin vendedor',
        saldo_actual: saldo
      };
    });
    
    res.json(clientesConSaldo);
  } catch (error) {
    console.error('Error obteniendo clientes por vendedor:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/clientes/:clienteId/estado-cuenta', async (req, res) => {
  try {
    const { clienteId } = req.params;
    
    const { data: movimientos, error } = await supabase
      .from('movimientos')
      .select(`
        *,
        clientes!cliente_id (razon_social)
      `)
      .eq('cliente_id', clienteId)
      .order('fecha')
      .order('id');
    
    if (error) throw error;
    
    // Calcular saldo acumulado
    let saldo = 0;
    const estadoCuenta = movimientos.map(mov => {
      saldo += parseFloat(mov.importe);
      return {
        ...mov,
        cliente_nombre: mov.clientes?.razon_social || 'Cliente desconocido',
        saldo_acumulado: saldo
      };
    });
    
    res.json(estadoCuenta);
  } catch (error) {
    console.error('Error obteniendo estado de cuenta:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===============================================
// RUTAS DE MOVIMIENTOS
// ===============================================

app.get('/api/movimientos', async (req, res) => {
  try {
    const { data: movimientos, error } = await supabase
      .from('movimientos')
      .select(`
        *,
        clientes!cliente_id (razon_social),
        usuarios!vendedor_id (nombre)
      `)
      .order('fecha', { ascending: false })
      .order('id', { ascending: false });
    
    if (error) throw error;
    
    const movimientosFormateados = movimientos.map(mov => ({
      ...mov,
      cliente_nombre: mov.clientes?.razon_social || 'Cliente desconocido',
      vendedor_nombre: mov.usuarios?.nombre || 'Vendedor desconocido'
    }));
    
    res.json(movimientosFormateados);
  } catch (error) {
    console.error('Error obteniendo movimientos:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/movimientos', async (req, res) => {
  try {
    const { fecha, cliente_id, vendedor_id, tipo_movimiento, documento, importe, comentario } = req.body;
    
    // Ajustar importe según tipo de movimiento
    let importeFinal = parseFloat(importe);
    if (tipo_movimiento === 'Pago' || tipo_movimiento === 'Nota de Crédito') {
      importeFinal = Math.abs(importeFinal) * -1;
    } else {
      importeFinal = Math.abs(importeFinal);
    }
    
    const { data, error } = await supabase
      .from('movimientos')
      .insert([{
        fecha,
        cliente_id: parseInt(cliente_id),
        vendedor_id: parseInt(vendedor_id),
        tipo_movimiento,
        documento,
        importe: importeFinal,
        comentario
      }])
      .select();
    
    if (error) throw error;
    
    res.json({ 
      id: data[0].id,
      message: 'Movimiento creado exitosamente'
    });
  } catch (error) {
    console.error('Error creando movimiento:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===============================================
// RUTAS DE COMISIONES
// ===============================================

app.get('/api/comisiones/config', async (req, res) => {
  try {
    const { data: configs, error } = await supabase
      .from('vendedores_config')
      .select(`
        *,
        usuarios!usuario_id (nombre, rol)
      `)
      .eq('activo', true)
      .order('id');
    
    if (error) throw error;
    
    const configsFormateadas = configs.map(config => ({
      ...config,
      nombre: config.usuarios?.nombre || 'Usuario desconocido',
      rol: config.usuarios?.rol || 'vendedor'
    }));
    
    res.json(configsFormateadas);
  } catch (error) {
    console.error('Error obteniendo configuraciones:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/comisiones/config/:vendedorId', async (req, res) => {
  try {
    const { vendedorId } = req.params;
    
    const { data: config, error } = await supabase
      .from('vendedores_config')
      .select(`
        *,
        usuarios!usuario_id (nombre, rol)
      `)
      .eq('usuario_id', vendedorId)
      .eq('activo', true)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    if (!config) {
      return res.status(404).json({ error: 'Configuración no encontrada' });
    }
    
    const configFormateada = {
      ...config,
      nombre: config.usuarios?.nombre || 'Usuario desconocido',
      rol: config.usuarios?.rol || 'vendedor'
    };
    
    res.json(configFormateada);
  } catch (error) {
    console.error('Error obteniendo configuración:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===============================================
// RUTAS DE EXPORTACIÓN
// ===============================================

app.post('/api/clientes/:clienteId/exportar-estado-cuenta', async (req, res) => {
  try {
    const { clienteId } = req.params;
    const { formato, filtro, fechaDesde, fechaHasta } = req.body;
    
    console.log(`🎯 EXPORTACIÓN SOLICITADA - Cliente: ${clienteId}, Formato: ${formato}`);
    
    // Obtener datos del cliente
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select(`
        *,
        usuarios!vendedor_id (nombre)
      `)
      .eq('id', clienteId)
      .single();
    
    if (clienteError || !cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    // Obtener movimientos según filtro
    let query = supabase
      .from('movimientos')
      .select('*')
      .eq('cliente_id', clienteId);
    
    if (filtro === 'fechas' && fechaDesde && fechaHasta) {
      query = query.gte('fecha', fechaDesde).lte('fecha', fechaHasta);
    }
    
    const { data: movimientos, error: movError } = await query.order('fecha').order('id');
    
    if (movError) throw movError;
    
    // Calcular saldo acumulado
    let saldoAcumulado = 0;
    const movimientosConSaldo = movimientos.map(mov => {
      saldoAcumulado += parseFloat(mov.importe);
      return {
        ...mov,
        saldo_acumulado: saldoAcumulado
      };
    });
    
    const datosExportacion = {
      cliente: {
        ...cliente,
        vendedor_nombre: cliente.usuarios?.nombre || 'Sin vendedor'
      },
      empresa: {
        razon_social: 'Feraben SRL',
        rut: '020522780010',
        telefono: '097998999',
        email: 'ferabensrl@gmail.com',
        web: 'mareuy.com',
        direccion: 'Montevideo, Uruguay'
      },
      movimientos: movimientosConSaldo,
      saldoFinal: saldoAcumulado,
      fechaGeneracion: new Date().toISOString(),
      filtroAplicado: filtro
    };
    
    res.json({
      success: true,
      datos: datosExportacion,
      message: `Estado de cuenta generado (${movimientosConSaldo.length} movimientos)`
    });
    
  } catch (error) {
    console.error('❌ Error en exportación:', error);
    res.status(500).json({ error: error.message });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor Feraben CRM funcionando en puerto ${PORT}`);
  console.log(`📊 Conectado a Supabase: ${supabaseUrl}`);
  console.log(`\n🎯 TODAS LAS RUTAS DISPONIBLES:`);
  console.log(`   📈 Health: GET /api/health`);
  console.log(`   👥 Clientes: GET /api/clientes`);
  console.log(`   💰 Movimientos: GET /api/movimientos`);
  console.log(`   📄 Exportación: POST /api/clientes/:id/exportar-estado-cuenta`);
  console.log(`   ⚙️ Comisiones: GET /api/comisiones/config`);
  console.log(`\n✅ Backend completo listo!`);
});

module.exports = app;