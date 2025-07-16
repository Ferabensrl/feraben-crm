const Database = require('better-sqlite3');
const path = require('path');

function configurarEmpresa() {
  console.log('🏢 CONFIGURANDO DATOS DE LA EMPRESA...\n');
  
  const db = new Database(path.join(__dirname, 'database', 'feraben.db'));
  
  try {
    // Crear tabla de configuración de empresa si no existe
    db.exec(`
      CREATE TABLE IF NOT EXISTS empresa_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clave TEXT UNIQUE NOT NULL,
        valor TEXT,
        descripcion TEXT,
        modificable BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Insertar/Actualizar datos de empresa
    const insertConfig = db.prepare(`
      INSERT OR REPLACE INTO empresa_config (clave, valor, descripcion, modificable)
      VALUES (?, ?, ?, ?)
    `);
    
    // Datos de Feraben SRL
    const datosEmpresa = [
      {
        clave: 'razon_social',
        valor: 'Feraben SRL',
        descripcion: 'Razón social de la empresa',
        modificable: 1
      },
      {
        clave: 'rut',
        valor: '020522780010',
        descripcion: 'RUT de la empresa',
        modificable: 1
      },
      {
        clave: 'telefono',
        valor: '097998999',
        descripcion: 'Teléfono de contacto',
        modificable: 1
      },
      {
        clave: 'email',
        valor: 'ferabensrl@gmail.com',
        descripcion: 'Email de contacto',
        modificable: 1
      },
      {
        clave: 'direccion',
        valor: '',
        descripcion: 'Dirección de la empresa',
        modificable: 1
      },
      {
        clave: 'ciudad',
        valor: 'Montevideo',
        descripcion: 'Ciudad',
        modificable: 1
      },
      {
        clave: 'web',
        valor: 'mareuy.com',
        descripcion: 'Sitio web',
        modificable: 1
      },
      {
        clave: 'logo_url',
        valor: '',
        descripcion: 'URL del logo para exportaciones',
        modificable: 1
      },
      {
        clave: 'version_sistema',
        valor: '1.0',
        descripcion: 'Versión del CRM',
        modificable: 0
      }
    ];
    
    console.log('📝 Insertando configuración de empresa...');
    
    datosEmpresa.forEach(dato => {
      insertConfig.run(dato.clave, dato.valor, dato.descripcion, dato.modificable);
      console.log(`   ✅ ${dato.descripcion}: ${dato.valor || 'No especificado'}`);
    });
    
    console.log('\n✅ ¡CONFIGURACIÓN DE EMPRESA COMPLETADA!\n');
    
    // Mostrar configuración actual
    const configuracion = db.prepare('SELECT * FROM empresa_config ORDER BY clave').all();
    
    console.log('📋 CONFIGURACIÓN ACTUAL:');
    configuracion.forEach(config => {
      console.log(`   ${config.clave}: ${config.valor || 'No especificado'} ${config.modificable ? '(modificable)' : '(fijo)'}`);
    });
    
    console.log('\n🔧 Para modificar estos datos en el futuro:');
    console.log('   - Ve a Configuración en el CRM');
    console.log('   - O ejecuta UPDATE en la tabla empresa_config');
    
  } catch (error) {
    console.error('❌ Error configurando empresa:', error);
  } finally {
    db.close();
  }
}

// Ejecutar configuración
configurarEmpresa();