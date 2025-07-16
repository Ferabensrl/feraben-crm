const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5000/api' 
  : '/api';

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
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // ===== MÉTODOS EXISTENTES =====

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

  // ===== MÉTODOS PARA COMISIONES =====

  // Configuración de vendedores
  async getConfiguracionesComision(): Promise<ConfigVendedor[]> {
    return this.request('/comisiones/config');
  }

  async getConfiguracionVendedor(vendedorId: number): Promise<ConfigVendedor> {
    return this.request(`/comisiones/config/${vendedorId}`);
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
    return this.request(`/comisiones/config/${vendedorId}`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  }

  // Cálculo y liquidación
  async calcularComision(
    vendedorId: number, 
    fechaDesde: string, 
    fechaHasta: string
  ): Promise<{ success: boolean; calculo: CalculoComision; message: string }> {
    return this.request('/comisiones/calcular', {
      method: 'POST',
      body: JSON.stringify({
        vendedor_id: vendedorId,
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
      }),
    });
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
    return this.request('/comisiones/liquidar', {
      method: 'POST',
      body: JSON.stringify({
        vendedor_id: vendedorId,
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
      }),
    });
  }

  // Consulta de liquidaciones
  async getLiquidacionesVendedor(vendedorId: number, limit = 10): Promise<LiquidacionComision[]> {
    return this.request(`/comisiones/liquidaciones/vendedor/${vendedorId}?limit=${limit}`);
  }

  async getAllLiquidaciones(limit = 20): Promise<LiquidacionComision[]> {
    return this.request(`/comisiones/liquidaciones?limit=${limit}`);
  }

  async getDetalleLiquidacion(liquidacionId: number): Promise<LiquidacionComision & { detalles: DetalleComision[] }> {
    return this.request(`/comisiones/liquidaciones/${liquidacionId}`);
  }

  async marcarLiquidacionPagada(
    liquidacionId: number, 
    fechaPago: string, 
    observaciones?: string
  ): Promise<{ success: boolean; message: string; changes: number }> {
    return this.request(`/comisiones/liquidaciones/${liquidacionId}/pagar`, {
      method: 'PUT',
      body: JSON.stringify({
        fecha_pago: fechaPago,
        observaciones: observaciones || '',
      }),
    });
  }

  // Estadísticas y reportes
  async getEstadisticasVendedor(vendedorId: number, año: number): Promise<any> {
    return this.request(`/comisiones/estadisticas/vendedor/${vendedorId}/${año}`);
  }

  async getResumenComisiones(): Promise<ResumenComisiones> {
    return this.request('/comisiones/resumen');
  }

  async getPeriodosSugeridos(): Promise<PeriodoSugerido[]> {
    return this.request('/comisiones/periodos-sugeridos');
  }

  // ===== MÉTODOS UTILITARIOS EXISTENTES =====

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