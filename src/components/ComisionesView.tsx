import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  Settings, 
  FileText, 
  TrendingUp, 
  Users, 
  Calendar,
  DollarSign,
  CheckCircle,
  Clock,
  AlertCircle,
  Plus,
  Download,
  Eye,
  Edit,
  Zap,
  Receipt
  // REMOVIDO: FilePdf - No existe en lucide-react
} from 'lucide-react';
import apiService from '../services/api';
import FormularioLiquidacionAvanzada from './FormularioLiquidacionAvanzada';
import exportLiquidacionService from '../services/exportLiquidacionService';

interface ComisionesViewProps {
  currentUser: {
    id: number;
    nombre: string;
    rol: 'admin' | 'vendedor';
  };
}

type VistaComisiones = 'dashboard' | 'calcular' | 'liquidaciones' | 'configuracion';

const ComisionesView: React.FC<ComisionesViewProps> = ({ currentUser }) => {
  const [vistaActiva, setVistaActiva] = useState<VistaComisiones>('dashboard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados para cálculo
  const [vendedorSeleccionado, setVendedorSeleccionado] = useState<number>(
    currentUser.rol === 'vendedor' ? currentUser.id : 0
  );
  const [fechaDesde, setFechaDesde] = useState('2025-06-15');
  const [fechaHasta, setFechaHasta] = useState('2025-07-15');
  const [calculo, setCalculo] = useState<any>(null);
  const [configuraciones, setConfiguraciones] = useState<any[]>([]);
  const [liquidaciones, setLiquidaciones] = useState<any[]>([]);

  // Estados para el formulario avanzado
  const [showFormularioAvanzado, setShowFormularioAvanzado] = useState(false);

  // Cargar datos iniciales
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Cargar configuraciones
      const configs = currentUser.rol === 'admin' 
        ? await apiService.getConfiguracionesComision()
        : [await apiService.getConfiguracionVendedor(currentUser.id)];
      
      setConfiguraciones(configs);

      // Cargar liquidaciones
      const liq = currentUser.rol === 'admin'
        ? await apiService.getAllLiquidaciones(10)
        : await apiService.getLiquidacionesVendedor(currentUser.id, 10);
      
      setLiquidaciones(liq);
    } catch (error) {
      console.error('Error cargando datos:', error);
      setError('Error al cargar los datos de comisiones');
    } finally {
      setLoading(false);
    }
  };

  const handleCalcular = async () => {
    if (!vendedorSeleccionado || !fechaDesde || !fechaHasta) {
      setError('Todos los campos son obligatorios');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const resultado = await apiService.calcularComision(vendedorSeleccionado, fechaDesde, fechaHasta);
      setCalculo(resultado.calculo);
    } catch (error) {
      console.error('Error calculando comisión:', error);
      setError('Error al calcular la comisión');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerarLiquidacion = async () => {
    if (!calculo) return;

    // Abrir formulario avanzado en lugar de generar liquidación simple
    setShowFormularioAvanzado(true);
  };

  const handleLiquidacionAvanzadaCreada = () => {
    setCalculo(null); // Limpiar cálculo
    setShowFormularioAvanzado(false); // Cerrar formulario
    loadData(); // Recargar liquidaciones
  };

  const setPeriodoSugerido = (dias: number) => {
    const hoy = new Date();
    const desde = new Date();
    desde.setDate(hoy.getDate() - dias);
    
    setFechaDesde(desde.toISOString().split('T')[0]);
    setFechaHasta(hoy.toISOString().split('T')[0]);
  };

  const vendedoresDisponibles = currentUser.rol === 'admin' 
    ? configuraciones 
    : configuraciones.filter(c => c.usuario_id === currentUser.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sistema de Comisiones</h2>
          <p className="text-gray-600">
            {currentUser.rol === 'admin' 
              ? 'Gestión completa del sistema de comisiones'
              : `Mis comisiones - ${currentUser.nombre}`
            }
          </p>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-center">
            <AlertCircle size={16} className="text-red-500 mr-2" />
            <span className="text-red-700 text-sm">{error}</span>
          </div>
        )}
      </div>

      {/* Navegación de pestañas */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <TabButton
            active={vistaActiva === 'dashboard'}
            onClick={() => setVistaActiva('dashboard')}
            icon={<TrendingUp size={16} />}
            label="Dashboard"
          />
          
          <TabButton
            active={vistaActiva === 'calcular'}
            onClick={() => setVistaActiva('calcular')}
            icon={<Calculator size={16} />}
            label="Calcular"
          />
          
          <TabButton
            active={vistaActiva === 'liquidaciones'}
            onClick={() => setVistaActiva('liquidaciones')}
            icon={<FileText size={16} />}
            label="Liquidaciones"
          />

          {currentUser.rol === 'admin' && (
            <TabButton
              active={vistaActiva === 'configuracion'}
              onClick={() => setVistaActiva('configuracion')}
              icon={<Settings size={16} />}
              label="Configuración"
            />
          )}
        </nav>
      </div>

      {/* Contenido principal */}
      <div className="min-h-[500px]">
        {loading && vistaActiva === 'dashboard' ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500">Cargando datos de comisiones...</div>
          </div>
        ) : (
          <>
            {vistaActiva === 'dashboard' && (
              <DashboardComisiones 
                configuraciones={configuraciones}
                liquidaciones={liquidaciones}
                currentUser={currentUser}
              />
            )}
            
            {vistaActiva === 'calcular' && (
              <CalcularComisiones 
                vendedoresDisponibles={vendedoresDisponibles}
                vendedorSeleccionado={vendedorSeleccionado}
                setVendedorSeleccionado={setVendedorSeleccionado}
                fechaDesde={fechaDesde}
                setFechaDesde={setFechaDesde}
                fechaHasta={fechaHasta}
                setFechaHasta={setFechaHasta}
                calculo={calculo}
                loading={loading}
                onCalcular={handleCalcular}
                onGenerarLiquidacion={handleGenerarLiquidacion}
                setPeriodoSugerido={setPeriodoSugerido}
                currentUser={currentUser}
              />
            )}
            
            {vistaActiva === 'liquidaciones' && (
              <LiquidacionesComisiones 
                liquidaciones={liquidaciones}
                currentUser={currentUser}
                onUpdate={loadData}
              />
            )}

            {vistaActiva === 'configuracion' && currentUser.rol === 'admin' && (
              <ConfiguracionComisiones 
                configuraciones={configuraciones}
                onUpdate={loadData}
              />
            )}
          </>
        )}
      </div>

      {/* Formulario de Liquidación Avanzada */}
      <FormularioLiquidacionAvanzada
        isOpen={showFormularioAvanzado}
        onClose={() => setShowFormularioAvanzado(false)}
        calculo={calculo}
        vendedorId={vendedorSeleccionado}
        onLiquidacionCreada={handleLiquidacionAvanzadaCreada}
      />
    </div>
  );
};

