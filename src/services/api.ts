// 🎯 API_BASE_URL CORREGIDO - Solo usar /api para Vercel
const API_BASE_URL = '/api';

export interface Cliente {
  id: number;
  rut: string;
  razon_social: string;
  nombre_fantasia?: string;
  email?: string;
  direccion?: string;
  ciudad?: string;
  departamento?: string;
  vendedor_id: number;
  vendedor_nombre?: string;
  activo: boolean;
  created_at: string;
}

export interface Movimiento {
  id: number;
  fecha: string;
  cliente_id: number;
  cliente_nombre: string;
  vendedor_id: number;
  vendedor_nombre: string;
  tipo_movimiento: 'Venta' | 'Pago' | 'Devolución';
  documento: string;
  importe: number;
  comentario?: string;
  created_at: string;
  saldo_acumulado?: number;
}

export interface Usuario {
  id: number;
  email: string;
  nombre: string;
  rol: 'admin' | 'vendedor';
  activo: boolean;
}

// ===== INTERFACES PARA COMISIONES =====

export interface ConfigVendedor {
  id: number;
  usuario_id: number;
  porcentaje_comision: number;
  base_calculo: 'venta' | 'pago' | 'cobro';
  minimo_comision: number;
  activo: boolean;
  fecha_desde: string;
  comentarios: string;
  created_at: string;
  updated_at: string;
  nombre: string;
  rol: string;
}

export interface CalculoComision {
  vendedor_id: number;
  vendedor_nombre: string;
  periodo_desde: string;
  periodo_hasta: string;
  configuracion: ConfigVendedor;
  total_base: number;
  total_comision: number;
  cantidad_movimientos: number;
  cantidad_clientes: number;
  detalles: DetalleComision[];
}

export interface DetalleComision {
  movimiento_id: number;
  cliente_id: number;
  cliente_nombre: string;
  fecha_movimiento: string;
  tipo_movimiento: string;
  importe_movimiento: number;
  base_comisionable: number;
  porcentaje_aplicado: number;
  comision_calculada: number;
}

export interface LiquidacionComision {
  id: number;
  vendedor_id: number;
  vendedor_nombre: string;
  periodo_desde: string;
  periodo_hasta: string;
  base_calculo: string;
  porcentaje: number;
  total_base: number;
  total_comision: number;
  cantidad_movimientos: number;
  cantidad_clientes: number;
  estado: 'calculada' | 'pagada' | 'anulada';
  fecha_pago?: string;
  observaciones?: string;
  created_at: string;
  updated_at: string;
}

export interface PeriodoSugerido {
  nombre: string;
  desde: string;
  hasta: string;
  descripcion: string;
}

export interface ResumenComisiones {
  resumen: {
    vendedores_activos: number;
    total_liquidaciones: number;
    total_comisiones_calculadas: number;
    total_comisiones_pagadas: number;
    total_comisiones_pendientes: number;
  };
  por_vendedor: Array<{
    vendedor: string;
    liquidaciones: number;
    total_comision: number;
    comision_pagada: number;
  }>;
}

