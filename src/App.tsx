import React, { useState, useEffect } from 'react';
import { Users, FileText, DollarSign, BarChart3, LogOut, Menu, X, Download, FileDown, Plus } from 'lucide-react';
import apiService, { Cliente, Movimiento } from './services/api';
import exportService from './services/exportService';
import './App.css';
import { FormularioMovimiento, NuevoMovimiento } from './components/FormularioMovimiento';
import ComisionesView from './components/ComisionesView';

// Tipos para el estado de la aplicación
interface AppState {
  currentUser: {
    id: number;
    nombre: string;
    rol: 'admin' | 'vendedor';
  } | null;
  activeView: 'dashboard' | 'clientes' | 'movimientos' | 'comisiones' | 'estado-cuenta';
  clientes: Cliente[];
  movimientos: Movimiento[];
  selectedClienteId: number | null;
  estadoCuentaMovimientos: Movimiento[];
  isLoading: boolean;
  isMobileMenuOpen: boolean;
}

function App() {
  const [state, setState] = useState<AppState>({
    currentUser: { id: 1, nombre: 'Fernando', rol: 'admin' }, // Por defecto Fernando
    activeView: 'dashboard',
    clientes: [],
    movimientos: [],
    selectedClienteId: null,
    estadoCuentaMovimientos: [],
    isLoading: true,
    isMobileMenuOpen: false,
  });

  // Cargar datos iniciales
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      const [clientesData, movimientosData] = await Promise.all([
        apiService.getClientes(),
        apiService.getMovimientos()
      ]);

      setState(prev => ({
        ...prev,
        clientes: clientesData,
        movimientos: movimientosData,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Error cargando datos:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleViewChange = (view: AppState['activeView']) => {
    setState(prev => ({
      ...prev,
      activeView: view,
      isMobileMenuOpen: false,
      selectedClienteId: view === 'estado-cuenta' ? prev.selectedClienteId : null,
    }));
  };

  const handleVerEstadoCuenta = async (clienteId: number) => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      const estadoCuenta = await apiService.getEstadoCuenta(clienteId);
      
      setState(prev => ({
        ...prev,
        activeView: 'estado-cuenta',
        selectedClienteId: clienteId,
        estadoCuentaMovimientos: estadoCuenta,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Error cargando estado de cuenta:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const toggleMobileMenu = () => {
    setState(prev => ({
      ...prev,
      isMobileMenuOpen: !prev.isMobileMenuOpen,
    }));
  };

  const handleLogout = () => {
    setState(prev => ({
      ...prev,
      currentUser: null,
      activeView: 'dashboard',
    }));
  };

  // Calcular estadísticas del dashboard según el rol del usuario
  const getStatsForUser = () => {
    if (state.currentUser?.rol === 'admin') {
      // Admin ve TODO
      return {
        totalClientes: state.clientes.length,
        clientesConDeuda: state.clientes.filter(c => {
          const movimientosCliente = state.movimientos.filter(m => m.cliente_id === c.id);
          const saldo = apiService.calcularSaldoCliente(movimientosCliente);
          return saldo > 0;
        }).length,
        totalDeuda: state.clientes.reduce((total, cliente) => {
          const movimientosCliente = state.movimientos.filter(m => m.cliente_id === cliente.id);
          const saldo = apiService.calcularSaldoCliente(movimientosCliente);
          return total + (saldo > 0 ? saldo : 0);
        }, 0),
        movimientosEsteMes: state.movimientos.filter(m => {
          const fecha = new Date(m.fecha);
          const ahora = new Date();
          return fecha.getMonth() === ahora.getMonth() && fecha.getFullYear() === ahora.getFullYear();
        }).length,
        tipoUsuario: 'admin'
      };
    } else {
      // Vendedor ve solo SU cartera
      const misClientes = state.clientes.filter(c => c.vendedor_id === state.currentUser?.id);
      const misMovimientos = state.movimientos.filter(m => m.vendedor_id === state.currentUser?.id);
      
      return {
        totalClientes: misClientes.length,
        clientesConDeuda: misClientes.filter(c => {
          const movimientosCliente = misMovimientos.filter(m => m.cliente_id === c.id);
          const saldo = apiService.calcularSaldoCliente(movimientosCliente);
          return saldo > 0;
        }).length,
        totalDeuda: misClientes.reduce((total, cliente) => {
          const movimientosCliente = misMovimientos.filter(m => m.cliente_id === cliente.id);
          const saldo = apiService.calcularSaldoCliente(movimientosCliente);
          return total + (saldo > 0 ? saldo : 0);
        }, 0),
        movimientosEsteMes: misMovimientos.filter(m => {
          const fecha = new Date(m.fecha);
          const ahora = new Date();
          return fecha.getMonth() === ahora.getMonth() && fecha.getFullYear() === ahora.getFullYear();
        }).length,
        tipoUsuario: 'vendedor'
      };
    }
  };

  const stats = getStatsForUser();

  if (!state.currentUser) {
    return <LoginScreen onLogin={(user) => setState(prev => ({ ...prev, currentUser: user }))} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleMobileMenu}
              className="md:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100"
              title="Menú"
            >
              {state.isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Feraben CRM</h1>
              <p className="text-sm text-gray-500">Sistema de gestión comercial</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{state.currentUser.nombre}</p>
              <p className="text-xs text-gray-500 capitalize">{state.currentUser.rol}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-md"
              title="Cerrar sesión"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`
          ${state.isMobileMenuOpen ? 'block' : 'hidden'} md:block
          w-64 bg-white shadow-sm border-r border-gray-200 min-h-screen
          absolute md:relative z-10 md:z-0
        `}>
          <nav className="p-4 space-y-2">
            <NavItem
              icon={<BarChart3 size={20} />}
              label="Dashboard"
              active={state.activeView === 'dashboard'}
              onClick={() => handleViewChange('dashboard')}
            />
            <NavItem
              icon={<Users size={20} />}
              label="Clientes"
              active={state.activeView === 'clientes'}
              onClick={() => handleViewChange('clientes')}
            />
            {state.currentUser.rol === 'admin' && (
              <>
                <NavItem
                  icon={<FileText size={20} />}
                  label="Movimientos"
                  active={state.activeView === 'movimientos'}
                  onClick={() => handleViewChange('movimientos')}
                />
                <NavItem
                  icon={<DollarSign size={20} />}
                  label="Comisiones"
                 active={state.activeView === 'comisiones'}
                  onClick={() => handleViewChange('comisiones')}
                />
              </>
            )}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {state.isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Cargando...</div>
            </div>
          ) : (
            <>
              {state.activeView === 'dashboard' && (
                <DashboardView 
                  stats={stats} 
                  currentUser={state.currentUser}
                />
              )}
              {state.activeView === 'clientes' && (
                <ClientesView 
                  clientes={state.clientes} 
                  movimientos={state.movimientos}
                  currentUser={state.currentUser}
                  onVerEstadoCuenta={handleVerEstadoCuenta}
                />
              )}
              {state.activeView === 'estado-cuenta' && state.selectedClienteId && (
                <EstadoCuentaView
                  clienteId={state.selectedClienteId}
                  clientes={state.clientes}
                  movimientos={state.estadoCuentaMovimientos}
                  onVolver={() => handleViewChange('clientes')}
                />
              )}
              {state.activeView === 'movimientos' && state.currentUser.rol === 'admin' && (
                <MovimientosView movimientos={state.movimientos} clientes={state.clientes} onRefresh={loadData} />
              )}
              {state.activeView === 'comisiones' && (
  <ComisionesView currentUser={state.currentUser} />
)}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// Componente de navegación
const NavItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`
      w-full flex items-center space-x-3 px-3 py-2 rounded-md text-left transition-colors
      ${active 
        ? 'bg-blue-50 text-blue-700 border border-blue-200' 
        : 'text-gray-700 hover:bg-gray-100'
      }
    `}
  >
    {icon}
    <span className="font-medium">{label}</span>
  </button>
);

// Vista de Dashboard
const DashboardView: React.FC<{ 
  stats: any; 
  currentUser: { id: number; nombre: string; rol: string } 
}> = ({ stats, currentUser }) => (
  <div>
    <div className="flex justify-between items-center mb-6">
      <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
      <div className="text-sm text-gray-500">
        {stats.tipoUsuario === 'admin' ? 
          'Vista general de la empresa' : 
          `Mi cartera - ${currentUser.nombre}`
        }
      </div>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <StatCard
        title={stats.tipoUsuario === 'admin' ? "Total Clientes" : "Mis Clientes"}
        value={stats.totalClientes}
        icon={<Users className="text-blue-500" size={24} />}
        color="blue"
      />
      <StatCard
        title="Clientes con Deuda"
        value={stats.clientesConDeuda}
        icon={<FileText className="text-orange-500" size={24} />}
        color="orange"
      />
      <StatCard
        title={stats.tipoUsuario === 'admin' ? "Total Deuda" : "Mi Cartera"}
        value={apiService.formatearMoneda(stats.totalDeuda)}
        icon={<DollarSign className="text-red-500" size={24} />}
        color="red"
      />
      <StatCard
        title="Movimientos (mes)"
        value={stats.movimientosEsteMes}
        icon={<BarChart3 className="text-green-500" size={24} />}
        color="green"
      />
    </div>

    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {stats.tipoUsuario === 'admin' ? 'Resumen Ejecutivo' : 'Mi Área de Trabajo'}
      </h3>
      <div className="space-y-3 text-sm text-gray-600">
        {stats.tipoUsuario === 'admin' ? (
          <>
            <p>✅ Sistema funcionando correctamente</p>
            <p>📊 Base de datos SQLite local</p>
            <p>🔒 Datos seguros en tu PC</p>
            <p>📱 Interfaz responsive para móviles</p>
            <p>👥 Acceso completo a todos los módulos</p>
            <p>💰 Sistema de comisiones integrado</p>
          </>
        ) : (
          <>
            <p>👤 Vendedor: {currentUser.nombre}</p>
            <p>🏢 Mis clientes: {stats.totalClientes}</p>
            <p>💰 Mi cartera: {apiService.formatearMoneda(stats.totalDeuda)}</p>
            <p>📊 Solo puedes ver tu información personal</p>
            <p>🔒 Acceso restringido por seguridad</p>
            <p>💼 Consulta tus comisiones en el módulo correspondiente</p>
          </>
        )}
      </div>
    </div>
  </div>
);

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

// Vista de Clientes
const ClientesView: React.FC<{
  clientes: Cliente[];
  movimientos: Movimiento[];
  currentUser: { id: number; rol: string };
  onVerEstadoCuenta: (clienteId: number) => void;
}> = ({ clientes, movimientos, currentUser, onVerEstadoCuenta }) => {
  const clientesFiltrados = currentUser.rol === 'admin' 
    ? clientes 
    : clientes.filter(c => c.vendedor_id === currentUser.id);

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Clientes</h2>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  RUT
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ubicación
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vendedor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Saldo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {clientesFiltrados.map((cliente) => {
                const movimientosCliente = movimientos.filter(m => m.cliente_id === cliente.id);
                const saldo = apiService.calcularSaldoCliente(movimientosCliente);
                
                return (
                  <tr key={cliente.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {cliente.razon_social}
                        </div>
                        {cliente.nombre_fantasia && (
                          <div className="text-sm text-gray-500">{cliente.nombre_fantasia}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {cliente.rut}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {cliente.ciudad}, {cliente.departamento}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {cliente.vendedor_nombre}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${
                        saldo > 0 ? 'text-red-600' : saldo < 0 ? 'text-green-600' : 'text-gray-900'
                      }`}>
                        {apiService.formatearMoneda(saldo)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button
                        onClick={() => onVerEstadoCuenta(cliente.id)}
                        className="bg-blue-600 text-white px-3 py-1 rounded-md text-xs hover:bg-blue-700 transition-colors"
                      >
                        Ver Estado
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Modal de exportación
const ExportModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onExport: (formato: 'pdf' | 'excel', filtro: string, fechaDesde?: string, fechaHasta?: string) => void;
  loading: boolean;
}> = ({ isOpen, onClose, onExport, loading }) => {
  const [formato, setFormato] = useState<'pdf' | 'excel'>('pdf');
  const [filtro, setFiltro] = useState('completo');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const handleExport = () => {
    onExport(formato, filtro, fechaDesde || undefined, fechaHasta || undefined);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Exportar Estado de Cuenta</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={loading}
            title="Cerrar"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Formato */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Formato de exportación
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="pdf"
                  checked={formato === 'pdf'}
                  onChange={(e) => setFormato(e.target.value as 'pdf')}
                  className="mr-2"
                  disabled={loading}
                />
                <FileDown size={16} className="mr-1" />
                PDF
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="excel"
                  checked={formato === 'excel'}
                  onChange={(e) => setFormato(e.target.value as 'excel')}
                  className="mr-2"
                  disabled={loading}
                />
                <FileText size={16} className="mr-1" />
                Excel
              </label>
            </div>
          </div>

          {/* Filtro */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filtro de movimientos
            </label>
            <select
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
              disabled={loading}
            >
              <option value="completo">Todos los movimientos</option>
              <option value="ultimo_saldo_cero">Desde último saldo en cero</option>
              <option value="fechas">Por rango de fechas</option>
            </select>
          </div>

          {/* Fechas (solo si se selecciona filtro por fechas) */}
          {filtro === 'fechas' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Desde
                </label>
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => setFechaDesde(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hasta
                </label>
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => setFechaHasta(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  disabled={loading}
                />
              </div>
            </div>
          )}

          {/* Botones */}
          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              onClick={handleExport}
              disabled={loading || (filtro === 'fechas' && (!fechaDesde || !fechaHasta))}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Exportando...
                </>
              ) : (
                <>
                  <Download size={16} className="mr-2" />
                  Exportar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Vista de Estado de Cuenta Detallado con exportación
const EstadoCuentaView: React.FC<{
  clienteId: number;
  clientes: Cliente[];
  movimientos: Movimiento[];
  onVolver: () => void;
}> = ({ clienteId, clientes, movimientos, onVolver }) => {
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const cliente = clientes.find(c => c.id === clienteId);
  
  if (!cliente) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Cliente no encontrado</p>
        <button onClick={onVolver} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md">
          Volver
        </button>
      </div>
    );
  }

  // Calcular saldo final
  const saldoFinal = apiService.calcularSaldoCliente(movimientos);
  
  // Agregar saldo acumulado a cada movimiento
  let saldoAcumulado = 0;
  const movimientosConSaldo = movimientos.map(mov => {
    saldoAcumulado += mov.importe;
    return {
      ...mov,
      saldo_acumulado: saldoAcumulado
    };
  });

  const handleExport = async (formato: 'pdf' | 'excel', filtro: string, fechaDesde?: string, fechaHasta?: string) => {
    try {
      setExportLoading(true);
      await exportService.exportarEstadoCuenta(
        clienteId,
        formato,
        filtro as any,
        fechaDesde,
        fechaHasta
      );
      setShowExportModal(false);
      alert('Estado de cuenta exportado exitosamente');
    } catch (error) {
      console.error('Error exportando:', error);
      alert('Error al exportar el estado de cuenta');
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div>
      {/* Header con información del cliente */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onVolver}
            className="flex items-center text-blue-600 hover:text-blue-700 transition-colors"
          >
            ← Volver a Clientes
          </button>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowExportModal(true)}
              className="bg-white border-2 border-green-600 text-green-800 font-semibold px-4 py-2 rounded-md hover:bg-green-50 transition-colors flex items-center"
              title="Exportar estado de cuenta"
            >
              <Download size={16} className="mr-2" />
              Exportar
            </button>
            <div className="text-right">
              <div className="text-sm text-gray-500">Saldo Actual</div>
              <div className={`text-2xl font-bold ${
                saldoFinal > 0 ? 'text-red-600' : saldoFinal < 0 ? 'text-green-600' : 'text-gray-900'
              }`}>
                {apiService.formatearMoneda(saldoFinal)}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Estado de Cuenta</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">Información del Cliente</h3>
              <div className="space-y-1 text-sm">
                <p><span className="font-medium">Razón Social:</span> {cliente.razon_social}</p>
                {cliente.nombre_fantasia && (
                  <p><span className="font-medium">Nombre Fantasía:</span> {cliente.nombre_fantasia}</p>
                )}
                <p><span className="font-medium">RUT:</span> {cliente.rut}</p>
                <p><span className="font-medium">Vendedor:</span> {cliente.vendedor_nombre}</p>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">Ubicación</h3>
              <div className="space-y-1 text-sm">
                <p><span className="font-medium">Dirección:</span> {cliente.direccion || 'No especificada'}</p>
                <p><span className="font-medium">Ciudad:</span> {cliente.ciudad}</p>
                <p><span className="font-medium">Departamento:</span> {cliente.departamento}</p>
                {cliente.email && (
                  <p><span className="font-medium">Email:</span> {cliente.email}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resumen de movimientos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Ventas</p>
              <p className="text-xl font-bold text-blue-600">
                {apiService.formatearMoneda(
                  movimientos
                    .filter(m => m.tipo_movimiento === 'Venta')
                    .reduce((sum, m) => sum + m.importe, 0)
                )}
              </p>
            </div>
            <div className="p-2 bg-blue-50 rounded-full">
              <DollarSign className="text-blue-500" size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Pagos</p>
              <p className="text-xl font-bold text-green-600">
                {apiService.formatearMoneda(
                  Math.abs(movimientos
                    .filter(m => m.tipo_movimiento === 'Pago')
                    .reduce((sum, m) => sum + m.importe, 0))
                )}
              </p>
            </div>
            <div className="p-2 bg-green-50 rounded-full">
              <BarChart3 className="text-green-500" size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Movimientos</p>
              <p className="text-xl font-bold text-gray-900">{movimientos.length}</p>
            </div>
            <div className="p-2 bg-gray-50 rounded-full">
              <FileText className="text-gray-500" size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de movimientos */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Historial de Movimientos</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Documento
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Importe
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Saldo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Comentario
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {movimientosConSaldo.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No hay movimientos registrados para este cliente
                  </td>
                </tr>
              ) : (
                movimientosConSaldo.map((movimiento, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {apiService.formatearFecha(movimiento.fecha)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        movimiento.tipo_movimiento === 'Venta' 
                          ? 'bg-blue-100 text-blue-800'
                          : movimiento.tipo_movimiento === 'Pago'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {movimiento.tipo_movimiento}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {movimiento.documento || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <span className={
                        movimiento.importe > 0 ? 'text-blue-600' : 'text-green-600'
                      }>
                        {apiService.formatearMoneda(movimiento.importe)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <span className={`${
                        movimiento.saldo_acumulado > 0 
                          ? 'text-red-600' 
                          : movimiento.saldo_acumulado < 0 
                          ? 'text-green-600' 
                          : 'text-gray-900'
                      }`}>
                        {apiService.formatearMoneda(movimiento.saldo_acumulado)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {movimiento.comentario || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de exportación */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        loading={exportLoading}
      />
    </div>
  );
};

// Vistas placeholder (las desarrollaremos después)
// Vista de Movimientos con formulario integrado
const MovimientosView: React.FC<{ 
  movimientos: Movimiento[]; 
  clientes: Cliente[];
  onRefresh: () => void;
}> = ({ movimientos, clientes, onRefresh }) => {
  const [showFormulario, setShowFormulario] = useState(false);
  const [formLoading, setFormLoading] = useState(false);

  const handleCrearMovimiento = async (movimiento: NuevoMovimiento) => {
    try {
      setFormLoading(true);
      
      await apiService.createMovimiento({
        fecha: movimiento.fecha,
        cliente_id: movimiento.cliente_id,
        vendedor_id: movimiento.vendedor_id,
        tipo_movimiento: movimiento.tipo_movimiento,
        documento: movimiento.documento,
        importe: movimiento.importe,
        comentario: movimiento.comentario || undefined,
      });

      setShowFormulario(false);
      onRefresh(); // Recargar datos
      alert('Movimiento creado exitosamente');
    } catch (error) {
      console.error('Error creando movimiento:', error);
      alert('Error al crear el movimiento');
    } finally {
      setFormLoading(false);
    }

    
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Movimientos</h2>
        <button
          onClick={() => setShowFormulario(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center"
        >
          <Plus size={20} className="mr-2" />
          Nuevo Movimiento
        </button>
      </div>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Documento
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Importe
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vendedor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Comentario
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {movimientos.slice(0, 50).map((movimiento, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {apiService.formatearFecha(movimiento.fecha)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {movimiento.cliente_nombre}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      movimiento.tipo_movimiento === 'Venta' 
                        ? 'bg-blue-100 text-blue-800'
                        : movimiento.tipo_movimiento === 'Pago'
                        ? 'bg-green-100 text-green-800'
                        :movimiento.tipo_movimiento === 'Devolución'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {movimiento.tipo_movimiento}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {movimiento.documento || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <span className={
                      movimiento.importe > 0 ? 'text-blue-600' : 'text-green-600'
                    }>
                      {apiService.formatearMoneda(movimiento.importe)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {movimiento.vendedor_nombre}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                    {movimiento.comentario || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {movimientos.length > 50 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Mostrando los primeros 50 movimientos de {movimientos.length} totales
            </p>
          </div>
        )}
      </div>

      {/* Formulario de movimiento */}
      <FormularioMovimiento
        isOpen={showFormulario}
        onClose={() => setShowFormulario(false)}
        onSubmit={handleCrearMovimiento}
        clientes={clientes}
        vendedorId={1} // Fernando
        loading={formLoading}
      />
    </div>
  );
};

// Pantalla de login simple
const LoginScreen: React.FC<{ onLogin: (user: any) => void }> = ({ onLogin }) => {
  const [selectedUser, setSelectedUser] = useState<'fernando' | 'mariela'>('fernando');

  const handleLogin = () => {
    const users = {
      fernando: { id: 1, nombre: 'Fernando', rol: 'admin' as const },
      mariela: { id: 2, nombre: 'Mariela', rol: 'vendedor' as const }
    };
    
    onLogin(users[selectedUser]);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-6">
          Feraben CRM
        </h1>
        
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Seleccionar usuario:</span>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value as 'fernando' | 'mariela')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
            >
              <option value="fernando">Fernando (Administrador)</option>
              <option value="mariela">Mariela (Vendedora)</option>
            </select>
          </label>
          
          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
          >
            Ingresar
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;