// Componente de botón de pestaña
const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}> = ({ active, onClick, icon, label }) => (
  <button
    onClick={onClick}
    className={`
      group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors
      ${active
        ? 'border-blue-500 text-blue-600'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }
    `}
  >
    <span className="mr-2">{icon}</span>
    {label}
  </button>
);

// Dashboard de comisiones
const DashboardComisiones: React.FC<{
  configuraciones: any[];
  liquidaciones: any[];
  currentUser: { id: number; nombre: string; rol: string };
}> = ({ configuraciones, liquidaciones, currentUser }) => {
  
  const miConfig = configuraciones.find(c => c.usuario_id === currentUser.id);
  const misLiquidaciones = currentUser.rol === 'admin' 
    ? liquidaciones 
    : liquidaciones.filter(l => l.vendedor_id === currentUser.id);

  const totalComision = misLiquidaciones.reduce((sum, l) => sum + l.total_comision, 0);
  const comisionPagada = misLiquidaciones
    .filter(l => l.estado === 'pagada')
    .reduce((sum, l) => sum + l.total_comision, 0);

  return (
    <div className="space-y-6">
      {/* Estadísticas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title={currentUser.rol === 'admin' ? "Vendedores Activos" : "Mi Configuración"}
          value={currentUser.rol === 'admin' ? configuraciones.length : (miConfig ? `${miConfig.porcentaje_comision}%` : '0%')}
          icon={<Users className="text-blue-500" size={24} />}
          color="blue"
        />
        <StatCard
          title="Total Liquidaciones"
          value={misLiquidaciones.length}
          icon={<FileText className="text-green-500" size={24} />}
          color="green"
        />
        <StatCard
          title="Total Comisiones"
          value={apiService.formatearMoneda(totalComision)}
          icon={<DollarSign className="text-purple-500" size={24} />}
          color="purple"
        />
        <StatCard
          title={currentUser.rol === 'admin' ? "Comisiones Pagadas" : "Ya Cobrado"}
          value={apiService.formatearMoneda(comisionPagada)}
          icon={<CheckCircle className="text-green-500" size={24} />}
          color="green"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mi configuración / Configuraciones activas */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Settings size={20} className="mr-2 text-gray-600" />
            {currentUser.rol === 'admin' ? 'Configuraciones Activas' : 'Mi Configuración'}
          </h3>
          
          {currentUser.rol === 'admin' ? (
            <div className="space-y-3">
              {configuraciones.slice(0, 3).map(config => (
                <div key={config.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                  <div>
                    <div className="font-medium text-gray-900">{config.nombre}</div>
                    <div className="text-sm text-gray-500">
                      {config.porcentaje_comision}% sobre {config.base_calculo}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {config.porcentaje_comision}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : miConfig ? (
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-blue-900 text-xl">
                    {miConfig.porcentaje_comision}%
                  </div>
                  <div className="text-blue-700 text-sm">
                    Sobre {miConfig.base_calculo === 'pago' ? 'pagos recibidos' : miConfig.base_calculo}
                  </div>
                  {miConfig.minimo_comision > 0 && (
                    <div className="text-blue-600 text-xs mt-1">
                      Mínimo: {apiService.formatearMoneda(miConfig.minimo_comision)}
                    </div>
                  )}
                </div>
              </div>
              {miConfig.comentarios && (
                <div className="mt-3 text-blue-700 text-sm">
                  💡 {miConfig.comentarios}
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-500 text-center py-4">
              No hay configuración definida
            </div>
          )}
        </div>

        {/* Liquidaciones recientes */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <FileText size={20} className="mr-2 text-gray-600" />
            Liquidaciones Recientes
          </h3>
          
          <div className="space-y-3">
            {misLiquidaciones.length > 0 ? (
              misLiquidaciones.slice(0, 5).map(liquidacion => (
                <div key={liquidacion.id} className="flex justify-between items-center p-3 border rounded-md hover:bg-gray-50">
                  <div>
                    <div className="font-medium text-gray-900">
                      {currentUser.rol === 'admin' ? liquidacion.vendedor_nombre : `Liquidación #${liquidacion.id}`}
                    </div>
                    <div className="text-sm text-gray-500">
                      {apiService.formatearFecha(liquidacion.periodo_desde)} - {apiService.formatearFecha(liquidacion.periodo_hasta)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">
                      {apiService.formatearMoneda(liquidacion.total_comision)}
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      liquidacion.estado === 'pagada' 
                        ? 'bg-green-100 text-green-800'
                        : liquidacion.estado === 'calculada'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {liquidacion.estado}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-gray-500 text-center py-4">
                No hay liquidaciones registradas
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Calculadora de comisiones
const CalcularComisiones: React.FC<{
  vendedoresDisponibles: any[];
  vendedorSeleccionado: number;
  setVendedorSeleccionado: (id: number) => void;
  fechaDesde: string;
  setFechaDesde: (fecha: string) => void;
  fechaHasta: string;
  setFechaHasta: (fecha: string) => void;
  calculo: any;
  loading: boolean;
  onCalcular: () => void;
  onGenerarLiquidacion: () => void;
  setPeriodoSugerido: (dias: number) => void;
  currentUser: { rol: string };
}> = ({ 
  vendedoresDisponibles, 
  vendedorSeleccionado, 
  setVendedorSeleccionado,
  fechaDesde, 
  setFechaDesde, 
  fechaHasta, 
  setFechaHasta,
  calculo, 
  loading, 
  onCalcular, 
  onGenerarLiquidacion, 
  setPeriodoSugerido,
  currentUser 
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
          <Calculator size={24} className="mr-2 text-blue-600" />
          Calcular Comisión
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Selección de vendedor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vendedor
            </label>
            <select
              value={vendedorSeleccionado}
              onChange={(e) => setVendedorSeleccionado(parseInt(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={currentUser.rol === 'vendedor'}
            >
              <option value={0}>Seleccionar vendedor...</option>
              {vendedoresDisponibles.map(config => (
                <option key={config.usuario_id} value={config.usuario_id}>
                  {config.nombre} ({config.porcentaje_comision}%)
                </option>
              ))}
            </select>
          </div>

          {/* Fecha desde */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha Desde
            </label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Fecha hasta */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha Hasta
            </label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Períodos sugeridos */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Períodos Sugeridos
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setPeriodoSugerido(7)}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-md text-sm transition-colors"
            >
              Últimos 7 días
            </button>
            <button
              onClick={() => setPeriodoSugerido(30)}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-md text-sm transition-colors"
            >
              Últimos 30 días
            </button>
            <button
              onClick={() => setPeriodoSugerido(90)}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-md text-sm transition-colors"
            >
              Últimos 3 meses
            </button>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex space-x-4">
          <button
            onClick={onCalcular}
            disabled={loading || !vendedorSeleccionado || !fechaDesde || !fechaHasta}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
          >
            <Calculator size={16} className="mr-2" />
            {loading ? 'Calculando...' : 'Calcular Comisión'}
          </button>

          {calculo && (
            <button
              onClick={onGenerarLiquidacion}
              disabled={loading}
              className="bg-green-100 text-black px-6 py-2 rounded-md hover:bg-green-200 disabled:bg-gray-300 flex items-center font-semibold shadow-md border border-green-400"
            >
              <Plus size={16} className="mr-2" />
              Generar Liquidación
            </button>
          )}
        </div>
      </div>

      {/* Resultados del cálculo */}
      {calculo && (
        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Zap size={20} className="mr-2 text-yellow-500" />
            Resultado del Cálculo - {calculo.vendedor_nombre}
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-blue-600 font-medium">Base Comisionable</div>
              <div className="text-2xl font-bold text-blue-900">
                {apiService.formatearMoneda(calculo.total_base)}
              </div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-green-600 font-medium">Total Comisión</div>
              <div className="text-2xl font-bold text-green-900">
                {apiService.formatearMoneda(calculo.total_comision)}
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-sm text-purple-600 font-medium">Movimientos</div>
              <div className="text-2xl font-bold text-purple-900">
                {calculo.cantidad_movimientos}
              </div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="text-sm text-orange-600 font-medium">Clientes</div>
              <div className="text-2xl font-bold text-orange-900">
                {calculo.cantidad_clientes}
              </div>
            </div>
          </div>

          {/* Configuración aplicada */}
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <h5 className="font-medium text-gray-900 mb-2">Configuración Aplicada:</h5>
            <div className="text-sm text-gray-700">
              <span className="font-medium">{calculo.configuracion.porcentaje_comision}%</span>
              {' '}sobre {calculo.configuracion.base_calculo === 'pago' ? 'pagos recibidos' : calculo.configuracion.base_calculo}
              {calculo.configuracion.minimo_comision > 0 && (
                <span> (mínimo: {apiService.formatearMoneda(calculo.configuracion.minimo_comision)})</span>
              )}
            </div>
          </div>

          {/* Detalle de movimientos */}
          {calculo.detalles && calculo.detalles.length > 0 && (
            <div>
              <h5 className="font-medium text-gray-900 mb-3">
                Detalle de Movimientos ({calculo.detalles.length})
              </h5>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Base</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Comisión</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {calculo.detalles.slice(0, 10).map((detalle: any, index: number) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-xs text-gray-900">
                          {apiService.formatearFecha(detalle.fecha_movimiento)}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-900">
                          {detalle.cliente_nombre}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-900">
                          {detalle.tipo_movimiento}
                        </td>
                        <td className="px-3 py-2 text-xs text-right text-gray-900">
                          {apiService.formatearMoneda(detalle.base_comisionable)}
                        </td>
                        <td className="px-3 py-2 text-xs text-right font-medium text-green-600">
                          {apiService.formatearMoneda(detalle.comision_calculada)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {calculo.detalles.length > 10 && (
                <div className="text-center text-sm text-gray-500 mt-2">
                  Mostrando 10 de {calculo.detalles.length} movimientos
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Componente de tarjeta de estadística
const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}> = ({ title, value, icon, color }) => (
  <div className="bg-white rounded-lg shadow p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
      <div className={`p-3 rounded-full bg-${color}-50`}>
        {icon}
      </div>
    </div>
  </div>
);

// Lista de liquidaciones (versión simplificada)
const LiquidacionesComisiones: React.FC<{
  liquidaciones: any[];
  currentUser: { id: number; nombre: string; rol: string };
  onUpdate: () => void;
}> = ({ liquidaciones, currentUser }) => {
  const [exportLoading, setExportLoading] = useState<number | null>(null);

  const liquidacionesFiltradas = currentUser.rol === 'admin' 
    ? liquidaciones 
    : liquidaciones.filter(l => l.vendedor_id === currentUser.id);

  const handleExportarExcel = async (liquidacionId: number) => {
  try {
    setExportLoading(liquidacionId);
    
    // Hacer la petición POST para generar Excel
    const response = await fetch(`http://localhost:5000/api/comisiones/liquidaciones/${liquidacionId}/exportar-excel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      // Crear link de descarga
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Recibo_Liquidacion_${liquidacionId}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } else {
      throw new Error('Error en la respuesta del servidor');
    }
    
  } catch (error) {
    console.error('Error exportando Excel:', error);
    alert('Error al generar el archivo Excel');
  } finally {
    setExportLoading(null);
  }
};

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-gray-900">
          {currentUser.rol === 'admin' ? 'Todas las Liquidaciones' : 'Mis Liquidaciones'}
        </h3>
        <div className="text-sm text-gray-500">
          {liquidacionesFiltradas.length} liquidación{liquidacionesFiltradas.length !== 1 ? 'es' : ''}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {currentUser.rol === 'admin' ? 'Vendedor' : 'Liquidación'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Período
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Base / Comisión
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                {currentUser.rol === 'admin' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {liquidacionesFiltradas.map((liquidacion) => (
                <tr key={liquidacion.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {currentUser.rol === 'admin' ? liquidacion.vendedor_nombre : `#${liquidacion.id}`}
                      </div>
                      <div className="text-sm text-gray-500">
                        {liquidacion.porcentaje}% sobre {liquidacion.base_calculo}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
  <div>
    <div>{apiService.formatearFecha(liquidacion.fecha_desde || liquidacion.periodo_desde)}</div>
    <div>al {apiService.formatearFecha(liquidacion.fecha_hasta || liquidacion.periodo_hasta)}</div>
  </div>
</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      <div>Base: {apiService.formatearMoneda(liquidacion.total_base)}</div>
                      <div className="font-semibold text-green-600">
                        Comisión: {apiService.formatearMoneda(liquidacion.total_comision)}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      liquidacion.estado === 'pagada' 
                        ? 'bg-green-100 text-green-800'
                        : liquidacion.estado === 'calculada'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {liquidacion.estado}
                    </span>
                    {liquidacion.fecha_pago && (
                      <div className="text-xs text-gray-500 mt-1">
                        Pagada: {apiService.formatearFecha(liquidacion.fecha_pago)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {apiService.formatearFecha(liquidacion.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleExportarExcel(liquidacion.id)}
                        disabled={exportLoading === liquidacion.id}
                        className="bg-green-100 text-black px-3 py-1 rounded text-xs hover:bg-green-200 disabled:bg-gray-300 flex items-center font-medium border border-green-300"
                        title="Exportar Excel"
                      >
                        {exportLoading === liquidacion.id ? (
                          <>
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                            Excel...
                          </>
                        ) : (
                          <>
                            <FileText size={12} className="mr-1" />
                             Excel
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {/* Ver detalle */}}
                        className="bg-blue-100 text-black px-3 py-1 rounded text-xs hover:bg-blue-200 flex items-center font-medium border border-blue-300"
                      >
                        <Eye size={12} className="mr-1" />
                        Ver
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {liquidacionesFiltradas.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <FileText size={48} className="mx-auto text-gray-300 mb-4" />
            <p>No hay liquidaciones registradas</p>
            <p className="text-sm">Las liquidaciones aparecerán aquí cuando las generes</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Configuración de comisiones (versión simplificada para admin)
const ConfiguracionComisiones: React.FC<{
  configuraciones: any[];
  onUpdate: () => void;
}> = ({ configuraciones, onUpdate }) => {
  const [editando, setEditando] = useState<number | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const handleEdit = (config: any) => {
    setEditando(config.usuario_id);
    setFormData({
      porcentaje_comision: config.porcentaje_comision,
      base_calculo: config.base_calculo,
      minimo_comision: config.minimo_comision,
      comentarios: config.comentarios
    });
  };

  const handleSave = async () => {
    if (!editando || !formData.porcentaje_comision) return;

    try {
      setLoading(true);
      await apiService.updateConfiguracionVendedor(editando, {
        porcentaje_comision: formData.porcentaje_comision,
        base_calculo: formData.base_calculo || 'pago',
        minimo_comision: formData.minimo_comision || 0,
        comentarios: formData.comentarios || ''
      });

      setEditando(null);
      setFormData({});
      onUpdate();
      alert('Configuración actualizada exitosamente');
    } catch (error) {
      console.error('Error actualizando configuración:', error);
      alert('Error al actualizar la configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditando(null);
    setFormData({});
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-gray-900">Configuración de Vendedores</h3>
        <div className="text-sm text-gray-500">
          {configuraciones.length} vendedor{configuraciones.length !== 1 ? 'es' : ''} configurado{configuraciones.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vendedor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Porcentaje
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Base de Cálculo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mínimo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {configuraciones.map((config) => (
                <tr key={config.usuario_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{config.nombre}</div>
                      <div className="text-sm text-gray-500 capitalize">{config.rol}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editando === config.usuario_id ? (
                      <input
                        type="number"
                        value={formData.porcentaje_comision || ''}
                        onChange={(e) => setFormData({ ...formData, porcentaje_comision: parseFloat(e.target.value) })}
                        className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                        min="0"
                        max="100"
                        step="0.01"
                      />
                    ) : (
                      <span className="text-sm font-medium text-gray-900">
                        {config.porcentaje_comision}%
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editando === config.usuario_id ? (
                      <select
                        value={formData.base_calculo || config.base_calculo}
                        onChange={(e) => setFormData({ ...formData, base_calculo: e.target.value })}
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                      >
                        <option value="venta">Ventas</option>
                        <option value="pago">Pagos</option>
                        <option value="cobro">Cobros</option>
                      </select>
                    ) : (
                      <span className="text-sm text-gray-900 capitalize">{config.base_calculo}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editando === config.usuario_id ? (
                      <input
                        type="number"
                        value={formData.minimo_comision || ''}
                        onChange={(e) => setFormData({ ...formData, minimo_comision: parseFloat(e.target.value) || 0 })}
                        className="w-24 border border-gray-300 rounded px-2 py-1 text-sm"
                        min="0"
                        step="0.01"
                        placeholder="0"
                      />
                    ) : (
                      <span className="text-sm text-gray-900">
                        {config.minimo_comision > 0 ? apiService.formatearMoneda(config.minimo_comision) : '-'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      config.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {config.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {editando === config.usuario_id ? (
                      <div className="flex space-x-2">
                        <button
                          onClick={handleSave}
                          disabled={loading}
                          className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 disabled:bg-gray-300"
                        >
                          {loading ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button
                          onClick={handleCancel}
                          disabled={loading}
                          className="bg-gray-600 text-white px-3 py-1 rounded text-xs hover:bg-gray-700"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEdit(config)}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 flex items-center"
                      >
                        <Edit size={12} className="mr-1" />
                        Editar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Información adicional */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <h4 className="font-medium text-blue-900 mb-2">💡 Información sobre la configuración:</h4>
        <ul className="text-blue-800 text-sm space-y-1">
          <li>• <strong>Ventas:</strong> Comisión sobre el monto total de ventas realizadas</li>
          <li>• <strong>Pagos:</strong> Comisión sobre los pagos efectivamente recibidos</li>
          <li>• <strong>Cobros:</strong> Comisión sobre pagos y notas de crédito</li>
          <li>• <strong>Mínimo:</strong> Comisión mínima garantizada por período</li>
        </ul>
      </div>
    </div>
  );
};

export default ComisionesView;