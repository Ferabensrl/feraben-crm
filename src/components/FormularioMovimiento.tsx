import React, { useState, useEffect } from 'react';
import { X, Calculator, DollarSign, AlertCircle, CheckCircle } from 'lucide-react';
import apiService, { Cliente } from '../services/api';

export interface NuevoMovimiento {
  fecha: string;
  cliente_id: number;
  vendedor_id: number;
  tipo_movimiento: 'Venta' | 'Pago' | 'Nota de Crédito' | 'Ajuste de Saldo' | 'Reestablecimiento';
  documento: string;
  importe: number;
  comentario: string;
}

interface FormularioMovimientoProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (movimiento: NuevoMovimiento) => Promise<void>;
  clientes: Cliente[];
  vendedorId: number;
  loading: boolean;
}

export const FormularioMovimiento: React.FC<FormularioMovimientoProps> = ({
  isOpen,
  onClose,
  onSubmit,
  clientes,
  vendedorId,
  loading
}) => {
  const [formData, setFormData] = useState<NuevoMovimiento>({
    fecha: new Date().toISOString().split('T')[0],
    cliente_id: 0,
    vendedor_id: vendedorId,
    tipo_movimiento: 'Venta',
    documento: 'FAC-0001',
    importe: 0,
    comentario: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saldoActual, setSaldoActual] = useState<number | null>(null);
  const [saldoProyectado, setSaldoProyectado] = useState<number | null>(null);

  // Resetear formulario cuando se abre
  useEffect(() => {
    if (isOpen) {
        // Scroll hacia arriba inmediatamente
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
      setFormData({
        fecha: new Date().toISOString().split('T')[0],
        cliente_id: 0,
        vendedor_id: vendedorId,
        tipo_movimiento: 'Venta',
        documento: 'FAC-0001',
        importe: 0,
        comentario: ''
      });
      setErrors({});
      setSaldoActual(null);
      setSaldoProyectado(null);
    }
  }, [isOpen, vendedorId]);

  // Calcular saldo proyectado cuando cambia el importe
  useEffect(() => {
    if (saldoActual !== null && formData.importe > 0) {
      let importeFinal = formData.importe;
      
      // Ajustar signo según tipo de movimiento
      if (formData.tipo_movimiento === 'Pago' || formData.tipo_movimiento === 'Nota de Crédito') {
        importeFinal = -Math.abs(importeFinal);
      } else if (formData.tipo_movimiento === 'Ajuste de Saldo') {
        importeFinal = formData.importe;
      } else if (formData.tipo_movimiento === 'Reestablecimiento') {
        importeFinal = formData.importe - saldoActual;
      } else {
        importeFinal = Math.abs(importeFinal);
      }
      
      setSaldoProyectado(saldoActual + importeFinal);
    } else {
      setSaldoProyectado(null);
    }
  }, [saldoActual, formData.importe, formData.tipo_movimiento]);

  const obtenerSaldoCliente = async (clienteId: number) => {
    try {
      const response = await fetch(`http://localhost:5000/api/clientes/${clienteId}/estado-cuenta`);
      if (response.ok) {
        const movimientos = await response.json();
        const saldo = movimientos.reduce((total: number, mov: any) => total + mov.importe, 0);
        setSaldoActual(saldo);
      }
    } catch (error) {
      console.error('Error obteniendo saldo:', error);
    }
  };

  const generarNumeroDocumento = (tipo: string) => {
    const prefijos: Record<string, string> = {
      'Venta': 'FAC',
      'Pago': 'REC',
      'Nota de Crédito': 'NC',
      'Ajuste de Saldo': 'AJ',
      'Reestablecimiento': 'RST'
    };
    
    const numero = Math.floor(Math.random() * 9999) + 1;
    return `${prefijos[tipo]}-${numero.toString().padStart(4, '0')}`;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validar fecha
    if (!formData.fecha) {
      newErrors.fecha = 'La fecha es obligatoria';
    } else {
      const fechaMovimiento = new Date(formData.fecha);
      const hoy = new Date();
      hoy.setHours(23, 59, 59, 999);
      
      if (fechaMovimiento > hoy) {
        newErrors.fecha = 'La fecha no puede ser futura';
      }
    }

    // Validar cliente
    if (formData.cliente_id === 0) {
      newErrors.cliente_id = 'Debe seleccionar un cliente';
    }

    // Validar documento
    if (!formData.documento.trim()) {
      newErrors.documento = 'El número de documento es obligatorio';
    }

    // Validar importe
    if (formData.importe <= 0) {
      newErrors.importe = 'El importe debe ser mayor a cero';
    }

    // Validación especial para reestablecimiento
    if (formData.tipo_movimiento === 'Reestablecimiento' && saldoActual !== null) {
      if (formData.importe === saldoActual) {
        newErrors.importe = 'El saldo objetivo debe ser diferente al actual';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      let importeFinal = formData.importe;
      
      // Calcular importe final según tipo de movimiento
      if (formData.tipo_movimiento === 'Reestablecimiento' && saldoActual !== null) {
        importeFinal = formData.importe - saldoActual;
      } else if (formData.tipo_movimiento === 'Ajuste de Saldo') {
        importeFinal = formData.importe;
      }
      
      const movimientoFinal = {
        ...formData,
        importe: importeFinal
      };

      await onSubmit(movimientoFinal);
      onClose();
    } catch (error) {
      console.error('Error al crear movimiento:', error);
    }
  };

  const handleInputChange = (field: keyof NuevoMovimiento, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Limpiar error del campo cuando el usuario empiece a escribir
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleClienteChange = (clienteId: number) => {
    setFormData(prev => ({ ...prev, cliente_id: clienteId }));
    if (clienteId > 0) {
      obtenerSaldoCliente(clienteId);
    } else {
      setSaldoActual(null);
    }
  };

  const handleTipoChange = (tipo: NuevoMovimiento['tipo_movimiento']) => {
    const nuevoDocumento = generarNumeroDocumento(tipo);
    setFormData(prev => ({ 
      ...prev, 
      tipo_movimiento: tipo,
      documento: nuevoDocumento
    }));
  };

  const clienteSeleccionado = clientes.find(c => c.id === formData.cliente_id);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4" style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0}}>
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900">Nuevo Movimiento</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={loading}
            title="Cerrar"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Tipo de Movimiento */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Movimiento *
            </label>
            <select
              value={formData.tipo_movimiento}
              onChange={(e) => handleTipoChange(e.target.value as NuevoMovimiento['tipo_movimiento'])}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              <option value="Venta">💰 Venta - Aumenta deuda</option>
              <option value="Pago">💵 Pago - Reduce deuda</option>
              <option value="Nota de Crédito">📋 Nota de Crédito - Devolución</option>
              <option value="Ajuste de Saldo">⚖️ Ajuste de Saldo - Corrección manual</option>
              <option value="Reestablecimiento">🔄 Reestablecimiento - Fijar saldo específico</option>
            </select>
          </div>

          {/* Fecha y Cliente en una fila */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha *
              </label>
              <input
                type="date"
                value={formData.fecha}
                onChange={(e) => handleInputChange('fecha', e.target.value)}
                className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.fecha ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={loading}
              />
              {errors.fecha && (
                <p className="text-red-500 text-xs mt-1 flex items-center">
                  <AlertCircle size={12} className="mr-1" />
                  {errors.fecha}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cliente *
              </label>
              <select
                value={formData.cliente_id}
                onChange={(e) => handleClienteChange(parseInt(e.target.value))}
                className={`w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.cliente_id ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={loading}
              >
                <option value={0}>Seleccionar cliente...</option>
                {clientes.map(cliente => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.razon_social}
                  </option>
                ))}
              </select>
              {errors.cliente_id && (
                <p className="text-red-500 text-xs mt-1 flex items-center">
                  <AlertCircle size={12} className="mr-1" />
                  {errors.cliente_id}
                </p>
              )}
            </div>
          </div>

          {/* Documento e Importe */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Número de Documento *
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={formData.documento}
                  onChange={(e) => handleInputChange('documento', e.target.value)}
                  placeholder="FAC-0001, REC-0001, etc."
                  className={`flex-1 border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.documento ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => handleInputChange('documento', generarNumeroDocumento(formData.tipo_movimiento))}
                  className="bg-gray-100 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-200 transition-colors"
                  disabled={loading}
                >
                  Auto
                </button>
              </div>
              {errors.documento && (
                <p className="text-red-500 text-xs mt-1 flex items-center">
                  <AlertCircle size={12} className="mr-1" />
                  {errors.documento}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {formData.tipo_movimiento === 'Reestablecimiento' 
                  ? 'Saldo Objetivo *' 
                  : 'Importe *'
                }
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input
                  type="number"
                  value={formData.importe || ''}
                  onChange={(e) => handleInputChange('importe', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  step="0.01"
                  min={formData.tipo_movimiento === 'Ajuste de Saldo' ? undefined : "0.01"}
                  className={`w-full border rounded-md pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.importe ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={loading}
                />
              </div>
              {errors.importe && (
                <p className="text-red-500 text-xs mt-1 flex items-center">
                  <AlertCircle size={12} className="mr-1" />
                  {errors.importe}
                </p>
              )}
            </div>
          </div>

          {/* Comentario */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Comentario
            </label>
            <textarea
              value={formData.comentario}
              onChange={(e) => handleInputChange('comentario', e.target.value)}
              placeholder="Comentario opcional sobre el movimiento..."
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>

          {/* Preview de Saldos */}
          {clienteSeleccionado && saldoActual !== null && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                <Calculator size={16} className="mr-2" />
                Vista Previa - {clienteSeleccionado.razon_social}
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Saldo Actual:</span>
                  <div className={`font-semibold ${
                    saldoActual > 0 ? 'text-red-600' : saldoActual < 0 ? 'text-green-600' : 'text-gray-900'
                  }`}>
                    {apiService.formatearMoneda(saldoActual)}
                  </div>
                </div>
                
                <div>
                  <span className="text-gray-600">Movimiento:</span>
                  <div className={`font-semibold ${
                    formData.tipo_movimiento === 'Venta' ? 'text-blue-600' : 'text-green-600'
                  }`}>
                    {formData.tipo_movimiento === 'Reestablecimiento' && saldoActual !== null
                      ? `${formData.importe - saldoActual > 0 ? '+' : ''}${(formData.importe - saldoActual).toFixed(2)}`
                      : formData.tipo_movimiento === 'Pago' || formData.tipo_movimiento === 'Nota de Crédito'
                      ? `-${formData.importe.toFixed(2)}`
                      : `+${formData.importe.toFixed(2)}`
                    }
                  </div>
                </div>
                
                {saldoProyectado !== null && (
                  <div>
                    <span className="text-gray-600">Saldo Final:</span>
                    <div className={`font-semibold ${
                      saldoProyectado > 0 ? 'text-red-600' : saldoProyectado < 0 ? 'text-green-600' : 'text-gray-900'
                    }`}>
                      {apiService.formatearMoneda(saldoProyectado)}
                      {saldoProyectado === 0 && (
                        <CheckCircle size={14} className="inline ml-1 text-green-500" />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Botones */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Guardando...
                </>
              ) : (
                <>
                  <DollarSign size={16} className="mr-2" />
                  Crear Movimiento
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};