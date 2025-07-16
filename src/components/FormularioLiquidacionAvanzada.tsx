import React, { useState, useEffect } from 'react';
import { 
  X, 
  Calculator, 
  AlertCircle, 
  CheckCircle, 
  FileText, 
  CreditCard,
  Banknote,
  Zap
} from 'lucide-react';
import apiService from '../services/api';

interface FormularioLiquidacionAvanzadaProps {
  isOpen: boolean;
  onClose: () => void;
  calculo: any; // Cálculo de comisión preexistente
  vendedorId: number;
  onLiquidacionCreada: () => void;
}

export const FormularioLiquidacionAvanzada: React.FC<FormularioLiquidacionAvanzadaProps> = ({
  isOpen,
  onClose,
  calculo,
  vendedorId,
  onLiquidacionCreada
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Estados para ajustes
  const [adelantosPendientes, setAdelantosPendientes] = useState<any[]>([]);
  const [dineroEnMano, setDineroEnMano] = useState<any[]>([]);
  const [resumenAjustes, setResumenAjustes] = useState<any>({});

  // Estados del formulario
  const [formData, setFormData] = useState({
    adelantos_otorgados: 0,
    dinero_en_mano: 0,
    otros_descuentos: 0,
    otros_bonos: 0,
    metodo_pago: 'transferencia',
    referencia_pago: '',
    observaciones_liquidacion: '',
    fecha_entrega: new Date().toISOString().split('T')[0]
  });

  // Cargar datos cuando se abre el modal
  useEffect(() => {
    if (isOpen && vendedorId) {
      loadAjustes();
    }
  }, [isOpen, vendedorId]);

  const loadAjustes = async () => {
    try {
      setLoading(true);
      setError(null);

      const [adelantos, dinero, resumen] = await Promise.all([
        fetch(`http://localhost:5000/api/comisiones/adelantos/${vendedorId}`).then(r => r.json()),
        fetch(`http://localhost:5000/api/comisiones/dinero-mano/${vendedorId}`).then(r => r.json()),
        fetch(`http://localhost:5000/api/comisiones/ajustes/${vendedorId}`).then(r => r.json())
      ]);

      setAdelantosPendientes(adelantos);
      setDineroEnMano(dinero);
      setResumenAjustes(resumen);

      // Precargar valores automáticamente
      setFormData(prev => ({
        ...prev,
        adelantos_otorgados: resumen.adelantos_pendientes || 0,
        dinero_en_mano: resumen.dinero_en_mano || 0
      }));

    } catch (error) {
      console.error('Error cargando ajustes:', error);
      setError('Error al cargar los datos de ajustes');
    } finally {
      setLoading(false);
    }
  };

  const calcularTotalNeto = () => {
    if (!calculo) return 0;
    
    const comisionBruta = calculo.total_comision;
    const adelantos = formData.adelantos_otorgados;
    const dinero = formData.dinero_en_mano;
    const descuentos = formData.otros_descuentos;
    const bonos = formData.otros_bonos;
    
    return comisionBruta - adelantos - dinero - descuentos + bonos;
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!calculo) {
      setError('No hay cálculo de comisión disponible');
      return;
    }

    const totalNeto = calcularTotalNeto();
    
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('http://localhost:5000/api/comisiones/liquidar-avanzada', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vendedor_id: vendedorId,
          fecha_desde: calculo.periodo_desde,
          fecha_hasta: calculo.periodo_hasta,
          ...formData
        }),
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const resultado = await response.json();
      
      setSuccess(`¡Liquidación #${resultado.liquidacion_id} generada exitosamente!`);
      onLiquidacionCreada();
      
      // Cerrar modal después de 2 segundos
      setTimeout(() => {
        onClose();
        setSuccess(null);
      }, 2000);

    } catch (error) {
      console.error('Error generando liquidación:', error);
      setError('Error al generar la liquidación avanzada');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      adelantos_otorgados: resumenAjustes.adelantos_pendientes || 0,
      dinero_en_mano: resumenAjustes.dinero_en_mano || 0,
      otros_descuentos: 0,
      otros_bonos: 0,
      metodo_pago: 'transferencia',
      referencia_pago: '',
      observaciones_liquidacion: '',
      fecha_entrega: new Date().toISOString().split('T')[0]
    });
    setError(null);
    setSuccess(null);
  };

  if (!isOpen) return null;

  const totalNeto = calcularTotalNeto();
  const esNetoPositivo = totalNeto > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-blue-50">
          <div>
            <h3 className="text-xl font-semibold text-blue-900">Liquidación Avanzada de Comisión</h3>
            <p className="text-blue-700 text-sm">
              {calculo ? `${calculo.vendedor_nombre} - ${apiService.formatearFecha(calculo.periodo_desde)} al ${apiService.formatearFecha(calculo.periodo_hasta)}` : 'Cargando...'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={loading}
            title="Cerrar"
          >
            <X size={24} />
          </button>
        </div>

        {loading && !calculo ? (
          <div className="p-8 text-center">
            <div className="text-gray-500">Cargando datos de ajustes...</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Resumen de comisión calculada */}
            {calculo && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-2 flex items-center">
                  <Calculator size={20} className="mr-2" />
                  Comisión Calculada
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-green-700">Base Comisionable:</span>
                    <div className="font-semibold text-green-900">
                      {apiService.formatearMoneda(calculo.total_base)}
                    </div>
                  </div>
                  <div>
                    <span className="text-green-700">Porcentaje:</span>
                    <div className="font-semibold text-green-900">
                      {calculo.configuracion.porcentaje_comision}%
                    </div>
                  </div>
                  <div>
                    <span className="text-green-700">Movimientos:</span>
                    <div className="font-semibold text-green-900">
                      {calculo.cantidad_movimientos}
                    </div>
                  </div>
                  <div>
                    <span className="text-green-700">Comisión Bruta:</span>
                    <div className="font-bold text-green-900 text-lg">
                      {apiService.formatearMoneda(calculo.total_comision)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sección de Ajustes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Adelantos */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h4 className="font-semibold text-orange-900 mb-3 flex items-center">
                  <Banknote size={20} className="mr-2" />
                  Adelantos Otorgados
                </h4>
                
                {adelantosPendientes.length > 0 ? (
                  <div className="space-y-2 mb-3">
                    {adelantosPendientes.map(adelanto => (
                      <div key={adelanto.id} className="text-sm bg-white p-2 rounded border">
                        <div className="flex justify-between items-center">
                          <span>{apiService.formatearFecha(adelanto.fecha_adelanto)}</span>
                          <span className="font-semibold">{apiService.formatearMoneda(adelanto.monto)}</span>
                        </div>
                        <div className="text-orange-700 text-xs">{adelanto.motivo}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-orange-700 text-sm mb-3">No hay adelantos pendientes</p>
                )}

                <div>
                  <label className="block text-sm font-medium text-orange-800 mb-2">
                    Monto a Aplicar
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-orange-600">$</span>
                    <input
                      type="number"
                      value={formData.adelantos_otorgados}
                      onChange={(e) => handleInputChange('adelantos_otorgados', parseFloat(e.target.value) || 0)}
                      className="w-full border border-orange-300 rounded-md pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
              </div>

              {/* Dinero en Mano */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h4 className="font-semibold text-purple-900 mb-3 flex items-center">
                  <CreditCard size={20} className="mr-2" />
                  Dinero en Mano
                </h4>
                
                {dineroEnMano.length > 0 ? (
                  <div className="space-y-2 mb-3">
                    {dineroEnMano.map(dinero => (
                      <div key={dinero.id} className="text-sm bg-white p-2 rounded border">
                        <div className="flex justify-between items-center">
                          <span>{dinero.cliente_nombre}</span>
                          <span className="font-semibold">{apiService.formatearMoneda(dinero.monto)}</span>
                        </div>
                        <div className="text-purple-700 text-xs">
                          {apiService.formatearFecha(dinero.fecha_cobro)} - {dinero.concepto}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-purple-700 text-sm mb-3">No tiene dinero en mano</p>
                )}

                <div>
                  <label className="block text-sm font-medium text-purple-800 mb-2">
                    Monto a Aplicar
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-purple-600">$</span>
                    <input
                      type="number"
                      value={formData.dinero_en_mano}
                      onChange={(e) => handleInputChange('dinero_en_mano', parseFloat(e.target.value) || 0)}
                      className="w-full border border-purple-300 rounded-md pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Otros Ajustes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Otros Descuentos
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={formData.otros_descuentos}
                    onChange={(e) => handleInputChange('otros_descuentos', parseFloat(e.target.value) || 0)}
                    className="w-full border border-gray-300 rounded-md pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="0.01"
                    placeholder="Gastos, multas, etc."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bonos/Incentivos
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={formData.otros_bonos}
                    onChange={(e) => handleInputChange('otros_bonos', parseFloat(e.target.value) || 0)}
                    className="w-full border border-gray-300 rounded-md pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="0.01"
                    placeholder="Bonos por objetivos, etc."
                  />
                </div>
              </div>
            </div>

            {/* Cálculo Total Neto */}
            <div className={`p-4 rounded-lg border-2 ${
              esNetoPositivo 
                ? 'bg-green-50 border-green-300' 
                : 'bg-red-50 border-red-300'
            }`}>
              <h4 className={`font-bold text-lg mb-2 flex items-center ${
                esNetoPositivo ? 'text-green-900' : 'text-red-900'
              }`}>
                <Zap size={24} className="mr-2" />
                Cálculo Final
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Comisión Bruta:</span>
                    <span className="font-semibold">+{apiService.formatearMoneda(calculo?.total_comision || 0)}</span>
                  </div>
                  <div className="flex justify-between text-orange-700">
                    <span>Adelantos:</span>
                    <span>-{apiService.formatearMoneda(formData.adelantos_otorgados)}</span>
                  </div>
                  <div className="flex justify-between text-purple-700">
                    <span>Dinero en mano:</span>
                    <span>-{apiService.formatearMoneda(formData.dinero_en_mano)}</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>Otros descuentos:</span>
                    <span>-{apiService.formatearMoneda(formData.otros_descuentos)}</span>
                  </div>
                  <div className="flex justify-between text-blue-700">
                    <span>Bonos/Incentivos:</span>
                    <span>+{apiService.formatearMoneda(formData.otros_bonos)}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-center">
                  <div className="text-center">
                    <div className={`text-sm ${esNetoPositivo ? 'text-green-700' : 'text-red-700'}`}>
                      {esNetoPositivo ? 'Total a Pagar:' : 'Saldo a Favor Empresa:'}
                    </div>
                    <div className={`text-3xl font-bold ${esNetoPositivo ? 'text-green-900' : 'text-red-900'}`}>
                      {apiService.formatearMoneda(Math.abs(totalNeto))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Información de Pago */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Método de Pago
                </label>
                <select
                  value={formData.metodo_pago}
                  onChange={(e) => handleInputChange('metodo_pago', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="transferencia">Transferencia Bancaria</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="cheque">Cheque</option>
                  <option value="mixto">Mixto</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Referencia de Pago
                </label>
                <input
                  type="text"
                  value={formData.referencia_pago}
                  onChange={(e) => handleInputChange('referencia_pago', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nº transferencia, recibo, etc."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha de Entrega
              </label>
              <input
                type="date"
                value={formData.fecha_entrega}
                onChange={(e) => handleInputChange('fecha_entrega', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observaciones de la Liquidación
              </label>
              <textarea
                value={formData.observaciones_liquidacion}
                onChange={(e) => handleInputChange('observaciones_liquidacion', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Observaciones especiales, condiciones, etc."
              />
            </div>

            {/* Mensajes de estado */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-center">
                <AlertCircle size={16} className="text-red-500 mr-2 flex-shrink-0" />
                <span className="text-red-700 text-sm">{error}</span>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-md p-3 flex items-center">
                <CheckCircle size={16} className="text-green-500 mr-2 flex-shrink-0" />
                <span className="text-green-700 text-sm">{success}</span>
              </div>
            )}

            {/* Botones */}
            <div className="flex justify-between items-center pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={resetForm}
                disabled={loading}
                className="text-gray-600 hover:text-gray-800 px-4 py-2"
              >
                Resetear
              </button>
              
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-6 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !calculo}
                  className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Generando...
                    </>
                  ) : (
                    <>
                      <FileText size={16} className="mr-2" />
                      Generar Liquidación
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default FormularioLiquidacionAvanzada;