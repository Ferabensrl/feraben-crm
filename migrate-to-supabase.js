const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuración de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Conectar a SQLite local
const db = new Database('./backend/database/feraben.db');

async function migrateData() {
  console.log('🚀 INICIANDO MIGRACIÓN DE DATOS...\n');

  try {
    // ===== MIGRAR CLIENTES =====
    console.log('📋 Migrando clientes...');
    const clientes = db.prepare(`
      SELECT c.*, u.nombre as vendedor_nombre 
      FROM clientes c 
      LEFT JOIN usuarios u ON c.vendedor_id = u.id 
      WHERE c.activo = 1
    `).all();

    console.log(`   Encontrados: ${clientes.length} clientes`);

    if (clientes.length > 0) {
      // Migrar en lotes de 50
      for (let i = 0; i < clientes.length; i += 50) {
        const lote = clientes.slice(i, i + 50);
        
        const { error } = await supabase
          .from('clientes')
          .insert(lote.map(cliente => ({
            id: cliente.id,
            rut: cliente.rut,
            razon_social: cliente.razon_social,
            nombre_fantasia: cliente.nombre_fantasia,
            email: cliente.email,
            direccion: cliente.direccion,
            ciudad: cliente.ciudad,
            departamento: cliente.departamento,
            vendedor_id: cliente.vendedor_id,
            activo: cliente.activo,
            created_at: cliente.created_at
          })));

        if (error) {
          console.error(`   ❌ Error en lote ${i/50 + 1}:`, error.message);
        } else {
          console.log(`   ✅ Lote ${i/50 + 1} migrado (${lote.length} clientes)`);
        }
      }
    }

    // ===== MIGRAR MOVIMIENTOS =====
    console.log('\n💰 Migrando movimientos...');
    const movimientos = db.prepare(`
      SELECT * FROM movimientos 
      ORDER BY fecha, id
    `).all();

    console.log(`   Encontrados: ${movimientos.length} movimientos`);

    if (movimientos.length > 0) {
      // Migrar en lotes de 100
      for (let i = 0; i < movimientos.length; i += 100) {
        const lote = movimientos.slice(i, i + 100);
        
        const { error } = await supabase
          .from('movimientos')
          .insert(lote.map(mov => ({
            id: mov.id,
            fecha: mov.fecha,
            cliente_id: mov.cliente_id,
            vendedor_id: mov.vendedor_id,
            tipo_movimiento: mov.tipo_movimiento,
            documento: mov.documento,
            importe: mov.importe,
            comentario: mov.comentario,
            created_at: mov.created_at
          })));

        if (error) {
          console.error(`   ❌ Error en lote ${i/100 + 1}:`, error.message);
        } else {
          console.log(`   ✅ Lote ${i/100 + 1} migrado (${lote.length} movimientos)`);
        }
      }
    }

    // ===== VERIFICAR MIGRACIÓN =====
    console.log('\n🔍 Verificando migración...');
    
    const { data: clientesCount } = await supabase
      .from('clientes')
      .select('id', { count: 'exact' });
    
    const { data: movimientosCount } = await supabase
      .from('movimientos')
      .select('id', { count: 'exact' });

    console.log(`   📊 Clientes en Supabase: ${clientesCount?.length || 0}`);
    console.log(`   📊 Movimientos en Supabase: ${movimientosCount?.length || 0}`);

    console.log('\n🎉 ¡MIGRACIÓN COMPLETADA EXITOSAMENTE!');
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
  } finally {
    db.close();
  }
}

// Ejecutar migración
migrateData();