class ApiService {
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      console.log(`🎯 API Request: ${config.method || 'GET'} ${url}`);
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`✅ API Response: ${url}`, data);
      return data;
    } catch (error) {
      console.error(`❌ API Error: ${url}`, error);
      throw error;
    }
  }

  // ===== MÉTODOS BÁSICOS =====

  // Health check
  async checkHealth(): Promise<{ status: string; message: string }> {
    return this.request('/health');
  }

  // Clientes
  async getClientes(): Promise<Cliente[]> {
    return this.request('/clientes');
  }

  async getClientesByVendedor(vendedorId: number): Promise<Cliente[]> {
    return this.request(`/clientes/vendedor/${vendedorId}`);
  }

  async getEstadoCuenta(clienteId: number): Promise<Movimiento[]> {
    return this.request(`/clientes/${clienteId}/estado-cuenta`);
  }

  // Movimientos
  async getMovimientos(): Promise<Movimiento[]> {
    return this.request('/movimientos');
  }

  async createMovimiento(movimiento: {
    fecha: string;
    cliente_id: number;
    vendedor_id: number;
    tipo_movimiento: string;
    documento: string;
    importe: number;
    comentario?: string;
  }): Promise<{ id: number; message: string }> {
    return this.request('/movimientos', {
      method: 'POST',
      body: JSON.stringify(movimiento),
    });
  }

  // ===== MÉTODOS PARA COMISIONES (SIMPLIFICADOS) =====

  // Configuración de vendedores
  async getConfiguracionesComision(): Promise<ConfigVendedor[]> {
    // Retornar datos mock mientras implementamos las APIs
    return [
      {
        id: 1,
        usuario_id: 2,
        porcentaje_comision: 15,
        base_calculo: 'pago',
        minimo_comision: 0,
        activo: true,
        fecha_desde: '2025-01-01',
        comentarios: 'Configuración estándar',
        created_at: '2025-01-01',
        updated_at: '2025-01-01',
        nombre: 'Mariela',
        rol: 'vendedor'
      }
    ];
  }

  async getConfiguracionVendedor(vendedorId: number): Promise<ConfigVendedor> {
    // Retornar configuración mock para Mariela
    return {
      id: 1,
      usuario_id: vendedorId,
      porcentaje_comision: 15,
      base_calculo: 'pago',
      minimo_comision: 0,
      activo: true,
      fecha_desde: '2025-01-01',
      comentarios: 'Configuración estándar',
      created_at: '2025-01-01',
      updated_at: '2025-01-01',
      nombre: vendedorId === 2 ? 'Mariela' : 'Vendedor',
      rol: 'vendedor'
    };
  }

  async updateConfiguracionVendedor(
    vendedorId: number, 
    config: {
      porcentaje_comision: number;
      base_calculo: 'venta' | 'pago' | 'cobro';
      minimo_comision: number;
      comentarios: string;
    }
  ): Promise<{ success: boolean; message: string; changes: number }> {
    // Mock response
    return { success: true, message: 'Configuración actualizada', changes: 1 };
  }

  // Cálculo y liquidación (MOCK)
  async calcularComision(
    vendedorId: number, 
    fechaDesde: string, 
    fechaHasta: string
  ): Promise<{ success: boolean; calculo: CalculoComision; message: string }> {
    // Mock de cálculo de comisión
    const mockCalculo: CalculoComision = {
      vendedor_id: vendedorId,
      vendedor_nombre: vendedorId === 2 ? 'Mariela' : 'Vendedor',
      periodo_desde: fechaDesde,
      periodo_hasta: fechaHasta,
      configuracion: await this.getConfiguracionVendedor(vendedorId),
      total_base: 50000,
      total_comision: 7500,
      cantidad_movimientos: 5,
      cantidad_clientes: 3,
      detalles: []
    };

    return { success: true, calculo: mockCalculo, message: 'Comisión calculada (DEMO)' };
  }

  async generarLiquidacion(
    vendedorId: number, 
    fechaDesde: string, 
    fechaHasta: string
  ): Promise<{ 
    success: boolean; 
    liquidacion_id: number; 
    calculo: CalculoComision; 
    message: string 
  }> {
    const calculo = await this.calcularComision(vendedorId, fechaDesde, fechaHasta);
    const liquidacionId = Date.now(); // ID temporal
    
    return {
      success: true,
      liquidacion_id: liquidacionId,
      calculo: calculo.calculo,
      message: `Liquidación #${liquidacionId} generada (DEMO)`
    };
  }

  // Consulta de liquidaciones (MOCK)
  async getLiquidacionesVendedor(vendedorId: number, limit = 10): Promise<LiquidacionComision[]> {
    return []; // Array vacío por ahora
  }

  async getAllLiquidaciones(limit = 20): Promise<LiquidacionComision[]> {
    return []; // Array vacío por ahora
  }

  async getDetalleLiquidacion(liquidacionId: number): Promise<LiquidacionComision & { detalles: DetalleComision[] }> {
    throw new Error('Funcionalidad en desarrollo');
  }

  async marcarLiquidacionPagada(
    liquidacionId: number, 
    fechaPago: string, 
    observaciones?: string
  ): Promise<{ success: boolean; message: string; changes: number }> {
    return { success: true, message: 'Marcada como pagada (DEMO)', changes: 1 };
  }

  // Estadísticas y reportes (MOCK)
  async getEstadisticasVendedor(vendedorId: number, año: number): Promise<any> {
    return { estadisticas: 'En desarrollo' };
  }

  async getResumenComisiones(): Promise<ResumenComisiones> {
    return {
      resumen: {
        vendedores_activos: 1,
        total_liquidaciones: 0,
        total_comisiones_calculadas: 0,
        total_comisiones_pagadas: 0,
        total_comisiones_pendientes: 0
      },
      por_vendedor: []
    };
  }

  async getPeriodosSugeridos(): Promise<PeriodoSugerido[]> {
    const hoy = new Date();
    const hace30dias = new Date();
    hace30dias.setDate(hoy.getDate() - 30);
    
    return [
      {
        nombre: 'Últimos 30 días',
        desde: hace30dias.toISOString().split('T')[0],
        hasta: hoy.toISOString().split('T')[0],
        descripcion: 'Período estándar'
      }
    ];
  }

  // ===== MÉTODOS UTILITARIOS =====

  // Calcular saldo de un cliente
  calcularSaldoCliente(movimientos: Movimiento[]): number {
    return movimientos.reduce((total, mov) => total + mov.importe, 0);
  }

  // Formatear moneda uruguaya
  formatearMoneda(amount: number): string {
    return new Intl.NumberFormat('es-UY', {
      style: 'currency',
      currency: 'UYU',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  // Formatear fecha
  formatearFecha(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-UY', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  // Formatear porcentaje
  formatearPorcentaje(porcentaje: number): string {
    return `${porcentaje.toFixed(2)}%`;
  }

  // Obtener descripción de base de cálculo
  getDescripcionBaseCalculo(base: string): string {
    const descripciones: Record<string, string> = {
      'venta': 'Sobre ventas realizadas',
      'pago': 'Sobre pagos recibidos',
      'cobro': 'Sobre pagos y notas de crédito'
    };
    return descripciones[base] || base;
  }

  // Obtener color de estado de liquidación
  getColorEstadoLiquidacion(estado: string): string {
    const colores: Record<string, string> = {
      'calculada': 'bg-blue-100 text-blue-800',
      'pagada': 'bg-green-100 text-green-800',
      'anulada': 'bg-red-100 text-red-800'
    };
    return colores[estado] || 'bg-gray-100 text-gray-800';
  }
}

export const apiService = new ApiService();
export default apiService;